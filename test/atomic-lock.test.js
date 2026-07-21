'use strict';
// ============================================================================
//  Test de BLOQUEO ATOMICO de asignacion (dos+ conductores a la vez).
//  Verifica que si N conductores presionan el boton casi simultaneamente,
//  SOLO UNO gana el pedido. Es el punto mas critico del sistema.
//
//  Requiere una PostgreSQL en marcha y el cliente Prisma generado:
//     docker compose up -d db          # o tu propia BD
//     npm run prisma:generate
//     npm run prisma:migrate           # (o prisma:deploy)
//     npm test
//
//  Se ejecuta con el runner nativo de Node:  node --test
// ============================================================================
const test = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config();
const { prisma } = require('../src/config/prisma');
const pedidosRepo = require('../src/repositories/pedidosRepo');

const SUFFIX = Date.now().toString().slice(-8);
const CLIENTE_TEL = `59900${SUFFIX}`;
const N = 8; // numero de conductores compitiendo

function makeConductor(i) {
  return {
    phoneFull: `59391${SUFFIX}${i}`,
    fullName: `Conductor ${i}`,
    plate: `ABC-${100 + i}`,
    unit: String(i),
    estado: 'disponible',
  };
}

test.before(async () => {
  await prisma.$connect();
  // Cliente
  await prisma.cliente.upsert({
    where: { telefono: CLIENTE_TEL },
    update: {},
    create: { telefono: CLIENTE_TEL, nombre: 'Cliente Test' },
  });
  // Conductores
  for (let i = 0; i < N; i++) {
    const c = makeConductor(i);
    await prisma.conductor.upsert({ where: { phoneFull: c.phoneFull }, update: {}, create: c });
  }
});

test.after(async () => {
  // Limpieza
  await prisma.pedido.deleteMany({ where: { clienteTelefono: CLIENTE_TEL } });
  await prisma.conductor.deleteMany({ where: { phoneFull: { startsWith: `59391${SUFFIX}` } } });
  await prisma.cliente.deleteMany({ where: { telefono: CLIENTE_TEL } });
  await prisma.$disconnect();
});

test('solo UN conductor gana un pedido cuando N compiten en paralelo', async () => {
  // 1) Crear un pedido pendiente
  const pedido = await pedidosRepo.crear({
    clienteTelefono: CLIENTE_TEL,
    clienteNombre: 'Cliente Test',
    ubicacion: {
      descripcion: 'Av. Test 123',
      direccionCompleta: 'Av. Test 123, Ciudad',
      lat: -2.17, lng: -79.92,
      mapsUrl: 'https://maps.google.com/?q=-2.17,-79.92',
    },
  });

  // 2) Disparar N intentos de aceptacion EN PARALELO sobre el mismo code.
  const intentos = Array.from({ length: N }, (_, i) =>
    pedidosRepo.aceptar({
      pedidoCode: pedido.pedidoCode,
      conductor: makeConductor(i),
      minutosEta: [3, 7, 10][i % 3],
    })
  );
  const resultados = await Promise.all(intentos);

  // 3) Exactamente uno debe devolver el pedido (ganador); el resto null.
  const ganadores = resultados.filter((r) => r !== null);
  const perdedores = resultados.filter((r) => r === null);

  assert.equal(ganadores.length, 1, `deberia ganar exactamente 1, ganaron ${ganadores.length}`);
  assert.equal(perdedores.length, N - 1, `deberian perder ${N - 1}`);

  // 4) El estado final en BD debe ser "aceptado" con un unico conductor.
  const final = await prisma.pedido.findUnique({ where: { id: pedido.id } });
  assert.equal(final.estado, 'aceptado');
  assert.ok(final.conductorId, 'debe tener conductorId asignado');
  assert.equal(final.conductorId, ganadores[0].conductorId);
  assert.ok(final.aceptadoEn instanceof Date, 'debe registrar aceptadoEn');
});

test('un segundo intento sobre un pedido ya aceptado devuelve null', async () => {
  const pedido = await pedidosRepo.crear({
    clienteTelefono: CLIENTE_TEL,
    clienteNombre: 'Cliente Test',
    ubicacion: { descripcion: 'Otra dir', direccionCompleta: 'Otra dir', lat: -2.1, lng: -79.9, mapsUrl: 'x' },
  });

  const primero = await pedidosRepo.aceptar({ pedidoCode: pedido.pedidoCode, conductor: makeConductor(0), minutosEta: 3 });
  const segundo = await pedidosRepo.aceptar({ pedidoCode: pedido.pedidoCode, conductor: makeConductor(1), minutosEta: 7 });

  assert.ok(primero, 'el primero debe ganar');
  assert.equal(segundo, null, 'el segundo debe recibir null (ya tomado)');
});
