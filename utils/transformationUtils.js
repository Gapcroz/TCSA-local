// utils/transformationUtils.js
const { getRegistryEntry } = require("../data/documentTypeRegistry");

/**
 * Applies standard transformations to parsed data, such as normalizing enum values.
 * This step runs BEFORE validation to clean up the data.
 * @param {Object} parsedData - The data object from one of the parsers.
 * @param {string} documentType - The internal name of the document type.
 * @returns {Object} The transformed data object.
 */
const applyTransformations = (parsedData, documentType) => {
  const transformedData = { ...parsedData };
  const records = transformedData.Sheet1;

  const { schemaSpec } = getRegistryEntry(documentType);

  if (!records || records.length === 0) {
    return transformedData;
  }

  console.log(
    `[Transformation] Starting transformations for document type: ${documentType}`
  );

  records.forEach((record, index) => {
    const rowNum = index + 2; // For user-friendly logging

    schemaSpec.forEach((fieldSpec) => {
      const fieldName = fieldSpec.dataElement;
      if (record[fieldName] === undefined || record[fieldName] === null) {
        return; // Skip empty fields
      }

      // Only apply special logic for fields with predefined possible values
      if (Array.isArray(fieldSpec.possibleValues)) {
        const rawValue = String(record[fieldName]).trim();
        const upperRawValue = rawValue.toUpperCase();

        // Log the initial state for problematic fields
        if (fieldName === "NAFTA" || fieldName === "Producer") {
          console.log(
            `[Row ${rowNum}] PRE-TRANSFORM | Field: "${fieldName}" | Value: "${rawValue}"`
          );
        }

        // Specific transformations for Finished Product
        if (documentType === "finishedProduct") {
          if (fieldName === "NAFTA") {
            if (upperRawValue === "YES") {
              record[fieldName] = "Y";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "Y"`
              );
              return;
            }
            if (upperRawValue === "NO") {
              record[fieldName] = "N";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "N"`
              );
              return;
            }
          }

          if (fieldName === "Producer") {
            if (upperRawValue === "YES") {
              record[fieldName] = "Yes";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "Yes"`
              );
              return;
            }
            if (upperRawValue === "NO") {
              record[fieldName] = "No (1)";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "No (1)"`
              );
              return;
            }
          }
        }

        // Generic transformation for description-to-code mapping
        const mappedValue = fieldSpec.possibleValues.find((pv) => {
          const [code, description] = pv.split(/\s*=\s*/);
          return (
            upperRawValue === code.toUpperCase() ||
            (description && upperRawValue === description.toUpperCase())
          );
        });

        if (mappedValue) {
          const code = mappedValue.split(/\s*=\s*/)[0];
          if (record[fieldName] !== code) {
            record[fieldName] = code;
          }
        }
      }
    });

    // Standardize part numbers
    if (record["Part Number"]) {
      record["Part Number"] = String(record["Part Number"]).toUpperCase();
    }
    if (record["Finished Good Part Number"]) {
      record["Finished Good Part Number"] = String(
        record["Finished Good Part Number"]
      ).toUpperCase();
    }
    if (record["Component Part Number"]) {
      record["Component Part Number"] = String(
        record["Component Part Number"]
      ).toUpperCase();
    }
  });

  return transformedData;
};

module.exports = {
  applyTransformations,
};