// services/automatedProcessingService.js
const fs = require("fs/promises");
const path = require("path");
const fileConversionService = require("./fileConversionService");
const sftpService = require("./sftpService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const {
  getDocumentTypeByPrefix,
} = require("../data/documentTypeRegistry");
// --- NEW: Import the document detector utility ---
const { detectDocumentType } = require("../utils/documentDetector");

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
  await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_ERROR_DIR, { recursive: true });
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
    let documentType = null;
    let fileBuffer;
    let newJob = null;
    let convertedFilePath = null;
    let errorReportPath = null;

    try {
      // Read the file buffer once for detection and processing
      fileBuffer = await fs.readFile(filePath);

      // --- NEW: AUTOMATIC DOCUMENT TYPE DETECTION LOGIC ---
      // First, try to detect the type based on file content (headers).
      documentType = await detectDocumentType(fileBuffer, originalName);

      if (documentType) {
        console.log(
          `[Automated Service] Detected document type via content analysis: "${documentType}"`
        );
      } else {
        // If content detection fails or is inconclusive, fall back to filename prefix.
        console.log(
          "[Automated Service] Content detection failed or was inconclusive. Falling back to filename prefix."
        );
        const filePrefix = originalName.substring(0, 2).toUpperCase();
        const registryEntry = getDocumentTypeByPrefix(filePrefix);

        if (registryEntry) {
          documentType = registryEntry.docType; // Get the canonical name
          console.log(
            `[Automated Service] Resolved prefix "${filePrefix}" to documentType "${documentType}"`
          );
        }
      }

      // If neither method worked, move the file to failed and skip.
      if (!documentType) {
        console.warn(
          `[Automated Service] Could not determine document type for file: ${originalName}. Skipping.`
        );
        const newPath = path.join(FAILED_DIR, originalName);
        await fs.rename(filePath, newPath);
        console.log(
          `[Automated Service] Moved unknown file type ${originalName} to ${FAILED_DIR}`
        );
        continue; // Move to the next file
      }
      // --- END OF DETECTION LOGIC ---

      const outputFormat = "txt";
      const conversionOptions = {
        documentType: documentType, // Use the determined document type
      };

      console.log(`[Automated Service] Processing file: ${originalName}`);

      newJob = await conversionJobRepository.createConversionJob({
        userId: null,
        fileName: originalName,
        originalFilePath: filePath,
        outputFormat: outputFormat,
        conversionOptions: conversionOptions,
        status: "processing",
        isAutomated: true,
      });

      const processingResult =
        await fileConversionService.processFileForConversion(
          fileBuffer, // Use the buffer we already read
          originalName,
          outputFormat,
          conversionOptions,
          null,
          true
        );

      convertedFilePath = processingResult.convertedFilePath;
      errorReportPath = processingResult.errorReportPath;
      const jobStatus = processingResult.status;

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

      const fileExists = async (p) => {
        try {
          await fs.access(p, fs.constants.F_OK);
          return true;
        } catch {
          return false;
        }
      };

      if (convertedFilePath && (await fileExists(convertedFilePath))) {
        const remoteConvertedFileName = path.basename(convertedFilePath);
        await sftpService.uploadFileViaSftp(
          convertedFilePath,
          path.join(sftpRemoteUploadDir, remoteConvertedFileName)
        );
        await fs.unlink(convertedFilePath).catch((e) =>
          console.error(
            `[Automated Service] Error deleting local converted file ${convertedFilePath}:`,
            e
          )
        );
      }

      if (errorReportPath && (await fileExists(errorReportPath))) {
        const remoteErrorFileName = path.basename(errorReportPath);
        await sftpService.uploadFileViaSftp(
          errorReportPath,
          path.join(sftpRemoteErrorDir, remoteErrorFileName)
        );
        await fs.unlink(errorReportPath).catch((e) =>
          console.error(
            `[Automated Service] Error deleting local error report ${errorReportPath}:`,
            e
          )
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
      // Cleanup partial files if they exist
      if (convertedFilePath) {
        await fs.unlink(convertedFilePath).catch(() => {});
      }
      if (errorReportPath) {
        await fs.unlink(errorReportPath).catch(() => {});
      }
    }
  }
};

module.exports = {
  processWatchedFiles,
  ensureDirectoriesExist,
};