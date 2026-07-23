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

// Solicita la ubicacion. Con YCloud usa el boton nativo "Enviar ubicacion";
// con Green API (sin boton nativo) cae a un texto con instrucciones.
async function solicitarUbicacion(phone, texto, textoManual) {
  if (PROVIDER === 'ycloud') return ycloud.sendLocationRequest(phone, texto);
  return greenapi.sendMessage(phone, textoManual || texto);
}

// Envia al cliente los datos del conductor (imagen + texto) con botones de respuesta.
// buttons: [{ id, title }].
async function enviarConfirmacionCliente(phone, { imageUrl, texto, buttons }) {
  if (PROVIDER === 'ycloud') {
    return ycloud.sendButtons(phone, { bodyText: texto, headerImageUrl: imageUrl, buttons });
  }
  // Green API: imagen aparte + botones interactivos.
  if (imageUrl) await greenapi.sendFileByUrl(phone, imageUrl, 'mototaxi.jpg', '');
  return greenapi.sendGroupMessage({
    body: texto,
    buttons: buttons.map((b) => ({ buttonId: b.id, buttonText: b.title })),
    chatId: greenapi.toChatId(phone),
  });
}

module.exports = { sendText, sendImage, solicitarUbicacion, enviarConfirmacionCliente, PROVIDER };
