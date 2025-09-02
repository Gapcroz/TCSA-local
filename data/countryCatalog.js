// data/countryCatalog.js
const path = require("path");
const fs = require("fs");

// Carga opcional de 'xlsx' (no rompe si no está instalado)
let xlsx = null;
try {
  xlsx = require("xlsx");
} catch (e) {
  console.warn(
    "[CountryCatalog] Paquete 'xlsx' no instalado; se usará solo el catálogo estático."
  );
}

const CATALOG_PATH =
  process.env.COUNTRY_CATALOG_PATH ||
  path.join(__dirname, "Country of Origin catalog.xlsx");

// Permite desactivar la lectura de Excel aunque 'xlsx' esté instalado
const DISABLE_EXCEL =
  (process.env.COUNTRY_CATALOG_DISABLE_EXCEL || "false").toLowerCase() ===
  "true";

let cache = null;

// ------------------------------
// Catálogo ESTÁTICO (fallback)
// ------------------------------
const COUNTRY_BY_CODE = {
  AD: "ANDORRA",
  AE: "EMIRATOS ARABES UNIDOS",
  AF: "AFGANISTAN",
  AG: "ANTIGUA Y BARBUDA",
  AI: "ANGUILA",
  AL: "ALBANIA",
  AM: "ARMENIA",
  AN: "ANTILLAS HOLANDESAS",
  AO: "ANGOLA",
  AQ: "ANTARTIDA",
  AR: "ARGENTINA",
  AS: "SAMOA AMERICANA",
  AT: "AUSTRIA",
  AU: "AUSTRALIA",
  AW: "ARUBA",
  AX: "ALAND, ISLAS",
  AZ: "AZERBAIYAN",
  BA: "BOSNIA Y HERZEGOVINA",
  BB: "BARBADOS",
  BD: "BANGLADESH",
  BE: "BELGICA",
  BF: "BURKINA FASO",
  BG: "BULGARIA",
  BH: "BAHREIN",
  BI: "BURUNDI",
  BJ: "BENIN",
  BL: "SAN BARTOLOME",
  BM: "BERMUDAS",
  BN: "BRUNEI",
  BO: "BOLIVIA, ESTADO PLURINACIONAL DE",
  BQ: "BONAIRE, SAN EUSTAQUIO Y SABA",
  BR: "BRASIL",
  BS: "BAHAMAS",
  BT: "BHUTAN",
  BV: "BOUVET, ISLA",
  BW: "BOTSWANA",
  BY: "BELARUS",
  BZ: "BELICE",
  CA: "CANADA",
  CC: "COCOS (KEELING), ISLAS",
  CD: "CONGO, LA REPUBLICA DEMOCRATICA DEL",
  CF: "AFRICA CENTRAL, REPUBLICA DE",
  CG: "CONGO",
  CH: "SUIZA",
  CI: "COSTA DE MARFIL",
  CK: "COOK, ISLAS",
  CL: "CHILE",
  CM: "CAMERUN",
  CN: "CHINA",
  CO: "COLOMBIA",
  CR: "COSTA RICA",
  CU: "CUBA",
  CV: "CABO VERDE",
  CW: "CURAÇAO",
  CX: "NAVIDAD, ISLA",
  CY: "CHIPRE",
  CZ: "REPUBLICA CHECA",
  DE: "ALEMANIA",
  DJ: "DJIBOUTI",
  DK: "DINAMARCA",
  DM: "DOMINICA",
  DO: "REPUBLICA DOMINICANA",
  DZ: "ARGELIA",
  EC: "ECUADOR",
  EE: "ESTONIA",
  EG: "EGIPTO",
  EH: "SAHARA OCCIDENTAL",
  ER: "ERITREA",
  ES: "ESPAÑA",
  ET: "ETIOPIA",
  FI: "FINLANDIA",
  FJ: "FIYI",
  FK: "MALVINAS, ISLAS (FALKLAND)",
  FM: "MICRONESIA, ESTADOS FEDERADOS DE",
  FO: "FEROE, ISLAS",
  FR: "FRANCIA",
  GA: "GABON",
  GB: "REINO UNIDO",
  GD: "GRANADA",
  GE: "GEORGIA",
  GF: "GUAYANA FRANCESA",
  GG: "GUERNSEY",
  GH: "GHANA",
  GI: "GIBRALTAR",
  GL: "GROENLANDIA",
  GM: "GAMBIA",
  GN: "GUINEA",
  GP: "GUADELUPE",
  GQ: "GUINEA ECUATORIAL",
  GR: "GRECIA",
  GS: "GEORGIA DEL SUR E ISLAS SANDWICH DEL SUR",
  GT: "GUATEMALA",
  GU: "GUAM",
  GW: "GUINEA-BISSAU",
  GY: "GUYANA",
  HK: "HONG KONG",
  HM: "HEARD Y MCDONALD, ISLAS",
  HN: "HONDURAS",
  HR: "CROACIA",
  HT: "HAITI",
  HU: "HUNGRIA",
  ID: "INDONESIA",
  IE: "IRLANDA",
  IL: "ISRAEL",
  IM: "ISLA DE MAN",
  IN: "INDIA",
  IO: "TERRITORIO BRITANICO DEL OCEANO INDICO",
  IQ: "IRAQ",
  IR: "IRAN, REPUBLICA ISLAMICA DE",
  IS: "ISLANDIA",
  IT: "ITALIA",
  JE: "JERSEY",
  JM: "JAMAICA",
  JO: "JORDANIA",
  JP: "JAPON",
  KE: "KENIA",
  KG: "KIRGUISTAN",
  KH: "CAMBOYA",
  KI: "KIRIBATI",
  KM: "COMORAS",
  KN: "SAN CRISTOBAL Y NIEVES",
  KP: "COREA, REPUBLICA POPULAR DEMOCRATICA DE",
  KR: "COREA, REPUBLICA DE",
  KW: "KUWAIT",
  KY: "CAIMAN, ISLAS",
  KZ: "KAZAJSTAN",
  LA: "LAO, REPUBLICA DEMOCRATICA POPULAR",
  LB: "LIBANO",
  LC: "SANTA LUCIA",
  LI: "LIECHTENSTEIN",
  LK: "SRI LANKA",
  LR: "LIBERIA",
  LS: "LESOTHO",
  LT: "LITUANIA",
  LU: "LUXEMBURGO",
  LV: "LETONIA",
  LY: "LIBIA",
  MA: "MARRUECOS",
  MC: "MONACO",
  MD: "MOLDAVIA, REPUBLICA DE",
  ME: "MONTENEGRO",
  MF: "SAN MARTIN (PARTE FRANCESA)",
  MG: "MADAGASCAR",
  MH: "MARSHALL, ISLAS",
  MK: "MACEDONIA DEL NORTE",
  ML: "MALI",
  MM: "MYANMAR",
  MN: "MONGOLIA",
  MO: "MACAO",
  MP: "MARIANAS DEL NORTE, ISLAS",
  MQ: "MARTINICA",
  MR: "MAURITANIA",
  MS: "MONTSERRAT",
  MT: "MALTA",
  MU: "MAURICIO",
  MV: "MALDIVAS",
  MW: "MALAWI",
  MX: "MEXICO",
  MY: "MALASIA",
  MZ: "MOZAMBIQUE",
  NA: "NAMIBIA",
  NC: "NUEVA CALEDONIA",
  NE: "NIGER",
  NF: "NORFOLK, ISLA",
  NG: "NIGERIA",
  NI: "NICARAGUA",
  NL: "PAISES BAJOS",
  NO: "NORUEGA",
  NP: "NEPAL",
  NR: "NAURU",
  NU: "NIUE",
  NZ: "NUEVA ZELANDA",
  OM: "OMAN",
  PA: "PANAMA",
  PE: "PERU",
  PF: "POLINESIA FRANCESA",
  PG: "PAPUA NUEVA GUINEA",
  PH: "FILIPINAS",
  PK: "PAKISTAN",
  PL: "POLONIA",
  PM: "SAN PEDRO Y MIQUELON",
  PN: "PITCAIRN",
  PR: "PUERTO RICO",
  PS: "TERRITORIO PALESTINO OCUPADO",
  PT: "PORTUGAL",
  PW: "PALAU",
  PY: "PARAGUAY",
  QA: "QATAR",
  RE: "REUNION",
  RO: "RUMANIA",
  RS: "SERBIA",
  RU: "FEDERACION DE RUSIA",
  RW: "RUANDA",
  SA: "ARABIA SAUDITA",
  SB: "SALOMON, ISLAS",
  SC: "SEYCHELLES",
  SD: "SUDAN",
  SE: "SUECIA",
  SG: "SINGAPUR",
  SH: "SANTA ELENA, ASCENSION Y TRISTAN DE CUNHA",
  SI: "ESLOVENIA",
  SJ: "SVALBARD Y JAN MAYEN",
  SK: "ESLOVAQUIA",
  SL: "SIERRA LEONA",
  SM: "SAN MARINO",
  SN: "SENEGAL",
  SO: "SOMALIA",
  SR: "SURINAM",
  SS: "SUDAN DEL SUR",
  ST: "SANTO TOME Y PRINCIPE",
  SV: "EL SALVADOR",
  SX: "SINT MAARTEN (PARTE HOLANDESA)",
  SY: "REPUBLICA ARABE SIRIA",
  SZ: "ESWATINI",
  TC: "TURCAS Y CAICOS, ISLAS",
  TD: "CHAD",
  TF: "TERRITORIOS AUSTRALES FRANCESES",
  TG: "TOGO",
  TH: "TAILANDIA",
  TJ: "TAYIKISTAN",
  TK: "TOKELAU",
  TL: "TIMOR-LESTE",
  TM: "TURKMENISTAN",
  TN: "TUNEZ",
  TO: "TONGA",
  TR: "TURQUIA",
  TT: "TRINIDAD Y TOBAGO",
  TV: "TUVALU",
  TW: "TAIWAN, PROVINCIA DE CHINA",
  TZ: "TANZANIA, REPUBLICA UNIDA DE",
  UA: "UCRANIA",
  UG: "UGANDA",
  UM: "ISLAS MENORES ALEJADAS DE LOS ESTADOS UNIDOS",
  US: "ESTADOS UNIDOS",
  UY: "URUGUAY",
  UZ: "UZBEKISTAN",
  VA: "SANTA SEDE (CIUDAD DEL VATICANO)",
  VC: "SAN VICENTE Y LAS GRANADINAS",
  VE: "VENEZUELA, REPUBLICA BOLIVARIANA DE",
  VG: "ISLAS VIRGENES (BRITANICAS)",
  VI: "ISLAS VIRGENES (EE.UU.)",
  VN: "VIET NAM",
  VU: "VANUATU",
  WF: "WALLIS Y FUTUNA",
  WS: "SAMOA",
  YE: "YEMEN",
  YT: "MAYOTTE",
  ZA: "SUDAFRICA",
  ZM: "ZAMBIA",
  ZW: "ZIMBABWE",
};

// ------------------------------
// Detección de columnas en Excel
// ------------------------------
const CODE_KEYS = [
  "CVE_PAIS",
  "CLAVE",
  "CODE",
  "ISO2",
  "ISO_2",
  "ISO ALPHA-2",
  "ALPHA2",
  "PAIS_COD",
  "CODIGO",
].map((s) => s.toUpperCase());

const NAME_KEYS = [
  "DESCRIP",
  "PAIS",
  "COUNTRY",
  "DESCRIPTION",
  "NAME",
  "NOMBRE",
  "DESCRIPCION",
].map((s) => s.toUpperCase());

function pickColumn(obj, candidatesUpper) {
  const keys = Object.keys(obj);
  for (const k of keys) {
    if (candidatesUpper.includes(k.toUpperCase())) return k;
  }
  return null;
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

// ------------------------------
// Carga (una vez) con fallback
// ------------------------------
function loadCatalogOnce() {
  if (cache) return cache;

  // 1) Semilla desde el catálogo estático
  const codeToName = new Map(Object.entries(COUNTRY_BY_CODE));
  const nameToCode = new Map(
    Object.entries(COUNTRY_BY_CODE).map(([code, name]) => [
      normalizeName(name),
      code,
    ])
  );

  let sourceMsg = `[CountryCatalog] Usando catálogo estático (${codeToName.size} países).`;

  // 2) Si hay Excel, lo cargamos y SOBREESCRIBIMOS/ACTUALIZAMOS
  try {
    if (!DISABLE_EXCEL && xlsx && fs.existsSync(CATALOG_PATH)) {
      const wb = xlsx.readFile(CATALOG_PATH);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length) {
        const codeKey = pickColumn(rows[0], CODE_KEYS);
        const nameKey = pickColumn(rows[0], NAME_KEYS);

        if (codeKey && nameKey) {
          let overrides = 0;
          for (const r of rows) {
            const code = String(r[codeKey] || "")
              .trim()
              .toUpperCase();
            const name = String(r[nameKey] || "").trim();
            if (!code) continue;

            codeToName.set(code, name); // override/insert
            nameToCode.set(normalizeName(name), code); // index inverso
            overrides++;
          }
          sourceMsg = `[CountryCatalog] Catálogo estático (${
            Object.keys(COUNTRY_BY_CODE).length
          }) + Excel (${overrides} entradas) desde ${CATALOG_PATH}`;
        } else {
          sourceMsg += ` Excel encontrado pero sin columnas reconocibles en ${CATALOG_PATH}`;
        }
      } else {
        sourceMsg += ` Excel vacío en ${CATALOG_PATH}`;
      }
    } else {
      if (DISABLE_EXCEL) {
        sourceMsg +=
          " Lectura de Excel desactivada por env (COUNTRY_CATALOG_DISABLE_EXCEL=true).";
      } else if (!xlsx) {
        sourceMsg += " Paquete 'xlsx' no instalado.";
      } else if (!fs.existsSync(CATALOG_PATH)) {
        sourceMsg += ` Excel no encontrado en ${CATALOG_PATH}`;
      }
    }
  } catch (e) {
    sourceMsg += ` (no se pudo leer Excel: ${e.message})`;
  }

  console.log(sourceMsg);
  cache = { codeToName, nameToCode };
  return cache;
}

// ------------------------------
// API pública
// ------------------------------
function isValidCountryCode(code) {
  const { codeToName } = loadCatalogOnce();
  return codeToName.has(
    String(code || "")
      .toUpperCase()
      .trim()
  );
}

function codeToNameFn(code) {
  const { codeToName } = loadCatalogOnce();
  return (
    codeToName.get(
      String(code || "")
        .toUpperCase()
        .trim()
    ) || null
  );
}

function nameToCodeFn(name) {
  if (!name) return null;
  const { nameToCode } = loadCatalogOnce();
  return nameToCode.get(normalizeName(name)) || null;
}

module.exports = {
  COUNTRY_BY_CODE, // por si necesitas inspeccionarlo en algún lugar
  loadCatalogOnce,
  isValidCountryCode,
  codeToName: codeToNameFn,
  nameToCode: nameToCodeFn,
};
