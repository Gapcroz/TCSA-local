const conversionJobRepository = require("../repositories/conversionJobRepository");

/**
 * Fetches conversion jobs. Regular users get their own jobs.
 * Admins get all jobs (theirs, other users', and automated ones).
 */
const getUserConversionJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    let jobs;
    if (isAdmin) {
      // Admins can see all jobs from all users and automated processes
      jobs = await conversionJobRepository.getAllJobs();
    } else {
      // Regular users can only see their own jobs
      jobs = await conversionJobRepository.getJobsByUserId(userId);
    }

    // Sort by most recent first for a consistent UI
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error fetching conversion jobs:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener el historial." });
  }
};

module.exports = {
  getUserConversionJobs,
};