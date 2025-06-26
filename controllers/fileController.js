// controllers/fileController.js
const fileConversionService = require('../services/fileConversionService');
const conversionJobRepository = require('../repositories/conversionJobRepository');
const path = require('path');
const fs = require('fs/promises');

// Middleware de Multer (configúralo una vez)
const multer = require('multer');
const upload = multer({ dest: 'temp_uploads/' });

const uploadAndConvertFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha proporcionado ningún archivo.' });
  }

  const { filename, path: tempFilePath, originalname } = req.file;
  const { outputFormat, ...conversionOptions } = req.body;

  if (!outputFormat) {
    await fs.unlink(tempFilePath);
    return res.status(400).json({ message: 'El formato de salida es requerido.' });
  }

  // --- NEW: Validate user ID for manual uploads ---
  // You can keep this check if you want userId to be strictly required for manual uploads.
  if (!req.user || !req.user.id) {
    await fs.unlink(tempFilePath);
    return res.status(401).json({ message: 'Usuario no autenticado para realizar esta operación.' });
  }
  // --- End new validation ---

  let newJob; // Declare outside try block for wider scope
  try {
    const fileBuffer = await fs.readFile(tempFilePath);

    // Crear un registro de trabajo en la DB
    newJob = await conversionJobRepository.createConversionJob({
      userId: req.user.id, // ID del usuario autenticado
      fileName: originalname,
      originalFilePath: tempFilePath,
      outputFormat: outputFormat,
      conversionOptions: conversionOptions,
      status: 'processing',
      isAutomated: false, // Explicitly false for manual uploads
    });

    // Procesar el archivo a través del servicio - MODIFIED CALL
    const { convertedFilePath, errorReportPath, status } = await fileConversionService.processFileForConversion(
      fileBuffer,
      originalname,
      outputFormat,
      conversionOptions,
      req.user.id, // Pass callerUserId
      false, // Explicitly false for isAutomated
    );

    // ... (rest of the try block remains similar)

    await conversionJobRepository.updateConversionJobStatus(
      newJob._id,
      status,
      {
        convertedFilePath,
        errorReportPath,
        completedAt: new Date(),
      },
    );

    await fs.unlink(tempFilePath);

    res.status(200).json({
      message: 'Archivo procesado exitosamente.',
      jobId: newJob._id,
      convertedFileName: path.basename(convertedFilePath),
      status: status,
    });
  } catch (error) {
    console.error('Error al procesar el archivo:', error);
    if (fs.existsSync(tempFilePath)) { // Using fs.existsSync for sync check
      await fs.unlink(tempFilePath).catch(e => console.error("Error deleting temp file in error handler:", e));
    }
    if (newJob && newJob._id) {
      await conversionJobRepository.updateConversionJobStatus(newJob._id, 'failed', {
        errorMessage: error.message,
      });
    }
    res.status(500).json({ message: 'Error al procesar el archivo.', error: error.message });
  }
};

const getConvertedFile = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Trabajo de conversión no encontrado.' });
    }

    // IMPORTANT: Access control for converted files
    // If job.userId is null (for automated jobs), you might need a different permission check.
    // For now, only jobs with an explicit userId are checked against req.user.id.
    // Automated jobs (with job.isAutomated === true) will require a different download policy.
    // E.g., only admins can download automated job outputs, or outputs are SFTP'd only.
    if (job.userId && job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado. No tienes permisos para este archivo.' });
    }
    // Added specific check for automated jobs
    if (!job.userId && job.isAutomated && !req.user.isAdmin) { // Assuming isAdmin is a property on req.user
        return res.status(403).json({ message: 'Acceso denegado. Este es un archivo de conversión automatizado.' });
    }
    // You might need to adjust the above `if (!req.user.isAdmin)` based on your user model and auth middleware.

    if (job.status !== 'completed' && job.status !== 'completed_with_errors') {
      return res.status(409).json({ message: 'El archivo aún no ha sido procesado o falló.' });
    }

    if (!job.convertedFilePath || !fs.existsSync(job.convertedFilePath)) { // Using fs.existsSync for sync check
      return res.status(404).json({ message: 'Archivo convertido no encontrado en el servidor.' });
    }

    res.download(job.convertedFilePath, job.convertedFileName || path.basename(job.convertedFilePath), (err) => {
      if (err) {
        console.error('Error al enviar el archivo para descarga:', err);
        res.status(500).json({ message: 'Error al descargar el archivo.' });
      }
    });
  } catch (error) {
    console.error('Error al obtener archivo convertido:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const getErrorReport = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Trabajo de conversión no encontrado.' });
    }

    // Similar access control logic for error reports
    if (job.userId && job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado.' });
    }
    if (!job.userId && job.isAutomated && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Acceso denegado. Este es un reporte de errores automatizado.' });
    }


    if (!job.errorReportPath || !fs.existsSync(job.errorReportPath)) { // Using fs.existsSync for sync check
      return res.status(404).json({ message: 'Reporte de errores no disponible.' });
    }

    res.download(job.errorReportPath, `error_report_${jobId}.json`, (err) => {
      if (err) {
        console.error('Error al enviar el reporte de errores:', err);
        res.status(500).json({ message: 'Error al descargar el reporte de errores.' });
      }
    });
  } catch (error) {
    console.error('Error al obtener reporte de errores:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  upload,
  uploadAndConvertFile,
  getConvertedFile,
  getErrorReport,
};