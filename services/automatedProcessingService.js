// services/automatedProcessingService.js
const fs = require("fs/promises");
const path = require("path");
const fileConversionService = require("./fileConversionService");
const sftpService = require("./sftpService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const { getDocumentTypeByPrefix } = require("../data/documentTypeRegistry");
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

// ¿Permitir subir el TXT aunque haya errores de validación?
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
      fileBuffer = await fs.readFile(filePath);

      // --- Detección automática del tipo ---
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
        continue;
      }
      // --- Fin detección ---

      const outputFormat = "txt";
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

      const processingResult =
        await fileConversionService.processFileForConversion(
          fileBuffer,
          originalName,
          outputFormat,
          conversionOptions,
          null,
          true
        );

      convertedFilePath = processingResult.convertedFilePath; // puede ser null
      errorReportPath = processingResult.errorReportPath;
      const jobStatus = processingResult.status; // "completed" | "completed_with_errors" | "failed"

      await conversionJobRepository.updateConversionJobStatus(
        newJob._id,
        jobStatus,
        {
          convertedFilePath,
          errorReportPath,
          completedAt: new Date(),
        }
      );

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

      // --- Subida por SFTP ---
      const toPosix = (p) => p.replace(/\\/g, "/");
      const uploads = [];

      const hasErrors = jobStatus !== "completed";
      const canUploadTxt =
        !hasErrors || (hasErrors && ALLOW_UPLOAD_ON_VALIDATION_ERROR);

      // (1) TXT convertido (sin .txt en remoto)
      if (
        canUploadTxt &&
        convertedFilePath &&
        (await fileExists(convertedFilePath))
      ) {
        const remoteBase = path
          .basename(convertedFilePath)
          .replace(/\.txt$/i, "");
        uploads.push({
          local: convertedFilePath,
          remote: toPosix(path.join(sftpRemoteUploadDir, remoteBase)),
        });
      }

      // (2) Reporte de errores (si existe)
      if (errorReportPath && (await fileExists(errorReportPath))) {
        uploads.push({
          local: errorReportPath,
          remote: toPosix(
            path.join(sftpRemoteErrorDir, path.basename(errorReportPath))
          ),
        });
      }

      if (uploads.length) {
        await sftpService.uploadFilesViaSftp(uploads);
      } else {
        console.log(
          "[SFTP] No files queued for upload (no TXT permitido/creado y/o no hubo reporte de error)."
        );
      }

      // --- Limpieza de artefactos locales ---
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

      // --- DECISIÓN DE DESTINO: SOLO POR STATUS ---
      // Si el job terminó "completed" -> PROCESSED; cualquier otro -> FAILED.
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
  }
};

module.exports = {
  processWatchedFiles,
  ensureDirectoriesExist,
};
