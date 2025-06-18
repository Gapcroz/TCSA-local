// models/ConversionJob.js
const mongoose = require('mongoose');

const conversionJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  originalFilePath: {
    type: String,
    required: true,
  },
  outputFormat: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  convertedFilePath: String,
  errorReportPath: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  // Puedes añadir más campos como la configuración de conversión específica
  conversionOptions: Object,
});

module.exports = mongoose.model('ConversionJob', conversionJobSchema);