'use strict';
// Cliente HTTP de Green API. Se usa SIEMPRE para el grupo (botones interactivos)
// y opcionalmente para el chat privado con el cliente.
const axios = require('axios');

const API_URL     = process.env.GREENAPI_API_URL || 'https://api.green-api.com';
const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID;
const API_TOKEN   = process.env.GREENAPI_API_TOKEN;
const GROUP_CHAT  = process.env.GREENAPI_GROUP_CHAT_ID;

function base() {
  if (!INSTANCE_ID || !API_TOKEN) {
    throw new Error('Faltan GREENAPI_INSTANCE_ID / GREENAPI_API_TOKEN en .env');
  }
  return `${API_URL}/waInstance${INSTANCE_ID}`;
}

// Normaliza un telefono (sin @c.us) a chatId de WhatsApp.
function toChatId(phone) {
  if (!phone) return phone;
  if (phone.endsWith('@c.us') || phone.endsWith('@g.us')) return phone;
  return `${phone}@c.us`;
}

async function sendMessage(chatId, message) {
  const url = `${base()}/sendMessage/${API_TOKEN}`;
  const { data } = await axios.post(url, { chatId: toChatId(chatId), message });
  return data; // { idMessage }
}

async function sendFileByUrl(chatId, urlFile, fileName = 'imagen.jpg', caption = '') {
  const url = `${base()}/sendFileByUrl/${API_TOKEN}`;
  const { data } = await axios.post(url, {
    chatId: toChatId(chatId), urlFile, fileName, caption,
  });
  return data;
}

// Publica en el GRUPO un mensaje con botones interactivos (ETA).
// buttons: [{ buttonId, buttonText }]
async function sendGroupMessage({ header, body, footer, buttons, chatId = GROUP_CHAT }) {
  if (!chatId) throw new Error('Falta GREENAPI_GROUP_CHAT_ID en .env');
  const url = `${base()}/sendInteractiveButtonsReply/${API_TOKEN}`;
  const payload = {
    chatId,
    header: header || undefined,
    body,
    footer: footer || undefined,
    buttons: buttons.map((b) => ({ buttonId: b.buttonId, buttonText: b.buttonText })),
  };
  const { data } = await axios.post(url, payload);
  return data; // { idMessage }
}

// Registra / actualiza la URL del webhook en Green API.
async function setWebhook(webhookUrl) {
  const url = `${base()}/setSettings/${API_TOKEN}`;
  const { data } = await axios.post(url, {
    webhookUrl,
    incomingWebhook: 'yes',
    stateWebhook: 'yes',
    outgoingMessageWebhook: 'no',
  });
  return data;
}

async function getGroups() {
  const url = `${base()}/getContacts/${API_TOKEN}`;
  const { data } = await axios.get(url);
  return (data || []).filter((c) => String(c.id || '').endsWith('@g.us'));
}

module.exports = {
  sendMessage, sendFileByUrl, sendGroupMessage, setWebhook, getGroups, toChatId,
  GROUP_CHAT,
};
