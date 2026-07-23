'use strict';
const conductoresRepo = require('../repositories/conductoresRepo');
const greenapi = require('../config/greenapi');

// Limpia sufijos de WhatsApp y deja solo digitos.
function limpiarTelefono(raw) {
  if (!raw) return '';
  return String(raw).replace(/@c\.us$/, '').replace(/@g\.us$/, '').replace(/\D/g, '');
}

// Normaliza a formato internacional de Ecuador (593XXXXXXXXX, sin 0 inicial, sin +).
// Ej: 0994633688 -> 593994633688 ; 994633688 -> 593994633688 ; 593994633688 -> igual.
function aInternacional(raw) {
  const d = limpiarTelefono(raw);
  if (!d) return d;
  if (d.startsWith('593')) return d;
  if (d.startsWith('0')) return `593${d.slice(1)}`;
  if (d.length === 9) return `593${d}`;
  return d;
}

// Busca un conductor tolerando diferencias de formato (0xxx vs 593xxx).
async function buscarPorTelefono(rawPhone) {
  const intl = aInternacional(rawPhone);
  let c = await conductoresRepo.buscarPorTelefono(intl);
  if (c) return c;
  // Respaldo: por los ultimos 9 digitos (numero de abonado, unico en Ecuador).
  const last9 = limpiarTelefono(rawPhone).slice(-9);
  if (last9.length >= 8) {
    c = await conductoresRepo.buscarPorSufijo(last9);
    if (c) return c;
  }
  return null;
}

// Resuelve el remitente de un mensaje de grupo (puede ser @c.us o @lid) al conductor.
// Con @lid: 1) busca por LID cacheado, 2) si no, resuelve el numero via getContactInfo
// y guarda el LID para la proxima vez.
async function buscarPorRemitente(sender) {
  const raw = String(sender || '');
  if (!/@lid$/i.test(raw)) return buscarPorTelefono(raw);

  const lid = raw.replace(/@lid$/i, '');
  // 1) por LID cacheado
  let c = await conductoresRepo.buscarPorLid(lid);
  if (c) return c;
  // 2) resolver numero real via getContactInfo y cachear el LID
  try {
    const info = await greenapi.getContactInfo(raw);
    const phone = aInternacional(info?.phoneNumber);
    if (phone) {
      c = await buscarPorTelefono(phone);
      if (c) { await conductoresRepo.guardarLid(c.phoneFull, lid).catch(() => {}); return c; }
    }
  } catch (err) {
    console.error('[conductor] no se pudo resolver LID', lid, '->', err.message);
  }
  return null;
}

module.exports = { buscarPorTelefono, buscarPorRemitente, limpiarTelefono, aInternacional };
