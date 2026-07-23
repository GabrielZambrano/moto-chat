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
      sector: ubicacion?.sector || null,
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

// Cancela un pedido por id (marca estado=cancelado).
async function cancelar(id) {
  return prisma.pedido.update({ where: { id }, data: { estado: 'cancelado' } });
}

async function buscarPorCode(pedidoCode) {
  return prisma.pedido.findFirst({ where: { pedidoCode } });
}

// Finaliza un pedido SOLO si estaba aceptado (atomico). Devuelve el pedido o null.
async function finalizar(pedidoCode) {
  const r = await prisma.pedido.updateMany({
    where: { pedidoCode, estado: 'aceptado' },
    data: { estado: 'finalizado' },
  });
  if (r.count === 0) return null;
  return prisma.pedido.findFirst({ where: { pedidoCode } });
}

// Todos los pedidos aun pendientes (para el barredor de espera).
async function listarPendientes() {
  return prisma.pedido.findMany({ where: { estado: 'pendiente' }, orderBy: { creadoEn: 'asc' } });
}

// Marca un pedido como "no atendido" SOLO si sigue pendiente (evita pisar una aceptacion).
// Devuelve true si lo marco, false si ya no estaba pendiente.
async function marcarNoAtendido(id) {
  const r = await prisma.pedido.updateMany({
    where: { id, estado: 'pendiente' },
    data: { estado: 'no_atendido' },
  });
  return r.count > 0;
}

// Incrementa el contador de recordatorios SOLO si sigue pendiente.
async function incrementarRecordatorio(id) {
  const r = await prisma.pedido.updateMany({
    where: { id, estado: 'pendiente' },
    data: { recordatoriosEnviados: { increment: 1 } },
  });
  return r.count > 0;
}

// Marca que ya se reenviaron los botones al grupo (SOLO si sigue pendiente y no se habia hecho).
async function marcarRepublicado(id) {
  const r = await prisma.pedido.updateMany({
    where: { id, estado: 'pendiente', republicadoEnGrupo: false },
    data: { republicadoEnGrupo: true },
  });
  return r.count > 0;
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
  aceptar, cancelar, listar, derivarCode,
  listarPendientes, marcarNoAtendido, incrementarRecordatorio, marcarRepublicado,
  buscarPorCode, finalizar,
};
