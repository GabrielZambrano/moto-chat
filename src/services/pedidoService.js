'use strict';
// Crea pedidos y asigna conductor con bloqueo atomico anti-doble-asignacion.
const pedidosRepo = require('../repositories/pedidosRepo');
const conductorService = require('./conductorService');
const whatsappService = require('./whatsappService');

// FASE C - Crear el pedido y publicarlo en el grupo.
async function crearPedido({ clienteTelefono, clienteNombre, ubicacion }) {
  // 1) Crear el pedido en BD (estado pendiente) para obtener el pedidoCode.
  const pedido = await pedidosRepo.crear({ clienteTelefono, clienteNombre, ubicacion });

  // 2) Publicar en el grupo con botones de ETA (Green API).
  let waGroupMsgId = null;
  try {
    const res = await whatsappService.publicarPedidoEnGrupo({
      pedidoCode: pedido.pedidoCode,
      direccion: ubicacion.descripcion || ubicacion.direccionCompleta,
      mapsUrl: ubicacion.mapsUrl,
    });
    waGroupMsgId = res?.idMessage || null;
    if (waGroupMsgId) await pedidosRepo.setWaGroupMsgId(pedido.id, waGroupMsgId);
  } catch (err) {
    console.error('[pedidoService] error publicando en grupo:', err.message);
  }

  return { ...pedido, waGroupMsgId };
}

// FASE D - Un conductor acepta (boton del grupo).
async function asignarConductor({ pedidoCode, minutosEta, telefonoConductor }) {
  // a) Buscar el conductor por telefono.
  const conductor = await conductorService.buscarPorTelefono(telefonoConductor);
  if (!conductor) {
    const phone = conductorService.limpiarTelefono(telefonoConductor);
    await whatsappService.conductorNoRegistrado(phone);
    return { ok: false, motivo: 'conductor_no_registrado' };
  }

  // b) Verificar que exista pedido pendiente con ese code.
  const pendiente = await pedidosRepo.buscarPendientePorCode(pedidoCode);
  if (!pendiente) {
    await whatsappService.pedidoYaTomado(conductor.phoneFull, pedidoCode);
    return { ok: false, motivo: 'ya_tomado' };
  }

  // c) BLOQUEO ATOMICO: UPDATE ... WHERE estado='pendiente'.
  const pedido = await pedidosRepo.aceptar({ pedidoCode, conductor, minutosEta });
  if (!pedido) {
    // Otro conductor gano la carrera entre (b) y (c).
    await whatsappService.pedidoYaTomado(conductor.phoneFull, pedidoCode);
    return { ok: false, motivo: 'ya_tomado' };
  }

  // FASE E - Notificaciones finales en paralelo.
  const clienteInfo = {
    nombre: pedido.clienteNombre,
    telefono: pedido.clienteTelefono,
    descripcion: pedido.ubicDescripcion,
    mapsUrl: pedido.ubicMapsUrl,
  };

  await Promise.allSettled([
    whatsappService.notificarCliente(pedido.clienteTelefono, conductor, minutosEta),
    whatsappService.notificarConductor(conductor.phoneFull, pedidoCode, clienteInfo, minutosEta),
    whatsappService.notificarGrupoAceptado({
      pedidoCode, fullName: conductor.fullName, unit: conductor.unit, minutosEta,
    }),
  ]);

  return { ok: true, pedido, conductor };
}

module.exports = { crearPedido, asignarConductor };
