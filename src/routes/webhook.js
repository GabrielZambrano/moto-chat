'use strict';
// Webhook de Green API: mensajes entrantes (cliente privado + botones del grupo).
const express = require('express');
const router = express.Router();

const chatbotService = require('../services/chatbotService');
const pedidoService = require('../services/pedidoService');

const RE_BOTON = /^ok_([A-Z0-9]{6})_(\d+)$/;
const RE_BOTON_DRV = /^drv_(llegue|fin)_([A-Z0-9]{6})$/i;

function limpiarId(chatId) {
  return String(chatId || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '');
}
function esGrupo(chatId) {
  return String(chatId || '').endsWith('@g.us');
}

// Claves a IGNORAR: el mensaje citado/contexto trae TODOS los botones del mensaje
// original, y confundiria la deteccion (tomaria el primero en vez del seleccionado).
const CLAVES_IGNORAR = new Set(['quotedMessage', 'quotedMessageData', 'contextInfo', 'quoted']);

// Busca en el payload (excluyendo el mensaje citado) un string que cumpla el regex,
// sin depender del nombre exacto del campo (varia segun el metodo de Green API).
function buscarCoincidencia(obj, re, prof = 0) {
  if (obj == null || prof > 6) return '';
  if (typeof obj === 'string') return re.test(obj) ? obj : '';
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (CLAVES_IGNORAR.has(k)) continue;
      const found = buscarCoincidencia(v, re, prof + 1);
      if (found) return found;
    }
  }
  return '';
}
const extraerBotonId = (obj) => buscarCoincidencia(obj, RE_BOTON);
const extraerBotonDrv = (obj) => buscarCoincidencia(obj, RE_BOTON_DRV);

// Procesamiento asincrono (el webhook ya respondio 200).
async function procesar(body) {
  try {
    if (body.typeWebhook && body.typeWebhook !== 'incomingMessageReceived') return;

    const senderData = body.senderData || {};
    const chatId = senderData.chatId;
    const msg = body.messageData || {};
    const type = msg.typeMessage;

    // --- Mensajes del grupo: solo nos interesa la aceptacion por boton ---
    if (esGrupo(chatId)) {
      const selectedId = extraerBotonId(msg);
      if (!selectedId) {
        // No es un boton nuestro. Si parecia un boton, volcamos la estructura para depurar.
        if (/button|interactive|template/i.test(type || '')) {
          console.log('[webhook grupo][raw sin id]', JSON.stringify(msg));
        }
        return;
      }
      // Remitente CRUDO (puede venir como @c.us o @lid); el servicio lo resuelve.
      const telefonoConductor = senderData.sender || senderData.chatId;
      const m = RE_BOTON.exec(selectedId);
      if (!m) return;
      const pedidoCode = m[1];
      const minutosEta = parseInt(m[2], 10);
      console.log(`[webhook grupo] boton "${selectedId}" -> aceptar #${pedidoCode} eta=${minutosEta}min remitente=${telefonoConductor}`);
      const r = await pedidoService.asignarConductor({ pedidoCode, minutosEta, telefonoConductor });
      console.log(`[webhook grupo] resultado #${pedidoCode}:`, JSON.stringify(r?.ok ? { ok: true, conductor: r.conductor?.fullName } : r));
      return;
    }

    // --- Chat privado (conductor por Green API) ---
    const telefono = limpiarId(chatId);
    const nombreWa = senderData.senderName || senderData.chatName || '';

    // Botones del conductor: "Llegué al punto" / "Finalizar pedido".
    // LOG TEMPORAL: ver la estructura real cuando llega un boton del conductor.
    if (/drv_(llegue|fin)_/i.test(JSON.stringify(msg))) {
      console.log('[webhook conductor][raw]', JSON.stringify(msg));
    }
    const botonDrv = extraerBotonDrv(msg);
    if (botonDrv) {
      const md = RE_BOTON_DRV.exec(botonDrv);
      const accion = md[1].toLowerCase();
      const pedidoCode = md[2].toUpperCase();
      console.log(`[webhook conductor] boton "${botonDrv}" de ${telefono} -> ${accion} #${pedidoCode}`);
      const r = accion === 'fin'
        ? await pedidoService.finalizarPedido({ pedidoCode })
        : await pedidoService.conductorLlego({ pedidoCode, telefonoConductor: telefono });
      console.log(`[webhook conductor] resultado ${accion} #${pedidoCode}:`, JSON.stringify(r));
      return;
    }

    if (type === 'locationMessage') {
      const loc = msg.locationMessageData || {};
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        await chatbotService.handleUbicacionCliente(telefono, lat, lng, nombreWa);
      }
      return;
    }

    if (type === 'textMessage' || type === 'extendedTextMessage') {
      const texto = msg.textMessageData?.textMessage
        || msg.extendedTextMessageData?.text
        || '';
      await chatbotService.handleTextoCliente(telefono, texto, nombreWa);
      return;
    }
  } catch (err) {
    console.error('[webhook greenapi] error:', err.message);
  }
}

router.post('/', (req, res) => {
  // Responder 200 de inmediato y procesar async.
  res.sendStatus(200);
  setImmediate(() => procesar(req.body || {}));
});

module.exports = router;
