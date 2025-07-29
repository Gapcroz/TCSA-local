const { getRegistryEntry } = require("../data/documentTypeRegistry");

/**
 * Validates the integrity of parsed data against its schema specification.
 * Checks for mandatory fields, field length, and valid enum values.
 * @param {Object} data - The parsed data object, e.g., { Sheet1: [records] }.
 * @param {string} documentType - The internal name of the document type.
 * @returns {{isValid: boolean, errors: Array<Object>}}
 */
const validateDataIntegrity = (data, documentType) => {
  // Get the correct schema spec from the central registry.
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
    const rowNum = recordIndex + 2; // Assuming row 1 is header for user-friendly error messages

    schemaSpec.forEach((fieldSpec) => {
      const value = record[fieldSpec.dataElement];
      const fieldName = fieldSpec.dataElement;

      // Check for mandatory fields (M)
      if (
        fieldSpec.requirement === "M" &&
        (value === null || value === undefined || String(value).trim() === "")
      ) {
        errors.push({
          type: "Integrity Error",
          message: `Row ${rowNum}: Mandatory field "${fieldName}" is missing or empty.`,
          field: fieldName,
          row: rowNum,
        });
      }

      // Correctly validate against enum CODES, not full descriptions.
      if (
        Array.isArray(fieldSpec.possibleValues) &&
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        // Extract just the codes (e.g., 'P', 'S') from the spec.
        const enumCodes = fieldSpec.possibleValues.map(
          (val) => val.split(/\s*=\s*/)[0]
        );
        // Check if the record's value is included in the list of codes.
        if (!enumCodes.includes(String(value).trim())) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fieldName}" has an invalid value "${value}". Expected one of: ${enumCodes.join(
              ", "
            )}`,
            field: fieldName,
            row: rowNum,
            value: value,
            expected: enumCodes, // The error report now shows the correct expected codes.
          });
        }
      }
    });
  });

  return { isValid: errors.length === 0, errors };
};

/**
 * Applies complex, cross-field, or database-dependent business rules.
 * @param {Object} data - The parsed data object.
 * @param {string} documentType - The internal name of the document type.
 * @returns {Promise<{isValid: boolean, errors: Array<Object>}>}
 */
const applyBusinessValidations = async (data, documentType) => {
  // Get the schema from the central registry to ensure consistency.
  const { schemaSpec } = getRegistryEntry(documentType);
  const errors = [];
  const records = data.Sheet1;

  if (!records || records.length === 0) {
    return { isValid: true, errors: [] }; // No records to validate
  }

  // This is where you would implement complex, document-specific business rules.
  if (documentType === "finishedProduct") {
    records.forEach((record, recordIndex) => {
      const rowNum = recordIndex + 2; // Assuming row 1 is header
      const fdaMarker = record["FDA Marker"];
      const fdaProductCode = record["FDA Product Code"];

      if (
        fdaMarker === "FD2" &&
        (fdaProductCode === null || String(fdaProductCode).trim() === "")
      ) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "FDA Product Code" is mandatory when "FDA Marker" is "FD2".`,
          field: "FDA Product Code",
          row: rowNum,
        });
      }

      const nafta = record["NAFTA"];
      const preferenceCriterion = record["Preference Criterion"];
      if (
        nafta === "Y" &&
        (preferenceCriterion === null ||
          String(preferenceCriterion).trim() === "")
      ) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "Preference Criterion" is mandatory when "NAFTA" is "Y".`,
          field: "Preference Criterion",
          row: rowNum,
        });
      }
      // Add other NAFTA-related business rules here...
    });
  }

  // Add other `if (documentType === ...)` blocks for other types as needed.

  return { isValid: errors.length === 0, errors };
};

module.exports = {
  validateDataIntegrity,
  applyBusinessValidations,
};