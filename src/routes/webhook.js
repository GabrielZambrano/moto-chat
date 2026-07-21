'use strict';
// Webhook de Green API: mensajes entrantes (cliente privado + botones del grupo).
const express = require('express');
const router = express.Router();

const chatbotService = require('../services/chatbotService');
const pedidoService = require('../services/pedidoService');

const RE_BOTON = /^ok_([A-Z0-9]{6})_(\d+)$/;

function limpiarId(chatId) {
  return String(chatId || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '');
}
function esGrupo(chatId) {
  return String(chatId || '').endsWith('@g.us');
}

// Procesamiento asincrono (el webhook ya respondio 200).
async function procesar(body) {
  try {
    if (body.typeWebhook && body.typeWebhook !== 'incomingMessageReceived') return;

    const senderData = body.senderData || {};
    const chatId = senderData.chatId;
    const msg = body.messageData || {};
    const type = msg.typeMessage;

    // --- Botones del grupo (aceptacion de conductor) ---
    const esBoton = type === 'buttonsResponseMessage'
      || type === 'interactiveButtonsResponse'
      || type === 'templateButtonReplyMessage';

    if (esGrupo(chatId) && esBoton) {
      const selectedId =
        msg.buttonsResponseMessage?.selectedButtonId
        || msg.interactiveButtons?.buttonId
        || msg.templateButtonReplyMessage?.selectedId
        || '';
      const m = RE_BOTON.exec(selectedId);
      if (!m) return;
      const pedidoCode = m[1];
      const minutosEta = parseInt(m[2], 10);
      const telefonoConductor = limpiarId(senderData.sender || senderData.chatId);
      await pedidoService.asignarConductor({ pedidoCode, minutosEta, telefonoConductor });
      return;
    }

    // Ignorar el resto de mensajes del grupo.
    if (esGrupo(chatId)) return;

    // --- Chat privado del cliente ---
    const telefono = limpiarId(chatId);
    const nombreWa = senderData.senderName || senderData.chatName || '';

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
