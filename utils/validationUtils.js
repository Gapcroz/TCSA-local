const { getRegistryEntry } = require("../data/documentTypeRegistry");
const { isValidCountryCode } = require("../data/countryCatalog");

// Reglas de formato
const HTS_FORMATTED_RE = /^\d{4}\.\d{2}\.\d{4}$/; // ####.##.####
const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";
const ALLOW_EMPTY_MANDATORY_FIELDS =
  (process.env.ALLOW_EMPTY_MANDATORY_FIELDS || "true").toLowerCase() === "true";

/**
 * Validates the integrity of parsed data against its schema specification.
 * Checks for mandatory fields, field length, and valid enum values.
 * Adds HTS-format and Country-of-Origin checks.
 * @param {Object} data - The parsed data object, e.g., { Sheet1: [records] }.
 * @param {string} documentType - The internal name of the document type.
 * @returns {{isValid: boolean, errors: Array<Object>}}
 */
const validateDataIntegrity = (data, documentType) => {
  const { schemaSpec } = getRegistryEntry(documentType);
  const errors = [];
  const records = data.Sheet1;

  if (!records || records.length === 0) {
    errors.push({
      type: "Integrity Error",
      message: "No records found to validate.",
    });
    return { isValid: false, errors };
  }

  records.forEach((record, recordIndex) => {
    const rowNum = recordIndex + 2; // UI-friendly

    // 1) Reglas genéricas del schema (obligatorios + enums)
    schemaSpec.forEach((fieldSpec) => {
      const fieldName = fieldSpec.dataElement;
      const value = record[fieldName];

      // Campos obligatorios (M)
      if (
        fieldSpec.requirement === "M" &&
        isBlank(value) &&
        !ALLOW_EMPTY_MANDATORY_FIELDS
      ) {
        errors.push({
          type: "Integrity Error",
          message: `Row ${rowNum}: Mandatory field "${fieldName}" is missing or empty.`,
          field: fieldName,
          row: rowNum,
        });
      }

      // Enums: validar contra códigos (lado izquierdo antes del "=")
      if (Array.isArray(fieldSpec.possibleValues) && !isBlank(value)) {
        const enumCodes = fieldSpec.possibleValues.map(
          (val) => val.split(/\s*=\s*/)[0]
        );
        if (!enumCodes.includes(String(value).trim())) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fieldName}" has an invalid value "${value}". Expected one of: ${enumCodes.join(
              ", "
            )}`,
            field: fieldName,
            row: rowNum,
            value,
            expected: enumCodes,
          });
        }
      }
    });

    // 2) Validación de formato HTS
    if (documentType === "finishedProduct") {
      [
        "USA Importation HTS Code",
        "USA Exportation Code",
        "USA Exportation HTS Code", // alias aceptado
      ].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    } else if (documentType === "rawMaterial") {
      ["Importation HTS Code", "Exportation HTS Code"].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    } else if (documentType === "splScrap") {
      ["US IMP HTS Code", "US EXP HTS Code"].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    }

    // 3) Validación Country of Origin contra catálogo (ambos esquemas)
    const cooFieldName = Object.prototype.hasOwnProperty.call(
      record,
      "Country of Origin"
    )
      ? "Country of Origin"
      : Object.prototype.hasOwnProperty.call(record, "Country of origin")
      ? "Country of origin"
      : null;

    if (cooFieldName) {
      const coo = record[cooFieldName];
      if (!isBlank(coo)) {
        const code = String(coo).trim().toUpperCase();
        if (!isValidCountryCode(code)) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: "${cooFieldName}" must be a valid 2-letter code from catalog. Got "${coo}".`,
            field: cooFieldName,
            row: rowNum,
            value: coo,
          });
        }
      }
    }
  });

  return { isValid: errors.length === 0, errors };
};

/**
 * Applies complex, cross-field, or database-dependent business rules.
 * Includes NAFTA-dependent rules.
 * @param {Object} data - The parsed data object.
 * @param {string} documentType - The internal name of the document type.
 * @returns {Promise<{isValid: boolean, errors: Array<Object>}>}
 */
const applyBusinessValidations = async (data, documentType) => {
  const errors = [];
  const records = data.Sheet1;

  if (!records || records.length === 0) {
    return { isValid: true, errors: [] };
  }

  if (documentType === "finishedProduct") {
    records.forEach((record, recordIndex) => {
      const rowNum = recordIndex + 2;

      // Regla existente: FDA Marker => FDA Product Code
      const fdaMarker = record["FDA Marker"];
      const fdaProductCode = record["FDA Product Code"];
      if (fdaMarker === "FD2" && isBlank(fdaProductCode)) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "FDA Product Code" is mandatory when "FDA Marker" is "FD2".`,
          field: "FDA Product Code",
          row: rowNum,
        });
      }

      // Regla existente: NAFTA => Preference Criterion obligatorio
      const nafta = record["NAFTA"];
      const preferenceCriterion = record["Preference Criterion"];
      if (nafta === "Y" && isBlank(preferenceCriterion)) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "Preference Criterion" is mandatory when "NAFTA" is "Y".`,
          field: "Preference Criterion",
          row: rowNum,
        });
      }

      // NUEVAS reglas cuando NAFTA = "Y"
      if (nafta === "Y") {
        const netCost = record["Net Cost"];
        const netCostUp = isBlank(netCost)
          ? ""
          : String(netCost).trim().toUpperCase();

        if (!["CN", "NO"].includes(netCostUp)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: When "NAFTA" is "Y", "Net Cost" must be "CN" or "NO". Got "${netCost}".`,
            field: "Net Cost",
            row: rowNum,
            value: netCost,
            expected: ["CN", "NO"],
          });
        }

        const periodFrom = record["Period (From)"];
        if (isBlank(periodFrom)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: "Period (From)" is mandatory when "NAFTA" is "Y".`,
            field: "Period (From)",
            row: rowNum,
          });
        }

        const periodTo = record["Period (To)"];
        if (isBlank(periodTo)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: "Period (To)" is mandatory when "NAFTA" is "Y".`,
            field: "Period (To)",
            row: rowNum,
          });
        }
      }
    });
  }

  return { isValid: errors.length === 0, errors };
};

module.exports = {
  validateDataIntegrity,
  applyBusinessValidations,
};
