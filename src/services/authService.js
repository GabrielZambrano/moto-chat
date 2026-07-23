'use strict';
// Autenticacion del panel administrativo.
// Responsabilidad unica: validar credenciales y emitir/verificar tokens JWT.
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''; // fallback en texto plano (menos seguro)
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_TTL = process.env.JWT_TTL || '12h';

function credencialesConfiguradas() {
  return Boolean(JWT_SECRET && (ADMIN_PASSWORD_HASH || ADMIN_PASSWORD));
}

function passwordCorrecta(password) {
  if (!password) return false;
  if (ADMIN_PASSWORD_HASH) return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  if (ADMIN_PASSWORD) return password === ADMIN_PASSWORD;
  return false;
}

// Devuelve { token, user } o lanza Error con .code.
function login(usuario, password) {
  if (!credencialesConfiguradas()) {
    const e = new Error('El panel no tiene credenciales configuradas (ADMIN_PASSWORD_HASH / JWT_SECRET).');
    e.code = 'NO_CONFIG';
    throw e;
  }
  if (usuario !== ADMIN_USER || !passwordCorrecta(password)) {
    const e = new Error('Usuario o contraseña incorrectos.');
    e.code = 'BAD_CREDENTIALS';
    throw e;
  }
  const token = jwt.sign({ sub: ADMIN_USER, role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: { usuario: ADMIN_USER, role: 'admin' } };
}

function verificar(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { login, verificar, credencialesConfiguradas };
