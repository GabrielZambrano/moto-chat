'use strict';
// API REST de consulta de pedidos.
const express = require('express');
const router = express.Router();
const pedidosRepo = require('../repositories/pedidosRepo');

// GET /pedidos?estado=pendiente&limit=50
router.get('/', async (req, res) => {
  try {
    const pedidos = await pedidosRepo.listar({ estado: req.query.estado, limit: req.query.limit });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
