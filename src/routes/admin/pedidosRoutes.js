'use strict';
// Rutas de consulta de pedidos/viajes en el panel (protegidas).
const express = require('express');
const router = express.Router();
const pedidosRepo = require('../../repositories/pedidosRepo');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// GET /api/admin/pedidos?estado=&limit=
router.get('/', async (req, res) => {
  try {
    const pedidos = await pedidosRepo.listar({
      estado: req.query.estado,
      limit: req.query.limit || 100,
    });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
