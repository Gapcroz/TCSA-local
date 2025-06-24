// utils/transformationUtils.js
const { finishedProductSchemaSpec, rawMaterialSchemaSpec } = require('../data/dataSchemas'); // Import schema specs for potential future use in transformations
//TODO: VERIFY AND UPDATE UNITS AND TRADE CODE MAPPINGS
// --- Unit of Measure (UOM) Mappings ---
const unitOfMeasureMappings = {
  'EA': 'PCS',
  'KGM': 'LB',
  'LTR': 'GAL',
  'MTK': 'SQM',
  // Add more as per your "UOM file"
};

// --- International Trade Code Mappings ---
const htsCodeMappings = {
  '1234.56.7890': '0101.10.1000',
  '9876543210': '9801.00.1000',
};

const eccnCodeMappings = {
  'EAR99': 'EAR99',
  '5A002': '5A002',
};

/**
 * Applies various transformations to the parsed data based on document type.
 * This includes unit of measure standardization and trade code processing.
 *
 * @param {Object} parsedData - The data parsed from the input file (plain JS objects).
 * @param {string} documentType - The type of document ('finishedProduct', 'rawMaterial', 'billOfMaterials').
 * @returns {Object} The transformed data (plain JS objects).
 */
function applyTransformations(parsedData, documentType) {
  // Ensure deep copy to avoid modifying original parsedData
  const transformedData = JSON.parse(JSON.stringify(parsedData));

  for (const sheetName in transformedData) {
    if (Object.hasOwnProperty.call(transformedData, sheetName)) {
      transformedData[sheetName] = transformedData[sheetName].map(record => {
        // 1. Unit of Measure Transformation
        if (record['Unit of Measure']) {
          const originalUOM = String(record['Unit of Measure']).toUpperCase().trim();
          if (unitOfMeasureMappings[originalUOM]) {
            record['Unit of Measure'] = unitOfMeasureMappings[originalUOM];
          }
          // Note: If you need to *convert* quantity values (e.g., KGM to LB),
          // you'd add that logic here, e.g., record['Quantity'] *= conversionFactor;
        }

        // 2. International Trade Codes (HTS, ECCN)
        if (documentType === 'rawMaterial' || documentType === 'finishedProduct') {
          if (record['Importation HTS Code']) {
            const originalHTS = String(record['Importation HTS Code']).trim();
            if (htsCodeMappings[originalHTS]) {
              record['Importation HTS Code'] = htsCodeMappings[originalHTS];
            }
          }

          if (record['Exportation HTS Code']) {
            const originalHTS = String(record['Exportation HTS Code']).trim();
            if (htsCodeMappings[originalHTS]) {
              record['Exportation HTS Code'] = htsCodeMappings[originalHTS];
            }
          }

          if (documentType === 'rawMaterial' && record['ECCN']) {
            const originalECCN = String(record['ECCN']).trim();
            if (eccnCodeMappings[originalECCN]) {
              record['ECCN'] = eccnCodeMappings[originalECCN];
            }
          }
        }

        // 3. Date Formatting Consistency for output (Date objects to YYYYMMDD string for TXT output)
        // This transformation makes sure date fields are in the expected format before being written to TXT.
        // It's applied here to the *value* in the record. The writeToStandardizedTXT will then use this string.
        if (documentType === 'finishedProduct') {
            if (record['Period (From)'] instanceof Date) {
                record['Period (From)'] = formatDateForTXT(record['Period (From)']);
            }
            if (record['Period (To)'] instanceof Date) {
                record['Period (To)'] = formatDateForTXT(record['Period (To)']);
            }
        }
        if (documentType === 'rawMaterial') {
            if (record['License Expiration date'] instanceof Date) {
                record['License Expiration date'] = formatDateForTXT(record['License Expiration date']);
            }
        }
        // Bill of materials doesn't have explicit dates for now.

        return record;
      });
    }
  }

  return transformedData;
}

/**
 * Helper function to format Date objects into YYYYMMDD string.
 * @param {Date} dateInput
 * @returns {string} YYYYMMDD string or empty string if invalid.
 */
function formatDateForTXT(dateInput) {
    if (!(dateInput instanceof Date) || isNaN(dateInput.getTime())) {
        return '';
    }
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}


module.exports = {
  applyTransformations,
  unitOfMeasureMappings,
  htsCodeMappings,
  eccnCodeMappings,
};