'use strict';
// Lista los grupos de WhatsApp y su chatId (para fijar GREENAPI_GROUP_CHAT_ID).
require('dotenv').config();
const greenapi = require('../src/config/greenapi');

(async () => {
  try {
    const grupos = await greenapi.getGroups();
    if (!grupos.length) { console.log('No se encontraron grupos.'); return; }
    console.log('Grupos de WhatsApp encontrados:\n');
    grupos.forEach((g) => console.log(`  ${g.name || '(sin nombre)'}  ->  ${g.id}`));
    console.log('\nCopia el chatId (…@g.us) del grupo de conductores a GREENAPI_GROUP_CHAT_ID en .env');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
