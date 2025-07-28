const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");
const {
  authenticateRequest,
  ensureApiAccess,
} = require("../middleware/authMiddleware");

// Middleware array to protect the route
const API_PROTECTED = [authenticateRequest, ensureApiAccess];

/**
 * @route   GET /api/conversion-jobs
 * @desc    Get conversion job history for the authenticated user
 * @access  Private
 */
router.get(
  "/conversion-jobs",
  API_PROTECTED,
  jobController.getUserConversionJobs
);

module.exports = router;