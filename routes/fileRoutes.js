// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { ensureAuthenticated, ensureApiAccess } = require('../middleware/authMiddleware'); // Importa ensureApiAccess

// Ruta para subir y convertir un archivo
// Requiere autenticación Y acceso a la API
router.post(
  '/upload',
  ensureAuthenticated,
  ensureApiAccess, // NUEVO: Verifica que el usuario tenga acceso a la API
  fileController.upload.single('file'),
  fileController.uploadAndConvertFile,
);

// Ruta para descargar un archivo convertido
// Requiere autenticación Y acceso a la API
router.get('/:jobId/download', ensureAuthenticated, ensureApiAccess, fileController.getConvertedFile);

// Ruta para descargar el reporte de errores
// Requiere autenticación Y acceso a la API
router.get('/:jobId/errors', ensureAuthenticated, ensureApiAccess, fileController.getErrorReport);

module.exports = router;