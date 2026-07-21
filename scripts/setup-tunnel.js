'use strict';
// Obtiene la URL publica de ngrok (API local :4040) y registra el webhook en Green API.
// Solo necesario si el servidor NO tiene dominio/HTTPS propio.
require('dotenv').config();
const axios = require('axios');
const greenapi = require('../src/config/greenapi');

async function urlNgrok() {
  const { data } = await axios.get('http://localhost:4040/api/tunnels', { timeout: 5000 });
  const t = (data.tunnels || []).find((x) => x.public_url.startsWith('https://'));
  if (!t) throw new Error('No hay tunel HTTPS activo en ngrok (levanta: ngrok http ' + (process.env.PORT || 3001) + ')');
  return t.public_url;
}

(async () => {
  try {
    const base = await urlNgrok();
    const webhookUrl = `${base}/webhook`;
    console.log('[tunnel] URL publica:', base);
    const res = await greenapi.setWebhook(webhookUrl);
    console.log('[tunnel] Webhook registrado en Green API:', webhookUrl, res);
  } catch (err) {
    console.error('[tunnel] Error:', err.message);
    process.exit(1);
  }
})();
