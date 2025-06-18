// controllers/fileController.js
const fileConversionService = require('../services/fileConversionService');
const conversionJobRepository = require('../repositories/conversionJobRepository');
const path = require('path');
const fs = require('fs/promises'); // Para eliminar archivos temporales

// Middleware de Multer (configúralo una vez)
const multer = require('multer');
const upload = multer({ dest: 'temp_uploads/' }); // Directorio temporal para las subidas

const uploadAndConvertFile = async (req, res) => {
  // req.file viene de multer
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha proporcionado ningún archivo.' });
  }

  const { filename, path: tempFilePath, originalname } = req.file;
  const { outputFormat, ...conversionOptions } = req.body; // Puedes enviar opciones desde el frontend

  if (!outputFormat) {
    // Eliminar archivo temporal si hay un error
    await fs.unlink(tempFilePath);
    return res.status(400).json({ message: 'El formato de salida es requerido.' });
  }

  try {
    // Leer el archivo temporalmente
    const fileBuffer = await fs.readFile(tempFilePath);

    // Crear un registro de trabajo en la DB
    const newJob = await conversionJobRepository.createConversionJob({
      userId: req.user.id, // ID del usuario autenticado
      fileName: originalname,
      originalFilePath: tempFilePath, // Ruta del archivo original temporal
      outputFormat: outputFormat,
      conversionOptions: conversionOptions,
      status: 'processing',
    });

    // Procesar el archivo a través del servicio
    // Esto podría ser un proceso asíncrono en segundo plano para archivos grandes
    const { convertedFilePath, errorReportPath, status } = await fileConversionService.processFileForConversion(
      fileBuffer,
      originalname,
      outputFormat,
      conversionOptions,
      req.user.id,
    );

    // Actualizar el registro del trabajo
    await conversionJobRepository.updateConversionJobStatus(
      newJob._id,
      status,
      {
        convertedFilePath,
        errorReportPath,
        completedAt: new Date(),
      },
    );

    // Eliminar el archivo temporal original
    await fs.unlink(tempFilePath);

    res.status(200).json({
      message: 'Archivo procesado exitosamente.',
      jobId: newJob._id,
      convertedFileName: path.basename(convertedFilePath),
      status: status,
      // Puedes enviar las URLs de descarga aquí o en un endpoint separado
    });
  } catch (error) {
    console.error('Error al procesar el archivo:', error);
    // Asegurarse de eliminar el archivo temporal en caso de error
    if (fs.existsSync(tempFilePath)) {
      await fs.unlink(tempFilePath);
    }
    // Actualizar estado del job a failed
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

    // Asegurarse de que el usuario solo pueda descargar sus propios archivos
    if (job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado. No tienes permisos para este archivo.' });
    }

    if (job.status !== 'completed' && job.status !== 'completed_with_errors') {
      return res.status(409).json({ message: 'El archivo aún no ha sido procesado o falló.' });
    }

    if (!job.convertedFilePath || !fs.existsSync(job.convertedFilePath)) {
      return res.status(404).json({ message: 'Archivo convertido no encontrado en el servidor.' });
    }

    res.download(job.convertedFilePath, job.convertedFileName || path.basename(job.convertedFilePath), (err) => {
      if (err) {
        console.error('Error al enviar el archivo para descarga:', err);
        res.status(500).json({ message: 'Error al descargar el archivo.' });
      }
      // Opcional: eliminar el archivo del servidor después de la descarga si no se necesita persistencia a largo plazo
      // fs.unlink(job.convertedFilePath).catch(e => console.error("Error eliminando archivo temporal:", e));
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

    if (job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado.' });
    }

    if (!job.errorReportPath || !fs.existsSync(job.errorReportPath)) {
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
  upload, // Exporta el middleware de multer
  uploadAndConvertFile,
  getConvertedFile,
  getErrorReport,
};