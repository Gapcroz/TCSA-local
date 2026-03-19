// utils/xlsConverter.js
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");

const CONVERT_OUT_DIR =
  process.env.XLS_CONVERT_OUT_DIR || path.join(__dirname, "..", "temp_uploads");
const CONVERT_TIMEOUT_MS = Number.parseInt(
  process.env.XLS_CONVERT_TIMEOUT_MS || "600000",
  10
);

const execFileAsync = (cmd, args, options) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const convertXlsToXlsx = async (inputPath) => {
  await ensureDir(CONVERT_OUT_DIR);
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(CONVERT_OUT_DIR, `${baseName}.xlsx`);
  const outputPathUpper = path.join(CONVERT_OUT_DIR, `${baseName}.XLSX`);

  const args = [
    "--headless",
    "--convert-to",
    "xlsx",
    "--outdir",
    CONVERT_OUT_DIR,
    inputPath,
  ];

  const candidates = process.env.SOFFICE_BIN
    ? [process.env.SOFFICE_BIN]
    : ["soffice", "libreoffice"];

  let lastErr;
  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, args, { timeout: CONVERT_TIMEOUT_MS });
      try {
        await fs.access(outputPath);
        return outputPath;
      } catch {
        await fs.access(outputPathUpper);
        return outputPathUpper;
      }
    } catch (err) {
      lastErr = err;
      if (err.code !== "ENOENT") break;
    }
  }

  const hint = process.env.SOFFICE_BIN
    ? `Check SOFFICE_BIN=${process.env.SOFFICE_BIN}`
    : "Install LibreOffice (soffice) or set SOFFICE_BIN";
  throw new Error(
    `Failed to convert .xls to .xlsx. ${hint}. ${lastErr?.message || ""}`
  );
};

module.exports = {
  convertXlsToXlsx,
  ensureDir,
};
