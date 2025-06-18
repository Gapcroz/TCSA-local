// services/authService.js
const userRepository = require('../repositories/userRepository');

const getUserProfile = async (userId) => {
  
  return await userRepository.findUserById(userId);
};

// TODO: funciones para registro, login con usuario/contraseña, etc.
// pero con OAuth, Passport y el repositorio ya manejan mucho de esto.

module.exports = {
  getUserProfile,
};