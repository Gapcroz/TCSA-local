// /data/dataSchemas.js
const FinishedProduct = require('../models/FinishedProduct');
const RawMaterial = require('../models/RawMaterial');
const BillOfMaterials = require('../models/BOM');

module.exports = {
  FinishedProduct,
  RawMaterial,
  BillOfMaterials,
  // Also export the schema specs directly for convenience in parsing/formatting
  finishedProductSchemaSpec: FinishedProduct.getSchemaSpec(),
  rawMaterialSchemaSpec: RawMaterial.getSchemaSpec(),
  billOfMaterialsSchemaSpec: BillOfMaterials.getSchemaSpec(),
};