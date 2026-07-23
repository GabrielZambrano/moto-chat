'use strict';
// Cambia la contraseña del panel: genera el hash bcrypt y lo escribe en .env (ADMIN_PASSWORD_HASH).
// Uso: node scripts/set-admin.js <nueva_contraseña> [usuario]
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const [, , pass, usuario] = process.argv;
if (!pass) {
  console.error('Uso: node scripts/set-admin.js <nueva_contraseña> [usuario]');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const hash = bcrypt.hashSync(pass, 10);

function upsert(key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(env)) env = env.replace(re, `${key}=${value}`);
  else env += `\n${key}=${value}`;
}

upsert('ADMIN_PASSWORD_HASH', hash);
if (usuario) upsert('ADMIN_USER', usuario);
fs.writeFileSync(envPath, env);
console.log('Contraseña actualizada.' + (usuario ? ` Usuario: ${usuario}` : ''));
console.log('Reinicia la app: pm2 restart mototaxi-server --update-env');
