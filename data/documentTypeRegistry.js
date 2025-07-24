// This file acts as a central registry for all document type configurations.
// It maps internal document type names to their corresponding models, schemas, and file prefixes.

const {
  FinishedProduct,
  RawMaterial,
  BillOfMaterials,
  finishedProductSchemaSpec,
  rawMaterialSchemaSpec,
  billOfMaterialsSchemaSpec,
} = require("./dataSchemas");

const documentRegistry = {
  finishedProduct: {
    model: FinishedProduct,
    schemaSpec: finishedProductSchemaSpec,
    filePrefix: "FG",
    docType: "finishedProduct", // Add self-reference for convenience
  },
  rawMaterial: {
    model: RawMaterial,
    schemaSpec: rawMaterialSchemaSpec,
    filePrefix: "RM",
    docType: "rawMaterial",
  },
  billOfMaterials: {
    model: BillOfMaterials,
    schemaSpec: billOfMaterialsSchemaSpec,
    filePrefix: "BM",
    docType: "billOfMaterials",
  },
};

// Create a reverse map for quick lookup from file prefix to the full config object
const prefixToConfigMap = Object.values(documentRegistry).reduce(
  (acc, config) => {
    acc[config.filePrefix] = config;
    return acc;
  },
  {}
);

/**
 * Retrieves the full configuration entry for a given identifier, which can be
 * either the internal document type name (e.g., 'finishedProduct') or the
 * file prefix (e.g., 'FG').
 *
 * @param {string} identifier - The internal name or the file prefix.
 * @returns {object} The configuration object for the document type.
 * @throws {Error} if the identifier is not found in the registry.
 */
const getRegistryEntry = (identifier) => {
  // First, try to find it as an internal name (e.g., 'billOfMaterials')
  let entry = documentRegistry[identifier];
  if (entry) {
    return entry;
  }

  // If not found, try to find it as a file prefix (e.g., 'BM')
  entry = prefixToConfigMap[identifier];
  if (entry) {
    return entry;
  }

  // If still not found, it's an unknown type.
  throw new Error(`Unknown document type or prefix requested: ${identifier}`);
};

module.exports = {
  getRegistryEntry,
};