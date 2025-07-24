// services/fileConversionService.js
const path = require("path");
const fs = require("fs/promises");
const ExcelJS = require("exceljs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");

// Import utilities
const { parseXLSX, parseCSV, parseTXT } = require("../utils/fileParsers");
const {
  validateDataIntegrity,
  applyBusinessValidations,
} = require("../utils/validationUtils");
const { applyTransformations } = require("../utils/transformationUtils");
// Import the registry to get schema information
const { getRegistryEntry } = require("../data/documentTypeRegistry");

// Service that encapsulates file conversion logic
const processFileForConversion = async (
  fileBuffer,
  originalName,
  outputFormat,
  conversionOptions,
  callerUserId = null,
  isAutomated = false
) => {
  let parsedData;
  const fileExtension = path.extname(originalName).toLowerCase();
  let errorReport = [];

  const { documentType } = conversionOptions;

  if (!documentType) {
    throw new Error(
      "Document type (e.g., 'finishedProduct', 'rawMaterial') is required for file processing."
    );
  }

  if (outputFormat !== "txt") {
    throw new Error(
      `Only 'txt' output format is supported. Received: '${outputFormat}'.`
    );
  }

  // Step 1: Parsing
  switch (fileExtension) {
    case ".xls":
    case ".xlsx":
      parsedData = await parseXLSX(fileBuffer);
      break;
    case ".csv":
      parsedData = await parseCSV(fileBuffer);
      break;
    case ".txt":
      parsedData = await parseTXT(fileBuffer, documentType);
      break;
    default:
      throw new Error(`Unsupported input file format: ${fileExtension}.`);
  }

  // Step 2: Transformation (Units and Trade Codes)
  let transformedData = applyTransformations(parsedData, documentType);

  // Step 3: Validation (Data Integrity and Business Rules)
  const integrityResult = validateDataIntegrity(transformedData, documentType);
  if (!integrityResult.isValid) {
    errorReport.push(...integrityResult.errors);
  }

  if (integrityResult.isValid) {
    const businessValidationResult = await applyBusinessValidations(
      transformedData,
      documentType
    );
    if (!businessValidationResult.isValid) {
      errorReport.push(...businessValidationResult.errors);
    }
  }

  // Step 4: Generation of the standardized plain text file
  const outputFileName = `${path.parse(originalName).name}-converted.txt`;
  const outputFilePath = path.join(
    __dirname,
    "..",
    "temp_converted_files",
    outputFileName
  );
  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

  await writeToStandardizedTXT(transformedData, outputFilePath, documentType);

  // Generate error report if any errors occurred
  let errorReportPath = null;
  if (errorReport.length > 0) {
    const errorReportFileName = `${path.parse(originalName).name}-errors.json`;
    errorReportPath = path.join(
      __dirname,
      "..",
      "temp_error_reports",
      errorReportFileName
    );
    await fs.mkdir(path.dirname(errorReportPath), { recursive: true });
    await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
  }

  return {
    convertedFilePath: outputFilePath,
    errorReportPath: errorReportPath,
    status: errorReport.length > 0 ? "completed_with_errors" : "completed",
  };
};

/**
 * Writes data to a standardized plain text file based on the schema.
 * Each record is a line, with fields at specific positions.
 *
 * @param {Object} data - The processed data, typically { Sheet1: [records] }.
 * @param {string} filePath - The path where the file should be written.
 * @param {string} documentType - The type of document to determine the schema.
 */
async function writeToStandardizedTXT(data, filePath, documentType) {
  const records = data.Sheet1;
  if (!records || records.length === 0) {
    await fs.writeFile(filePath, "");
    return;
  }

  // --- REFACTORED LOGIC ---
  // Get the schema spec directly from the registry instead of using a switch statement.
  const { schemaSpec } = getRegistryEntry(documentType);
  // --- END REFACTORED LOGIC ---

  const lines = records.map((record) => {
    let line = "";
    for (const field of schemaSpec) {
      let value = record[field.dataElement];
      let formattedValue = "";

      if (value === null || value === undefined) {
        formattedValue = "";
      } else {
        if (field.type === "N") {
          const formatMatch = field.format.match(/9\((\d+)\)\.?9?\(?(\d+)?\)?/);
          const integerLengthInFormat = parseInt(formatMatch[1], 10);
          const decimalLengthInFormat = formatMatch[2]
            ? parseInt(formatMatch[2], 10)
            : 0;

          let num = parseFloat(value);
          if (isNaN(num)) {
            formattedValue = "";
          } else {
            let tempValueString = num.toFixed(decimalLengthInFormat);
            let [intPart, decPart] = tempValueString.split(".");
            intPart = intPart.padStart(integerLengthInFormat, "0");

            if (decimalLengthInFormat > 0) {
              formattedValue = intPart + "." + decPart;
            } else {
              formattedValue = intPart;
            }
          }
        } else if (field.type === "D") {
          if (value instanceof Date && !isNaN(value)) {
            const year = value.getFullYear();
            const month = (value.getMonth() + 1).toString().padStart(2, "0");
            const day = value.getDate().toString().padStart(2, "0");
            formattedValue = `${year}${month}${day}`;
          } else if (typeof value === "string" && value.match(/^\d{8}$/)) {
            formattedValue = value;
          } else {
            formattedValue = "";
          }
        } else {
          formattedValue = String(value);
        }
      }

      formattedValue = formattedValue
        .padEnd(field.length, " ")
        .substring(0, field.length);

      line += formattedValue;
    }
    return line;
  });

  await fs.writeFile(filePath, lines.join("\n"));
}

module.exports = {
  processFileForConversion,
};