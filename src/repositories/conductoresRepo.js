'use strict';
const { prisma } = require('../config/prisma');

async function buscarPorTelefono(phoneFull) {
  return prisma.conductor.findUnique({ where: { phoneFull } });
}

// Busca por los ultimos digitos (respaldo cuando el formato guardado difiere).
async function buscarPorSufijo(sufijo) {
  return prisma.conductor.findFirst({ where: { phoneFull: { endsWith: sufijo } } });
}

// Busca por LID (identificador anonimo de WhatsApp en grupos).
async function buscarPorLid(lid) {
  if (!lid) return null;
  return prisma.conductor.findFirst({ where: { lid } });
}

// Guarda/actualiza el LID de un conductor (cache para no resolverlo cada vez).
async function guardarLid(phoneFull, lid) {
  return prisma.conductor.update({ where: { phoneFull }, data: { lid } });
}

async function listar({ estado } = {}) {
  return prisma.conductor.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { creadoEn: 'desc' },
  });
}

async function crear({ phoneFull, fullName, plate, unit, fotoUrl, estado }) {
  const base = {
    fullName,
    plate: plate ?? null,
    unit: unit != null ? String(unit) : null,
  };
  // Solo tocar la foto si se envio una nueva (no borrarla en updates sin foto).
  if (fotoUrl !== undefined) base.fotoUrl = fotoUrl;
  return prisma.conductor.upsert({
    where: { phoneFull },
    update: { ...base, ...(estado ? { estado } : {}) },
    create: {
      phoneFull,
      ...base,
      fotoUrl: fotoUrl ?? null,
      estado: estado || 'disponible',
    },
  });
}

async function actualizar(phoneFull, { fullName, plate, unit, fotoUrl, estado, nuevoPhone }) {
  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (plate !== undefined) data.plate = plate || null;
  if (unit !== undefined) data.unit = unit != null && unit !== '' ? String(unit) : null;
  if (fotoUrl !== undefined) data.fotoUrl = fotoUrl;
  if (estado !== undefined) data.estado = estado;
  // Cambio de telefono (es el PK): actualiza tambien los pedidos por cascada (onUpdate).
  if (nuevoPhone && nuevoPhone !== phoneFull) data.phoneFull = nuevoPhone;
  return prisma.conductor.update({ where: { phoneFull }, data });
}

async function actualizarEstado(phoneFull, estado) {
  return prisma.conductor.update({ where: { phoneFull }, data: { estado } });
}

async function eliminar(phoneFull) {
  return prisma.conductor.delete({ where: { phoneFull } });
}

module.exports = {
  buscarPorTelefono, buscarPorSufijo, buscarPorLid, guardarLid,
  listar, crear, actualizar, actualizarEstado, eliminar,
};
