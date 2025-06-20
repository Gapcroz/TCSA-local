// config/passport.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy; // Importa LocalStrategy
const userRepository = require('../repositories/userRepository');

module.exports = (passport) => {
  // Estrategia de Google (ya existente)
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true, // Muy importante para acceder a req.user (sesión actual)
      },
      async (req, accessToken, refreshToken, profile, done) => { // req como primer argumento
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

          // ESCENARIO 1: Usuario ya autenticado y quiere vincular su cuenta de Google
          if (req.user) {
            // Si el usuario ya tiene sesión y está vinculando Google
            const currentUser = await userRepository.findUserById(req.user.id);
            if (!currentUser) {
              return done(null, false, { message: 'Usuario actual no encontrado.' });
            }

            // Si la cuenta de Google ya está vinculada a otro usuario
            const existingGoogleUser = await userRepository.findUserByEmail(email);
            if (existingGoogleUser && existingGoogleUser.id !== currentUser.id) {
              return done(null, false, { message: 'Esta cuenta de Google ya está vinculada a otro usuario.' });
            }

            // Vincular GoogleId a la cuenta actual
            currentUser.googleId = profile.id;
            await currentUser.save();
            return done(null, currentUser);
          }

          // ESCENARIO 2: Usuario NO autenticado, intenta iniciar sesión con Google
          // o es un nuevo registro/login con Google.

          // Buscar usuario existente por Google ID
          let user = await userRepository.findUserByGoogleId(profile.id); // Asume que agregaste esta función a userRepository

          if (user) {
            return done(null, user); // Usuario ya existe con este Google ID
          }

          // Si no se encuentra por Google ID, buscar por Email (para vincular si ya tiene cuenta local sin Google)
          if (email) {
            user = await userRepository.findUserByEmail(email);
            if (user) {
              // Si existe un usuario con ese email (local), vincular cuenta de Google
              user.googleId = profile.id;
              // Si display name no está configurado, usa el de Google
              if (!user.displayName) user.displayName = profile.displayName;
              await user.save();
              return done(null, user);
            }
          }

          // Si no se encontró ningún usuario existente, crear uno nuevo
          const newUser = await userRepository.findOrCreateUserByGoogleId(profile);
          return done(null, newUser);
        } catch (err) {
          console.error('Error en estrategia Google:', err);
          return done(err, null);
        }
      },
    ),
  );

  // NUEVO: Estrategia Local (Email y Contraseña)
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' }, // El campo del request body que contendrá el email
      async (email, password, done) => {
        try {
          const user = await userRepository.findUserByEmail(email);

          if (!user) {
            // Usuario no encontrado (o no registrado con esta forma)
            return done(null, false, { message: 'Credenciales inválidas.' });
          }

          // Comparar la contraseña ingresada con la hasheada en la DB
          const isMatch = await user.comparePassword(password);

          if (!isMatch) {
            // Contraseña incorrecta
            return done(null, false, { message: 'Credenciales inválidas.' });
          }

          // Si todo es correcto, devolver el usuario
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Serialización y Deserialización (mantener igual, ya manejan User por ID)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userRepository.findUserById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};