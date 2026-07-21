'use strict';
// Punto de entrada. Carga .env, arranca Express en PORT y verifica la BD.
require('dotenv').config();

const { createApp } = require('./src/app');
const { prisma } = require('./src/config/prisma');

const PORT = process.env.PORT || 3001;

async function main() {
  // Verificar conexion a PostgreSQL antes de escuchar.
  try {
    await prisma.$connect();
    console.log('[db] Conectado a PostgreSQL');
  } catch (err) {
    console.error('[db] No se pudo conectar a PostgreSQL:', err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`[server] MotoTaxi escuchando en puerto ${PORT}`);
    console.log(`[server] Webhook Green API: POST /webhook`);
    console.log(`[server] Webhook YCloud:    POST /webhook/ycloud`);
  });

  const cerrar = async () => {
    console.log('\n[server] Cerrando...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main();
