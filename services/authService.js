// services/authService.js
const userRepository = require('../repositories/userRepository');

const getUserProfile = async (userId) => {
  
  return await userRepository.findUserById(userId);
};
const changeUserActivityStatus = async (userId, isActiveStatus) => {
  const user = await userRepository.updateUserStatus(userId, isActiveStatus);
  if (!user) {
    throw new Error('Usuario no encontrado.');
  }
  return user;
};

const listAllRegisteredUsers = async () => {
  return await userRepository.getAllUsers();
};
// TODO: funciones para registro, login con usuario/contraseña, etc.
// pero con OAuth, Passport y el repositorio ya manejan mucho de esto.

module.exports = {
  getUserProfile,
  changeUserActivityStatus,
  listAllRegisteredUsers
};