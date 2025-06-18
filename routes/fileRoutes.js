// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Ruta para subir y convertir un archivo
// Usa el middleware `upload.single('file')` para procesar una única carga de archivo
router.post('/upload', ensureAuthenticated, fileController.upload.single('file'), fileController.uploadAndConvertFile);

// Ruta para descargar un archivo convertido
router.get('/:jobId/download', ensureAuthenticated, fileController.getConvertedFile);

// Ruta para descargar el reporte de errores
router.get('/:jobId/errors', ensureAuthenticated, fileController.getErrorReport);

module.exports = router;