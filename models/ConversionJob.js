// models/ConversionJob.js
const mongoose = require('mongoose');

const conversionJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Now optional, as automated jobs won't have a direct user
    // Only required if not isAutomated, but Mongoose doesn't support complex 'required' logic
    // Best practice is to make it not required here, and handle validation in the service/controller
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
    enum: ['pending', 'processing', 'completed', 'failed', 'completed_with_errors'],
    default: 'pending',
  },
  convertedFilePath: String,
  errorReportPath: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
  conversionOptions: Object,
  isAutomated: { 
    type: Boolean,
    default: false,
  },
  errorMessage: String,
});

module.exports = mongoose.model('ConversionJob', conversionJobSchema);