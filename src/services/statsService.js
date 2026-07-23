'use strict';
// Agregaciones para el dashboard. Responsabilidad unica: leer datos y devolver metricas.
const { prisma } = require('../config/prisma');

function inicioDelDia(offsetDias = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDias);
  return d;
}

async function resumen() {
  const hoy = inicioDelDia(0);

  const [
    totalPedidos,
    porEstadoRaw,
    pedidosHoy,
    conductoresRaw,
    etaAgg,
    serieRaw,
    topConductoresRaw,
    recientes,
  ] = await Promise.all([
    prisma.pedido.count(),
    prisma.pedido.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.pedido.count({ where: { creadoEn: { gte: hoy } } }),
    prisma.conductor.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.pedido.aggregate({ _avg: { minutosEta: true }, where: { estado: { in: ['aceptado', 'finalizado'] } } }),
    prisma.pedido.findMany({
      where: { creadoEn: { gte: inicioDelDia(6) } },
      select: { creadoEn: true, estado: true },
    }),
    prisma.pedido.groupBy({
      by: ['conductorId'],
      where: { conductorId: { not: null } },
      _count: { _all: true },
    }),
    prisma.pedido.findMany({ orderBy: { creadoEn: 'desc' }, take: 8 }),
  ]);

  // Mapa estado -> conteo
  const porEstado = { pendiente: 0, aceptado: 0, finalizado: 0, cancelado: 0, no_atendido: 0 };
  for (const r of porEstadoRaw) porEstado[r.estado] = r._count._all;

  const conductores = { disponible: 0, ocupado: 0, inactivo: 0, total: 0 };
  for (const r of conductoresRaw) {
    conductores[r.estado] = r._count._all;
    conductores.total += r._count._all;
  }

  // Serie de los ultimos 7 dias (etiquetas + conteo)
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = inicioDelDia(i);
    dias.push({ fecha: d.toISOString().slice(0, 10), label: d.toLocaleDateString('es-EC', { weekday: 'short' }), total: 0 });
  }
  const indicePorFecha = Object.fromEntries(dias.map((d, i) => [d.fecha, i]));
  for (const p of serieRaw) {
    const key = new Date(p.creadoEn).toISOString().slice(0, 10);
    if (key in indicePorFecha) dias[indicePorFecha[key]].total += 1;
  }

  // Top conductores (resolver nombre)
  const topOrden = topConductoresRaw
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5);
  const ids = topOrden.map((t) => t.conductorId);
  const info = ids.length
    ? await prisma.conductor.findMany({ where: { phoneFull: { in: ids } } })
    : [];
  const infoPorId = Object.fromEntries(info.map((c) => [c.phoneFull, c]));
  const topConductores = topOrden.map((t) => ({
    phoneFull: t.conductorId,
    fullName: infoPorId[t.conductorId]?.fullName || 'Conductor',
    unit: infoPorId[t.conductorId]?.unit || null,
    fotoUrl: infoPorId[t.conductorId]?.fotoUrl || null,
    viajes: t._count._all,
  }));

  const totalTerminados = porEstado.finalizado + porEstado.aceptado;
  const tasaAceptacion = totalPedidos ? Math.round((totalTerminados / totalPedidos) * 100) : 0;

  return {
    totalPedidos,
    pedidosHoy,
    porEstado,
    conductores,
    etaPromedio: etaAgg._avg.minutosEta ? Math.round(etaAgg._avg.minutosEta) : null,
    tasaAceptacion,
    serie: dias,
    topConductores,
    recientes,
  };
}

module.exports = { resumen };
