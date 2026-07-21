'use strict';
const { prisma } = require('../config/prisma');

// pedidoCode = ultimos 6 chars del UUID, en MAYUSCULAS (sin guiones).
function derivarCode(id) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

async function crear({ clienteTelefono, clienteNombre, ubicacion, waGroupMsgId }) {
  // Generamos el id primero para derivar el code de forma consistente.
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const pedidoCode = derivarCode(id);

  return prisma.pedido.create({
    data: {
      id,
      pedidoCode,
      clienteTelefono,
      clienteNombre: clienteNombre || null,
      ubicDescripcion: ubicacion?.descripcion || null,
      ubicDireccionCompleta: ubicacion?.direccionCompleta || null,
      ubicLat: ubicacion?.lat ?? null,
      ubicLng: ubicacion?.lng ?? null,
      ubicMapsUrl: ubicacion?.mapsUrl || null,
      estado: 'pendiente',
      waGroupMsgId: waGroupMsgId || null,
    },
  });
}

async function setWaGroupMsgId(id, waGroupMsgId) {
  return prisma.pedido.update({ where: { id }, data: { waGroupMsgId } });
}

async function buscarPendientePorCode(pedidoCode) {
  return prisma.pedido.findFirst({ where: { pedidoCode, estado: 'pendiente' } });
}

// Devuelve el pedido activo (pendiente o aceptado) del cliente, si existe.
async function pedidoActivoDeCliente(clienteTelefono) {
  return prisma.pedido.findFirst({
    where: { clienteTelefono, estado: { in: ['pendiente', 'aceptado'] } },
    orderBy: { creadoEn: 'desc' },
  });
}

// *** BLOQUEO ATOMICO ANTI-DOBLE-ASIGNACION ***
// UPDATE ... WHERE pedido_code=? AND estado='pendiente'
// Devuelve el pedido actualizado, o null si otro conductor ya lo tomo.
async function aceptar({ pedidoCode, conductor, minutosEta }) {
  const result = await prisma.pedido.updateMany({
    where: { pedidoCode, estado: 'pendiente' },
    data: {
      estado: 'aceptado',
      conductorId: conductor.phoneFull,
      conductorData: {
        fullName: conductor.fullName,
        phoneFull: conductor.phoneFull,
        plate: conductor.plate,
        unit: conductor.unit,
      },
      minutosEta,
      aceptadoEn: new Date(),
    },
  });

  if (result.count === 0) return null; // ya fue tomado
  return prisma.pedido.findFirst({ where: { pedidoCode } });
}

async function listar({ estado, limit = 50 } = {}) {
  return prisma.pedido.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { creadoEn: 'desc' },
    take: Number(limit) || 50,
  });
}

module.exports = {
  crear, setWaGroupMsgId, buscarPendientePorCode, pedidoActivoDeCliente,
  aceptar, listar, derivarCode,
};
