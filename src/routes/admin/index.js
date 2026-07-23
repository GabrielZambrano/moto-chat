'use strict';
// Router raiz del panel administrativo. Monta los sub-routers bajo /api/admin.
const express = require('express');
const router = express.Router();

router.use('/', require('./authRoutes'));            // /login, /me
router.use('/stats', require('./statsRoutes'));      // /stats
router.use('/conductores', require('./conductoresRoutes'));
router.use('/pedidos', require('./pedidosRoutes'));
router.use('/sectores', require('./sectoresRoutes'));

module.exports = router;
