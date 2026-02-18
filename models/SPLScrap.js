// models/SPLScrap.js
const mongoose = require("mongoose");

/**
 * convierte la especificación de campo (tipo A/N/D,
 * requirement M/A/O, enum de posibles valores) a un campo de Mongoose.
 */
const createSchemaField = (fieldSpec) => {
  let type;
  const required = fieldSpec.requirement === "M";

  switch (fieldSpec.type) {
    case "A":
      type = String;
      break; // Alphanumeric
    case "N":
      type = Number;
      break; // Numeric (usa decimales si aplica en tu lógica)
    case "D":
      type = Date;
      break; // Date (YYYYMMDD en tu conversor)
    default:
      type = String;
  }

  const schemaField = { type };

  if (required) {
    schemaField.required = [true, `${fieldSpec.dataElement} is required.`];
  } else if (fieldSpec.requirement === "A") {
    // "If Applies":
    schemaField.required = false;
  }

  if (Array.isArray(fieldSpec.possibleValues)) {
    const enumValues = fieldSpec.possibleValues.map((val) => {
      const parts = val.split(/\s*=\s*/);
      return parts[0];
    });
    schemaField.enum = enumValues;
  }

  return schemaField;
};

let splScrapSchemaSpec = [
  {
    item: 1,
    dataElement: "Customer(southbound) / Ship to (northbound)",
    aliases: ["Customer", "Ship to"],
    type: "A",
    length: 60,
    format: "X(60)",
    possibleValues: null,
    requirement: "M",
    description: "Shipping address",
  },
  {
    item: 2,
    dataElement: "Type of goods",
    aliases: ["Type of good"],
    type: "A",
    length: 2,
    position: "03-04",
    format: "X(2)",
    possibleValues: [
      "FG = Finish Goods",
      "RM = Raw Materials",
      "EQ = Machinery & Equipment",
    ],
    requirement: "M",
    description: null,
  },
  {
    item: 3,
    dataElement: "Type of shipment",
    aliases: ["Type of shipments"],
    type: "A",
    length: 10,
    position: "05-14",
    format: "X(10)",
    possibleValues: ["Northbound", "Southbound", "Scrap"],
    requirement: "M",
    description:
      "Southbound - Importation to Mexico / Northbound - Exportation from Mexico",
  },
  {
    item: 4,
    dataElement: "Expected date of arrival",
    aliases: ["Expected date of arrival:"],
    type: "D",
    length: 10,
    position: "15-24",
    format: "YYYY-MM-DD",
    possibleValues: null,
    requirement: "M",
    description: null,
  },
  {
    item: 5,
    dataElement: "Waybill number",
    aliases: ["Waybill number:"],
    type: "N",
    length: 30,
    position: "25-54",
    format: "X(30)",
    possibleValues: null,
    requirement: "O",
    description: null,
  },
  {
    item: 6,
    dataElement: "Total gross weight",
    aliases: [
      "Total gross weight:",
      "Total gross Weight",
      "Total gross Weight:",
    ],
    type: "N",
    length: 17,
    position: "55-71",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "O",
    description: "total gross weight per shipment",
  },
  {
    item: 7,
    dataElement: "Total bundles",
    aliases: ["Total bundles:"],
    type: "N",
    length: 17,
    position: "72-88",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "O",
    description: "Total bundles per shipment",
  },

  {
    item: 8,
    dataElement: "Part Number",
    type: "A",
    length: 30,
    position: "89-118",
    format: "X(30)",
    possibleValues: null,
    requirement: "M",
    description: "Item Part Number",
  },
  {
    item: 9,
    dataElement: "Description",
    type: "A",
    length: 60,
    position: "119-178",
    format: "X(60)",
    possibleValues: null,
    requirement: "M",
    description: "Line item description", // without commas
  },
  {
    item: 10,
    dataElement: "Quantity",
    type: "N",
    length: 17,
    position: "179-195",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Out of delivery",
  },
  {
    item: 11,
    dataElement: "Unit Of Measure",
    type: "A",
    length: 3,
    position: "196-198",
    format: "X(3)",
    possibleValues: null,
    requirement: "M",
    description: null,
  },
  {
    item: 12,
    dataElement: "Unit Value (USD)",
    type: "N",
    length: 17,
    position: "199-215",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Unit Cost Dlls",
  },
  {
    item: 13,
    dataElement: "Added Value (USD)",
    type: "N",
    length: 17,
    position: "216-232",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Unit Cost Dlls", // 0 for raw material
  },
  {
    item: 14,
    dataElement: "Total Value (USD)",
    type: "N",
    length: 17,
    position: "233-249",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Sum of the columns 12 & 13",
  },
  {
    item: 15,
    dataElement: "Unit Net Weight",
    type: "N",
    length: 17,
    position: "250-266",
    format: "9(08).9(08)",
    possibleValues: null,
    requirement: "M",
    description: "Weight in pounds",
  },
  {
    item: 16,
    dataElement: "Country of Origin",
    type: "A",
    length: 2,
    position: "267-268",
    format: "X(2)",
    possibleValues: null,
    requirement: "M",
    description: "Line item origin",
  },
  {
    item: 17,
    dataElement: "ECCN",
    type: "A",
    length: 10,
    position: "269-278",
    format: "X(10)",
    possibleValues: null,
    requirement: "M",
    description: "Export Control Classification Number",
  },
  {
    item: 18,
    dataElement: "License No.",
    type: "A",
    length: 20,
    position: "279-298",
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description: "When applies (belongs to ECCN)",
  },
  {
    item: 19,
    dataElement: "License Exception",
    type: "A",
    length: 20,
    position: "299-318",
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description: "When applies (belongs to ECCN)",
  },

  {
    item: 20,
    dataElement: "US IMP HTS Code",
    type: "A",
    length: 12,
    format: "X(12)",
    possibleValues: null,
    requirement: "M",
    description: "HTS US", // in the following format: 9999.99.9999
  },
  {
    item: 21,
    dataElement: "US EXP HTS Code",
    type: "A",
    length: 12,
    format: "X(12)",
    possibleValues: null,
    requirement: "M",
    description: "HTS US", // in the following format: 9999.99.9999
  },
  {
    item: 22,
    dataElement: "Regime",
    type: "A",
    length: 10,
    format: "X(10)",
    possibleValues: ["Permanent", "Temporary"],
    requirement: "A",
    description: null,
  },
  {
    item: 23,
    dataElement: "Brand",
    type: "A",
    length: 40,
    position: "352-391",
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 24,
    dataElement: "Model",
    type: "A",
    length: 40,
    position: "392-431",
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 25,
    dataElement: "Serial",
    type: "A",
    length: 40,
    position: "432-471",
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },

  {
    item: 26,
    dataElement: "Power Source Type",
    type: "A",
    length: 20,
    format: "X(20)",
    possibleValues: [
      "Hydraulic",
      "Electric",
      "Pneumatic",
      "Water",
      "Gas",
      "Steam",
      "Manual",
      "Not applicable",
    ],
    requirement: "A",
    description: null,
  },
  {
    item: 27,
    dataElement: "Capacity",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 28,
    dataElement: "Main Function",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 29,
    dataElement: "PO Number",
    type: "A",
    length: 20,
    format: "X(20)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  // Si requieres “Customizer 1–10”, descomenta y ajusta longitudes:
  {
    item: 30,
    dataElement: "Customizer 1",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 31,
    dataElement: "Customizer 2",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 32,
    dataElement: "Customizer 3",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 33,
    dataElement: "Customizer 4",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 34,
    dataElement: "Customizer 5",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 35,
    dataElement: "Customizer 6",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 36,
    dataElement: "Customizer 7",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 37,
    dataElement: "Customizer 8",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 38,
    dataElement: "Customizer 9",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
  {
    item: 39,
    dataElement: "Customizer 10",
    type: "A",
    length: 40,
    format: "X(40)",
    possibleValues: null,
    requirement: "A",
    description: null,
  },
];

/**
 * Calcula start/end/position de forma secuencial según length.
 * start/end son 0-index (coherente con tus otros modelos), position es 1-index "NN-NN".
 */
(() => {
  let cursor = 0;
  splScrapSchemaSpec = splScrapSchemaSpec.map((f) => {
    const start = cursor;
    const end = cursor + (f.length - 1);
    const position =
      (start + 1).toString().padStart(2, "0") +
      "-" +
      (end + 1).toString().padStart(2, "0");
    cursor = end + 1;
    return { ...f, start, end, position };
  });
})();

const splScrapMongooseSchema = new mongoose.Schema({});

// Añade los campos al schema de Mongoose
splScrapSchemaSpec.forEach((field) => {
  splScrapMongooseSchema.add({ [field.dataElement]: createSchemaField(field) });
});

// Exponer la especificación para tu conversor
splScrapMongooseSchema.statics.getSchemaSpec = () => splScrapSchemaSpec;

module.exports = mongoose.model("SPLScrap", splScrapMongooseSchema);
