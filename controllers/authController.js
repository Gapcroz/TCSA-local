// controllers/authController.js
const authService = require('../services/authService');

const getDashboard = async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user = await authService.getUserProfile(req.user.id);
      res.status(200).json({ message: 'Bienvenido al dashboard!', user: user.displayName, email: user.email });
    } catch (error) {
      console.error('Error al obtener perfil de usuario:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  } else {
    res.status(401).json({ message: 'No autenticado.' });
  }
};

const handleLoginFailure = (req, res) => {
  res.status(401).json({ message: 'Fallo la autenticación con Google.' });
};

const handleLogout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
  });
};

module.exports = {
  getDashboard,
  handleLoginFailure,
  handleLogout,
};