const ConversionJob = require("../models/ConversionJob");

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

/**
 * NEW: Finds all conversion jobs associated with a specific user ID.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array>} A promise that resolves to an array of job documents.
 */
const getJobsByUserId = async (userId) => {
  // Find all jobs where the userId field matches the provided ID.
  return await ConversionJob.find({ userId: userId });
};

/**
 * NEW: Finds all conversion jobs in the database.
 * Intended for admin use.
 * @returns {Promise<Array>} A promise that resolves to an array of all job documents.
 */
const getAllJobs = async () => {
  // Find all documents in the collection.
  return await ConversionJob.find({});
};

const updateConversionJobStatus = async (
  jobId,
  status,
  {
    convertedFilePath = null,
    errorReportPath = null,
    completedAt = null,
    errorMessage = null,
  } = {}
) => {
  const updateFields = { status };
  if (convertedFilePath) updateFields.convertedFilePath = convertedFilePath;
  if (errorReportPath) updateFields.errorReportPath = errorReportPath;
  if (completedAt) updateFields.completedAt = completedAt;
  if (errorMessage) updateFields.errorMessage = errorMessage;

  return await ConversionJob.findByIdAndUpdate(
    jobId,
    { $set: updateFields },
    { new: true }
  );
};

module.exports = {
  createConversionJob,
  getConversionJobById,
  updateConversionJobStatus,
  getJobsByUserId, // <-- EXPORT THE NEW FUNCTION
  getAllJobs, // <-- EXPORT THE NEW FUNCTION
};