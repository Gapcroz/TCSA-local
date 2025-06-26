// repositories/conversionJobRepository.js
const ConversionJob = require('../models/ConversionJob');

const createConversionJob = async ({
  userId, // Can be null for automated jobs
  fileName,
  originalFilePath,
  outputFormat,
  conversionOptions,
  status,
  isAutomated = false, // Default to false
}) => {
  const newJob = new ConversionJob({
    userId, // Will be null if not provided
    fileName,
    originalFilePath,
    outputFormat,
    conversionOptions,
    status,
    isAutomated,
  });
  return await newJob.save();
};

const getConversionJobById = async (jobId) => {
  return await ConversionJob.findById(jobId);
};

const updateConversionJobStatus = async (
  jobId,
  status,
  { convertedFilePath = null, errorReportPath = null, completedAt = null, errorMessage = null } = {},
) => {
  const updateFields = { status };
  if (convertedFilePath) updateFields.convertedFilePath = convertedFilePath;
  if (errorReportPath) updateFields.errorReportPath = errorReportPath;
  if (completedAt) updateFields.completedAt = completedAt;
  if (errorMessage) updateFields.errorMessage = errorMessage;

  return await ConversionJob.findByIdAndUpdate(jobId, { $set: updateFields }, { new: true });
};

module.exports = {
  createConversionJob,
  getConversionJobById,
  updateConversionJobStatus,
};