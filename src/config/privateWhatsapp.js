'use strict';
// Selector de proveedor SOLO para el chat PRIVADO con el CLIENTE.
// WHATSAPP_CHATBOT_PROVIDER = "greenapi" (def.) | "ycloud".
// El GRUPO y el chat privado del CONDUCTOR usan SIEMPRE Green API (ver whatsappService).
const greenapi = require('./greenapi');
const ycloud   = require('./ycloudWhatsapp');

const PROVIDER = (process.env.WHATSAPP_CHATBOT_PROVIDER || 'greenapi').toLowerCase();

async function sendText(phone, message) {
  if (PROVIDER === 'ycloud') return ycloud.sendText(phone, message);
  return greenapi.sendMessage(phone, message);
}

async function sendImage(phone, imageUrl, caption = '') {
  if (PROVIDER === 'ycloud') return ycloud.sendImage(phone, imageUrl, caption);
  return greenapi.sendFileByUrl(phone, imageUrl, 'mototaxi.jpg', caption);
}

module.exports = { sendText, sendImage, PROVIDER };
