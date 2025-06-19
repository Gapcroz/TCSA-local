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
      // Opcional: obtener datos detallados del usuario
      // const user = await authService.getUserProfile(req.user.id);
      // res.status(200).json({ message: 'Bienvenido al dashboard!', user: user.displayName, email: user.email });
      res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html')); // Envía el HTML de dashboard
    } catch (error) {
      console.error('Error al obtener perfil de usuario:', error);
      res.status(500).send('Error interno del servidor.'); // Envía un mensaje simple
    }
  } else {
    // Si por alguna razón llega aquí sin autenticar, redirige a login
    res.redirect('/auth/login');
  }
};

const handleLoginFailure = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'login-failure.html')); // Envía el HTML de fallo
};

const handleLogout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    // Después del logout, redirige a la página de inicio o login
    res.redirect('/'); // O a '/auth/login'
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

    // Crea el usuario; la password se hasheará en el pre-save hook
    user = await userRepository.findOrCreateUserByEmailPassword(email, password);

    // Puedes hacer login automático aquí, o pedirle que inicie sesión
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

    // Antes de emitir JWT o iniciar sesión, verifica si el usuario está activo
    if (!user.isActive) {
      // Para flujo de API:
      if (wantsJwt) {
        return res.status(403).json({ message: 'Acceso denegado. Su cuenta no está activa para usar la API.' });
      }
      // Para flujo de navegador (mostrar HTML):
      // Si el dashboard redirige a access-pending.html, Passport ya lo manejaría.
      // O puedes forzar la redirección aquí para cuentas inactivas
      return res.redirect('/access-pending'); // Asegúrate de que esta ruta existe en server.js o authRoutes.js
    }


    if (wantsJwt) {
      // Si el cliente quiere JWT directamente, emitir el token y no establecer sesión de Express
      const jwtPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
      const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ message: 'JWT generado exitosamente.', token: token });
    } else {
      // Comportamiento por defecto: iniciar sesión basado en cookies y redirigir
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

// Endpoint para obtener JWT (se mantiene igual, no necesita cambios)
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
module.exports = {
  getLoginPage,
  getDashboard,
  handleLoginFailure,
  handleLogout,
  registerUser,
  localLogin,
  getJwtToken,
};