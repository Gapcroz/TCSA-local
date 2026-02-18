// repositories/userRepository.js
const User = require('../models/user');

const findUserById = async (id) => {
  return await User.findById(id);
};

const findUserByEmail = async (email) => { // Función clave para la estrategia Local
  return await User.findOne({ email });
};

const findOrCreateUserByGoogleId = async (profile) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
      isActive: false,
      role: 'user',
    });
  }
  return user;
};
const findUserByGoogleId = async (googleId) => {
  return await User.findOne({ googleId });
};
// Nueva función para crear o buscar usuario con email/password
const findOrCreateUserByEmailPassword = async (email, password) => {
  let user = await User.findOne({ email });
  if (!user) {
    // Si no existe, se registra
    user = await User.create({
      email,
      password, // La contraseña se hasheará en el pre-save hook del modelo
      displayName: email.split('@')[0], // Un display name por defecto
      isActive: false, // Por defecto, inactivo
      role: 'user',
    });
  }
  return user;
};

const updateUserAccess = async (userId, isActive, role) => {
  return await User.findByIdAndUpdate(userId, { isActive, role }, { new: true });
};

const deleteUserById = async (userId, session = null) => {
  const options = session ? { session } : {};
  return await User.findByIdAndDelete(userId, options);
};

const getAllUsers = async () => {
  return await User.find({});
};
const updateUserPassword = async (userId, newPassword) => {
  const user = await User.findById(userId);
  if (!user) return null;
  user.password = newPassword; // El pre-save hook se encargará de hashear
  await user.save();
  return user;
};

const linkGoogleAccount = async (userId, googleId) => {
  return await User.findByIdAndUpdate(userId, { googleId: googleId }, { new: true });
};

const unlinkGoogleAccount = async (userId) => {
  // Asegurarse de que el usuario tenga una contraseña si va a desvincular Google
  const user = await User.findById(userId);
  if (!user.password) { // Verifica si el campo de contraseña existe y tiene un valor
    // Puedes mejorar esta validación para chequear el hash o que sea un string no vacío.
    // Para simplificar, asumimos que si password existe, hay una contraseña.
    throw new Error('No puedes desvincular Google sin tener una contraseña establecida.');
  }
  return await User.findByIdAndUpdate(userId, { $unset: { googleId: 1 } }, { new: true }); // $unset elimina el campo
};

module.exports = {
  findUserById,
  findUserByEmail,
  findOrCreateUserByGoogleId,
  findUserByGoogleId,
  findOrCreateUserByEmailPassword, // Exporta la nueva función
  updateUserAccess,
  getAllUsers,
  updateUserPassword,
  linkGoogleAccount,
  unlinkGoogleAccount,
  deleteUserById,
};