'use strict';
// Rutas de estadisticas del dashboard (protegidas).
const express = require('express');
const router = express.Router();
const statsService = require('../../services/statsService');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// GET /api/admin/stats
router.get('/', async (_req, res) => {
  try {
    const data = await statsService.resumen();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
