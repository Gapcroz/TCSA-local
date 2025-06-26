// services/automatedProcessingService.js
const fs = require("fs/promises");
const path = require("path");
const fileConversionService = require("./fileConversionService");
const sftpService = require("./sftpService");
const conversionJobRepository = require("../repositories/conversionJobRepository");

const INPUT_DIR =
  process.env.SFTP_LOCAL_INPUT_DIR ||
  path.join(__dirname, "..", "sftp_input_watch");
const PROCESSED_DIR =
  process.env.SFTP_LOCAL_PROCESSED_DIR ||
  path.join(__dirname, "..", "sftp_processed");
const FAILED_DIR =
  process.env.SFTP_LOCAL_FAILED_DIR ||
  path.join(__dirname, "..", "sftp_failed");
const TEMP_OUTPUT_DIR = path.join(__dirname, "..", "temp_converted_files");
const TEMP_ERROR_DIR = path.join(__dirname, "..", "temp_error_reports");

const ensureDirectoriesExist = async () => {
  await fs.mkdir(INPUT_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(FAILED_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, "..", "temp_uploads"), {
    recursive: true,
  });
  await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true }); // Ensure this for conversion service
  await fs.mkdir(TEMP_ERROR_DIR, { recursive: true }); // Ensure this for conversion service
  console.log(
    `[Automated Service] Ensured directories: ${INPUT_DIR}, ${PROCESSED_DIR}, ${FAILED_DIR}, ${path.join(
      __dirname,
      "..",
      "temp_uploads"
    )}, ${TEMP_OUTPUT_DIR}, ${TEMP_ERROR_DIR}`
  );
};

const processWatchedFiles = async () => {
  console.log(`[Automated Service] Checking for new files in: ${INPUT_DIR}`);
  let files;
  try {
    files = await fs.readdir(INPUT_DIR);
    if (files.length === 0) {
      console.log("[Automated Service] No new files to process.");
      return;
    }
  } catch (readDirError) {
    console.error(
      `[Automated Service] Error reading input directory ${INPUT_DIR}:`,
      readDirError
    );
    return;
  }

  for (const fileName of files) {
    const filePath = path.join(INPUT_DIR, fileName);
    const stats = await fs.stat(filePath);
    if (
      !stats.isFile() ||
      fileName.startsWith(".") ||
      fileName.endsWith(".tmp") ||
      fileName.endsWith(".partial")
    ) {
      console.log(
        `[Automated Service] Skipping non-file/temp/partial entry: ${fileName}`
      );
      continue;
    }

    const originalName = fileName;
    const fileExtension = path.extname(originalName).toLowerCase();

    // Determine outputFormat and conversionOptions
    let outputFormat = "txt";
    let conversionOptions = {
      documentType: "finishedProduct", // Still needs a robust way to be dynamic!
    };

    console.log(`[Automated Service] Processing file: ${originalName}`);
    let newJob = null;
    let convertedFilePath = null;
    let errorReportPath = null;
    let jobStatus = "failed";
    let fileBuffer;

    try {
      fileBuffer = await fs.readFile(filePath);

      // Create a job entry - MODIFIED CALL
      newJob = await conversionJobRepository.createConversionJob({
        userId: null, // No direct user for automated jobs
        fileName: originalName,
        originalFilePath: filePath,
        outputFormat: outputFormat,
        conversionOptions: conversionOptions,
        status: "processing",
        isAutomated: true, // Explicitly true for automated jobs
      });

      // Process the file - MODIFIED CALL
      const processingResult =
        await fileConversionService.processFileForConversion(
          fileBuffer,
          originalName,
          outputFormat,
          conversionOptions,
          null, // No callerUserId
          true // Explicitly true for isAutomated
        );

      convertedFilePath = processingResult.convertedFilePath;
      errorReportPath = processingResult.errorReportPath;
      jobStatus = processingResult.status;

      await conversionJobRepository.updateConversionJobStatus(
        newJob._id,
        jobStatus,
        {
          convertedFilePath: convertedFilePath,
          errorReportPath: errorReportPath,
          completedAt: new Date(),
        }
      );

      const sftpRemoteUploadDir =
        process.env.SFTP_REMOTE_UPLOAD_DIR || "/converted_files";
      const sftpRemoteErrorDir =
        process.env.SFTP_REMOTE_ERROR_DIR || "/error_reports";

      if (
        convertedFilePath &&
        (await fs
          .access(convertedFilePath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false))
      ) {
        const remoteConvertedFileName = path.basename(convertedFilePath);
        await sftpService.uploadFileViaSftp(
          convertedFilePath,
          path.join(sftpRemoteUploadDir, remoteConvertedFileName)
        );
        await fs
          .unlink(convertedFilePath)
          .catch((e) =>
            console.error(
              `[Automated Service] Error deleting local converted file ${convertedFilePath}:`,
              e
            )
          );
      } else if (convertedFilePath) {
        console.warn(
          `[Automated Service] Converted file not found at ${convertedFilePath}, skipping SFTP upload.`
        );
      }

      if (
        errorReportPath &&
        (await fs
          .access(errorReportPath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false))
      ) {
        const remoteErrorFileName = path.basename(errorReportPath);
        await sftpService.uploadFileViaSftp(
          errorReportPath,
          path.join(sftpRemoteErrorDir, remoteErrorFileName)
        );
        await fs
          .unlink(errorReportPath)
          .catch((e) =>
            console.error(
              `[Automated Service] Error deleting local error report ${errorReportPath}:`,
              e
            )
          );
      } else if (errorReportPath) {
        console.warn(
          `[Automated Service] Error report file not found at ${errorReportPath}, skipping SFTP upload.`
        );
      }

      const newPath = path.join(PROCESSED_DIR, originalName);
      await fs.rename(filePath, newPath);
      console.log(
        `[Automated Service] Successfully processed and moved ${originalName} to ${PROCESSED_DIR}`
      );
    } catch (error) {
      console.error(
        `[Automated Service] Error processing file ${originalName}:`,
        error
      );
      try {
        const newPath = path.join(FAILED_DIR, originalName);
        await fs.rename(filePath, newPath);
        console.log(
          `[Automated Service] Moved failed file ${originalName} to ${FAILED_DIR}`
        );
      } catch (moveErr) {
        console.error(
          `[Automated Service] Could not move failed file ${originalName} to ${FAILED_DIR}:`,
          moveErr
        );
      }

      if (newJob && newJob._id) {
        await conversionJobRepository.updateConversionJobStatus(
          newJob._id,
          "failed",
          {
            errorMessage: error.message,
          }
        );
      }
      if (
        convertedFilePath &&
        (await fs
          .access(convertedFilePath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false))
      ) {
        await fs
          .unlink(convertedFilePath)
          .catch((e) =>
            console.error(
              `[Automated Service] Error deleting partial converted file ${convertedFilePath}:`,
              e
            )
          );
      }
      if (
        errorReportPath &&
        (await fs
          .access(errorReportPath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false))
      ) {
        await fs
          .unlink(errorReportPath)
          .catch((e) =>
            console.error(
              `[Automated Service] Error deleting partial error report ${errorReportPath}:`,
              e
            )
          );
      }
    }
  }
};

module.exports = {
  processWatchedFiles,
  ensureDirectoriesExist,
};
