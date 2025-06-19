// middleware/authMiddleware.js

// Middleware para verificar si el usuario está autenticado
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'No autenticado. Por favor, inicie sesión.' });
};

// Middleware para verificar si el usuario tiene acceso (isActive = true)
const ensureApiAccess = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.isActive) {
    return next();
  }
  res.status(403).json({ message: 'Acceso denegado. Su cuenta no está activa para usar la API.' });
};

// Middleware para verificar si el usuario es administrador
const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
};

module.exports = {
  ensureAuthenticated,
  ensureApiAccess,
  ensureAdmin,
};