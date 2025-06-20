// middleware/authMiddleware.js

const passport = require('passport'); // Asegúrate de importar passport aquí

// Middleware para intentar autenticar la solicitud usando JWT o Sesión.
// Debería ir ANTES de ensureApiAccess o ensureAdmin.
const authenticateRequest = (req, res, next) => {
  // Opción 1: Intentar con JWT (para acceso programático)
  passport.authenticate('jwt', { session: false }, (jwtErr, jwtUser, jwtInfo) => {
    // Si la autenticación JWT fue exitosa, o hubo un error significativo que no es "token not found"
    if (jwtUser) {
      req.user = jwtUser; // Popula req.user con el usuario del JWT
      return next(); // Continúa al siguiente middleware (ej. ensureApiAccess)
    }

    // Si hubo un error en JWT que no sea simplemente "token no presente"
    if (jwtErr && jwtErr.message !== 'No auth token') { // Puedes ajustar este mensaje de error de Passport JWT
        console.warn('Error durante autenticación JWT:', jwtErr.message);
        return res.status(401).json({ message: 'Token JWT inválido o expirado.', error: jwtErr.message });
    }


    // Opción 2: Si JWT falló (o no se presentó), intentar con la Sesión (para navegador)
    passport.authenticate('session', (sessionErr, sessionUser, sessionInfo) => {
      if (sessionUser) {
        req.user = sessionUser; // Popula req.user con el usuario de la sesión
        return next(); // Continúa
      }

      // Si ninguna autenticación fue exitosa
      res.status(401).json({ message: 'Autenticación requerida: Se necesita un token JWT válido o una sesión activa.' });
    })(req, res, next); // Llama a la estrategia de sesión con req, res, next

  })(req, res, next); // Llama a la estrategia JWT con req, res, next
};


// Middlewares de Autorización (mantienen la misma lógica, ahora confían en req.user)

const ensureApiAccess = (req, res, next) => {
  // req.user ya debería estar populado por authenticateRequest si la autenticación fue exitosa
  if (!req.user) {
    // Esto no debería suceder si authenticateRequest funciona correctamente,
    // pero es un fallback.
    return res.status(401).json({ message: 'No autenticado. Se necesita un token JWT o sesión activa.' });
  }

  // Si el usuario es un cliente API, verificar que tenga los permisos adecuados para la API de conversión
  // Esto es para distinguir si req.user es un usuario humano o un cliente API si hubieras mantenido apiClient
  // Si solo hay usuarios humanos, puedes simplificar esto a req.user.isActive
  if (req.user.isApiClient) { // Si usaste el modelo ApiClient
      // req.user.permissions.includes('convert_files') o similar
      // return res.status(403).json({ message: 'Cliente API no autorizado para esta operación.' });
      return next(); // Por ahora, si es API client, dejamos pasar (asumiendo isActive ya está en el payload JWT si es relevante para ellos)
  }

  // Para usuarios humanos
  if (req.user.isActive) {
    return next();
  }
  res.status(403).json({ message: 'Acceso denegado. Su cuenta de usuario no está activa para usar la API.' });
};

const ensureAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado. Se requiere un token JWT o sesión activa.' });
  }
  // Verificar el rol
  if (req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
};

module.exports = {
  authenticateRequest, // Exporta el nuevo middleware unificado
  ensureApiAccess,
  ensureAdmin,
};