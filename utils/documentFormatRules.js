// utils/documentFormatRules.js
/**
 * Mapa centralizado de tipos de documento y sus formatos de salida permitidos
 */
const DOCUMENT_FORMAT_RULES = {
  splScrap: {
    allowedFormats: ['csv'],
    defaultFormat: 'csv',
    description: 'Packing List (PI/PE)'
  },
  finishedProduct: {
    allowedFormats: ['txt'],
    defaultFormat: 'txt',
    description: 'Finished Goods (FG)'
  },
  rawMaterial: {
    allowedFormats: ['txt'],
    defaultFormat: 'txt',
    description: 'Raw Materials (RM)'
  },
  billOfMaterials: {
    allowedFormats: ['txt'],
    defaultFormat: 'txt',
    description: 'Bill of Materials (BM)'
  }
};

/**
 * Valida si un formato de salida es compatible con un tipo de documento
 * @param {string} documentType - El tipo de documento
 * @param {string} outputFormat - El formato de salida solicitado
 * @returns {{ isValid: boolean, message?: string }}
 */
const validateFormatCompatibility = (documentType, outputFormat) => {
  const rules = DOCUMENT_FORMAT_RULES[documentType];
  
  if (!rules) {
    return { 
      isValid: false, 
      message: `Tipo de documento desconocido: ${documentType}` 
    };
  }

  if (!rules.allowedFormats.includes(outputFormat)) {
    const allowedList = rules.allowedFormats.join(', ').toUpperCase();
    return {
      isValid: false,
      message: `Los archivos de tipo ${rules.description} solo pueden exportarse a formato ${allowedList}.`
    };
  }

  return { isValid: true };
};

/**
 * Obtiene el formato por defecto para un tipo de documento
 * @param {string} documentType - El tipo de documento
 * @returns {string|null} - El formato por defecto o null si no existe
 */
const getDefaultFormat = (documentType) => {
  const rules = DOCUMENT_FORMAT_RULES[documentType];
  return rules ? rules.defaultFormat : null;
};

/**
 * Obtiene los formatos permitidos para un tipo de documento
 * @param {string} documentType - El tipo de documento
 * @returns {string[]} - Array de formatos permitidos
 */
const getAllowedFormats = (documentType) => {
  const rules = DOCUMENT_FORMAT_RULES[documentType];
  return rules ? rules.allowedFormats : [];
};

module.exports = {
  DOCUMENT_FORMAT_RULES,
  validateFormatCompatibility,
  getDefaultFormat,
  getAllowedFormats
};