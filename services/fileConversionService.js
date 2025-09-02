// services/fileConversionService.js
const path = require("path");
const fs = require("fs/promises");
const { getRegistryEntry } = require("../data/documentTypeRegistry");
const { parseXLSX, parseCSV, parseTXT } = require("../utils/fileParsers");
const {
  validateDataIntegrity,
  applyBusinessValidations,
} = require("../utils/validationUtils");
const { applyTransformations } = require("../utils/transformationUtils");

const WRITE_TXT_ON_VALIDATION_ERROR =
  (process.env.WRITE_TXT_ON_VALIDATION_ERROR || "false").toLowerCase() ===
  "true";

// Service that encapsulates file conversion logic
const processFileForConversion = async (
  fileBuffer,
  originalName,
  outputFormat,
  conversionOptions,
  callerUserId = null,
  isAutomated = false
) => {
  const fileExtension = path.extname(originalName).toLowerCase();
  let errorReport = [];
  const { documentType } = conversionOptions;

  if (!documentType) {
    throw new Error(
      "Document type (e.g., 'finishedProduct') is required for processing."
    );
  }

  // Step 1: Parsing
  let parsedData;
  switch (fileExtension) {
    case ".xls":
    case ".xlsx":
      parsedData = await parseXLSX(fileBuffer, documentType);
      break;
    case ".csv":
      parsedData = await parseCSV(fileBuffer, documentType);
      break;
    case ".txt":
      parsedData = await parseTXT(fileBuffer, documentType);
      break;
    default:
      throw new Error(`Unsupported input file format: ${fileExtension}.`);
  }

  // Step 2: Transformation (e.g., normalize enum values)
  const transformedData = applyTransformations(parsedData, documentType);

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

  const hasErrors = errorReport.length > 0;

  // Step 4: (Opcional) generación del TXT
  const baseName = path.parse(originalName).name;
  const outputExt = outputFormat || "txt";
  let convertedFilePath = null;

  if (!hasErrors || WRITE_TXT_ON_VALIDATION_ERROR) {
    const outputFileName = `${baseName}.${outputExt}`;
    convertedFilePath = path.join(
      __dirname,
      "..",
      "temp_converted_files",
      outputFileName
    );
    await fs.mkdir(path.dirname(convertedFilePath), { recursive: true });
    await writeToStandardizedTXT(
      transformedData,
      convertedFilePath,
      documentType
    );
  }

  // Step 5: Generate error report if any errors occurred
  let errorReportPath = null;
  if (hasErrors) {
    const errorReportFileName = `${baseName}-errors.json`;
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
    convertedFilePath, // puede ser null si no generamos TXT por errores
    errorReportPath,
    status: hasErrors ? "completed_with_errors" : "completed",
  };
};

/**
 * Writes data to a standardized plain text file based on the schema.
 */
async function writeToStandardizedTXT(data, filePath, documentType) {
  const records = data.Sheet1;
  if (!records || records.length === 0) {
    await fs.writeFile(filePath, "");
    return;
  }

  const { schemaSpec } = getRegistryEntry(documentType);

  const lines = records.map((record) => {
    const naftaRaw = String(record["NAFTA"] ?? "")
      .trim()
      .toUpperCase();
    const nafta = naftaRaw === "Y" ? "Y" : naftaRaw === "N" ? "N" : ""; // ← fuerza vacío si no es Y/N
    const maskNafta = documentType === "finishedProduct" && nafta !== "Y";

    const naftaDependents = new Set([
      "Preference Criterion",
      "Producer",
      "Net Cost",
      "Period (From)",
      "Period (To)",
    ]);

    let line = "";
    for (const field of schemaSpec) {
      let value = record[field.dataElement];

      // -------- NAFTA safety mask --------
      // Si el propio campo es NAFTA y quedó inválido, imprímelo vacío
      if (field.dataElement === "NAFTA" && nafta === "") {
        value = "";
      }

      if (maskNafta && naftaDependents.has(field.dataElement)) {
        value = ""; // no imprimir nada para estos campos
      }
      // -----------------------------------

      let formattedValue = "";

      if (value !== null && value !== undefined) {
        if (field.type === "N") {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            const formatMatch = field.format.match(
              /9\((\d+)\)\.?9?\(?(\d+)?\)?/
            );
            const decimalLengthInFormat = formatMatch?.[2]
              ? parseInt(formatMatch[2], 10)
              : 0;
            formattedValue = num
              .toFixed(decimalLengthInFormat)
              .replace(/\.?0+$/, "");
          }
        } else if (field.type === "D") {
          if (value instanceof Date && !isNaN(value)) {
            const year = value.getFullYear();
            const month = (value.getMonth() + 1).toString().padStart(2, "0");
            const day = value.getDate().toString().padStart(2, "0");
            formattedValue = `${year}${month}${day}`;
          } else {
            // si llega string vacío u otro, dejamos vacío
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
