'use strict';
// Configura Express y monta las rutas. Captura rawBody (para validar firmas).
const express = require('express');

const webhookRouter = require('./routes/webhook');
const ycloudWebhookRouter = require('./routes/ycloudWebhook');
const conductoresRouter = require('./routes/conductores');
const clientesRouter = require('./routes/clientes');
const pedidosRouter = require('./routes/pedidos');

function createApp() {
  const app = express();

  // Captura el cuerpo crudo para poder validar firmas HMAC (YCloud).
  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
  }));
  app.use(express.urlencoded({ extended: true }));

  // Salud
  app.get('/', (_req, res) => res.json({ ok: true, service: 'server-mototaxi' }));
  app.get('/health', (_req, res) => res.json({ status: 'up', time: new Date().toISOString() }));

  // Webhooks
  app.use('/webhook', webhookRouter);           // Green API (cliente + grupo)
  app.use('/webhook/ycloud', ycloudWebhookRouter); // YCloud (cliente)

  // API REST
  app.use('/conductores', conductoresRouter);
  app.use('/clientes', clientesRouter);
  app.use('/pedidos', pedidosRouter);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  return app;
}

module.exports = { createApp };
