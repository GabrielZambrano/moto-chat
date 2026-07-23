'use strict';
const { prisma } = require('../config/prisma');

async function listar() {
  return prisma.sector.findMany({ orderBy: { creadoEn: 'desc' } });
}

async function crear({ nombreSector, coordenadas }) {
  return prisma.sector.create({ data: { nombreSector, coordenadas } });
}

async function actualizarNombre(id, nombreSector) {
  return prisma.sector.update({ where: { id }, data: { nombreSector } });
}

async function eliminar(id) {
  return prisma.sector.delete({ where: { id } });
}

module.exports = { listar, crear, actualizarNombre, eliminar };
