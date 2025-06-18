// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Ruta para iniciar el proceso de autenticación de Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Ruta de callback de Google después de la autenticación
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login-failure',
    successRedirect: '/dashboard',
  }),
);

// Ruta para manejar fallos de autenticación
router.get('/login-failure', authController.handleLoginFailure);

// Ruta de ejemplo para el dashboard (protegida)
router.get('/dashboard', ensureAuthenticated, authController.getDashboard);

// Ruta para cerrar sesión
router.get('/logout', authController.handleLogout);

module.exports = router;