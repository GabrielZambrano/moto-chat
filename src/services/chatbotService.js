'use strict';
// Logica del chatbot: interpreta mensajes de texto y ubicaciones del cliente.
const clientesRepo = require('../repositories/clientesRepo');
const pedidosRepo = require('../repositories/pedidosRepo');
const pedidoService = require('./pedidoService');
const whatsappService = require('./whatsappService');
const geocodingService = require('./geocodingService');
const sectorService = require('./sectorService');

// Saludos e inicios de conversacion.
const RE_SALUDO = /\b(hola|buenas|buenos|buen[oa]s\s+(d[ií]as|tardes|noches)|hey|hi|start|inicio|menu)\b/i;
// Formas de pedir una moto/taxi: incluye "libre", "disponible", "algun", etc.
const RE_SOLICITUD = /\b(taxi|mototaxi|moto|servicio|viaje|carrera|necesito|quiero|pedir|solicit\w*|llamar|mandar|carro|libre|disponible|dispon\w*|alg[uú]n)\b/i;
const RE_CANCELAR = /\b(cancelar|cancela|cancelo|anular|anula|anulo)\b/i;

// FASE A - mensaje de texto del cliente.
async function handleTextoCliente(telefono, texto, nombreWa) {
  const cliente = await clientesRepo.ensure(telefono, nombreWa);
  const nombre = cliente.nombre || nombreWa || '';

  // Cancelacion: el cliente escribe "cancelar" -> anula su pedido activo y queda libre para pedir otro.
  if (RE_CANCELAR.test(texto || '')) {
    await clientesRepo.updateConversacion(telefono, 'ninguna');
    const r = await pedidoService.cancelarPedidoCliente(telefono);
    if (!r.ok) await whatsappService.sinPedidoActivo(telefono);
    return { accion: r.ok ? 'pedido_cancelado' : 'nada_que_cancelar' };
  }

  const quiereTaxi = RE_SOLICITUD.test(texto || '');
  const saluda = RE_SALUDO.test(texto || '');

  // Solo pedimos la ubicacion cuando el cliente REALMENTE solicita el servicio
  // (saludo o solicitud de moto/taxi). Asi no se le manda el boton "a cada rato"
  // ante cualquier palabra que escriba.
  if (quiereTaxi || saluda) {
    await clientesRepo.updateConversacion(telefono, 'esperando_ubicacion');
    await whatsappService.pedirUbicacion(telefono, nombre);
    return { accion: 'pedir_ubicacion' };
  }

  // Mensaje que no es una solicitud: no reenviamos el boton para no saturar al cliente.
  return { accion: 'sin_accion' };
}

// FASE B - el cliente comparte su ubicacion.
async function handleUbicacionCliente(telefono, lat, lng, nombreWa) {
  await clientesRepo.ensure(telefono, nombreWa);

  // 1) Reverse geocoding + deteccion de sector (poligono).
  const ubicacion = await geocodingService.reverseGeocode(lat, lng);
  ubicacion.sector = await sectorService.encontrarSector(lat, lng);

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

// FASE B2 - el cliente pulsa un boton (OK espero / Cancelar) tras recibir los datos.
const RE_BOTON_CLIENTE = /^cli_(ok|cancel)_([A-Z0-9]{6})$/i;
async function handleBotonCliente(telefono, buttonId, nombreWa) {
  const m = RE_BOTON_CLIENTE.exec(buttonId || '');
  if (!m) return { accion: 'boton_desconocido' };
  await clientesRepo.ensure(telefono, nombreWa);

  if (m[1].toLowerCase() === 'cancel') {
    await clientesRepo.updateConversacion(telefono, 'ninguna');
    const r = await pedidoService.cancelarPedidoCliente(telefono); // avisa al conductor y al grupo
    if (!r.ok) await whatsappService.sinPedidoActivo(telefono);
    return { accion: 'cliente_cancelo' };
  }
  // "OK, espero"
  await whatsappService.conductorEnCamino(telefono);
  return { accion: 'cliente_espera' };
}

module.exports = {
  handleTextoCliente, handleUbicacionCliente, handleBotonCliente,
  RE_SALUDO, RE_SOLICITUD, RE_BOTON_CLIENTE,
};
