const { getRegistryEntry } = require("../data/documentTypeRegistry");

// --- Country catalog helpers ---
const { isValidCountryCode, nameToCode } = require("../data/countryCatalog");

// --- HTS helpers ---
const HTS_FORMATTED_RE = /^\d{4}\.\d{2}\.\d{4}$/; // ####.##.####
const HTS_10_DIGITS_RE = /^\d{10}$/;

/** Recibe cualquier string con o sin puntos y devuelve ####.##.#### (12 chars) */
function normalizeHTS(value) {
  if (value == null) return value;
  const raw = String(value).trim();

  if (HTS_FORMATTED_RE.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (!HTS_10_DIGITS_RE.test(digits)) return raw;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function isHTSField(fieldName, documentType) {
  if (documentType === "rawMaterial") {
    return (
      fieldName === "Importation HTS Code" ||
      fieldName === "Exportation HTS Code"
    );
  }
  if (documentType === "finishedProduct") {
    return (
      fieldName === "USA Importation HTS Code" ||
      fieldName === "USA Exportation Code" ||
      fieldName === "USA Exportation HTS Code" // alias aceptado
    );
  }
  return false;
}

/** Country of Origin -> código ISO2 si viene por nombre, o se deja si ya es código válido */
function normalizeCountryOfOrigin(value) {
  if (value == null) return value;
  const raw = String(value).trim();
  const up = raw.toUpperCase();

  if (up.length === 2 && isValidCountryCode(up)) return up;

  const guessed = nameToCode(raw);
  if (guessed) return guessed;

  return raw;
}

/** Net Cost: deja "CN" o "NO" si viene con ruido; caso contrario lo deja (validación lo marcará) */
function normalizeNetCost(value) {
  if (value == null) return value;
  const raw = String(value).trim();
  const compact = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (compact === "CN") return "CN";
  if (compact === "NO") return "NO";
  return raw.toUpperCase();
}

/** Limpia campos dependientes de NAFTA cuando NAFTA !== "Y" */
function maskNaftaDependents(record) {
  const nafta = String(record["NAFTA"] ?? "")
    .trim()
    .toUpperCase();

  // Si NAFTA NO aplica, limpiar estos campos en la salida
  if (nafta !== "Y") {
    [
      "Preference Criterion",
      "Producer",
      "Net Cost",
      "Period (From)",
      "Period (To)",
    ].forEach((f) => {
      if (f in record) record[f] = "";
    });
  }
}

/**
 * Applies standard transformations to parsed data, such as normalizing enum values.
 * This step runs BEFORE validation to clean up the data.
 */
const applyTransformations = (parsedData, documentType) => {
  const transformedData = { ...parsedData };
  const records = transformedData.Sheet1;

  const { schemaSpec } = getRegistryEntry(documentType);

  if (!records || records.length === 0) {
    return transformedData;
  }

  console.log(
    `[Transformation] Starting transformations for document type: ${documentType}`
  );

  records.forEach((record, index) => {
    const rowNum = index + 2;

    schemaSpec.forEach((fieldSpec) => {
      const fieldName = fieldSpec.dataElement;
      if (record[fieldName] === undefined || record[fieldName] === null) {
        return; // Skip empty fields
      }

      if (Array.isArray(fieldSpec.possibleValues)) {
        const rawValue = String(record[fieldName]).trim();
        const upperRawValue = rawValue.toUpperCase();

        if (documentType === "finishedProduct") {
          if (fieldName === "NAFTA") {
            if (upperRawValue === "YES") {
              record[fieldName] = "Y";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "Y"`
              );
              return;
            }
            if (upperRawValue === "NO") {
              record[fieldName] = "N";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "N"`
              );
              return;
            }
          }

          if (fieldName === "Producer") {
            if (upperRawValue === "YES") {
              record[fieldName] = "Yes";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "Yes"`
              );
              return;
            }
            if (upperRawValue === "NO") {
              record[fieldName] = "No (1)";
              console.log(
                `[Row ${rowNum}] POST-TRANSFORM | Field: "${fieldName}" | Changed to: "No (1)"`
              );
              return;
            }
          }
        }

        // Mapeo genérico code/description
        const mappedValue = fieldSpec.possibleValues.find((pv) => {
          const [code, description] = pv.split(/\s*=\s*/);
          return (
            upperRawValue === code.toUpperCase() ||
            (description && upperRawValue === String(description).toUpperCase())
          );
        });

        if (mappedValue) {
          const code = mappedValue.split(/\s*=\s*/)[0];
          if (record[fieldName] !== code) {
            record[fieldName] = code;
          }
        }
      }

      // HTS ####.##.####
      if (isHTSField(fieldName, documentType)) {
        record[fieldName] = normalizeHTS(record[fieldName]);
      }
    });

    // Country of Origin
    if (record["Country of Origin"] !== undefined) {
      record["Country of Origin"] = normalizeCountryOfOrigin(
        record["Country of Origin"]
      );
    }
    if (record["Country of origin"] !== undefined) {
      record["Country of origin"] = normalizeCountryOfOrigin(
        record["Country of origin"]
      );
    }

    // Net Cost
    if (record["Net Cost"] !== undefined) {
      record["Net Cost"] = normalizeNetCost(record["Net Cost"]);
    }

    // NAFTA masking (clave para tu caso)
    if (documentType === "finishedProduct") {
      maskNaftaDependents(record);
    }

    // Part numbers a mayúsculas
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
  // helpers opcionales
  normalizeHTS,
  normalizeCountryOfOrigin,
  normalizeNetCost,
  // export por si lo quieres testear
  maskNaftaDependents,
};
