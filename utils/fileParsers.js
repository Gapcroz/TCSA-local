// utils/fileParsers.js
const ExcelJS = require('exceljs');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

/**
 * Generates a filename based on the specified convention.
 * File Name Convention: BMDDHHMM.MMYY
 * BM: Identifies the type of file (BM, RM, or FG)
 * DD: Day
 * HH: Hour
 * MM: Minute
 * MM: Month
 * YY: Last two digits of the current year
 * Example: Filename BM031113.0621 > BOM file generated on June 3rd, 2021 at 11:13 hrs
 *
 * @param {string} fileType - The type of file (e.g., "BM", "RM", "FG").
 * @param {Date} [date=new Date()] - The date and time to use for the filename. Defaults to the current date and time.
 * @returns {string} The generated filename.
 */
function generateFilename(fileType, date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = String(date.getFullYear()).slice(-2);

  return `${fileType}${day}${hours}${minutes}.${month}${year}`;
}

async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const data = {};
  workbook.eachSheet((worksheet, sheetId) => {
    // Saltar la primera fila si es un encabezado y quieres omitirla de los datos
    const sheetData = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Asume la primera fila como encabezados
        // Si no quieres que formen parte de los datos, puedes omitirla aquí.
        // Opcional: asignar los headers a la propiedad columns de ExcelJS
        // worksheet.columns = row.values.map(header => ({ header: header, key: header }));
      } else {
        const rowValues = {};
        // Aquí necesitarías mapear los valores de la fila a un objeto JSON usando los encabezados
        // Esto es un ejemplo simplificado, en un caso real se usarían los headers de la hoja
        row.eachCell((cell, colNumber) => {
          // Asumimos que los headers están en la primera fila (ajustar si no)
          const headerCell = worksheet.getRow(1).getCell(colNumber);
          rowValues[headerCell.value || `Column${colNumber}`] = cell.value;
        });
        sheetData.push(rowValues);
      }
    });
    data[worksheet.name] = sheetData;
  });

  return data;
}

async function parseCSV(buffer) {
  const results = [];
  const stream = Readable.from(buffer); // Crea un stream a partir del buffer

  return new Promise((resolve, reject) => {
    stream
      .pipe(csvParser()) // csv-parser auto-detecta delimitadores y headers
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve({ Sheet1: results }); // Envuelve en un objeto para consistencia
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function parseTXT(buffer) {
  // Para TXT, la lógica de parsing dependerá mucho del formato.
  // Aquí un ejemplo simple: cada línea es un objeto con una clave "line"
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(Boolean); // Elimina líneas vacías

  const data = lines.map((line, index) => ({
    line: line,
    lineNumber: index + 1,
  }));

  // O si el TXT es un CSV delimitado por tabuladores, puedes usar csv-parser con options:
  // return new Promise((resolve, reject) => {
  //   const stream = Readable.from(buffer);
  //   stream.pipe(csvParser({ separator: '\t' }))
  //     .on('data', (data) => results.push(data))
  //     .on('end', () => resolve({ Sheet1: results }))
  //     .on('error', reject);
  // });

  return { Sheet1: data }; // Envuelve en un objeto para consistencia
}
//TODO: REEMPLAZAR CON IMPLEMENTACION ajustada al formato esperado en funciones parseXLSX, parseCSV y parseTXT
module.exports = {
  parseXLSX,
  parseCSV,
  parseTXT,
  generateFilename, // Export the new function
};