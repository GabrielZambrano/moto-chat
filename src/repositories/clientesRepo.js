'use strict';
const { prisma } = require('../config/prisma');

const MAX_DIRECCIONES = 10;

async function get(telefono) {
  return prisma.cliente.findUnique({
    where: { telefono },
    include: { direcciones: { orderBy: { orden: 'asc' } } },
  });
}

// Crea el cliente si no existe (conversacion = ninguna). Devuelve el cliente.
async function ensure(telefono, nombre) {
  return prisma.cliente.upsert({
    where: { telefono },
    update: nombre ? { nombre } : {},
    create: { telefono, nombre: nombre || null, conversacion: 'ninguna' },
  });
}

async function updateConversacion(telefono, conversacion) {
  // conversacion: 'ninguna' | 'esperando_ubicacion'
  return prisma.cliente.update({
    where: { telefono },
    data: { conversacion },
  });
}

// Agrega una direccion al historial: mas reciente primero, sin duplicados por
// texto, filtrando direcciones que sean solo coordenadas, maximo 10.
async function agregarDireccion(telefono, { direccion, lat, lng, mapsUrl }) {
  const esSoloCoordenadas = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test((direccion || '').trim());

  await prisma.$transaction(async (tx) => {
    const existentes = await tx.clienteDireccion.findMany({
      where: { clienteTelefono: telefono },
      orderBy: { orden: 'asc' },
    });

    // Evitar duplicado por texto exacto
    const yaExiste = existentes.some(
      (d) => d.direccion.trim().toLowerCase() === (direccion || '').trim().toLowerCase()
    );
    if (yaExiste || esSoloCoordenadas) {
      // Aun asi, si es solo coordenadas no la guardamos como nueva entrada.
      if (yaExiste) return;
    }

    // Desplaza el orden de las existentes (+1) para que la nueva quede en 0.
    await tx.clienteDireccion.updateMany({
      where: { clienteTelefono: telefono },
      data: { orden: { increment: 1 } },
    });

    await tx.clienteDireccion.create({
      data: { clienteTelefono: telefono, direccion, lat: lat ?? null, lng: lng ?? null, mapsUrl: mapsUrl ?? null, orden: 0 },
    });

    // Recorta a MAX_DIRECCIONES (elimina las de mayor orden).
    const total = await tx.clienteDireccion.count({ where: { clienteTelefono: telefono } });
    if (total > MAX_DIRECCIONES) {
      const sobrantes = await tx.clienteDireccion.findMany({
        where: { clienteTelefono: telefono },
        orderBy: { orden: 'desc' },
        take: total - MAX_DIRECCIONES,
        select: { id: true },
      });
      await tx.clienteDireccion.deleteMany({ where: { id: { in: sobrantes.map((s) => s.id) } } });
    }
  });
}

module.exports = { get, ensure, updateConversacion, agregarDireccion, MAX_DIRECCIONES };
