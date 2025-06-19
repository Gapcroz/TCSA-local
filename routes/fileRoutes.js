// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
// Importa el nuevo middleware unificado
const { authenticateRequest, ensureApiAccess } = require('../middleware/authMiddleware');

// Middleware para autenticar la solicitud y luego verificar acceso a la API
// authenticateRequest se encarga de probar JWT o Sesión.
const API_PROTECTED = [
  authenticateRequest, // <--- Único middleware para autenticación
  ensureApiAccess,
];

// Ruta para subir y convertir un archivo
router.post(
  '/upload',
  API_PROTECTED, // Usa el array de middlewares
  fileController.upload.single('file'),
  fileController.uploadAndConvertFile,
);

// Ruta para descargar un archivo convertido
router.get('/:jobId/download', API_PROTECTED, fileController.getConvertedFile);

// Ruta para descargar el reporte de errores
router.get('/:jobId/errors', API_PROTECTED, fileController.getErrorReport);

module.exports = router;