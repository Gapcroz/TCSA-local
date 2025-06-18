// repositories/conversionJobRepository.js
const ConversionJob = require('../models/ConversionJob');

const createConversionJob = async (jobData) => {
  return await ConversionJob.create(jobData);
};

const getConversionJobById = async (jobId) => {
  return await ConversionJob.findById(jobId).populate('userId', 'displayName email'); // Para obtener datos del usuario asociado
};

const updateConversionJobStatus = async (jobId, status, details = {}) => {
  const updateData = { status, ...details };
  return await ConversionJob.findByIdAndUpdate(jobId, updateData, { new: true });
};

module.exports = {
  createConversionJob,
  getConversionJobById,
  updateConversionJobStatus,
};