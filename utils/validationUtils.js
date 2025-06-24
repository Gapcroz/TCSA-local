// Import Mongoose models and their schema specs
const { FinishedProduct, RawMaterial, BillOfMaterials, finishedProductSchemaSpec, rawMaterialSchemaSpec, billOfMaterialsSchemaSpec } = require('../data/dataSchemas');

/**
 * Performs general data integrity validations (e.g., empty sheets).
 * @param {Object} data - The parsed data, typically { Sheet1: [records] }.
 * @returns {{isValid: boolean, errors: Array<Object>}} Validation result.
 */
function validateDataIntegrity(data) {
  const errors = [];
  let isValid = true;

  for (const sheetName in data) {
    if (Object.hasOwnProperty.call(data, sheetName)) {
      const records = data[sheetName];

      if (!records || records.length === 0) {
        errors.push({
          type: 'empty_sheet',
          message: `Sheet "${sheetName}" is empty or contains no data.`,
          sheet: sheetName,
        });
        isValid = false;
        continue;
      }

      records.forEach((row, rowIndex) => {
        if (Object.keys(row).length === 0) {
          errors.push({
            type: 'empty_row',
            message: `Row ${rowIndex + 1} in sheet "${sheetName}" is empty.`,
            sheet: sheetName,
            row: rowIndex + 1,
          });
          isValid = false;
        }
      });
    }
  }
  return { isValid, errors };
}

/**
 * Applies business-specific validations using Mongoose models and custom rules.
 *
 * @param {Object} data - The parsed and potentially transformed data (plain JS objects).
 * @param {string} documentType - The type of document.
 * @returns {{isValid: boolean, errors: Array<Object>}} Validation result.
 */
async function applyBusinessValidations(data, documentType) {
  const errors = [];
  let isValid = true;

  let Model;
  let schemaSpec;
  switch (documentType) {
    case 'finishedProduct':
      Model = FinishedProduct;
      schemaSpec = finishedProductSchemaSpec;
      break;
    case 'rawMaterial':
      Model = RawMaterial;
      schemaSpec = rawMaterialSchemaSpec;
      break;
    case 'billOfMaterials':
      Model = BillOfMaterials;
      schemaSpec = billOfMaterialsSchemaSpec;
      break;
    default:
      errors.push({
        type: 'schema_error',
        message: `Unknown document type '${documentType}' for business validation.`,
      });
      return { isValid: false, errors };
  }

  const records = data.Sheet1; // Assuming parsed data is always in 'Sheet1' for simplicity

  for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
    const record = records[rowIndex];
    const rowIdentifier = `Row ${rowIndex + 1}`;

    // 1. Mongoose Model Validation (handles `required` fields and basic type casting)
    const doc = new Model(record);
    try {
      await doc.validate();
    } catch (mongooseValidationError) {
      isValid = false;
      for (const fieldName in mongooseValidationError.errors) {
        const err = mongooseValidationError.errors[fieldName];
        errors.push({
          type: 'mongoose_validation_error',
          message: `${fieldName}: ${err.message}`,
          documentType,
          row: rowIndex + 1,
          field: fieldName,
          reason: err.kind,
        });
      }
    }

    // 2. Custom Business Rule Validations (for 'A' fields and cross-field logic)
    schemaSpec.forEach((field) => {
      const fieldValue = record[field.dataElement];
      const fieldName = field.dataElement;

      // "If Applies" (A) requirement checks
      if (field.requirement === 'A' && (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '')) {
        // NAFTA related fields for Finished Product
        if (documentType === 'finishedProduct' && (
            fieldName === 'Preference Criterion' ||
            fieldName === 'Producer' ||
            fieldName === 'Net Cost' ||
            fieldName === 'Period (From)' ||
            fieldName === 'Period (To)'
        )) {
            const naftaApplicable = record['NAFTA'] && String(record['NAFTA']).toUpperCase().trim() === 'Y';
            if (naftaApplicable) {
                errors.push({
                    type: 'missing_conditional_field',
                    message: `${fieldName} is mandatory when NAFTA applies but is missing or empty.`,
                    documentType,
                    row: rowIndex + 1,
                    field: fieldName,
                });
                isValid = false;
            }
        }
        // ECCN related fields for Raw Material
        if (documentType === 'rawMaterial' &&
            (fieldName === 'License Number (LCN)' || fieldName === 'License Exception' || fieldName === 'License Expiration date')
        ) {
            const eccnPresent = record['ECCN'] && String(record['ECCN']).trim() !== '';
            if (eccnPresent && String(record['ECCN']).toUpperCase().trim() !== 'EAR99') {
                if (String(fieldValue).trim() === '') { // Only error if the field is actually empty/missing
                    errors.push({
                        type: 'missing_conditional_field',
                        message: `${fieldName} is required for ECCN '${record['ECCN']}' (if not EAR99) but is missing.`,
                        documentType,
                        row: rowIndex + 1,
                        field: fieldName,
                    });
                    isValid = false;
                }
            }
        }
        // FDA related fields for Finished Product
        if (documentType === 'finishedProduct' && fieldName.startsWith('FDA')) {
            const fdaProductCodePresent = record['FDA Product Code'] && String(record['FDA Product Code']).trim() !== '';
            // Example: If FDA Product Code is present, then FDA Storage is required.
            if (fieldName === 'FDA Storage' && fdaProductCodePresent && String(fieldValue).trim() === '') {
                errors.push({
                    type: 'missing_conditional_field',
                    message: `${fieldName} is required when FDA Product Code is present but is missing.`,
                    documentType,
                    row: rowIndex + 1,
                    field: fieldName,
                });
                isValid = false;
            }
            // Add more specific FDA rules here
        }
      }

      // Format-specific checks that Mongoose might not catch (e.g., date string exact format YYYYMMDD before casting to Date)
      if (field.type === 'D' && fieldValue && typeof fieldValue === 'string') {
          // If the parser returned a string (e.g. from CSV/XLSX) and it's not a Date object yet
          if (!/^\d{8}$/.test(fieldValue)) {
              errors.push({
                  type: 'invalid_format',
                  message: `${fieldName} must be in YYYYMMDD format. Found: '${fieldValue}'`,
                  documentType,
                  row: rowIndex + 1,
                  field: fieldName,
              });
              isValid = false;
          }
      }

      // Enum possible values check (Mongoose handles enum for schema, but extra check if data was modified or not cast)
      if (Array.isArray(field.possibleValues) && fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== '') {
        const acceptedValues = field.possibleValues.map(val => {
            const parts = val.split(' = ');
            return (parts.length > 1 ? parts[0] : val).toUpperCase().trim();
        });
        const currentVal = String(fieldValue).toUpperCase().trim();

        if (!acceptedValues.includes(currentVal)) {
            errors.push({
                type: 'invalid_enum_value',
                message: `${fieldName} has an invalid value: '${fieldValue}'. Accepted values: ${acceptedValues.join(', ')}.`,
                documentType,
                row: rowIndex + 1,
                field: fieldName,
            });
            isValid = false;
        }
      }

    });

    // Cross-record/document level validations (requires external data if applicable)
    // E.g., "Unit of Measure has to be the same unit of measure used in the Raw Matl catalog" for BOM
    // This would require fetching a RawMaterial record by 'Component Part Number'.
    // For now, this is a placeholder. You'd need to query the RawMaterial model here.
    // if (documentType === 'billOfMaterials') {
    //   const componentPartNumber = record['Component Part Number'];
    //   const bomUOM = record['Unit of Measure'];
    //   if (componentPartNumber && bomUOM) {
    //     const rm = await RawMaterial.findOne({ 'Part Number': componentPartNumber });
    //     if (rm && rm['Unit of measure'] !== bomUOM) {
    //       errors.push({
    //         type: 'uom_mismatch_bom_rm',
    //         message: `UOM for BOM Component '${componentPartNumber}' (${bomUOM}) does not match Raw Material UOM (${rm['Unit of measure']}).`,
    //         documentType,
    //         row: rowIndex + 1,
    //         field: 'Unit of Measure',
    //       });
    //       isValid = false;
    //     }
    //   }
    // }
  }

  return { isValid, errors };
}

module.exports = {
  validateDataIntegrity,
  applyBusinessValidations,
};