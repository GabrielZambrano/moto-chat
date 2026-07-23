'use strict';
// Barredor de pedidos en espera. Responsabilidad unica: mientras un pedido siga
// "pendiente", envia recordatorios periodicos al cliente; si supera el tiempo
// maximo de espera, lo marca "no_atendido" y avisa que no se consiguio conductor.
//
// Se basa en el estado de la BD (creadoEn + recordatoriosEnviados), no en timers
// en memoria, para sobrevivir a reinicios del proceso.
const pedidosRepo = require('../repositories/pedidosRepo');
const whatsappService = require('./whatsappService');

const ESPERA_MIN = Number(process.env.PEDIDO_ESPERA_MINUTOS || 6);
const RECORDATORIO_MIN = Number(process.env.PEDIDO_RECORDATORIO_MINUTOS || 2);
const REPUBLICAR_MIN = Number(process.env.PEDIDO_REPUBLICAR_MINUTOS || 4);
const SWEEP_SEG = Number(process.env.PEDIDO_SWEEP_SEGUNDOS || 30);

function minutosDesde(fecha) {
  return (Date.now() - new Date(fecha).getTime()) / 60000;
}

// Procesa un pedido pendiente: expira o recuerda segun corresponda.
async function procesarPendiente(p) {
  const min = minutosDesde(p.creadoEn);

  // 1) ¿Ya supero el tiempo maximo de espera? -> no atendido.
  if (min >= ESPERA_MIN) {
    const marcado = await pedidosRepo.marcarNoAtendido(p.id);
    if (marcado) {
      await Promise.allSettled([
        whatsappService.noSeEncontroConductor(p.clienteTelefono, p.pedidoCode),
        whatsappService.notificarGrupoExpirado(p.pedidoCode),
      ]);
    }
    return;
  }

  // 2) ¿Toca reenviar los botones al grupo? (una sola vez, al llegar al umbral).
  if (REPUBLICAR_MIN > 0 && min >= REPUBLICAR_MIN) {
    const ok = await pedidosRepo.marcarRepublicado(p.id);
    if (ok) {
      const direccion = p.ubicDescripcion || p.ubicDireccionCompleta || 'Ubicación compartida';
      await whatsappService.publicarPedidoEnGrupo({ pedidoCode: p.pedidoCode, direccion, sector: p.sector });
    }
  }

  // 3) ¿Toca un recordatorio al cliente? Uno por cada intervalo cumplido,
  //    sin pasar del tiempo de espera. (recordatorio a los 2, 4 min... con espera 6).
  if (RECORDATORIO_MIN > 0) {
    const esperados = Math.min(
      Math.floor(min / RECORDATORIO_MIN),
      Math.ceil(ESPERA_MIN / RECORDATORIO_MIN) - 1, // no recordar justo al expirar
    );
    if (esperados > p.recordatoriosEnviados) {
      const ok = await pedidosRepo.incrementarRecordatorio(p.id);
      if (ok) await whatsappService.buscandoConductor(p.clienteTelefono, p.pedidoCode);
    }
  }
}

async function barrer() {
  try {
    const pendientes = await pedidosRepo.listarPendientes();
    for (const p of pendientes) {
      await procesarPendiente(p).catch((e) => console.error('[expiracion] pedido', p.pedidoCode, e.message));
    }
  } catch (err) {
    console.error('[expiracion] error barriendo:', err.message);
  }
}

let timer = null;
function iniciar() {
  if (timer) return;
  console.log(`[expiracion] barredor activo: espera=${ESPERA_MIN}min, recordatorio=${RECORDATORIO_MIN}min, cada ${SWEEP_SEG}s`);
  timer = setInterval(barrer, SWEEP_SEG * 1000);
  timer.unref?.(); // no bloquear el cierre del proceso
}
function detener() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { iniciar, detener, barrer, procesarPendiente };
