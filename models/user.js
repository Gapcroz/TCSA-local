// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  displayName: String,
  email: {
    type: String,
    unique: true,
    required: true,
  },
  // Nuevo campo para controlar el acceso del usuario
  isActive: {
    type: Boolean,
    default: false, // Por defecto, los nuevos usuarios NO tienen acceso a la API
  },
  // Opcional: Un campo de rol si necesitas más granularidad (ej. 'user', 'admin')
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);