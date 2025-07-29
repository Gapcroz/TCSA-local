// controllers/fileController.js
const fileConversionService = require("../services/fileConversionService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const path = require("path");
const fs = require("fs/promises");
const { getRegistryEntry } = require("../data/documentTypeRegistry");

// Middleware de Multer (configúralo una vez)
const multer = require("multer");
const upload = multer({ dest: "temp_uploads/" });

// Helper function for checking file existence asynchronously
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const uploadAndConvertFile = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "No se ha proporcionado ningún archivo." });
  }

  const { path: tempFilePath, originalname } = req.file;
  const { outputFormat, ...conversionOptions } = req.body;

  if (!outputFormat) {
    await fs.unlink(tempFilePath);
    return res
      .status(400)
      .json({ message: "El formato de salida es requerido." });
  }

  // --- REVISED LOGIC TO GET CANONICAL DOCUMENT TYPE ---
  if (!conversionOptions.documentType) {
    const filePrefix = originalname.substring(0, 2).toUpperCase();
    try {
      const registryEntry = getRegistryEntry(filePrefix);
      // Use the canonical internal name (e.g., 'finishedProduct')
      conversionOptions.documentType = registryEntry.docType;
      console.log(
        `[FileController] Resolved prefix "${filePrefix}" to documentType "${conversionOptions.documentType}"`
      );
    } catch (e) {
      await fs.unlink(tempFilePath);
      return res
        .status(400)
        .json({ message: `Unknown document type prefix: ${filePrefix}` });
    }
  }
  // --- END REVISED LOGIC ---

  if (!req.user || !req.user.id) {
    await fs.unlink(tempFilePath);
    return res.status(401).json({
      message: "Usuario no autenticado para realizar esta operación.",
    });
  }

  let newJob;
  try {
    const fileBuffer = await fs.readFile(tempFilePath);

    newJob = await conversionJobRepository.createConversionJob({
      userId: req.user.id,
      fileName: originalname,
      originalFilePath: tempFilePath,
      outputFormat: outputFormat,
      conversionOptions: conversionOptions,
      status: "processing",
      isAutomated: false,
    });

    const { convertedFilePath, errorReportPath, status } =
      await fileConversionService.processFileForConversion(
        fileBuffer,
        originalname,
        outputFormat,
        conversionOptions,
        req.user.id,
        false
      );

    await conversionJobRepository.updateConversionJobStatus(newJob._id, status, {
      convertedFilePath,
      errorReportPath,
      completedAt: new Date(),
    });

    await fs.unlink(tempFilePath);

    res.status(200).json({
      message: "Archivo procesado exitosamente.",
      jobId: newJob._id,
      convertedFileName: path.basename(convertedFilePath),
      status: status,
    });
  } catch (error) {
    console.error("Error al procesar el archivo:", error);
    if (await fileExists(tempFilePath)) {
      await fs
        .unlink(tempFilePath)
        .catch((e) =>
          console.error("Error deleting temp file in error handler:", e)
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
    res
      .status(500)
      .json({ message: "Error al procesar el archivo.", error: error.message });
  }
};

const getConvertedFile = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res
        .status(404)
        .json({ message: "Trabajo de conversión no encontrado." });
    }

    if (job.userId && job.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Acceso denegado. No tienes permisos para este archivo." });
    }
    if (!job.userId && job.isAutomated && !req.user.isAdmin) {
      return res.status(403).json({
        message: "Acceso denegado. Este es un archivo de conversión automatizado.",
      });
    }

    if (job.status !== "completed" && job.status !== "completed_with_errors") {
      return res
        .status(409)
        .json({ message: "El archivo aún no ha sido procesado o falló." });
    }

    if (!job.convertedFilePath || !(await fileExists(job.convertedFilePath))) {
      return res
        .status(404)
        .json({ message: "Archivo convertido no encontrado en el servidor." });
    }

    res.download(
      job.convertedFilePath,
      job.convertedFileName || path.basename(job.convertedFilePath),
      (err) => {
        if (err) {
          console.error("Error al enviar el archivo para descarga:", err);
          res.status(500).json({ message: "Error al descargar el archivo." });
        }
      }
    );
  } catch (error) {
    console.error("Error al obtener archivo convertido:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const getErrorReport = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res
        .status(404)
        .json({ message: "Trabajo de conversión no encontrado." });
    }

    if (job.userId && job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Acceso denegado." });
    }
    if (!job.userId && job.isAutomated && !req.user.isAdmin) {
      return res.status(403).json({
        message: "Acceso denegado. Este es un reporte de errores automatizado.",
      });
    }

    if (!job.errorReportPath || !(await fileExists(job.errorReportPath))) {
      return res
        .status(404)
        .json({ message: "Reporte de errores no disponible." });
    }

    res.download(job.errorReportPath, `error_report_${jobId}.json`, (err) => {
      if (err) {
        console.error("Error al enviar el reporte de errores:", err);
        res
          .status(500)
          .json({ message: "Error al descargar el reporte de errores." });
      }
    });
  } catch (error) {
    console.error("Error al obtener reporte de errores:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

module.exports = {
  upload,
  uploadAndConvertFile,
  getConvertedFile,
  getErrorReport,
};