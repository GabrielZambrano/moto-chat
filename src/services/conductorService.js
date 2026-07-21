'use strict';
const conductoresRepo = require('../repositories/conductoresRepo');

// Limpia sufijos de WhatsApp para obtener el telefono puro.
function limpiarTelefono(raw) {
  if (!raw) return raw;
  return String(raw).replace(/@c\.us$/, '').replace(/@g\.us$/, '').replace(/\D/g, '');
}

async function buscarPorTelefono(rawPhone) {
  const phone = limpiarTelefono(rawPhone);
  return conductoresRepo.buscarPorTelefono(phone);
}

module.exports = { buscarPorTelefono, limpiarTelefono };
