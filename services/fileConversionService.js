// services/fileConversionService.js
const path = require('path');
const fs = require('fs/promises'); // Para operaciones asíncronas con archivos
const ExcelJS = require('exceljs'); // exceljs para XLS/XLSX
const csvParser = require('csv-parser'); // csv-parser para CSV
const { Readable } = require('stream'); // Para usar csv-parser con buffers/strings

// Importar utilidades
const { parseXLSX, parseCSV, parseTXT } = require('../utils/fileParsers');
const { validateDataIntegrity } = require('../utils/validationUtils'); // A crear

// Servicio que encapsula la lógica de conversión
const processFileForConversion = async (fileBuffer, originalName, outputFormat, conversionOptions, userId) => {
  let parsedData;
  const fileExtension = path.extname(originalName).toLowerCase();
  let errorReport = [];

  // Paso 1: Parsing
  switch (fileExtension) {
    case '.xls':
    case '.xlsx':
      parsedData = await parseXLSX(fileBuffer);
      break;
    case '.csv':
      parsedData = await parseCSV(fileBuffer);
      break;
    case '.txt':
      parsedData = await parseTXT(fileBuffer);
      break;
    default:
      throw new Error('Formato de archivo no soportado.');
  }

  // console.log('Datos parseados:', parsedData); // Para depuración

  // Paso 2: Transformación (esto sería un módulo más complejo en el futuro)
  // Aquí aplicarías la lógica de estandarización de unidades, HTS/ECCN, etc.
  let transformedData = parsedData; // Placeholder
  // transformedData = applyTransformations(parsedData, conversionOptions);
  // console.log('Datos transformados:', transformedData); // Para depuración

  // Paso 3: Validación
  const validationResult = validateDataIntegrity(transformedData);
  if (!validationResult.isValid) {
    errorReport = validationResult.errors;
    // Decidir si continuar con la conversión o fallar
    // Por ahora, continuaremos pero guardaremos el reporte de errores
  }

  // Paso 4: Generación del archivo de salida
  const outputFileName = `${path.parse(originalName).name}-converted.${outputFormat}`;
  const outputFilePath = path.join(__dirname, '..', 'temp_converted_files', outputFileName); // Directorio temporal
  // Asegúrate de que el directorio temporal exista
  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

  switch (outputFormat) {
    case 'csv':
      // Ejemplo: Convertir a CSV (usando un enfoque simple para JSON a CSV)
      await writeToCSV(transformedData, outputFilePath);
      break;
    case 'xlsx':
      // Ejemplo: Convertir a XLSX
      await writeToXLSX(transformedData, outputFilePath);
      break;
    // Añadir más formatos de salida según sea necesario
    default:
      throw new Error(`Formato de salida '${outputFormat}' no soportado.`);
  }

  // Simulación de generación de reporte de errores
  let errorReportPath = null;
  if (errorReport.length > 0) {
    const errorReportFileName = `${path.parse(originalName).name}-errors.json`;
    errorReportPath = path.join(__dirname, '..', 'temp_error_reports', errorReportFileName);
    await fs.mkdir(path.dirname(errorReportPath), { recursive: true });
    await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
  }

  return {
    convertedFilePath: outputFilePath,
    errorReportPath: errorReportPath,
    status: errorReport.length > 0 ? 'completed_with_errors' : 'completed',
  };
};

// --- Funciones auxiliares para escribir archivos (simples) ---
async function writeToCSV(data, filePath) {
  // Asumiendo que `data` es un objeto { Sheet1: [{ col1: val1 }, { col2: val2 }] }
  // O un array de objetos si no hay sheets.
  const firstSheetName = Object.keys(data)[0];
  const rows = data[firstSheetName];

  if (!rows || rows.length === 0) {
    await fs.writeFile(filePath, ''); // Crear archivo CSV vacío
    return;
  }

  const header = Object.keys(rows[0]).join(',');
  const csvRows = rows.map((row) => Object.values(row).join(','));
  const csvContent = [header, ...csvRows].join('\n');
  await fs.writeFile(filePath, csvContent);
}

async function writeToXLSX(data, filePath) {
  const workbook = new ExcelJS.Workbook();

  for (const sheetName in data) {
    if (Object.hasOwnProperty.call(data, sheetName)) {
      const worksheet = workbook.addWorksheet(sheetName);
      worksheet.columns = Object.keys(data[sheetName][0] || {}).map((key) => ({
        header: key,
        key: key,
        width: 20,
      }));
      worksheet.addRows(data[sheetName]);
    }
  }

  await workbook.xlsx.writeFile(filePath);
}
// --- Fin funciones auxiliares ---

module.exports = {
  processFileForConversion,
};