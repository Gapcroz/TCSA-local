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

function normalizeNafta(value) {
  if (value == null) return "";
  const v = String(value).trim().toUpperCase();

  // vacíos o "basura" → vacío
  if (v === "" || v === "NA" || v === "N/A" || v === "-") return "";

  // mapeos válidos
  if (v === "YES" || v === "Y") return "Y";
  if (v === "NO" || v === "N") return "N";

  // cualquier otro texto → vacío (no imprimimos nada)
  return "";
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

function coerceExcelDate(value) {
  if (value == null || value === "") return null;

  // Caso 1: ya es Date
  if (value instanceof Date && !isNaN(value)) return value;

  const s = String(value).trim();

  // Caso 2: YYYYMMDD (8 dígitos)
  const ymd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd) {
    const y = +ymd[1],
      m = +ymd[2] - 1,
      d = +ymd[3];
    const dt = new Date(y, m, d);
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d)
      return dt;
    return null;
  }

  // Caso 3: con separadores (2025-08-01 / 01/08/2025)
  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) {
    const y = +digits.slice(0, 4),
      m = +digits.slice(4, 6) - 1,
      d = +digits.slice(6, 8);
    const dt = new Date(y, m, d);
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d)
      return dt;
  }

  // Caso 4: serial Excel (número de días desde 1899-12-30)
  if (!isNaN(+s)) {
    const serial = +s;
    if (serial > 0) {
      const base = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(base.getTime() + serial * 86400000);
      // pásalo a fecha local sin hora
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
  }

  return null;
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

    // --- Transformaciones por campo (según schema) ---
    schemaSpec.forEach((fieldSpec) => {
      const fieldName = fieldSpec.dataElement;
      const v = record[fieldName];

      // Si el campo no existe o es null/undefined, salta
      if (v === undefined || v === null) return;

      if (documentType === "finishedProduct" && fieldName === "NAFTA") {
        const norm = normalizeNafta(v);
        if (norm !== v) {
          record[fieldName] = norm; // "Y" | "N" | ""
          console.log(
            `[Row ${rowNum}] POST-TRANSFORM | Field: "NAFTA" | Changed to: "${
              norm || "(blank)"
            }"`
          );
        }
        // no seguimos con más mapeo para NAFTA
        return;
      }

      // 1) Normalización de enumeraciones (possibleValues)
      if (Array.isArray(fieldSpec.possibleValues)) {
        const rawValue = String(v).trim();
        const upperRawValue = rawValue.toUpperCase();

        if (documentType === "finishedProduct") {
          // Producer: YES/NO -> Yes / No (1)
          // (opcional) Solo mapear si NAFTA aplica:
          const naftaNorm = String(record["NAFTA"] ?? "")
            .trim()
            .toUpperCase();
          if (fieldName === "Producer" && naftaNorm === "Y") {
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

        // Mapeo genérico code=description...
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

      // 2) HTS ####.##.####
      if (isHTSField(fieldName, documentType)) {
        record[fieldName] = normalizeHTS(v);
      }

      // 3) Fechas (tipo D): convierte a Date (acepta YYYYMMDD, con separadores, o serial Excel)
      if (fieldSpec.type === "D") {
        record[fieldName] = coerceExcelDate(v); // queda Date o null
      }
    });

    // --- Transformaciones por registro (no atadas a un campo del schema) ---

    // Country of Origin (acepta nombre o código)
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

    // NAFTA masking: si NAFTA !== "Y" limpia dependientes
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
  normalizeHTS,
  normalizeCountryOfOrigin,
  normalizeNetCost,
  maskNaftaDependents,
};