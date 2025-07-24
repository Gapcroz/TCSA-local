// utils/fileParsers.js
const ExcelJS = require("exceljs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
// Import the registry to get schema information
const { getRegistryEntry } = require("../data/documentTypeRegistry");

/**
 * Generates a filename based on the specified convention.
 * Convention: [TYPE]DDHHMM.MMYY (e.g., BM031113.0621)
 * @param {string} fileType - The type of file ("BM", "RM", or "FG").
 * @param {Date} [date=new Date()] - The date for the filename.
 * @returns {string} The generated filename.
 */
function generateFilename(fileType, date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const year = String(date.getFullYear()).slice(-2);

  return `${fileType}${day}${hours}${minutes}.${month}${year}`;
}

/**
 * Parses an XLSX file buffer into a standardized data object.
 * @param {Buffer} buffer - The buffer of the XLSX file.
 * @returns {Promise<Object>} A promise that resolves to an object like { Sheet1: [records] }.
 */
async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const data = {};
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { Sheet1: [] };
  }

  const sheetData = [];
  const headers = [];

  const headerRow = worksheet.getRow(1);
  if (headerRow) {
    headerRow.eachCell((cell) => {
      if (cell.value && typeof cell.value === "object" && cell.value.richText) {
        headers.push(cell.value.richText.map((rt) => rt.text).join(""));
      } else {
        headers.push(cell.value);
      }
    });
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowValues = {};
    let hasValues = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        const cellValue =
          cell.value && cell.value.result !== undefined
            ? cell.value.result
            : cell.value;
        rowValues[header] = cellValue;
        if (cellValue !== null && cellValue !== undefined) {
          hasValues = true;
        }
      }
    });

    if (hasValues) {
      sheetData.push(rowValues);
    }
  });

  data["Sheet1"] = sheetData;
  return data;
}

/**
 * Parses a CSV file buffer into a standardized data object.
 * @param {Buffer} buffer - The buffer of the CSV file.
 * @returns {Promise<Object>} A promise that resolves to an object like { Sheet1: [records] }.
 */
async function parseCSV(buffer) {
  const results = [];
  const stream = Readable.from(buffer);

  return new Promise((resolve, reject) => {
    stream
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        resolve({ Sheet1: results });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Parses a fixed-width plain text file based on a given schema.
 * @param {Buffer} buffer - The buffer containing the text file content.
 * @param {string} documentType - The type of document ('finishedProduct', 'rawMaterial', 'billOfMaterials').
 * @returns {Promise<Object>} A promise that resolves to an object like { Sheet1: [records] }.
 */
async function parseTXT(buffer, documentType) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  // --- REFACTORED LOGIC ---
  // Get the schema spec directly from the registry.
  const { schemaSpec } = getRegistryEntry(documentType);
  // --- END REFACTORED LOGIC ---

  const parsedRecords = lines.map((line) => {
    const record = {};
    for (const field of schemaSpec) {
      let rawValue = line.substring(field.start, field.end + 1);

      if (field.dataElement !== "Filler") {
        rawValue = rawValue.trim();
      }

      if (rawValue === "") {
        record[field.dataElement] = null;
        continue;
      }

      switch (field.type) {
        case "N":
          const num = parseFloat(rawValue);
          record[field.dataElement] = isNaN(num) ? null : num;
          break;

        case "D":
          if (rawValue.length === 8 && /^\d{8}$/.test(rawValue)) {
            const year = parseInt(rawValue.substring(0, 4), 10);
            const month = parseInt(rawValue.substring(4, 6), 10) - 1;
            const day = parseInt(rawValue.substring(6, 8), 10);

            const date = new Date(year, month, day);
            if (
              date.getFullYear() === year &&
              date.getMonth() === month &&
              date.getDate() === day
            ) {
              record[field.dataElement] = date;
            } else {
              record[field.dataElement] = null;
            }
          } else {
            record[field.dataElement] = null;
          }
          break;

        case "A":
        default:
          record[field.dataElement] = rawValue;
          break;
      }
    }
    return record;
  });

  return { Sheet1: parsedRecords };
}

module.exports = {
  parseXLSX,
  parseCSV,
  parseTXT,
  generateFilename,
};