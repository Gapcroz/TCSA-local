const ExcelJS = require("exceljs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
// Import the models and their schema specs
const {
  FinishedProduct,
  RawMaterial,
  BillOfMaterials,
  finishedProductSchemaSpec,
  rawMaterialSchemaSpec,
  billOfMaterialsSchemaSpec,
} = require("../data/dataSchemas");

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
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const year = String(date.getFullYear()).slice(-2);

  return `${fileType}${day}${hours}${minutes}.${month}${year}`;
}

async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const data = {};
  workbook.eachSheet((worksheet) => {
    const sheetData = [];
    const headers = [];

    // Read headers from the first row
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value);
    });

    // Iterate over rows, skipping the header row
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return; // Skip header row
      }

      const rowValues = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]; // colNumber is 1-indexed
        if (header) {
          rowValues[header] = cell.value;
        }
      });
      sheetData.push(rowValues);
    });
    data[worksheet.name] = sheetData;
  });
  return data;
}

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
 * Parses a plain text file based on a given schema.
 * Assumes each line in the text file represents a record.
 * Returns an array of plain JavaScript objects, not Mongoose documents.
 *
 * @param {Buffer} buffer - The buffer containing the text file content.
 * @param {string} documentType - The type of document (e.g., 'finishedProduct', 'rawMaterial', 'billOfMaterials').
 * @returns {Object} An object containing parsed data, typically { Sheet1: [records] }.
 */
async function parseTXT(buffer, documentType) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean); // Split by newline, remove empty lines

  let schemaSpec;
  let Model;

  switch (documentType) {
    case "finishedProduct":
      schemaSpec = finishedProductSchemaSpec;
      Model = FinishedProduct;
      break;
    case "rawMaterial":
      schemaSpec = rawMaterialSchemaSpec;
      Model = RawMaterial;
      break;
    case "billOfMaterials":
      schemaSpec = billOfMaterialsSchemaSpec;
      Model = BillOfMaterials;
      break;
    default:
      throw new Error(`Unknown document type for TXT parsing: ${documentType}`);
  }

  const parsedRecords = lines.map((line) => {
    const record = {};
    for (const field of schemaSpec) {
      let value = line.substring(field.start, field.end + 1); // Extract as-is

      // Trim spaces from value unless it's a filler
      if (field.dataElement !== "Filler") {
        value = value.trim();
      }

      // Convert to appropriate type based on schema
      if (field.type === "N") {
        record[field.dataElement] = parseFloat(value) || 0;
      } else if (field.type === "D") {
        // Parse YYYYMMDD string to Date object
        const year = parseInt(value.substring(0, 4), 10);
        const month = parseInt(value.substring(4, 6), 10) - 1; // Month is 0-indexed
        const day = parseInt(value.substring(6, 8), 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          record[field.dataElement] = null; // Or handle as an error
        } else {
          record[field.dataElement] = new Date(year, month, day);
        }
      } else if (Array.isArray(field.possibleValues)) {
        // If it's an enum, store just the code if "Code = Description"
        const foundPossibleValue = field.possibleValues.find((pv) => {
          const parts = pv.split(" = ");
          return (
            (parts.length > 1 ? parts[0] : pv).toUpperCase() ===
            value.toUpperCase()
          );
        });
        record[field.dataElement] = foundPossibleValue
          ? foundPossibleValue.split(" = ")[0] || foundPossibleValue
          : value;
      } else {
        record[field.dataElement] = value;
      }
    }
    return record;
  });

  return { Sheet1: parsedRecords }; // Return as an object with a sheet
}

module.exports = {
  parseXLSX,
  parseCSV,
  parseTXT,
  generateFilename,
};
