'use strict';
// Rutas de autenticacion del panel (publicas: login; protegida: me).
const express = require('express');
const router = express.Router();
const authService = require('../../services/authService');
const { requireAuth } = require('../../middleware/auth');

// POST /api/admin/login  { usuario, password }
router.post('/login', (req, res) => {
  const { usuario, password } = req.body || {};
  try {
    const { token, user } = authService.login(usuario, password);
    res.json({ token, user });
  } catch (err) {
    const status = err.code === 'BAD_CREDENTIALS' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/admin/me  (verifica sesion)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { usuario: req.admin.sub, role: req.admin.role } });
});

module.exports = router;
