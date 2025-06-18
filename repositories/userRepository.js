// repositories/userRepository.js
const User = require('../models/user'); // Asume que User.js está en la carpeta models

const findUserById = async (id) => {
  return await User.findById(id);
};

const findOrCreateUserByGoogleId = async (profile) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
    });
  }
  return user;
};

// Puedes añadir más funciones como updateUser, deleteUser, etc.

module.exports = {
  findUserById,
  findOrCreateUserByGoogleId,
};