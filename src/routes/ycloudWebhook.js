'use strict';
// Webhook de YCloud (solo mensajes de cliente). Valida firma HMAC-SHA256.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const chatbotService = require('../services/chatbotService');

const SECRET = process.env.YCLOUD_WEBHOOK_SECRET || '';

// YCloud firma con la cabecera "X-YCloud-Signature: t=<timestamp>,s=<hmacHex>",
// donde el HMAC-SHA256 se calcula sobre "<t>.<raw>" usando el webhook secret completo.
function firmaValida(req) {
  if (!SECRET) return true; // si no hay secreto, se omite la validacion
  const signature = req.get('X-YCloud-Signature') || req.get('ycloud-signature') || '';
  const partes = Object.fromEntries(
    signature.split(',').map((p) => p.split('=').map((x) => x.trim()))
  );
  const sig = partes.s || partes.v1;
  const t = partes.t || '';
  if (!sig || !t) return false;

  const raw = req.rawBody || JSON.stringify(req.body || {});
  const esperado = crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
  } catch {
    return false;
  }
}

// Busca el id de nuestros botones de cliente (cli_ok_XXXXXX / cli_cancel_XXXXXX)
// en cualquier parte del payload, sin depender del nombre exacto del campo.
const RE_BTN_CLI = /^cli_(ok|cancel)_[A-Z0-9]{6}$/i;
function extraerBotonCliente(obj, prof = 0) {
  if (obj == null || prof > 6) return '';
  if (typeof obj === 'string') return RE_BTN_CLI.test(obj) ? obj : '';
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const f = extraerBotonCliente(v, prof + 1);
      if (f) return f;
    }
  }
  return '';
}

async function procesar(body) {
  try {
    const evt = body.type || '';
    if (!evt.startsWith('whatsapp.inbound_message')) return;
    const m = body.whatsappInboundMessage || {};
    const telefono = String(m.from || '').replace(/^\+/, '');
    const nombreWa = m.customerProfile?.name || '';

    // Respuesta a un boton interactivo (OK espero / Cancelar). Buscamos el id sin
    // depender de la estructura exacta (varia segun el tipo de mensaje interactivo).
    const botonId = extraerBotonCliente(m);
    if (botonId) {
      await chatbotService.handleBotonCliente(telefono, botonId, nombreWa);
      return;
    }

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
  if (!firmaValida(req)) {
    console.warn('[webhook ycloud] firma no válida -> 401');
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  setImmediate(() => procesar(req.body || {}));
});

module.exports = router;
