'use strict';
// API REST de clientes y direcciones.
const express = require('express');
const router = express.Router();
const clientesRepo = require('../repositories/clientesRepo');
const pedidosRepo = require('../repositories/pedidosRepo');

// POST /clientes -> alta
router.post('/', async (req, res) => {
  try {
    const { telefono, nombre } = req.body || {};
    if (!telefono) return res.status(400).json({ error: 'telefono es obligatorio' });
    const c = await clientesRepo.ensure(String(telefono).replace(/\D/g, ''), nombre);
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /clientes/:telefono
router.get('/:telefono', async (req, res) => {
  try {
    const c = await clientesRepo.get(req.params.telefono);
    if (!c) return res.status(404).json({ error: 'no encontrado' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /clientes/:telefono/direcciones
router.post('/:telefono/direcciones', async (req, res) => {
  try {
    const { direccion, lat, lng, mapsUrl } = req.body || {};
    if (!direccion) return res.status(400).json({ error: 'direccion es obligatoria' });
    await clientesRepo.agregarDireccion(req.params.telefono, { direccion, lat, lng, mapsUrl });
    const c = await clientesRepo.get(req.params.telefono);
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
