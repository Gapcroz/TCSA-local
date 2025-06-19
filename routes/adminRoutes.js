// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
// Importa el nuevo middleware unificado
const { authenticateRequest, ensureAdmin } = require('../middleware/authMiddleware');

// Middleware para autenticar la solicitud y luego verificar rol de admin
const ADMIN_PROTECTED = [
  authenticateRequest, // <--- Único middleware para autenticación
  ensureAdmin,
];

// Todas las rutas de administración requieren que el usuario sea admin
router.get('/users', ADMIN_PROTECTED, adminController.getAllUsers);
router.put('/users/:userId/access', ADMIN_PROTECTED, adminController.updateUserAccess);

module.exports = router;