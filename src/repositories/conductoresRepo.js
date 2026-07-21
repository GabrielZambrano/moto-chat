'use strict';
const { prisma } = require('../config/prisma');

async function buscarPorTelefono(phoneFull) {
  return prisma.conductor.findUnique({ where: { phoneFull } });
}

async function listar({ estado } = {}) {
  return prisma.conductor.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { creadoEn: 'desc' },
  });
}

async function crear({ phoneFull, fullName, plate, unit, estado }) {
  return prisma.conductor.upsert({
    where: { phoneFull },
    update: { fullName, plate: plate ?? null, unit: unit != null ? String(unit) : null, ...(estado ? { estado } : {}) },
    create: {
      phoneFull, fullName,
      plate: plate ?? null,
      unit: unit != null ? String(unit) : null,
      estado: estado || 'disponible',
    },
  });
}

async function actualizarEstado(phoneFull, estado) {
  return prisma.conductor.update({ where: { phoneFull }, data: { estado } });
}

async function eliminar(phoneFull) {
  return prisma.conductor.delete({ where: { phoneFull } });
}

module.exports = { buscarPorTelefono, listar, crear, actualizarEstado, eliminar };
