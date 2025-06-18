// utils/fileParsers.js
// Placeholder para las funciones de parsing de archivos, se debe ajustar a las necesidades cada tipo de archivo
const ExcelJS = require('exceljs');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

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

module.exports = {
  parseXLSX,
  parseCSV,
  parseTXT,
};