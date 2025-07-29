const ConversionJob = require("../models/ConversionJob");

// createConversionJob and getConversionJobById remain the same...
const createConversionJob = async ({
  userId,
  fileName,
  originalFilePath,
  outputFormat,
  conversionOptions,
  status,
  isAutomated = false,
}) => {
  const newJob = new ConversionJob({
    userId,
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
 * UPDATED: Finds paginated conversion jobs for a specific user ID.
 */
const getPaginatedJobsByUserId = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = { userId: userId };

  // Execute queries in parallel for efficiency
  const [jobs, totalJobs] = await Promise.all([
    ConversionJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ConversionJob.countDocuments(query),
  ]);

  return {
    jobs,
    totalJobs,
    currentPage: page,
    totalPages: Math.ceil(totalJobs / limit),
  };
};

/**
 * UPDATED: Finds all paginated conversion jobs in the database (for admins).
 */
const getPaginatedAllJobs = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [jobs, totalJobs] = await Promise.all([
    ConversionJob.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ConversionJob.countDocuments({}),
  ]);

  return {
    jobs,
    totalJobs,
    currentPage: page,
    totalPages: Math.ceil(totalJobs / limit),
  };
};

// updateConversionJobStatus remains the same...
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
  getPaginatedJobsByUserId, // <-- EXPORT THE PAGINATED FUNCTION
  getPaginatedAllJobs, // <-- EXPORT THE PAGINATED FUNCTION
};