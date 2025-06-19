// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/authMiddleware'); // Importa ensureAdmin

// Todas las rutas de administración requieren que el usuario esté autenticado y sea admin
router.get('/users', ensureAuthenticated, ensureAdmin, adminController.getAllUsers);
router.put('/users/:userId/access', ensureAuthenticated, ensureAdmin, adminController.updateUserAccess);

module.exports = router;