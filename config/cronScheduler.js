// config/cronScheduler.js
const cron = require('node-cron');
const automatedProcessingService = require('../services/automatedProcessingService');

/**
 * Starts the cron job to periodically process watched files.
 * @param {string} cronSchedule - The cron string (e.g., '0 * * * *' for every hour).
 */
const startAutomatedFileProcessor = (cronSchedule) => {
  // Ensure directories exist before starting the scheduler, and also clean them up on startup if needed.
  // We'll call ensureDirectoriesExist once from index.js before starting the cron.

  // Schedule the task
  cron.schedule(cronSchedule, async () => {
    console.log(`[Cron] Running automated file processing job at ${new Date().toLocaleString()}`);
    try {
      await automatedProcessingService.processWatchedFiles();
    } catch (error) {
      console.error('[Cron] Error during automated file processing job:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Chicago" // Or your desired timezone, e.g., 'UTC'
  });

  console.log(`[Cron] Automated file processor scheduled to run with cron expression: "${cronSchedule}"`);
};

module.exports = {
  startAutomatedFileProcessor,
};