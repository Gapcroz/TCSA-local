// data/documentTypeRegistry.js
const {
  FinishedProduct,
  RawMaterial,
  BillOfMaterials,
  SPLScrap,
  finishedProductSchemaSpec,
  rawMaterialSchemaSpec,
  billOfMaterialsSchemaSpec,
  splScrapSchemaSpec,
} = require("./dataSchemas");

const documentRegistry = {
  finishedProduct: {
    model: FinishedProduct,
    schemaSpec: finishedProductSchemaSpec,
    filePrefix: "FG",
    docType: "finishedProduct",
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
  splScrap: {
    model: SPLScrap,
    schemaSpec: splScrapSchemaSpec,
    filePrefix: ["PI", "PE"],
    docType: "PackingList",
  },
};

// --- NEW: Pre-calculate which fields are unique to each schema ---
const getSchemaUniqueness = () => {
  const allFields = {};
  const uniquenessMap = {};
  const docTypes = Object.keys(documentRegistry);

  // First, get a list of all fields for each document type
  docTypes.forEach((docType) => {
    allFields[docType] = new Set(
      documentRegistry[docType].schemaSpec.map((field) => field.dataElement)
    );
  });

  // Now, determine uniqueness for each field in each doc type
  docTypes.forEach((currentDocType) => {
    uniquenessMap[currentDocType] = new Set();
    const otherDocTypes = docTypes.filter((dt) => dt !== currentDocType);

    allFields[currentDocType].forEach((field) => {
      const isPresentElsewhere = otherDocTypes.some((otherDoc) =>
        allFields[otherDoc].has(field)
      );
      if (!isPresentElsewhere) {
        uniquenessMap[currentDocType].add(field);
      }
    });
  });

  console.log("[Registry] Calculated schema uniqueness:", uniquenessMap);
  return uniquenessMap;
};

const schemaUniquenessMap = getSchemaUniqueness();
// --- END of new section ---

const prefixToConfigMap = {};
Object.values(documentRegistry).forEach((cfg) => {
  const prefixes = Array.isArray(cfg.filePrefix)
    ? cfg.filePrefix
    : [cfg.filePrefix];
  prefixes.forEach((p) => {
    if (!p) return;
    prefixToConfigMap[String(p).toUpperCase()] = cfg;
  });
});

const getRegistryEntry = (identifier) => {
  let entry = documentRegistry[identifier] || prefixToConfigMap[identifier];
  if (entry) {
    return entry;
  }
  throw new Error(`Unknown document type or prefix requested: ${identifier}`);
};

const getDocumentTypeByPrefix = (prefix) => {
  return prefixToConfigMap[prefix];
};

module.exports = {
  getRegistryEntry,
  getDocumentTypeByPrefix,
  schemaUniquenessMap, // Export the pre-calculated map
};
