// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Importa bcryptjs

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Permite que haya usuarios sin googleId (si se registran con email/password)
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: { // Nuevo campo para la contraseña (hash)
    type: String,
    // No es 'required' si el usuario se registra solo con Google
  },
  displayName: String,
  isActive: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: Date, // Opcional: para rastrear el último login
});

// Middleware de Mongoose: Hashear la contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) { // Solo hashear si la password se modificó y no está vacía
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Método para comparar la contraseña ingresada con la hasheada
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // Si no hay password en DB, no puede comparar
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);