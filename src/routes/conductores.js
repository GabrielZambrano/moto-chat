'use strict';
// API REST CRUD de conductores (esquema unificado: phoneFull, fullName, plate, unit, estado).
const express = require('express');
const router = express.Router();
const conductoresRepo = require('../repositories/conductoresRepo');

// POST /conductores  -> alta / upsert
router.post('/', async (req, res) => {
  try {
    const { phoneFull, telefono, fullName, nombre, plate, placa, unit, unidad, estado } = req.body || {};
    const phone = phoneFull || telefono;
    const name = fullName || nombre;
    if (!phone || !name) return res.status(400).json({ error: 'phoneFull y fullName son obligatorios' });
    const c = await conductoresRepo.crear({
      phoneFull: String(phone).replace(/\D/g, ''),
      fullName: name,
      plate: plate || placa || null,
      unit: unit || unidad || null,
      estado,
    });
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /conductores?estado=disponible
router.get('/', async (req, res) => {
  try {
    const c = await conductoresRepo.listar({ estado: req.query.estado });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /conductores/:id -> cambiar estado
router.patch('/:id', async (req, res) => {
  try {
    const { estado } = req.body || {};
    if (!['disponible', 'ocupado', 'inactivo'].includes(estado)) {
      return res.status(400).json({ error: 'estado invalido' });
    }
    const c = await conductoresRepo.actualizarEstado(req.params.id, estado);
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /conductores/:id
router.delete('/:id', async (req, res) => {
  try {
    await conductoresRepo.eliminar(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
