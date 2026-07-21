'use strict';
// Webhook de YCloud (solo mensajes de cliente). Valida firma HMAC-SHA256.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const chatbotService = require('../services/chatbotService');

const SECRET = process.env.YCLOUD_WEBHOOK_SECRET || '';

function firmaValida(req) {
  if (!SECRET) return true; // si no hay secreto, se omite la validacion
  const signature = req.get('X-YCloud-Signature') || req.get('ycloud-signature') || '';
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const esperado = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(esperado));
  } catch {
    return false;
  }
}

async function procesar(body) {
  try {
    const evt = body.type || '';
    if (!evt.startsWith('whatsapp.inbound_message')) return;
    const m = body.whatsappInboundMessage || {};
    const telefono = String(m.from || '').replace(/^\+/, '');
    const nombreWa = m.customerProfile?.name || '';

    if (m.type === 'location' && m.location) {
      const lat = Number(m.location.latitude);
      const lng = Number(m.location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        await chatbotService.handleUbicacionCliente(telefono, lat, lng, nombreWa);
      }
      return;
    }
    if (m.type === 'text' && m.text) {
      await chatbotService.handleTextoCliente(telefono, m.text.body || '', nombreWa);
    }
  } catch (err) {
    console.error('[webhook ycloud] error:', err.message);
  }
}

router.post('/', (req, res) => {
  if (!firmaValida(req)) return res.sendStatus(401);
  res.sendStatus(200);
  setImmediate(() => procesar(req.body || {}));
});

module.exports = router;
