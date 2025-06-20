// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateRequest, ensureApiAccess } = require('../middleware/authMiddleware');

// Middleware para autenticar la solicitud y luego verificar acceso a la API
// authenticateRequest se encarga de probar JWT o Sesión.
const API_PROTECTED = [
  authenticateRequest, // <--- Único middleware para autenticación
  ensureApiAccess,
];
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
router.get('/dashboard', API_PROTECTED, authController.getDashboard);

// Ruta para cerrar sesión
router.get('/logout', authController.handleLogout);
// NUEVO: Ruta para registro con email/contraseña
router.post('/register', authController.registerUser);

// NUEVO: Ruta para login con email/contraseña (inicia sesión de navegador)
router.post('/local-login', authController.localLogin);

// Ruta para obtener JWT (protegida por sesión, no por JWT aún)
router.get('/jwt', API_PROTECTED, authController.getJwtToken);

module.exports = router;