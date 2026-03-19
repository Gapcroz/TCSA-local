// services/automatedProcessingService.js
const fs = require("fs/promises");
const path = require("path");
const { fork } = require("child_process");
const fileConversionService = require("./fileConversionService");
const sftpService = require("./sftpService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const { getDocumentTypeByPrefix } = require("../data/documentTypeRegistry");
const { detectDocumentType } = require("../utils/documentDetector");
const { getDefaultFormat } = require("../utils/documentFormatRules");

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
const WORKER_PATH = path.join(
  __dirname,
  "..",
  "workers",
  "automatedFileWorker.js"
);
const WORKER_TIMEOUT_MINUTES = Number.parseInt(
  process.env.WORKER_TIMEOUT_MINUTES || "30",
  10
);
const WORKER_TIMEOUT_MS =
  Number.isFinite(WORKER_TIMEOUT_MINUTES) && WORKER_TIMEOUT_MINUTES > 0
    ? WORKER_TIMEOUT_MINUTES * 60 * 1000
    : null;

let activeWorker = null;

const handleWorkerTimeout = async (filePath, fileName) => {
  const displayName = fileName || path.basename(filePath);
  console.error(
    `[Automated Service] Worker timeout after ${WORKER_TIMEOUT_MINUTES} minutes for ${displayName}.`
  );

  try {
    await fs.access(filePath, fs.constants.F_OK);
    const targetPath = path.join(FAILED_DIR, displayName);
    await fs.rename(filePath, targetPath);
    console.log(
      `[Automated Service] Moved timed out file ${displayName} to ${FAILED_DIR}`
    );
  } catch {
    // file might have been moved/removed already
  }

  try {
    const latestJob =
      await conversionJobRepository.getLatestAutomatedJobByFileName(
        displayName
      );
    if (latestJob?._id) {
      await conversionJobRepository.updateConversionJobStatus(
        latestJob._id,
        "failed",
        {
          errorMessage: `Worker timeout after ${WORKER_TIMEOUT_MINUTES} minutes`,
        }
      );
    }
  } catch (err) {
    console.error(
      `[Automated Service] Failed to update job status after timeout for ${displayName}:`,
      err
    );
  }
};

const spawnWorkerForFile = (filePath, fileName) => {
  if (activeWorker) return false;
  const displayName = fileName || path.basename(filePath);
  console.log(`[Automated Service] Spawning worker for: ${displayName}`);

  let timeoutHandle = null;

  activeWorker = fork(WORKER_PATH, [filePath], {
    env: { ...process.env },
    stdio: "inherit",
  });

  activeWorker.on("exit", (code, signal) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    console.log(
      `[Automated Service] Worker finished ${displayName} (code=${code}, signal=${signal || "none"})`
    );
    activeWorker = null;
  });

  activeWorker.on("error", (err) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    console.error(`[Automated Service] Worker error for ${displayName}:`, err);
    activeWorker = null;
  });

  if (WORKER_TIMEOUT_MS) {
    timeoutHandle = setTimeout(() => {
      if (!activeWorker) return;
      try {
        activeWorker.kill("SIGKILL");
      } catch {}
      activeWorker = null;
      handleWorkerTimeout(filePath, displayName).catch(() => {});
    }, WORKER_TIMEOUT_MS);
  }

  return true;
};

// Allow uploading TXT even if there are validation errors?
const ALLOW_UPLOAD_ON_VALIDATION_ERROR =
  (process.env.ALLOW_UPLOAD_ON_VALIDATION_ERROR || "false").toLowerCase() ===
  "true";

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

const processSingleFile = async ({
  filePath,
  originalName = path.basename(filePath),
  readPath = filePath,
}) => {
  let documentType = null;
  let fileBuffer;
  let newJob = null;
  let convertedFilePath = null;
  let errorReportPath = null;

  try {
    fileBuffer = await fs.readFile(readPath);

    // --- Automatic document type detection ---
    documentType = await detectDocumentType(fileBuffer, originalName);
    if (documentType) {
      console.log(
        `[Automated Service] Detected document type via content analysis: "${documentType}"`
      );
    } else {
      console.log(
        "[Automated Service] Content detection failed or was inconclusive. Falling back to filename prefix."
      );
      const filePrefix = originalName.substring(0, 2).toUpperCase();
      const registryEntry = getDocumentTypeByPrefix(filePrefix);
      if (registryEntry) {
        documentType = registryEntry.docType;
        console.log(
          `[Automated Service] Resolved prefix "${filePrefix}" to documentType "${documentType}"`
        );
      }
    }

    if (!documentType) {
      console.warn(
        `[Automated Service] Could not determine document type for file: ${originalName}. Skipping.`
      );
      const newPath = path.join(FAILED_DIR, originalName);
      await fs.rename(filePath, newPath);
      console.log(
        `[Automated Service] Moved unknown file type ${originalName} to ${FAILED_DIR}`
      );
      return;
    }
    // --- End detection ---

    const outputFormat = getDefaultFormat(documentType) || "txt";
    const conversionOptions = { documentType };

    console.log(`[Automated Service] Processing file: ${originalName}`);

    newJob = await conversionJobRepository.createConversionJob({
      userId: null,
      fileName: originalName,
      originalFilePath: filePath,
      outputFormat,
      conversionOptions,
      status: "processing",
      isAutomated: true,
    });

    // Get latest automated job for same file/type to delete old remote file after upload
    const previousJob =
      await conversionJobRepository.getLatestAutomatedJobByFileNameAndDocType(
        originalName,
        documentType
      );
    const previousRemotePath = previousJob?.remoteConvertedPath || null;

    const processingResult =
      await fileConversionService.processFileForConversion(
        fileBuffer,
        originalName,
        outputFormat,
        conversionOptions,
        null,
        true
      );

    convertedFilePath = processingResult.convertedFilePath; // may be null
    errorReportPath = processingResult.errorReportPath;
    const jobStatus = processingResult.status; // "completed" | "completed_with_errors" | "failed"

    console.log(
      `[Automated Service] Job result for ${originalName} -> status=${jobStatus}, convertedFilePath=${
        convertedFilePath || "null"
      }, errorReportPath=${errorReportPath || "null"}`
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

    // --- SFTP upload ---
    const toPosix = (p) => p.replace(/\\/g, "/");
    const uploads = [];

    const hasErrors = jobStatus !== "completed";
    const canUploadTxt =
      !hasErrors || (hasErrors && ALLOW_UPLOAD_ON_VALIDATION_ERROR);

    let remoteConvertedPath = null;
    let remoteErrorPath = null;

    // (1) Converted TXT (without .txt in remote path)
    if (
      canUploadTxt &&
      convertedFilePath &&
      (await fileExists(convertedFilePath))
    ) {
      const remoteBase = path
        .basename(convertedFilePath)
        .replace(/\.txt$/i, "");
      remoteConvertedPath = toPosix(
        path.join(sftpRemoteUploadDir, remoteBase)
      );
      uploads.push({
        local: convertedFilePath,
        remote: remoteConvertedPath,
      });
    }

    // (2) Error report (if exists)
    if (errorReportPath && (await fileExists(errorReportPath))) {
      remoteErrorPath = toPosix(
        path.join(sftpRemoteErrorDir, path.basename(errorReportPath))
      );
      uploads.push({
        local: errorReportPath,
        remote: remoteErrorPath,
      });
    }

    if (uploads.length) {
      const uploadResults = await sftpService.uploadFilesViaSftp(uploads);
      // Capture final remote paths in case name strategy changes
      const convertedUpload = uploadResults.find(
        (r) => r.local === convertedFilePath
      );
      const errorUpload = uploadResults.find(
        (r) => r.local === errorReportPath
      );
      if (convertedUpload) remoteConvertedPath = convertedUpload.remote;
      if (errorUpload) remoteErrorPath = errorUpload.remote;

      // If there was a previous version, delete it (only after successful upload)
      if (
        previousRemotePath &&
        remoteConvertedPath &&
        previousRemotePath !== remoteConvertedPath
      ) {
        await sftpService.deleteRemoteFile(previousRemotePath);
      }
    } else {
      console.log(
        "[SFTP] No files queued for upload (no TXT allowed/created and/or no error report)."
      );
    }

    // Update job now that we know remote paths
    await conversionJobRepository.updateConversionJobStatus(
      newJob._id,
      jobStatus,
      {
        convertedFilePath,
        errorReportPath,
        remoteConvertedPath,
        remoteErrorPath,
        completedAt: new Date(),
      }
    );

    // --- Cleanup local artifacts ---
    const tryUnlink = async (p) => {
      if (!p) return;
      try {
        await fs.unlink(p);
      } catch (e) {
        console.error(
          `[Automated Service] Error deleting local file ${p}:`,
          e
        );
      }
    };
    await tryUnlink(convertedFilePath);
    await tryUnlink(errorReportPath);

    // --- Destination based ONLY on status ---
    // If job finished "completed" -> PROCESSED; any other -> FAILED.
    const succeeded = jobStatus === "completed";
    const targetDir = succeeded ? PROCESSED_DIR : FAILED_DIR;

    const newPath = path.join(targetDir, originalName);
    await fs.rename(filePath, newPath);
    console.log(
      `[Automated Service] Moved ${originalName} to ${targetDir} (status=${jobStatus})`
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
        { errorMessage: error.message }
      );
    }
    // Cleanup partial files if they exist
    try {
      if (convertedFilePath)
        await fs.unlink(convertedFilePath).catch(() => {});
      if (errorReportPath) await fs.unlink(errorReportPath).catch(() => {});
    } catch {}
  }
};

const processWatchedFiles = async () => {
  if (activeWorker) {
    console.log(
      "[Automated Service] Worker is still running. Skipping this tick."
    );
    return;
  }

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

  const candidates = [];
  for (const fileName of files) {
    const filePath = path.join(INPUT_DIR, fileName);
    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (err) {
      console.warn(
        `[Automated Service] Could not stat ${fileName}, skipping.`,
        err
      );
      continue;
    }
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
    candidates.push({ fileName, filePath, stats });
  }

  if (!candidates.length) {
    console.log("[Automated Service] No valid files to process.");
    return;
  }

  candidates.sort((a, b) => {
    const aTime = a.stats.birthtimeMs ?? a.stats.mtimeMs;
    const bTime = b.stats.birthtimeMs ?? b.stats.mtimeMs;
    if (aTime !== bTime) return aTime - bTime;
    return a.stats.mtimeMs - b.stats.mtimeMs;
  });

  const { fileName, filePath } = candidates[0];
  const originalName = fileName;
  console.log(
    `[Automated Service] Queued files: ${candidates.length}. Processing oldest first: ${originalName}`
  );

  spawnWorkerForFile(filePath, originalName);
};

module.exports = {
  processWatchedFiles,
  ensureDirectoriesExist,
  processSingleFile,
};
