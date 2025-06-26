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
// Import schema specs to define output structure for standardized TXT
const {
  finishedProductSchemaSpec,
  rawMaterialSchemaSpec,
  billOfMaterialsSchemaSpec,
} = require("../data/dataSchemas");

// Service that encapsulates file conversion logic
// MODIFIED SIGNATURE: userId is now optional, isAutomated is new
const processFileForConversion = async (
  fileBuffer,
  originalName,
  outputFormat,
  conversionOptions,
  // userId is now optional, handled by specific callers if needed
  callerUserId = null, // Renamed for clarity, it's the user who initiated if applicable
  isAutomated = false // New parameter to indicate automated job
) => {
  let parsedData;
  const fileExtension = path.extname(originalName).toLowerCase();
  let errorReport = [];

  const { documentType } = conversionOptions;

  if (fileExtension === ".txt" && !documentType) {
    throw new Error("Document type is required for TXT file parsing.");
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
      throw new Error("Unsupported input file format.");
  }

  // Step 2: Transformation (Units and Trade Codes)
  let transformedData = applyTransformations(parsedData, documentType);

  // Step 3: Validation (Data Integrity and Business Rules)
  const integrityResult = validateDataIntegrity(transformedData);
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
 * @param {Object} data - The processed data, typically { Sheet1: [records] } (plain JS objects).
 * @param {string} filePath - The path where the file should be written.
 * @param {string} documentType - The type of document to determine the schema.
 */
async function writeToStandardizedTXT(data, filePath, documentType) {
  const records = data.Sheet1;
  if (!records || records.length === 0) {
    await fs.writeFile(filePath, "");
    return;
  }

  let schemaSpec;
  switch (documentType) {
    case "finishedProduct":
      schemaSpec = finishedProductSchemaSpec;
      break;
    case "rawMaterial":
      schemaSpec = rawMaterialSchemaSpec;
      break;
    case "billOfMaterials":
      schemaSpec = billOfMaterialsSchemaSpec;
      break;
    default:
      throw new Error(`Unknown document type for TXT writing: ${documentType}`);
  }

  const lines = records.map((record) => {
    let line = "";
    for (const field of schemaSpec) {
      let value = record[field.dataElement];
      let formattedValue = "";

      if (value === null || value === undefined) {
        formattedValue = "";
      } else {
        if (field.type === "N") {
          const parts = field.format.match(/9\((\d+)\)\.?9?\(?(\d+)?\)?/);
          let integerLength = parseInt(parts[1], 10);
          let decimalLength = parts[2] ? parseInt(parts[2], 10) : 0;

          let num = parseFloat(value);
          if (isNaN(num)) {
            formattedValue = "";
          } else {
            formattedValue = num.toFixed(decimalLength);
            const [intPart, decPart] = formattedValue.split(".");
            const paddedIntPart = intPart.padStart(integerLength, "0");
            formattedValue = paddedIntPart;
            if (decimalLength > 0) {
              formattedValue +=
                "." + (decPart || "").padEnd(decimalLength, "0");
            }
          }
        } else if (field.type === "D") {
          formattedValue = String(value);
        } else {
          formattedValue = String(value);
        }
      }

      formattedValue = formattedValue.padEnd(field.length, " ");
      formattedValue = formattedValue.substring(0, field.length);

      line += formattedValue;
    }
    return line;
  });

  await fs.writeFile(filePath, lines.join("\n"));
}

module.exports = {
  processFileForConversion,
};
