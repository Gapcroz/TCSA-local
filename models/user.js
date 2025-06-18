// models/User.js
// simple placeholder model for initial commit
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Permite que haya documentos sin googleId
  },
  displayName: String,
  email: {
    type: String,
    unique: true, // Asegura que no haya emails duplicados
    required: true,
  },
  // Puedes añadir más campos aquí según necesites
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);