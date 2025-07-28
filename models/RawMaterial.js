const mongoose = require("mongoose");

// Helper function to create schema fields from your spec
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
      type = String; // Default to string if type is unknown
  }

  const schemaField = { type: type };

  if (required) {
    schemaField.required = [true, `${fieldSpec.dataElement} is required.`];
  } else if (fieldSpec.requirement === "A") {
    // "If Applies" fields are not strictly required by default Mongoose schema,
    // but validation logic will handle their conditional requirement.
    schemaField.required = false;
  }

  // Add enum for possible values if applicable
  if (Array.isArray(fieldSpec.possibleValues)) {
    // For values like "A = Ambient", store just "A" in DB.
    // Use a regex to handle inconsistent spacing around the "=".
    const enumValues = fieldSpec.possibleValues.map((val) => {
      const parts = val.split(/\s*=\s*/); // Robust split
      return parts[0]; // Always take the first part as the code
    });
    schemaField.enum = enumValues;
  }

  return schemaField;
};

const rawMaterialSchemaSpec = [
  {
    item: 1,
    dataElement: "Part Number",
    aliases: ["Part No", "Part #", "SKU", "Item Number", "Material Code"],
    type: "A",
    length: 30,
    position: "01-30",
    format: "X(30)",
    possibleValues: null,
    requirement: "M",
    description: "A Client defined code for the raw material or component",
    start: 0,
    end: 29,
  },
  {
    item: 2,
    dataElement: "Description",
    aliases: ["Desc", "Item Description", "Material Description"],
    type: "A",
    length: 60,
    position: "31-90",
    format: "X(60)",
    possibleValues: null,
    requirement: "M",
    description: "Line item description",
    start: 30,
    end: 89,
  },
  {
    item: 3,
    dataElement: "Unit Weight Lb.",
    aliases: ["Weight", "Unit Weight", "Weight (LBS)", "LBS"],
    type: "N",
    length: 17,
    position: "91-107",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Line item weight in pounds (LBS)",
    start: 90,
    end: 106,
  },
  {
    item: 4,
    dataElement: "Unit Cost (USD)",
    aliases: ["Unit Value (USD)","Unit value","Cost", "Unit Cost", "Price", "Unit Price", "Cost (USD)"],
    type: "N",
    length: 17,
    position: "108-124",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Line item unit cost",
    start: 107,
    end: 123,
  },
  {
    item: 5,
    dataElement: "Unit of measure",
    aliases: ["UOM", "Unit"],
    type: "A",
    length: 3,
    position: "125-127",
    format: "X(03)",
    possibleValues: null,
    requirement: "M",
    description: "Unit of measure",
    start: 124,
    end: 126,
  },
  {
    item: 6,
    dataElement: "Country of origin",
    aliases: ["COO", "Origin", "Country"],
    type: "A",
    length: 2,
    position: "128-129",
    format: "X(02)",
    possibleValues: null,
    requirement: "M",
    description: "Line item origin",
    start: 127,
    end: 128,
  },
  {
    item: 7,
    dataElement: "Importation HTS Code",
    aliases: ["US IMP HTS Code","HTS Import", "Import HTS", "HTS Code (Import)"],
    type: "A",
    length: 12,
    position: "130-141",
    format: "X(12)",
    possibleValues: null,
    requirement: "M",
    description:
      "US HTS Code for merchandise to be imported into the US (Customs purposes)",
    start: 129,
    end: 140,
  },
  {
    item: 8,
    dataElement: "Exportation HTS Code",
    aliases: ["US EXP HTS Code","HTS Export", "Export HTS", "HTS Code (Export)", "Schedule B"],
    type: "A",
    length: 12,
    position: "142-153",
    format: "X(12)",
    possibleValues: null,
    requirement: "M",
    description:
      "US HTS Code for merchandise to be exported from the US (Customs purposes)",
    start: 141,
    end: 152,
  },
  {
    item: 9,
    dataElement: "ECCN",
    aliases: ["ECCN Number"],
    type: "A",
    length: 10,
    position: "154-163",
    format: "X(10)",
    possibleValues: null,
    requirement: "M",
    description: "Export Control Classification Number",
    start: 153,
    end: 162,
  },
  {
    item: 10,
    dataElement: "Filler",
    aliases: [], // No aliases needed for a filler field
    type: "A",
    length: 20,
    position: "164-183",
    format: "X(20)",
    possibleValues: null,
    requirement: "O",
    description: "Additional item's information",
    start: 163,
    end: 182,
  },
  {
    item: 11,
    dataElement: "License Number (LCN)",
    aliases: ["License No", "LCN", "License #"],
    type: "A",
    length: 20,
    position: "184-203",
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description: "When applies (belongs to ECCN)",
    start: 183,
    end: 202,
  },
  {
    item: 12,
    dataElement: "License Exception",
    aliases: ["Lic Exception", "Exception"],
    type: "A",
    length: 20,
    position: "204-223",
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description: "When applies (belongs to ECCN)",
    start: 203,
    end: 222,
  },
  {
    item: 13,
    dataElement: "License Expiration date",
    aliases: ["Lic Exp Date", "Expiration Date", "Expires On"],
    type: "D",
    length: 8,
    position: "224-231",
    format: "YYYYMMDD",
    possibleValues: "i.e. 20110131 = Jan 31st, 2011",
    requirement: "A",
    description: "When applies (belongs to ECCN)",
    start: 223,
    end: 230,
  },
  {
    item: 14,
    dataElement: "USML (ITAR)",
    aliases: ["USML", "ITAR"],
    type: "A",
    length: 20,
    position: "232-251",
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description:
      "US Military License (When the material is classified for the US Gov as a Military good)",
    start: 231,
    end: 250,
  },
];

const rawMaterialMongooseSchema = new mongoose.Schema({});
rawMaterialSchemaSpec.forEach((field) => {
  // The dataElement name must not have spaces for Mongoose keys
  const key = field.dataElement.replace(/\s+/g, "");
  rawMaterialMongooseSchema.add({
    [field.dataElement]: createSchemaField(field),
  });
});

rawMaterialMongooseSchema.statics.getSchemaSpec = () => rawMaterialSchemaSpec;

module.exports = mongoose.model("RawMaterial", rawMaterialMongooseSchema);