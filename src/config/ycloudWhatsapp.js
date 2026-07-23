'use strict';
// Cliente HTTP de YCloud (WhatsApp Cloud API oficial). Solo chat PRIVADO.
// NOTA: YCloud NO se usa para el grupo (no envia los botones interactivos).
const axios = require('axios');

const API_URL = process.env.YCLOUD_API_URL || 'https://api.ycloud.com/v2';
const API_KEY = process.env.YCLOUD_API_KEY;
const FROM    = process.env.YCLOUD_WHATSAPP_FROM;

function headers() {
  if (!API_KEY) throw new Error('Falta YCLOUD_API_KEY en .env');
  return { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };
}

function toNumber(phone) {
  if (!phone) return phone;
  const clean = String(phone).replace(/@c\.us$/, '').replace(/@g\.us$/, '');
  return clean.startsWith('+') ? clean : `+${clean}`;
}

async function sendText(to, body) {
  const url = `${API_URL}/whatsapp/messages`;
  const { data } = await axios.post(url, {
    from: toNumber(FROM),
    to: toNumber(to),
    type: 'text',
    text: { body },
  }, { headers: headers() });
  return data;
}

async function sendImage(to, link, caption = '') {
  const url = `${API_URL}/whatsapp/messages`;
  const { data } = await axios.post(url, {
    from: toNumber(FROM),
    to: toNumber(to),
    type: 'image',
    image: { link, caption },
  }, { headers: headers() });
  return data;
}

// Mensaje interactivo con botones de respuesta (max 3). Opcionalmente con imagen de cabecera.
// buttons: [{ id, title }] (title max 20 chars).
async function sendButtons(to, { bodyText, headerImageUrl, buttons }) {
  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
    },
  };
  if (headerImageUrl) interactive.header = { type: 'image', image: { link: headerImageUrl } };
  const { data } = await axios.post(`${API_URL}/whatsapp/messages`, {
    from: toNumber(FROM),
    to: toNumber(to),
    messagingProduct: 'whatsapp',
    type: 'interactive',
    interactive,
  }, { headers: headers() });
  return data;
}

// Mensaje interactivo nativo de WhatsApp: muestra el boton "Enviar ubicacion".
// Al pulsarlo, el cliente comparte sus coordenadas (llega como mensaje type=location).
async function sendLocationRequest(to, text) {
  const url = `${API_URL}/whatsapp/messages`;
  const { data } = await axios.post(url, {
    from: toNumber(FROM),
    to: toNumber(to),
    messagingProduct: 'whatsapp',
    type: 'interactive',
    interactive: {
      type: 'location_request_message',
      body: { text },
      action: { name: 'send_location' },
    },
  }, { headers: headers() });
  return data;
}

module.exports = { sendText, sendImage, sendButtons, sendLocationRequest, toNumber };
