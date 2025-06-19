// config/passport.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userRepository = require('../repositories/userRepository'); // Usar el repositorio

module.exports = (passport) => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await userRepository.findOrCreateUserByGoogleId(profile);
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );

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