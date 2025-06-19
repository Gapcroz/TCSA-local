// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateRequest } = require('../middleware/authMiddleware'); // Solo authenticateRequest

// Todas estas rutas requieren que el usuario esté autenticado por sesión O JWT
// PERO, para set-password y unlink-google, necesitas que req.user tenga id,
// que siempre se da por JWT o Session.
router.get('/profile', authenticateRequest, userController.getUserProfile);
router.post('/set-password', authenticateRequest, userController.setUpdatePassword);
router.post('/unlink-google', authenticateRequest, userController.unlinkGoogle);

module.exports = router;