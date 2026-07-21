'use strict';
// Redacta y envia TODOS los mensajes de notificacion.
// - Chat privado del CLIENTE: usa el proveedor seleccionado (privateWhatsapp / WHATSAPP_CHATBOT_PROVIDER).
// - Chat privado del CONDUCTOR y el GRUPO: SIEMPRE Green API.
const priv = require('../config/privateWhatsapp');
const greenapi = require('../config/greenapi');

const IMAGEN_MOTOTAXI = process.env.IMAGEN_MOTOTAXI_URL
  || 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';

// (a) PEDIR UBICACION (cliente, privado)
async function pedirUbicacion(telefono, nombre) {
  const msg =
`👋 ¡Hola ${nombre || ''}! Bienvenido a *MotoTaxi* 🛵
Para solicitar tu servicio, por favor *comparte tu ubicación*:
📱 En WhatsApp → toca el clip 📎 → *Ubicación* → *Enviar ubicación actual*`;
  return priv.sendText(telefono, msg);
}

// (b) CONFIRMAR UBICACION (cliente, privado)
async function confirmarUbicacion(telefono, direccion, mapsUrl) {
  const msg =
`✅ *Ubicación recibida*
📍 *${direccion}*
🗺️ ${mapsUrl}
⏳ Notificando a los conductores disponibles...`;
  return priv.sendText(telefono, msg);
}

// (c) MENSAJE AL GRUPO CON BOTONES (nuevo pedido) - SIEMPRE Green API
async function publicarPedidoEnGrupo({ pedidoCode, direccion, mapsUrl }) {
  const header = `🛵 NUEVO PEDIDO #${pedidoCode}`;
  const body   = `📍 *${direccion}*\n🗺️ ${mapsUrl}`;
  const footer = '¿En cuánto tiempo llegas al punto?';
  const buttons = [
    { buttonId: `ok_${pedidoCode}_3`,  buttonText: '⚡ 3 minutos' },
    { buttonId: `ok_${pedidoCode}_7`,  buttonText: '🕐 7 minutos' },
    { buttonId: `ok_${pedidoCode}_10`, buttonText: '🕒 10 minutos' },
  ];
  return greenapi.sendGroupMessage({ header, body, footer, buttons });
}

// (d) NOTIFICAR CLIENTE (privado, con imagen)
async function notificarCliente(telefono, conductor, minutosEta) {
  const caption =
`🛵 *¡Tu mototaxi está en camino!*
👤 *Conductor:* ${conductor.fullName}
📞 *Teléfono:* wa.me/${conductor.phoneFull}
🔢 *Unidad:* #${conductor.unit || '-'}
🏍️ *Placa:* ${conductor.plate || '-'}
⏱️ *Llega en aprox:* ${minutosEta} minutos`;
  return priv.sendImage(telefono, IMAGEN_MOTOTAXI, caption);
}

// (e) NOTIFICAR CONDUCTOR (privado)
async function notificarConductor(phoneFull, pedidoCode, cliente, minutosEta) {
  const msg =
`✅ *Pedido #${pedidoCode} asignado a ti*
👤 *Cliente:* ${cliente.nombre || 'Cliente'}
📞 *Teléfono:* wa.me/${cliente.telefono}
📍 *Dirección:* ${cliente.descripcion || '-'}
🗺️ ${cliente.mapsUrl || ''}
⏱️ *Tu ETA declarado:* ${minutosEta} minutos`;
  return greenapi.sendMessage(phoneFull, msg);
}

// (f) NOTIFICAR GRUPO (aceptado) - Green API
async function notificarGrupoAceptado({ pedidoCode, fullName, unit, minutosEta }) {
  const msg =
`✅ *Pedido #${pedidoCode} ACEPTADO*
👤 *Conductor:* ${fullName}
🔢 *Unidad:* #${unit || '-'}
⏱️ *ETA:* ${minutosEta} minutos`;
  return greenapi.sendMessage(greenapi.GROUP_CHAT, msg);
}

// (g) PEDIDO YA TOMADO (a conductor, privado)
async function pedidoYaTomado(phoneFull, pedidoCode) {
  const msg = `⚠️ El pedido *#${pedidoCode}* ya fue tomado por otro conductor.`;
  return greenapi.sendMessage(phoneFull, msg);
}

// (h) PEDIDO ACTIVO (a cliente que pide otro)
async function avisoPedidoActivo(telefono, pedidoCode, estado) {
  const msg =
`⚠️ Ya tienes un pedido activo *#${pedidoCode}* (${estado}).
Espera a que finalice antes de solicitar otro servicio.`;
  return priv.sendText(telefono, msg);
}

async function conductorNoRegistrado(phoneFull) {
  const msg = '⚠️ No estás registrado como conductor. Contacta al administrador.';
  return greenapi.sendMessage(phoneFull, msg);
}

module.exports = {
  pedirUbicacion, confirmarUbicacion, publicarPedidoEnGrupo,
  notificarCliente, notificarConductor, notificarGrupoAceptado,
  pedidoYaTomado, avisoPedidoActivo, conductorNoRegistrado,
};
