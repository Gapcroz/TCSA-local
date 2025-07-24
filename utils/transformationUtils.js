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

  // Get the schema spec from the central registry.
  const { schemaSpec } = getRegistryEntry(documentType);

  if (!records || records.length === 0) {
    return transformedData;
  }

  records.forEach((record) => {
    schemaSpec.forEach((fieldSpec) => {
      // This transformation ensures that if a user provides a full description
      // (e.g., "Ambient"), it gets normalized to its code ("A") before validation.
      if (
        Array.isArray(fieldSpec.possibleValues) &&
        record[fieldSpec.dataElement]
      ) {
        const rawValue = String(record[fieldSpec.dataElement]).trim();

        // Find the matching entry in possibleValues
        const mappedValue = fieldSpec.possibleValues.find((pv) => {
          const [code, description] = pv.split(/\s*=\s*/);
          // Check if the raw value matches either the code or the description (case-insensitive)
          return (
            rawValue.toUpperCase() === code.toUpperCase() ||
            (description &&
              rawValue.toUpperCase() === description.toUpperCase())
          );
        });

        if (mappedValue) {
          // If a match is found, always store just the code part.
          record[fieldSpec.dataElement] = mappedValue.split(/\s*=\s*/)[0];
        }
      }
    });

    // Example of another common transformation: standardize part numbers to uppercase.
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