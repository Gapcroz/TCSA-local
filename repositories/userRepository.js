// repositories/userRepository.js
const User = require('../models/User');

const findUserById = async (id) => {
  return await User.findById(id);
};

const findUserByEmail = async (email) => { // Añadido para admin panel
  return await User.findOne({ email });
};

const findOrCreateUserByGoogleId = async (profile) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
      isActive: false, // NUEVO: Por defecto, inactivo hasta que un admin lo active
      role: 'user', // NUEVO: Rol por defecto 'user'
    });
  }
  return user;
};

const updateUserAccess = async (userId, isActive, role) => { // Función para admin
  return await User.findByIdAndUpdate(userId, { isActive, role }, { new: true });
};

const getAllUsers = async () => { // Función para que el admin vea a todos
  return await User.find({});
};

module.exports = {
  findUserById,
  findUserByEmail,
  findOrCreateUserByGoogleId,
  updateUserAccess,
  getAllUsers,
};