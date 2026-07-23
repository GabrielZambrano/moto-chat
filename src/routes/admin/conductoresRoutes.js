'use strict';
// Rutas de gestion de conductores en el panel (protegidas). Soportan subida de foto.
const express = require('express');
const router = express.Router();
const conductoresRepo = require('../../repositories/conductoresRepo');
const conductorService = require('../../services/conductorService');
const greenapi = require('../../config/greenapi');
const { requireAuth } = require('../../middleware/auth');
const { uploadFoto, rutaPublica } = require('../../config/upload');

router.use(requireAuth);

// Envuelve multer para devolver errores como JSON legible.
function conFoto(req, res, next) {
  uploadFoto(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// GET /api/admin/conductores?estado=
router.get('/', async (req, res) => {
  try {
    const lista = await conductoresRepo.listar({ estado: req.query.estado });
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/conductores  (multipart: phoneFull, fullName, plate, unit, estado, foto)
router.post('/', conFoto, async (req, res) => {
  try {
    const { phoneFull, telefono, fullName, plate, unit, estado } = req.body || {};
    // Normalizamos a formato internacional (593...) para que coincida con WhatsApp.
    const phone = conductorService.aInternacional(phoneFull || telefono || '');
    if (!phone || !fullName) {
      return res.status(400).json({ error: 'Teléfono y nombre del conductor son obligatorios.' });
    }
    const foto = rutaPublica(req.file);
    const c = await conductoresRepo.crear({
      phoneFull: phone,
      fullName,
      plate,
      unit,
      estado,
      ...(foto ? { fotoUrl: foto } : {}),
    });
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/conductores/:id  (edicion; multipart opcional con nueva foto)
router.put('/:id', conFoto, async (req, res) => {
  try {
    const { fullName, plate, unit, estado, phoneFull, telefono } = req.body || {};
    const foto = rutaPublica(req.file);
    // Permitir cambiar el numero (normalizado a internacional).
    const nuevoPhone = (phoneFull || telefono)
      ? conductorService.aInternacional(phoneFull || telefono)
      : undefined;
    const c = await conductoresRepo.actualizar(req.params.id, {
      fullName, plate, unit, estado, nuevoPhone,
      ...(foto ? { fotoUrl: foto } : {}),
    });
    res.json(c);
  } catch (err) {
    const msg = /Unique constraint/.test(err.message)
      ? 'Ya existe un conductor con ese número de teléfono.'
      : err.message;
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/admin/conductores/:id/estado  { estado }
router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body || {};
    if (!['disponible', 'ocupado', 'inactivo'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    const c = await conductoresRepo.actualizarEstado(req.params.id, estado);
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Traduce errores de Green API a un mensaje claro para el panel.
function errorGrupo(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  const detalle = typeof data === 'string' ? data.slice(0, 200) : (data ? JSON.stringify(data) : err.message);
  console.error('[grupo] Green API error:', status || '', detalle);
  // Restriccion anti-spam de WhatsApp (bloquea agregar y generar enlaces).
  if (status === 423 || /reachout_restricted|403 Forbidden/i.test(detalle)) {
    return 'El número del bot está temporalmente RESTRINGIDO por WhatsApp (anti-spam) y no puede agregar ni generar enlaces por ahora. '
      + 'Solución: abre WhatsApp en el teléfono del bot → grupo "Grupo de Unidades" → Info del grupo → "Invitar al grupo mediante enlace" → copia ese enlace y pásalo al conductor.';
  }
  return `No se pudo completar. Green API respondió: ${detalle}`;
}

// GET /api/admin/conductores/grupo/invite-link  -> enlace de invitacion al grupo
router.get('/grupo/invite-link', async (_req, res) => {
  try {
    const r = await greenapi.getGroupInviteLink();
    if (r && r.inviteLink) return res.json({ link: r.inviteLink });
    return res.status(422).json({ error: 'No se pudo obtener el enlace del grupo.' });
  } catch (err) {
    res.status(422).json({ error: errorGrupo(err) });
  }
});

// POST /api/admin/conductores/:id/grupo  -> agregar al grupo de conductores
router.post('/:id/grupo', async (req, res) => {
  try {
    const r = await greenapi.addGroupParticipant(req.params.id);
    if (r && r.addParticipant) return res.json({ ok: true });
    return res.status(422).json({
      error: 'WhatsApp no permitió agregarlo. Puede que ya esté en el grupo, que el bot no sea administrador, o que el conductor no permita ser agregado a grupos.',
    });
  } catch (err) {
    res.status(422).json({ error: errorGrupo(err) });
  }
});

// DELETE /api/admin/conductores/:id/grupo  -> quitar del grupo
router.delete('/:id/grupo', async (req, res) => {
  try {
    const r = await greenapi.removeGroupParticipant(req.params.id);
    if (r && r.removeParticipant) return res.json({ ok: true });
    return res.status(422).json({
      error: 'WhatsApp no permitió quitarlo. Puede que no esté en el grupo o que el bot no sea administrador.',
    });
  } catch (err) {
    res.status(422).json({ error: errorGrupo(err) });
  }
});

// DELETE /api/admin/conductores/:id
router.delete('/:id', async (req, res) => {
  try {
    await conductoresRepo.eliminar(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
