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

// Envia a un chat (grupo o privado) un mensaje con botones interactivos.
// buttons: [{ buttonId, buttonText }]
async function sendButtons({ chatId, header, body, footer, buttons }) {
  if (!chatId) throw new Error('Falta chatId para enviar botones');
  const url = `${base()}/sendInteractiveButtonsReply/${API_TOKEN}`;
  const payload = {
    chatId: toChatId(chatId),
    header: header || undefined,
    body,
    footer: footer || undefined,
    buttons: buttons.map((b) => ({ buttonId: b.buttonId, buttonText: b.buttonText })),
  };
  const { data } = await axios.post(url, payload);
  return data; // { idMessage }
}

// Publica en el GRUPO (por defecto) un mensaje con botones interactivos (ETA).
async function sendGroupMessage({ header, body, footer, buttons, chatId = GROUP_CHAT }) {
  if (!chatId) throw new Error('Falta GREENAPI_GROUP_CHAT_ID en .env');
  return sendButtons({ chatId, header, body, footer, buttons });
}

// Envia un pin de ubicacion nativo (mapa navegable en WhatsApp).
async function sendLocation(chatId, { latitude, longitude, nameLocation, address }) {
  const url = `${base()}/sendLocation/${API_TOKEN}`;
  const { data } = await axios.post(url, {
    chatId: toChatId(chatId),
    latitude, longitude,
    nameLocation: nameLocation || undefined,
    address: address || undefined,
  });
  return data;
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

// Agrega un participante (conductor) al grupo. Requiere que el numero del bot
// sea ADMIN del grupo. Devuelve { addParticipant: true|false }.
async function addGroupParticipant(participantChatId, groupId = GROUP_CHAT) {
  if (!groupId) throw new Error('Falta GREENAPI_GROUP_CHAT_ID en .env');
  const url = `${base()}/addGroupParticipant/${API_TOKEN}`;
  const { data } = await axios.post(url, {
    groupId,
    participantChatId: toChatId(participantChatId),
  });
  return data;
}

// Quita un participante (conductor) del grupo. Requiere ser ADMIN.
// Devuelve { removeParticipant: true|false }.
async function removeGroupParticipant(participantChatId, groupId = GROUP_CHAT) {
  if (!groupId) throw new Error('Falta GREENAPI_GROUP_CHAT_ID en .env');
  const url = `${base()}/removeGroupParticipant/${API_TOKEN}`;
  const { data } = await axios.post(url, {
    groupId,
    participantChatId: toChatId(participantChatId),
  });
  return data;
}

// Resuelve la informacion de un contacto (incluye phoneNumber real, aunque el
// chatId sea un @lid). Clave para identificar conductores que aparecen como @lid.
async function getContactInfo(chatId) {
  const url = `${base()}/getContactInfo/${API_TOKEN}`;
  const { data } = await axios.post(url, { chatId });
  return data; // { phoneNumber, name, chatId, ... }
}

// Obtiene el enlace de invitacion del grupo (para que el conductor entre solo).
async function getGroupInviteLink(groupId = GROUP_CHAT) {
  if (!groupId) throw new Error('Falta GREENAPI_GROUP_CHAT_ID en .env');
  const url = `${base()}/getGroupInviteLink/${API_TOKEN}`;
  const { data } = await axios.post(url, { groupId });
  return data; // { inviteLink }
}

async function getGroups() {
  const url = `${base()}/getContacts/${API_TOKEN}`;
  const { data } = await axios.get(url);
  return (data || []).filter((c) => String(c.id || '').endsWith('@g.us'));
}

module.exports = {
  sendMessage, sendFileByUrl, sendGroupMessage, sendButtons, sendLocation,
  addGroupParticipant, removeGroupParticipant, getGroupInviteLink, getContactInfo,
  setWebhook, getGroups, toChatId, GROUP_CHAT,
};
