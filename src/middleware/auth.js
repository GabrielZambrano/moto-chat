'use strict';
// Guard de rutas del panel: exige un JWT valido (header Authorization: Bearer <token>).
const authService = require('../services/authService');

function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');
  const payload = authService.verificar(token);
  if (!payload) return res.status(401).json({ error: 'No autorizado. Inicia sesión de nuevo.' });
  req.admin = payload;
  next();
}

module.exports = { requireAuth };
