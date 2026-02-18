// /data/uomCatalog.js
const path = require("path");
const fs = require("fs");

let xlsx = null;
try {
  xlsx = require("xlsx");
} catch (_) {
  console.warn(
    "[UOMCatalog] Paquete 'xlsx' no instalado; se usará sólo el catálogo estático."
  );
}

const DEFAULT_UOM_FILES = [
  "Unit Of Measure catalog.xlsx", // actual file in /data
  "Unit Of Measure Feb24.xlsx",
];

const resolveCatalogPath = () => {
  const envPath = process.env.UOM_CATALOG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  for (const name of DEFAULT_UOM_FILES) {
    const candidate = path.join(__dirname, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  // fallback to the first name even if it doesn't exist (we'll log later)
  return path.join(__dirname, DEFAULT_UOM_FILES[0]);
};

const UOM_CATALOG_PATH = resolveCatalogPath();

const DISABLE_EXCEL =
  (process.env.UOM_CATALOG_DISABLE_EXCEL || "false").toLowerCase() === "true";

// Fallback básico
const STATIC_UOM = {
  EA: { description: "Each", decimals: 0 },
  PCS: { description: "Pieces", decimals: 0 },
  KG: { description: "Kilogram", decimals: 3 },
  LB: { description: "Pound", decimals: 3 },
  MT: { description: "Metric Ton", decimals: 3 },
  L: { description: "Liter", decimals: 3 },
  M: { description: "Meter", decimals: 3 },
  FT: { description: "Foot", decimals: 3 },
  PK: { description: "Pack", decimals: 0 },
};

let cache = null;

function loadUOMOnce() {
  if (cache) return cache;

  const codeToInfo = new Map(Object.entries(STATIC_UOM));
  const nameToCode = new Map(
    Object.entries(STATIC_UOM).map(([code, info]) => [
      normalizeName(info.description),
      code,
    ])
  );

  let sourceMsg = `[UOMCatalog] Usando catálogo estático (${codeToInfo.size} UOM).`;

  try {
    if (!DISABLE_EXCEL && xlsx && fs.existsSync(UOM_CATALOG_PATH)) {
      const wb = xlsx.readFile(UOM_CATALOG_PATH);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

      let added = 0;
      for (const r of rows) {
        const code = String(r.Code || r.CODE || "")
          .trim()
          .toUpperCase();
        const desc = String(r.Description || r.DESCRIPTION || "").trim();
        const decRaw = r.Decimals ?? r.DECIMALS ?? r.decimals ?? "";
        let decs = 0;
        if (decRaw !== "") {
          const num = Number(decRaw);
          if (Number.isFinite(num)) decs = num;
          else if (String(decRaw).trim().toLowerCase() === "yes") decs = 3; // common convention
        }
        if (!code) continue;
        codeToInfo.set(code, { description: desc || code, decimals: decs });
        if (desc) nameToCode.set(normalizeName(desc), code);
        added++;
      }
      sourceMsg = `[UOMCatalog] Catálogo estático (${
        Object.keys(STATIC_UOM).length
      }) + Excel (${added}) desde ${UOM_CATALOG_PATH}`;
    } else {
      if (DISABLE_EXCEL) sourceMsg += " Lectura Excel desactivada por env.";
      else if (!xlsx) sourceMsg += " Paquete 'xlsx' no instalado.";
      else if (!fs.existsSync(UOM_CATALOG_PATH))
        sourceMsg += ` Excel no encontrado en ${UOM_CATALOG_PATH}`;
    }
  } catch (e) {
    sourceMsg += ` (error leyendo Excel: ${e.message})`;
  }

  console.log(sourceMsg);
  cache = { codeToInfo, nameToCode };
  return cache;
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

// API pública
function isValidUOMCode(code) {
  const { codeToInfo } = loadUOMOnce();
  return codeToInfo.has(
    String(code || "")
      .trim()
      .toUpperCase()
  );
}
function codeToDescription(code) {
  const { codeToInfo } = loadUOMOnce();
  const info = codeToInfo.get(
    String(code || "")
      .trim()
      .toUpperCase()
  );
  return info ? info.description : null;
}
function nameToUOMCode(name) {
  if (!name) return null;
  const { nameToCode } = loadUOMOnce();
  return nameToCode.get(normalizeName(name)) || null;
}
function getUOMDecimals(code) {
  const { codeToInfo } = loadUOMOnce();
  const info = codeToInfo.get(
    String(code || "")
      .trim()
      .toUpperCase()
  );
  return info ? info.decimals : 0;
}

/** Acepta "EA", "Each", "each", etc. y devuelve el código estándar (p.ej. "EA") */
function normalizeUOM(value) {
  if (value == null) return value;
  const raw = String(value).trim();
  if (raw === "") return raw;

  const up = raw.toUpperCase();

  // 1) Direct code
  if (isValidUOMCode(up)) return up;

  // 2) Full name match (description)
  const byName = nameToUOMCode(raw);
  if (byName) return byName;

  // 3) Split tokens like "EA-EACH", "EA / EACH", etc.
  const tokens = up.split(/[\s\/-]+/).filter(Boolean);
  for (const t of tokens) {
    if (isValidUOMCode(t)) return t;
    const byTokenName = nameToUOMCode(t);
    if (byTokenName) return byTokenName;
  }

  // 4) Compact alphanum only (e.g., "EA," -> "EA")
  const compact = up.replace(/[^A-Z0-9]/g, "");
  if (isValidUOMCode(compact)) return compact;

  // Si no lo reconocemos, devolvemos en mayúsculas
  return up;
}

module.exports = {
  loadUOMOnce,
  isValidUOMCode,
  codeToDescription,
  nameToUOMCode,
  getUOMDecimals,
  normalizeUOM,
};
