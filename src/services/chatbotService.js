'use strict';
// Logica del chatbot: interpreta mensajes de texto y ubicaciones del cliente.
const clientesRepo = require('../repositories/clientesRepo');
const pedidosRepo = require('../repositories/pedidosRepo');
const pedidoService = require('./pedidoService');
const whatsappService = require('./whatsappService');
const geocodingService = require('./geocodingService');

const RE_SALUDO = /\b(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hi|hey|start|inicio|menu)\b/i;
const RE_SOLICITUD = /\b(taxi|mototaxi|moto|servicio|viaje|carrera|necesito|quiero|pedir|solicitar|llamar|mandar|carro)\b/i;

// FASE A - mensaje de texto del cliente.
async function handleTextoCliente(telefono, texto, nombreWa) {
  const cliente = await clientesRepo.ensure(telefono, nombreWa);
  const nombre = cliente.nombre || nombreWa || '';

  const quiereTaxi = RE_SOLICITUD.test(texto || '');
  const saluda = RE_SALUDO.test(texto || '');
  const sinConversacion = !cliente.conversacion || cliente.conversacion === 'ninguna';

  if (quiereTaxi || saluda || sinConversacion) {
    await clientesRepo.updateConversacion(telefono, 'esperando_ubicacion');
    await whatsappService.pedirUbicacion(telefono, nombre);
    return { accion: 'pedir_ubicacion' };
  }

  // Si ya esta esperando ubicacion, recordar como compartirla.
  await whatsappService.pedirUbicacion(telefono, nombre);
  return { accion: 'recordar_ubicacion' };
}

// FASE B - el cliente comparte su ubicacion.
async function handleUbicacionCliente(telefono, lat, lng, nombreWa) {
  await clientesRepo.ensure(telefono, nombreWa);

  // 1) Reverse geocoding.
  const ubicacion = await geocodingService.reverseGeocode(lat, lng);

  // 2) Confirmar al cliente.
  await whatsappService.confirmarUbicacion(telefono, ubicacion.descripcion, ubicacion.mapsUrl);

  // 3) Guardar en historial de direcciones.
  await clientesRepo.agregarDireccion(telefono, {
    direccion: ubicacion.descripcion,
    lat, lng, mapsUrl: ubicacion.mapsUrl,
  });

  // 4) Cerrar la conversacion.
  await clientesRepo.updateConversacion(telefono, 'ninguna');

  // 5) ANTI-DUPLICADO: si ya tiene pedido activo, avisar y no crear otro.
  const activo = await pedidosRepo.pedidoActivoDeCliente(telefono);
  if (activo) {
    await whatsappService.avisoPedidoActivo(telefono, activo.pedidoCode, activo.estado);
    return { accion: 'pedido_activo', pedido: activo };
  }

  // 6) Crear el pedido y publicarlo en el grupo.
  const cliente = await clientesRepo.get(telefono);
  const pedido = await pedidoService.crearPedido({
    clienteTelefono: telefono,
    clienteNombre: cliente?.nombre || nombreWa || null,
    ubicacion,
  });

  return { accion: 'pedido_creado', pedido };
}

module.exports = { handleTextoCliente, handleUbicacionCliente, RE_SALUDO, RE_SOLICITUD };
