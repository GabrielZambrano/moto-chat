'use strict';
// Rutas de gestion de sectores/poligonos (protegidas).
const express = require('express');
const router = express.Router();
const sectoresRepo = require('../../repositories/sectoresRepo');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

function coordsValidas(c) {
  return Array.isArray(c) && c.length >= 3
    && c.every((p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
}

// GET /api/admin/sectores
router.get('/', async (_req, res) => {
  try {
    res.json(await sectoresRepo.listar());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sectores  { nombreSector, coordenadas: [{lat,lng}] }
router.post('/', async (req, res) => {
  try {
    const { nombreSector, coordenadas } = req.body || {};
    if (!nombreSector || !String(nombreSector).trim()) {
      return res.status(400).json({ error: 'El nombre del sector es obligatorio.' });
    }
    if (!coordsValidas(coordenadas)) {
      return res.status(400).json({ error: 'Coordenadas inválidas (mínimo 3 puntos con lat/lng).' });
    }
    const coords = coordenadas.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    const s = await sectoresRepo.crear({ nombreSector: String(nombreSector).trim(), coordenadas: coords });
    res.status(201).json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/sectores/:id  { nombreSector }  -> renombrar
router.put('/:id', async (req, res) => {
  try {
    const { nombreSector } = req.body || {};
    if (!nombreSector || !String(nombreSector).trim()) {
      return res.status(400).json({ error: 'El nombre del sector es obligatorio.' });
    }
    const s = await sectoresRepo.actualizarNombre(req.params.id, String(nombreSector).trim());
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/sectores/:id
router.delete('/:id', async (req, res) => {
  try {
    await sectoresRepo.eliminar(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
