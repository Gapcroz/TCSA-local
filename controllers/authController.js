// controllers/authController.js
const authService = require('../services/authService');
const path = require('path'); // Importar módulo path

const getLoginPage = (req, res) => {
  // Simplemente envía el archivo HTML de login
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
};

const getDashboard = async (req, res) => {
  console.log(req);
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

module.exports = {
  getLoginPage,
  getDashboard,
  handleLoginFailure,
  handleLogout,
};