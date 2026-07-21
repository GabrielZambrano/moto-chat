'use strict';
// Levanta el server y (si aplica) registra el webhook. En produccion con dominio
// propio, define PUBLIC_URL en .env y este script registra el webhook directo.
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const greenapi = require('../src/config/greenapi');

const PUBLIC_URL = process.env.PUBLIC_URL; // ej. https://api.midominio.com

const server = spawn('node', [path.join(__dirname, '..', 'index.js')], { stdio: 'inherit' });

setTimeout(async () => {
  try {
    if (PUBLIC_URL) {
      const webhookUrl = `${PUBLIC_URL.replace(/\/$/, '')}/webhook`;
      await greenapi.setWebhook(webhookUrl);
      console.log('[start] Webhook registrado:', webhookUrl);
    } else {
      console.log('[start] PUBLIC_URL no definida. Usa `npm run tunnel` con ngrok o registra el webhook manualmente.');
    }
  } catch (err) {
    console.error('[start] No se pudo registrar el webhook:', err.message);
  }
}, 3000);

process.on('SIGINT', () => { server.kill('SIGINT'); process.exit(0); });
