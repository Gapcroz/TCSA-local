// config/passportJwt.js
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const userRepository = require('../repositories/userRepository'); // Solo necesitamos el repositorio de usuarios

module.exports = (passport) => {
  const opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  opts.secretOrKey = process.env.JWT_SECRET;

  passport.use(
    'jwt', // Nombre de la estrategia
    new JwtStrategy(opts, async (jwt_payload, done) => {
      try {
        // En este esquema, el payload JWT siempre contendrá 'id' (del usuario)
        // ya que los JWTs solo se emiten para usuarios humanos (Google o local)
        const user = await userRepository.findUserById(jwt_payload.id);

        if (user) {
          // Asegúrate de que el usuario esté activo
          if (!user.isActive) {
            // El usuario existe pero su cuenta no está activa para usar la API
            return done(null, false, { message: 'Cuenta de usuario inactiva.' });
          }
          // Si todo es correcto, devuelve el objeto de usuario
          return done(null, user);
        } else {
          // Usuario no encontrado en la base de datos (quizás fue eliminado después de emitir el token)
          return done(null, false, { message: 'Usuario no encontrado.' });
        }
      } catch (err) {
        // Manejar cualquier error de la base de datos o de otro tipo
        console.error('Error en la estrategia JWT:', err);
        return done(err, false);
      }
    }),
  );
};