// utils/fileParsers.js
const ExcelJS = require("exceljs");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const iconv = require("iconv-lite");
const Fuse = require("fuse.js"); // Needed for CSV parser
const { getRegistryEntry } = require("../data/documentTypeRegistry");
// Import the new header mapper utility
const { mapHeaders } = require("./headerMapper");

// --- Helpers for encoding and delimiter detection ---
function decodeToUtf8(buffer) {
  let text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    text = iconv.decode(buffer, "win1252");
  }
  return text.replace(/\u00A0/g, " ");
}

function sniffDelimiter(sampleText) {
  const head = sampleText.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = {
    ",": (head.match(/,/g) || []).length,
    ";": (head.match(/;/g) || []).length,
    "\t": (head.match(/\t/g) || []).length,
    "|": (head.match(/\|/g) || []).length,
  };
  return (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] ||
    process.env.CSV_DEFAULT_SEPARATOR ||
    ","
  );
}

/**
 * Generates a filename based on the specified convention.
 * Convention: [TYPE]DDHHMM.MMYY (e.g., BM031113.0621)
 * @param {string} fileType - The type of file ("BM", "RM", or "FG").
 * @param {Date} [date=new Date()] - The date for the filename.
 * @returns {string} The generated filename.
 */
function generateFilename(fileType, date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const year = String(date.getFullYear()).slice(-2);

  return `${fileType}${day}${hours}${minutes}.${month}${year}`;
}

/**
 * Parses an XLSX file buffer using flexible header mapping.
 * @param {Buffer} buffer - The buffer of the XLSX file.
 * @param {string} documentType - The type of document for schema lookup.
 * @returns {Promise<Object>} A promise that resolves to { Sheet1: [records] }.
 */
// --- splScrap helpers (XLSX with headers in row 16 and metadata rows) ---
const SPL_SCRAP_HEADER_ROW_MAX_SCAN = 50;
const SPL_SCRAP_METADATA_ROWS = {
  "customer:": "Customer(southbound) / Ship to (northbound)",
  "ship to:": "Customer(southbound) / Ship to (northbound)",
  "type of goods:": "Type of goods",
  "type of shipment:": "Type of shipment",
  "expected date of arrival:": "Expected date of arrival",
  "waybill number:": "Waybill number",
  "total gross weight:": "Total gross weight",
  "total gross weight": "Total gross weight",
  "total bundles:": "Total bundles",
  "regime:": "Regime",
};

const normalizeCellValue = (cell) => {
  if (!cell) return null;
  // Prefer evaluated result for formulas
  if (cell.value && typeof cell.value === "object") {
    if (cell.value.result !== undefined) return cell.value.result;
    if (cell.value.text) return cell.value.text;
  }
  if (cell.text) return cell.text;
  return cell.value ?? null;
};

const findSplScrapHeaderRow = (worksheet) => {
  let bestRow = null;
  let bestScore = 0;
  for (let r = 1; r <= Math.min(worksheet.rowCount, SPL_SCRAP_HEADER_ROW_MAX_SCAN); r++) {
    const row = worksheet.getRow(r);
    const headers = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const h = normalizeCellValue(cell);
      headers.push(h ? String(h).replace(/\u00A0/g, " ").trim() : "");
    });
    const nonEmpty = headers.filter((h) => h).length;
    const hasPart = headers.some((h) => /part number/i.test(h));
    const score = (hasPart ? 2 : 0) + nonEmpty;
    if (score > bestScore && nonEmpty >= 3) {
      bestScore = score;
      bestRow = { index: r, headers };
      if (hasPart && nonEmpty >= 8) break; // good enough
    }
  }
  return bestRow;
};

const readSplScrapMetadata = (worksheet) => {
  const meta = {};
  const IGNORE_HINTS_RE = /(green cells are mandatory|yellow cells are optional)/i;
  // Scan first 20 rows for labels in col1 and values in the next non-empty cell
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    const labelCell = row.getCell(1);
    const rawLabel = normalizeCellValue(labelCell);
    if (!rawLabel) continue;
    const key = String(rawLabel).toLowerCase().trim();
    const canonical = SPL_SCRAP_METADATA_ROWS[key];
    if (!canonical) continue;
    // take first non-empty among col2..4 that is not just a hint label
    let value = null;
    for (let c = 2; c <= 4; c++) {
      const v = normalizeCellValue(row.getCell(c));
      if (
        v !== null &&
        v !== undefined &&
        v !== "" &&
        !(typeof v === "string" && IGNORE_HINTS_RE.test(v))
      ) {
        value = v;
        break;
      }
    }
    meta[canonical] = value ?? null;
  }
  return meta;
};

const parseSplScrapXLSX = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { Sheet1: [] };

  const { schemaSpec } = getRegistryEntry("splScrap");
  const headerRowInfo = findSplScrapHeaderRow(worksheet);
  if (!headerRowInfo) return { Sheet1: [] };

  const fileHeaders = headerRowInfo.headers;
  const headerMap = mapHeaders(fileHeaders, schemaSpec);

  const meta = readSplScrapMetadata(worksheet);
  const dataRowsStart = headerRowInfo.index + 1;
  const rows = [];

  for (let r = dataRowsStart; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    let hasAny = false;
    const rowValues = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const originalHeader = fileHeaders[colNumber - 1];
      const canonicalHeader = headerMap[originalHeader];
      if (!canonicalHeader) return;
      const value = normalizeCellValue(cell);
      if (value !== null && value !== undefined && value !== "") hasAny = true;
      rowValues[canonicalHeader] = value;
    });

    if (!hasAny) break; // stop at first empty row
    rows.push({ ...meta, ...rowValues });
  }

  return { Sheet1: rows };
};

async function parseXLSX(buffer, documentType) {
  if (documentType === "splScrap") {
    return await parseSplScrapXLSX(buffer);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const data = {};
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { Sheet1: [] };

  const { schemaSpec } = getRegistryEntry(documentType);

  // Extract headers from the first row of the sheet
  const fileHeaders = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    const headerText =
      cell.value && cell.value.richText
        ? cell.value.richText.map((rt) => rt.text).join("")
        : cell.value;
    fileHeaders.push(
      String(headerText || "")
        .replace(/\u00A0/g, " ")
        .trim()
    );
  });

  const headerMap = mapHeaders(fileHeaders, schemaSpec); // Maps headers to canonical names

  // Process data rows
  const sheetData = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    const rowValues = {};
    let hasValues = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const originalHeader = fileHeaders[colNumber - 1];
      const canonicalHeader = headerMap[originalHeader];

      if (canonicalHeader) {
        const cellValue =
          cell.value && cell.value.result !== undefined
            ? cell.value.result
            : cell.value;
        // Assign the value to the CANONICAL header name
        rowValues[canonicalHeader] = cellValue;
        if (cellValue !== null && cellValue !== undefined) {
          hasValues = true;
        }
      }
    });

    if (hasValues) {
      sheetData.push(rowValues);
    }
  });

  data["Sheet1"] = sheetData;
  return data;
}

/**
 * Parses a CSV file buffer using flexible header mapping.
 * @param {Buffer} buffer - The buffer of the CSV file.
 * @param {string} documentType - The type of document for schema lookup.
 * @returns {Promise<Object>} A promise that resolves to { Sheet1: [records] }.
 */
async function parseCSV(buffer, documentType) {
  const { schemaSpec } = getRegistryEntry(documentType);
  const mandatory = schemaSpec
    .filter((f) => f.requirement === "M")
    .map((f) => f.dataElement);
  const text = decodeToUtf8(buffer);

  // 1) Candidatos de separador (probamos en este orden)
  const candidates = (() => {
    const head = text.split(/\r?\n/).slice(0, 5).join("\n");
    const counts = {
      ",": (head.match(/,/g) || []).length,
      ";": (head.match(/;/g) || []).length,
      "\t": (head.match(/\t/g) || []).length,
      "|": (head.match(/\|/g) || []).length,
    };
    // primer candidato: el que más aparece en cabecera
    const ranked = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map((x) => x[0]);
    // añade todos por si la cabecera no es representativa
    for (const s of [",", ";", "\t", "|"])
      if (!ranked.includes(s)) ranked.push(s);
    return ranked;
  })();

  // Utilidad para construir el Fuse y mapear headers por separador
  function buildHeaderMapper() {
    return new Fuse(
      schemaSpec.map((field) => ({
        canonicalName: field.dataElement,
        searchable: [field.dataElement, ...(field.aliases || [])],
      })),
      {
        keys: ["searchable"],
        includeScore: true,
        threshold: 0.2,
        ignoreLocation: true,
        minMatchCharLength: 3,
      }
    );
  }

  function makeParser(separator, collectRows, resolve, reject) {
    const stream = Readable.from(text);
    const fuse = buildHeaderMapper();

    return stream
      .pipe(
        csvParser({
          separator,
          mapHeaders: ({ header }) => {
            if (!header) return null;
            const clean = String(header)
              .replace(/\u00A0/g, " ")
              .trim();

            // Direct match
            const direct = schemaSpec.find(
              (f) =>
                f.dataElement.toLowerCase() === clean.toLowerCase() ||
                (f.aliases || []).some(
                  (a) => a.toLowerCase() === clean.toLowerCase()
                )
            );
            if (direct) return direct.dataElement;

            // Fuzzy
            const res = fuse.search(clean);
            if (res.length) return res[0].item.canonicalName;

            // Desconocido: descartamos columna
            return null;
          },
          mapValues: ({ value }) => {
            if (value === undefined || value === null) return null;
            const v = String(value)
              .replace(/\u00A0/g, " ")
              .trim();
            return v === "" ? null : v;
          },
        })
      )
      .on("data", (row) => collectRows(row))
      .on("end", resolve)
      .on("error", reject);
  }

  // 2) Probamos separadores sobre una muestra corta para puntuar
  async function scoreSeparator(sep) {
    const sample = [];
    await new Promise((resolve, reject) => {
      let count = 0;
      makeParser(
        sep,
        (row) => {
          // normaliza fila y corta a 20 filas de muestra
          const cleaned = {};
          let hasAny = false;
          for (const [k, v] of Object.entries(row)) {
            const t =
              v == null
                ? null
                : String(v)
                    .replace(/\u00A0/g, " ")
                    .trim();
            cleaned[k] = t && t !== "" ? t : null;
            if (cleaned[k] !== null) hasAny = true;
          }
          if (hasAny) sample.push(cleaned);
          if (++count >= 20) resolve();
        },
        resolve,
        reject
      );
    });

    if (sample.length === 0) return { sep, score: 0 };

    // score: % de filas de muestra que tienen TODOS los obligatorios con valor
    let ok = 0;
    for (const r of sample) {
      let all = true;
      for (const m of mandatory) {
        if (r[m] == null) {
          all = false;
          break;
        }
      }
      if (all) ok++;
    }
    const score = ok / sample.length;
    return { sep, score, sampleCount: sample.length };
  }

  const scored = [];
  for (const sep of candidates) {
    try {
      scored.push(await scoreSeparator(sep));
    } catch {
      scored.push({ sep, score: 0 });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const bestSep = (scored[0]?.score ?? 0) > 0 ? scored[0].sep : candidates[0];

  // 3) Parseo completo con el mejor separador y filtrado de filas vacías
  const results = [];
  await new Promise((resolve, reject) => {
    makeParser(
      bestSep,
      (row) => {
        const cleaned = {};
        let hasAny = false;
        for (const [k, v] of Object.entries(row)) {
          const t =
            v == null
              ? null
              : String(v)
                  .replace(/\u00A0/g, " ")
                  .trim();
          cleaned[k] = t && t !== "" ? t : null;
          if (cleaned[k] !== null) hasAny = true;
        }
        if (hasAny) results.push(cleaned);
      },
      resolve,
      reject
    );
  });

  return { Sheet1: results };
}

/**
 * Parses a fixed-width plain text file based on a given schema.
 * (This function is unchanged as it is position-based, not header-based).
 * @param {Buffer} buffer - The buffer containing the text file content.
 * @param {string} documentType - The type of document ('finishedProduct', 'rawMaterial', 'billOfMaterials').
 * @returns {Promise<Object>} A promise that resolves to { Sheet1: [records] }.
 */
async function parseTXT(buffer, documentType) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const { schemaSpec } = getRegistryEntry(documentType);

  const parsedRecords = lines.map((line) => {
    const record = {};
    for (const field of schemaSpec) {
      let rawValue = line.substring(field.start, field.end + 1);
      if (field.dataElement !== "Filler") rawValue = rawValue.trim();
      if (rawValue === "") {
        record[field.dataElement] = null;
        continue;
      }
      switch (field.type) {
        case "N":
          const num = parseFloat(rawValue);
          record[field.dataElement] = isNaN(num) ? null : num;
          break;
        case "D":
          if (rawValue.length === 8 && /^\d{8}$/.test(rawValue)) {
            const year = parseInt(rawValue.substring(0, 4), 10);
            const month = parseInt(rawValue.substring(4, 6), 10) - 1;
            const day = parseInt(rawValue.substring(6, 8), 10);
            const date = new Date(year, month, day);
            if (
              date.getFullYear() === year &&
              date.getMonth() === month &&
              date.getDate() === day
            ) {
              record[field.dataElement] = date;
            } else {
              record[field.dataElement] = null;
            }
          } else {
            record[field.dataElement] = null;
          }
          break;
        default:
          record[field.dataElement] = rawValue;
          break;
      }
    }
    return record;
  });

  return { Sheet1: parsedRecords };
}

module.exports = {
  parseXLSX,
  parseCSV,
  parseTXT,
  generateFilename,
};
