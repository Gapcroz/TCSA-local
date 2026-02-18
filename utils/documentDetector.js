// utils/documentDetector.js
const ExcelJS = require("exceljs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const iconv = require("iconv-lite");
const path = require("path");
const {
  getRegistryEntry,
  schemaUniquenessMap,
} = require("../data/documentTypeRegistry");
const { mapHeaders } = require("./headerMapper");

// ---------- helpers de lectura ----------
function decodeToUtf8(buffer) {
  let text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) text = iconv.decode(buffer, "win1252");
  return text.replace(/\u00A0/g, " ");
}

function sniffSeparatorFromHeaderLine(line) {
  const counts = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
    "|": (line.match(/\|/g) || []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : ",";
}

async function getHeaders(buffer, ext) {
  if (ext === ".xlsx" || ext === ".xlsm" || ext === ".xls") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.worksheets[0];
    if (!ws) return [];

    // Scan early rows to find the first meaningful header row (handles splScrap templates)
    let candidate = null;
    let bestScore = -1;
    for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
      const headers = [];
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
        const v =
          cell.value && cell.value.richText
            ? cell.value.richText.map((rt) => rt.text).join("")
            : cell.value;
        headers.push(
          String(v ?? "")
            .replace(/\u00A0/g, " ")
            .trim()
        );
      });
      const nonEmpty = headers.filter((h) => h).length;
      const hasPart = headers.some((h) => /part number/i.test(h));
      const score = nonEmpty + (hasPart ? 5 : 0);
      if (score > bestScore && nonEmpty >= 3) {
        bestScore = score;
        candidate = headers;
        if (hasPart && nonEmpty >= 8) break; // good enough
      }
    }
    return candidate || [];
  }

  if (ext === ".csv") {
    const text = decodeToUtf8(buffer);
    const firstLine = text.split(/\r?\n/)[0] || "";
    const sep = sniffSeparatorFromHeaderLine(firstLine);
    return await new Promise((resolve, reject) => {
      let resolved = false;
      Readable.from(text)
        .pipe(csv({ headers: false, separator: sep }))
        .on("data", (row) => {
          if (!resolved) {
            resolved = true;
            resolve(
              Object.values(row).map((h) =>
                String(h ?? "")
                  .replace(/\u00A0/g, " ")
                  .trim()
              )
            );
          }
        })
        .on("error", reject)
        .on("end", () => !resolved && resolve([]));
    });
  }

  return [];
}

// ---------- splScrap heuristic (Excel templates with header row not at row 1) ----------
async function detectSplScrapTemplate(buffer, ext) {
  if (![".xlsx", ".xlsm", ".xls"].includes(ext)) return false;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.worksheets[0];
  if (!ws) return false;

  // Check early rows for metadata labels typical of the template
  let hasMeta = false;
  for (let r = 1; r <= Math.min(ws.rowCount, 25); r++) {
    const row = ws.getRow(r);
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value && cell.value.text ? cell.value.text : cell.value;
      if (v) vals.push(String(v).toLowerCase());
    });
    if (
      vals.some((v) => v.includes("type of shipment")) ||
      vals.some((v) => v.includes("type of goods")) ||
      vals.some((v) => v.includes("packing list"))
    ) {
      hasMeta = true;
      break;
    }
  }

  // Find a header row containing Part Number and Description
  for (let r = 1; r <= Math.min(ws.rowCount, 80); r++) {
    const row = ws.getRow(r);
    const headers = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value && cell.value.text ? cell.value.text : cell.value;
      headers.push(v ? String(v).trim().toLowerCase() : "");
    });
    const hasPart = headers.some((h) => h.includes("part number"));
    const hasDesc = headers.some((h) => h.includes("description"));
    const nonEmpty = headers.filter((h) => h).length;
    if (hasPart && hasDesc && nonEmpty >= 6 && hasMeta) {
      return true;
    }
  }
  return false;
}

// ---------- pistas por nombre ----------
function filenameHintToDocType(name) {
  const b = path.basename(name).toLowerCase();
  // Prefijos que usa el cliente: PE/PI => Packing List (SPL-Scrap/EQ)
  if (/^(pe|pi)\d*/i.test(b)) return "splScrap";
  if (/\brm\b|_rm|rmexample/.test(b)) return "rawMaterial";
  if (/\bfg\b|_fg|fgexample|finished.?good/.test(b)) return "finishedProduct";
  if (/\bbm\b|_bm|bom|bomexample/.test(b)) return "billOfMaterials";
  if (/\beq\b|_eq|eqexample|packing.?list|spl|scrap/.test(b)) return "splScrap";
  return null;
}

// ---------- signaturas discriminantes por tipo ----------
// Usa nombres CANÓNICOS del schema (los mismos que valida tu app).
const SIGNATURES = {
  finishedProduct: new Set([
    "Dutiable Value (USD)",
    "USA Importation HTS Code",
    "USA Exportation Code",
    "FDA Product Code",
    "FDA Marker",
    "Preference Criterion",
    "Net Cost",
    "Period (From)",
    "Period (To)",
  ]),
  rawMaterial: new Set([
    "Unit Cost (USD)",
    "Unit of measure",
    "Country of origin",
    "Importation HTS Code",
    "Exportation HTS Code",
    "License Number (LCN)",
  ]),
  billOfMaterials: new Set([
    "Finished Good Part Number",
    "Component Part Number",
    "Component classification",
    "Type",
  ]),
  // Packing List / SPL-Scrap / EQ
  splScrap: new Set([
    "Customer(southbound) / Ship to (northbound)",
    "Type of goods",
    "Type of shipment",
    "Expected date of arrival",
    "Waybill number",
    "Total gross weight",
    "Total bundles",
    "Unit Of Measure",
    "Unit Value (USD)",
    "Total Value (USD)",
    // En plantillas del cliente aparece "Unit Net Weight"
    "Unit Net Weight",
    // Otros de cabecera típicos del EQ:
    "Brand",
    "Model",
    "Serial",
    "Power Source Type",
    "Capacity",
    "Main Function",
    "PO Number",
  ]),
};

// ---------- detector principal ----------
const detectDocumentType = async (fileBuffer, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  if (![".xlsx", ".xlsm", ".xls", ".csv"].includes(ext)) return null;

  // Early heuristic for splScrap Excel templates (header row later)
  if (await detectSplScrapTemplate(fileBuffer, ext)) {
    console.log("[Detector] Heuristic matched splScrap template (Excel).");
    return "splScrap";
  }

  const headers = await getHeaders(fileBuffer, ext);
  if (headers.length === 0) return null;

  // Mapea headers del archivo a canónicos para poder contrastar con schemas
  const docTypes = Object.keys(schemaUniquenessMap);
  const detailed = {};
  const filenameHint = filenameHintToDocType(originalName);

  for (const docType of docTypes) {
    const { schemaSpec } = getRegistryEntry(docType);
    const headerMap = mapHeaders(headers, schemaSpec);
    const mappedCanonicals = new Set(Object.values(headerMap));

    // 1) Cobertura de obligatorios
    const mandatory = schemaSpec.filter((f) => f.requirement === "M");
    const foundMandatory = mandatory.filter((f) =>
      mappedCanonicals.has(f.dataElement)
    ).length;
    const baseScore =
      mandatory.length > 0 ? (foundMandatory / mandatory.length) * 100 : 100;

    // 2) Cobertura de signatura discriminante
    const sig = SIGNATURES[docType] || new Set();
    let sigFound = 0;
    for (const s of sig) if (mappedCanonicals.has(s)) sigFound++;
    const signatureCoverage = sig.size > 0 ? (sigFound / sig.size) * 100 : 0;

    // 3) Bonus por nombre de archivo
    const hintBonus = filenameHint === docType ? 15 : 0;

    // 4) Score final ponderado
    const finalScore = baseScore * 0.7 + signatureCoverage * 0.3 + hintBonus;

    detailed[docType] = {
      baseScore,
      signatureCoverage,
      hintBonus,
      finalScore,
      foundMandatory,
      totalMandatory: mandatory.length,
      sigFound,
      sigSize: sig.size,
    };
  }

  console.log("\n[Detector] --- Detailed Detection Report ---");
  for (const dt of docTypes) {
    const d = detailed[dt];
    console.log(`[Detector] ${dt}`);
    console.log(
      `  baseScore: ${d.baseScore.toFixed(2)}% (M ${d.foundMandatory}/${
        d.totalMandatory
      })`
    );
    console.log(
      `  signature: ${d.signatureCoverage.toFixed(2)}% (${d.sigFound}/${
        d.sigSize
      })`
    );
    console.log(`  hintBonus: +${d.hintBonus}`);
    console.log(`  FINAL: ${d.finalScore.toFixed(2)}`);
  }
  console.log("[Detector] --- End of Report ---\n");

  // Selección
  const sorted = Object.entries(detailed).sort((a, b) => {
    // 1) Mayor puntaje final
    if (b[1].finalScore !== a[1].finalScore) {
      return b[1].finalScore - a[1].finalScore;
    }
    // 2) Mayor cobertura de signatura discriminante
    if (b[1].signatureCoverage !== a[1].signatureCoverage) {
      return b[1].signatureCoverage - a[1].signatureCoverage;
    }
    // 3) Mayor tama≠o de signatura (prefiere schemas con m≠s campos distintivos)
    if (b[1].sigSize !== a[1].sigSize) {
      return b[1].sigSize - a[1].sigSize;
    }
    // 4) Mayor cobertura de obligatorios
    if (b[1].baseScore !== a[1].baseScore) {
      return b[1].baseScore - a[1].baseScore;
    }
    return 0;
  });
  const best = sorted[0];

  // Acepta solo si cubre obligatorios razonablemente
  const CONFIDENCE_BASE_THRESHOLD = 75;
  if (best[1].baseScore < CONFIDENCE_BASE_THRESHOLD) {
    console.log(
      `[Detector] best '${best[0]}' base=${best[1].baseScore.toFixed(
        2
      )} < ${CONFIDENCE_BASE_THRESHOLD}, returning null`
    );
    return null;
  }

  console.log(
    `[Detector] Confidently detected: ${
      best[0]
    } (FINAL ${best[1].finalScore.toFixed(2)})`
  );
  return best[0];
};

module.exports = { detectDocumentType };
