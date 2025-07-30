// controllers/authController.js
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository'); // Necesario para registro local
const path = require('path');
const jwt = require('jsonwebtoken');
const passport = require('passport'); // Necesario para la autenticación local

const getLoginPage = (req, res) => {
  // Simplemente envía el archivo HTML de login
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
};

const getDashboard = async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
    } catch (error) {
      console.error('Error al obtener perfil de usuario:', error);
      res.status(500).send('Error interno del servidor.');
    }
  } else {
    res.redirect('/auth/login');
  }
};

const handleLoginFailure = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'login-failure.html'));
};

const handleLogout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
};

const registerUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
  }

  try {
    let user = await userRepository.findUserByEmail(email);
    if (user) {
      return res.status(409).json({ message: 'El email ya está registrado.' });
    }

    user = await userRepository.findOrCreateUserByEmailPassword(email, password);

    res.status(201).json({ message: 'Usuario registrado exitosamente. Por favor, inicie sesión.' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
  }
};

const localLogin = (req, res, next) => {
  const wantsJwt = req.body.getJwt || req.query.getJwt === 'true';

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Error en autenticación local:', err);
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ message: info.message || 'Credenciales inválidas.' });
    }

    if (!user.isActive) {
      if (wantsJwt) {
        return res.status(403).json({ message: 'Acceso denegado. Su cuenta no está activa para usar la API.' });
      }
      return res.redirect('/access-pending');
    }

    if (wantsJwt) {
      const jwtPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
      const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ message: 'JWT generado exitosamente.', token: token });
    } else {
      req.logIn(user, async (err) => {
        if (err) {
          console.error('Error al iniciar sesión local:', err);
          return next(err);
        }
        res.status(200).json({ message: 'Inicio de sesión exitoso con email/contraseña.', redirect: '/auth/dashboard' });
      });
    }
  })(req, res, next);
};

const getJwtToken = async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'No autenticado. Inicie sesión primero (OAuth o Local).' });
  }

  if (!req.user.isActive) {
    return res.status(403).json({ message: 'Acceso denegado. Su cuenta no está activa para usar la API.' });
  }

  const jwtPayload = {
    id: req.user._id,
    email: req.user.email,
    role: req.user.role,
    isActive: req.user.isActive,
  };

  const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.status(200).json({ message: 'JWT generado exitosamente.', token: token });
};

// --- NEW ---
/**
 * Checks if the currently authenticated user is an admin.
 * This endpoint is purely for UX purposes on the frontend to decide
 * whether to show or hide UI elements like an "Admin Panel" link.
 * It MUST be protected by an authentication middleware.
 */
const checkAdminStatus = (req, res) => {
  // The `authenticateRequest` middleware should have already run,
  // so we can safely check req.user.
  const isAdmin = req.user && req.user.role === 'admin';
  res.status(200).json({ isAdmin: isAdmin });
};

module.exports = {
  getLoginPage,
  getDashboard,
  handleLoginFailure,
  handleLogout,
  registerUser,
  localLogin,
  getJwtToken,
  checkAdminStatus, // <-- Export the new function
};