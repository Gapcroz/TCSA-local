const mongoose = require("mongoose");

const createSchemaField = (fieldSpec) => {
  let type;
  let required = fieldSpec.requirement === "M";

  switch (fieldSpec.type) {
    case "A": // Alphanumeric
      type = String;
      break;
    case "N": // Numeric
      type = Number;
      break;
    case "D": // Date (YYYYMMDD)
      type = Date;
      break;
    default:
      type = String;
  }

  const schemaField = { type: type };

  if (required) {
    schemaField.required = [true, `${fieldSpec.dataElement} is required.`];
  } else if (fieldSpec.requirement === "A") {
    schemaField.required = false;
  }

  if (Array.isArray(fieldSpec.possibleValues)) {
    const enumValues = fieldSpec.possibleValues.map((val) => {
      const parts = val.split(" = ");
      return parts.length > 1 ? parts[0] : val;
    });
    schemaField.enum = enumValues;
  }

  return schemaField;
};

const billOfMaterialsSchemaSpec = [
  {
    item: 1,
    dataElement: "Finished Good Part Number",
    type: "A",
    length: 30,
    position: "01-30",
    format: "X(30)",
    possibleValues: null,
    requirement: "M",
    description: "A Client defined code for the Finished Good or Sub-Assy part",
    start: 0,
    end: 29,
  },
  {
    item: 2,
    dataElement: "Component Part Number",
    type: "A",
    length: 30,
    position: "31-60",
    format: "X(30)",
    possibleValues: null,
    requirement: "M",
    description:
      "A Client defined code for the Raw Material (component) that is part of the FG or Sub-Assy",
    start: 30,
    end: 59,
  },
  {
    item: 3,
    dataElement: "Type",
    type: "A",
    length: 1,
    position: "61",
    format: "X(01)",
    possibleValues: ["P-Part", "S-Subassemblies"],
    requirement: "M",
    description:
      "A Code that identifies the component as a Part or as a Sub-Assembly (multi-level BOM)",
    start: 60,
    end: 60,
  },
  {
    item: 4,
    dataElement: "Quantity",
    type: "N",
    length: 17,
    position: "62-78",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description:
      "Quantity to decrement from inventory of the Raw Material Component that are needed in the Finished Good or Sub-Assy",
    start: 61,
    end: 77,
  },
  {
    item: 5,
    dataElement: "Unit of Measure",
    type: "A",
    length: 3,
    position: "79-81",
    format: "X(03)",
    possibleValues: "For valid code see table UOM, section Quantity.",
    requirement: "M",
    description:
      "Unit of Measure based on the quantity. It has to be the same unit of measure used in the Raw Matl catalog",
    start: 78,
    end: 80,
  },
  {
    item: 6,
    dataElement: "Component classification",
    type: "A",
    length: 20,
    position: "82-101",
    format: "X(20)",
    possibleValues: "Client defined",
    requirement: "O",
    description: "A client defined code that identify the component type",
    start: 81,
    end: 100,
  },
];

const billOfMaterialsMongooseSchema = new mongoose.Schema({});
billOfMaterialsSchemaSpec.forEach((field) => {
  billOfMaterialsMongooseSchema.add({
    [field.dataElement]: createSchemaField(field),
  });
});

billOfMaterialsMongooseSchema.statics.getSchemaSpec = () =>
  billOfMaterialsSchemaSpec;

module.exports = mongoose.model(
  "BillOfMaterials",
  billOfMaterialsMongooseSchema
);
