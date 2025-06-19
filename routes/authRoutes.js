// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Ruta principal para mostrar la página de inicio de sesión
router.get('/login', authController.getLoginPage);

// Ruta para iniciar el proceso de autenticación de Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Ruta de callback de Google después de la autenticación
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login-failure',
    successRedirect: '/auth/dashboard', // Redirige al dashboard HTML
  }),
);

// Ruta para manejar fallos de autenticación
router.get('/login-failure', authController.handleLoginFailure);

// Ruta de ejemplo para el dashboard (protegida y muestra HTML)
router.get('/dashboard', ensureAuthenticated, authController.getDashboard);

// Ruta para cerrar sesión
router.get('/logout', authController.handleLogout);

module.exports = router;