'use strict';
// Configuracion de subida de la foto del conductor (multer, almacenamiento en disco).
// Las fotos quedan en public/uploads/conductores y se sirven como estaticos.
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'conductores');
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DIR),
  filename: (req, file, cb) => {
    const phone = String(req.body.phoneFull || req.body.telefono || 'conductor').replace(/\D/g, '');
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${phone || Date.now()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error('Formato no soportado. Usa JPG, PNG o WEBP.'));
}

const uploadFoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('foto');

// Ruta publica relativa (para guardar en BD) a partir del archivo subido.
function rutaPublica(file) {
  return file ? `/uploads/conductores/${file.filename}` : null;
}

module.exports = { uploadFoto, rutaPublica };
