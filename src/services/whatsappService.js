'use strict';
// Redacta y envia TODOS los mensajes de notificacion.
// - Chat privado del CLIENTE: usa el proveedor seleccionado (privateWhatsapp / WHATSAPP_CHATBOT_PROVIDER).
// - Chat privado del CONDUCTOR y el GRUPO: SIEMPRE Green API.
const priv = require('../config/privateWhatsapp');
const greenapi = require('../config/greenapi');

const IMAGEN_MOTOTAXI = process.env.IMAGEN_MOTOTAXI_URL
  || 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
const PUBLIC_URL = process.env.PUBLIC_URL || '';

// Convierte la ruta de la foto del conductor (relativa, ej. /uploads/...) en URL absoluta
// publica para poder enviarla por WhatsApp. Si no hay PUBLIC_URL o foto, devuelve null.
function fotoConductorAbsoluta(fotoUrl) {
  if (!fotoUrl) return null;
  if (/^https?:\/\//i.test(fotoUrl)) return fotoUrl;
  if (!PUBLIC_URL) return null;
  return `${PUBLIC_URL.replace(/\/$/, '')}${fotoUrl}`;
}

// Enlace de Google Maps para la ubicacion del cliente. Usa el mapsUrl guardado; si no,
// lo construye desde lat/lng para que el conductor SIEMPRE pueda ubicar al cliente.
function enlaceMaps(cliente) {
  if (cliente.mapsUrl) return cliente.mapsUrl;
  if (cliente.lat != null && cliente.lng != null) {
    return `https://www.google.com/maps?q=${cliente.lat},${cliente.lng}`;
  }
  return null;
}

// (a) PEDIR UBICACION (cliente, privado)
// Con YCloud muestra el boton nativo "Enviar ubicacion". Con Green API (sin boton),
// envia instrucciones manuales.
async function pedirUbicacion(telefono, nombre) {
  const texto = `👋 ¡Hola${nombre ? ' ' + nombre : ''}! Bienvenido a *MotoTaxi* 🛵\nToca el botón *Enviar ubicación* para asignarte un conductor. 📍`;
  const textoManual =
`👋 ¡Hola${nombre ? ' ' + nombre : ''}! Bienvenido a *MotoTaxi* 🛵
Para solicitar tu servicio, *comparte tu ubicación*:
📱 En WhatsApp → toca el clip 📎 → *Ubicación* → *Enviar ubicación actual*`;
  return priv.solicitarUbicacion(telefono, texto, textoManual);
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
// Nota: al grupo NO se envia la URL de ubicacion (solo la direccion).
async function publicarPedidoEnGrupo({ pedidoCode, direccion, sector }) {
  const header = `🛵 NUEVO PEDIDO #${pedidoCode}`;
  const body   = sector ? `🗂️ *Sector:* ${sector}\n📍 *${direccion}*` : `📍 *${direccion}*`;
  const footer = '¿En cuánto tiempo llegas al punto?';
  const buttons = [
    { buttonId: `ok_${pedidoCode}_3`,  buttonText: '⚡ 3 minutos' },
    { buttonId: `ok_${pedidoCode}_7`,  buttonText: '🕐 7 minutos' },
    { buttonId: `ok_${pedidoCode}_10`, buttonText: '🕒 10 minutos' },
  ];
  return greenapi.sendGroupMessage({ header, body, footer, buttons });
}

// (d) NOTIFICAR CLIENTE (privado, con imagen + botones OK/Cancelar)
async function notificarCliente(telefono, conductor, minutosEta, pedidoCode) {
  const caption =
`🛵 *¡Tu mototaxi está en camino!*

👤 *Conductor:* ${conductor.fullName}

📞 *WhatsApp / llamadas:* +${conductor.phoneFull}

🔢 *Unidad:* #${conductor.unit || '-'}
🏍️ *Placa:* ${conductor.plate || '-'}

⏱️ *Llega en aprox:* ${minutosEta} minutos`;
  // Envia la foto del conductor (subida en el panel) si existe; si no, la imagen por defecto.
  const imagen = fotoConductorAbsoluta(conductor.fotoUrl) || IMAGEN_MOTOTAXI;
  const buttons = [
    { id: `cli_ok_${pedidoCode}`, title: 'OK, espero' },
    { id: `cli_cancel_${pedidoCode}`, title: 'Cancelar' },
  ];
  return priv.enviarConfirmacionCliente(telefono, { imageUrl: imagen, texto: caption, buttons });
}

// (d2) Respuesta cuando el cliente pulsa "OK, espero"
async function conductorEnCamino(telefono) {
  return priv.sendText(telefono, '👍 ¡Perfecto! Tu conductor está en camino y llegará pronto. Gracias por esperar. 🛵');
}

// (d3) El conductor pulso "Llegué al punto" -> avisar al cliente.
async function avisarClienteConductorLlego(telefono, pedidoCode) {
  return priv.sendText(telefono, `🛵 *¡Tu conductor llegó!* Ya está en el punto de encuentro (pedido #${pedidoCode}). Sal con cuidado. 👋`);
}

// (d4) El conductor pulso "Finalizar pedido" -> avisar al cliente.
async function avisarClienteFinalizado(telefono, pedidoCode) {
  return priv.sendText(telefono, `🏁 *Viaje #${pedidoCode} finalizado.* ¡Gracias por viajar con MotoTaxi! 🛵 Escríbenos cuando necesites otro servicio.`);
}

// (e2) Tras "Llegué", reenviar al conductor SOLO el boton "Finalizar pedido".
async function enviarBotonFinalizar(phoneFull, pedidoCode) {
  return greenapi.sendButtons({
    chatId: phoneFull,
    body: `✅ Avisamos al cliente que llegaste (pedido #${pedidoCode}).\nCuando termines el viaje, toca *Finalizar pedido*.`,
    buttons: [{ buttonId: `drv_fin_${pedidoCode}`, buttonText: 'Finalizar pedido' }],
  });
}

// (e3) Confirmacion breve al conductor al finalizar (queda disponible).
async function confirmarFinalizadoConductor(phoneFull, pedidoCode) {
  return greenapi.sendMessage(phoneFull, `🏁 *Pedido #${pedidoCode} finalizado.* Quedas disponible para otra carrera. 🛵`);
}

// (e) NOTIFICAR CONDUCTOR (privado) - datos del cliente + botones + pin de ubicacion
async function notificarConductor(phoneFull, pedidoCode, cliente, minutosEta) {
  const maps = enlaceMaps(cliente);
  const direccion = cliente.descripcion || cliente.direccionCompleta || 'Ubicación compartida';
  const cuerpo = [
    `🎯 *Pedido #${pedidoCode} — ¡es tuyo!*`,
    '',
    `👤 *Cliente:* ${cliente.nombre || 'Cliente'}`,
    '',
    `📞 *WhatsApp / llamadas:* +${cliente.telefono}`,
    '',
    `📍 *Dirección:* ${direccion}`,
    '',
    `⏱️ *Tu tiempo de llegada:* ${minutosEta} minutos`,
  ].join('\n');

  const buttons = [
    { buttonId: `drv_llegue_${pedidoCode}`, buttonText: 'Llegué al punto' },
    { buttonId: `drv_fin_${pedidoCode}`, buttonText: 'Finalizar pedido' },
  ];

  // 1) Datos + botones de accion.
  await greenapi.sendButtons({
    chatId: phoneFull, body: cuerpo,
    footer: 'Toca “Llegué al punto” al llegar y “Finalizar pedido” al terminar.',
    buttons,
  });
  // 2) Pin de ubicacion nativo para navegar (o enlace si no hay coordenadas).
  if (cliente.lat != null && cliente.lng != null) {
    await greenapi.sendLocation(phoneFull, {
      latitude: cliente.lat, longitude: cliente.lng,
      nameLocation: 'Ir a la ubicación del cliente', address: direccion,
    });
  } else if (maps) {
    await greenapi.sendMessage(phoneFull, `🗺️ *Ir a la ubicación del cliente:*\n${maps}`);
  }
}

// (f) NOTIFICAR GRUPO (aceptado) - Green API
// Solo el numero de pedido; NO se revela que conductor lo tomo.
async function notificarGrupoAceptado({ pedidoCode }) {
  return greenapi.sendMessage(greenapi.GROUP_CHAT, `✅ *Pedido #${pedidoCode} ACEPTADO*`);
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

// (i) PEDIDO CANCELADO (a cliente, privado)
async function pedidoCanceladoCliente(telefono, pedidoCode) {
  const msg =
`❌ *Pedido #${pedidoCode} cancelado.*
Cuando quieras otro servicio, comparte tu ubicación de nuevo y con gusto te asignamos un mototaxi. 🛵`;
  return priv.sendText(telefono, msg);
}

// (j) SIN PEDIDO ACTIVO PARA CANCELAR (a cliente, privado)
async function sinPedidoActivo(telefono) {
  const msg =
`ℹ️ No tienes ningún pedido activo para cancelar.
Comparte tu ubicación cuando quieras solicitar un mototaxi. 🛵`;
  return priv.sendText(telefono, msg);
}

// (k) AVISAR AL CONDUCTOR QUE EL CLIENTE CANCELO (privado) - Green API
async function notificarConductorCancelado(phoneFull, pedidoCode) {
  return greenapi.sendMessage(phoneFull, `⚠️ El cliente canceló el *pedido #${pedidoCode}*. Quedas disponible para otra carrera.`);
}

// (l) AVISAR AL GRUPO QUE UN PEDIDO SE CANCELO - Green API
async function notificarGrupoCancelado(pedidoCode) {
  return greenapi.sendMessage(greenapi.GROUP_CHAT, `❌ *Pedido #${pedidoCode}* cancelado por el cliente.`);
}

// (m) RECORDATORIO "seguimos buscando" (a cliente, privado)
async function buscandoConductor(telefono, pedidoCode) {
  const msg =
`🔎 *Seguimos buscando un conductor* para tu pedido #${pedidoCode}.
Gracias por tu paciencia, en cuanto uno lo tome te avisamos. 🛵`;
  return priv.sendText(telefono, msg);
}

// (n) NO SE ENCONTRO CONDUCTOR / expiro (a cliente, privado)
async function noSeEncontroConductor(telefono, pedidoCode) {
  const msg =
`😔 *No pudimos conseguir un conductor* para tu pedido #${pedidoCode} en este momento.
Por favor intenta de nuevo compartiendo tu ubicación. Lamentamos la espera. 🛵`;
  return priv.sendText(telefono, msg);
}

// (o) AVISAR AL GRUPO QUE UN PEDIDO EXPIRO SIN SER TOMADO - Green API
async function notificarGrupoExpirado(pedidoCode) {
  return greenapi.sendMessage(greenapi.GROUP_CHAT, `⌛ *Pedido #${pedidoCode}* expiró sin ser tomado (no atendido).`);
}

module.exports = {
  pedirUbicacion, confirmarUbicacion, publicarPedidoEnGrupo,
  notificarCliente, notificarConductor, notificarGrupoAceptado,
  pedidoYaTomado, avisoPedidoActivo, conductorNoRegistrado,
  pedidoCanceladoCliente, sinPedidoActivo, notificarConductorCancelado, notificarGrupoCancelado,
  buscandoConductor, noSeEncontroConductor, notificarGrupoExpirado,
  conductorEnCamino, avisarClienteConductorLlego, avisarClienteFinalizado,
  enviarBotonFinalizar, confirmarFinalizadoConductor,
};
