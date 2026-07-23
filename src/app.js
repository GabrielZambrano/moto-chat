'use strict';
// Configura Express y monta las rutas. Captura rawBody (para validar firmas).
const express = require('express');
const path = require('path');

const webhookRouter = require('./routes/webhook');
const ycloudWebhookRouter = require('./routes/ycloudWebhook');
const conductoresRouter = require('./routes/conductores');
const clientesRouter = require('./routes/clientes');
const pedidosRouter = require('./routes/pedidos');
const adminRouter = require('./routes/admin');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();

  // Captura el cuerpo crudo para poder validar firmas HMAC (YCloud).
  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
  }));
  app.use(express.urlencoded({ extended: true }));

  // Salud
  app.get('/health', (_req, res) => res.json({ status: 'up', time: new Date().toISOString() }));

  // Webhooks
  app.use('/webhook', webhookRouter);              // Green API (cliente + grupo)
  app.use('/webhook/ycloud', ycloudWebhookRouter); // YCloud (cliente)

  // API del panel administrativo
  app.use('/api/admin', adminRouter);

  // API REST publica (compatibilidad)
  app.use('/conductores', conductoresRouter);
  app.use('/clientes', clientesRouter);
  app.use('/pedidos', pedidosRouter);

  // Estaticos: fotos subidas y panel administrativo
  app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
  app.use('/admin', express.static(PUBLIC_DIR));
  // SPA fallback: cualquier ruta del panel devuelve el index.
  app.get(/^\/admin(\/.*)?$/, (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  // Raiz -> panel
  app.get('/', (_req, res) => res.redirect('/admin/'));

  // 404
  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  return app;
}

module.exports = { createApp };
