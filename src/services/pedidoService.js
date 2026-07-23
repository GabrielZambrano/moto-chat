'use strict';
// Crea pedidos y asigna conductor con bloqueo atomico anti-doble-asignacion.
const pedidosRepo = require('../repositories/pedidosRepo');
const conductoresRepo = require('../repositories/conductoresRepo');
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
      sector: ubicacion.sector,
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
  // a) Buscar el conductor (resuelve @lid -> numero real si hace falta).
  const conductor = await conductorService.buscarPorRemitente(telefonoConductor);
  if (!conductor) {
    console.warn(`[asignar] conductor NO registrado para remitente: ${telefonoConductor}`);
    // Avisar solo si tenemos un numero real (no un LID sin resolver, para no fallar con 400).
    if (!/@lid$/i.test(String(telefonoConductor))) {
      await whatsappService.conductorNoRegistrado(conductorService.limpiarTelefono(telefonoConductor)).catch(() => {});
    }
    return { ok: false, motivo: 'conductor_no_registrado' };
  }
  console.log(`[asignar] conductor: ${conductor.fullName} (unidad ${conductor.unit || '-'})`);

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
    direccionCompleta: pedido.ubicDireccionCompleta,
    lat: pedido.ubicLat,
    lng: pedido.ubicLng,
    mapsUrl: pedido.ubicMapsUrl,
  };

  const resultados = await Promise.allSettled([
    whatsappService.notificarCliente(pedido.clienteTelefono, conductor, minutosEta, pedidoCode),
    whatsappService.notificarConductor(conductor.phoneFull, pedidoCode, clienteInfo, minutosEta),
    whatsappService.notificarGrupoAceptado({ pedidoCode }),
  ]);
  const etiquetas = ['cliente', 'conductor', 'grupo'];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') console.log(`[asignar] notificacion ${etiquetas[i]}: OK`);
    else console.error(`[asignar] notificacion ${etiquetas[i]}: FALLO -> ${r.reason?.message || r.reason}`);
  });

  // Marcar al conductor como ocupado (se libera al finalizar o cancelar).
  await conductoresRepo.actualizarEstado(conductor.phoneFull, 'ocupado').catch(() => {});

  return { ok: true, pedido, conductor };
}

// FASE F - El cliente cancela su pedido activo (escribe "cancelar").
async function cancelarPedidoCliente(telefono) {
  const activo = await pedidosRepo.pedidoActivoDeCliente(telefono);
  if (!activo) return { ok: false, motivo: 'sin_pedido' };

  const cancelado = await pedidosRepo.cancelar(activo.id);

  const tareas = [whatsappService.pedidoCanceladoCliente(telefono, activo.pedidoCode)];
  // Si ya lo habia tomado un conductor, avisarle, avisar al grupo y liberarlo.
  if (activo.estado === 'aceptado' && activo.conductorId) {
    tareas.push(whatsappService.notificarConductorCancelado(activo.conductorId, activo.pedidoCode));
    tareas.push(whatsappService.notificarGrupoCancelado(activo.pedidoCode));
    await conductoresRepo.actualizarEstado(activo.conductorId, 'disponible').catch(() => {});
  }
  await Promise.allSettled(tareas);

  return { ok: true, pedido: cancelado };
}

// FASE G - El conductor pulsa "Llegué al punto".
// Avisa al cliente y le reenvia al conductor el boton "Finalizar pedido".
async function conductorLlego({ pedidoCode, telefonoConductor }) {
  const pedido = await pedidosRepo.buscarPorCode(pedidoCode);
  if (!pedido || pedido.estado !== 'aceptado') return { ok: false, motivo: 'no_activo' };
  await Promise.allSettled([
    whatsappService.avisarClienteConductorLlego(pedido.clienteTelefono, pedidoCode),
    whatsappService.enviarBotonFinalizar(pedido.conductorId || telefonoConductor, pedidoCode),
  ]);
  return { ok: true };
}

// FASE H - El conductor pulsa "Finalizar pedido".
// SOLO actualiza la BD (finalizado) y libera al conductor. No envia mensaje al cliente.
async function finalizarPedido({ pedidoCode }) {
  const pedido = await pedidosRepo.finalizar(pedidoCode); // atomico: solo si estaba aceptado
  if (!pedido) return { ok: false, motivo: 'no_finalizable' };
  // Liberar al conductor para que pueda aceptar otros viajes.
  if (pedido.conductorId) {
    await conductoresRepo.actualizarEstado(pedido.conductorId, 'disponible').catch(() => {});
    await whatsappService.confirmarFinalizadoConductor(pedido.conductorId, pedidoCode).catch(() => {});
  }
  return { ok: true, pedido };
}

module.exports = {
  crearPedido, asignarConductor, cancelarPedidoCliente, conductorLlego, finalizarPedido,
};
