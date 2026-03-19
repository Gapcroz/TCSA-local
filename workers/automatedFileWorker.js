// workers/automatedFileWorker.js
require("dotenv").config();

const path = require("path");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const {
  ensureDirectoriesExist,
  processSingleFile,
} = require("../services/automatedProcessingService");
const { convertXlsToXlsx, ensureDir } = require("../utils/xlsConverter");

const filePath = process.argv[2];

const FAILED_DIR =
  process.env.SFTP_LOCAL_FAILED_DIR ||
  path.join(__dirname, "..", "sftp_failed");

const moveToFailed = async (inputPath) => {
  try {
    await ensureDir(FAILED_DIR);
    const targetPath = path.join(FAILED_DIR, path.basename(inputPath));
    await fs.rename(inputPath, targetPath);
    console.log(`[Worker] Moved file to failed: ${targetPath}`);
  } catch (err) {
    console.error(`[Worker] Failed to move file to failed:`, err);
  }
};

const normalizeInputFile = async (inputPath) => {
  const originalName = path.basename(inputPath);
  const ext = path.extname(originalName).toLowerCase();
  if (ext !== ".xls") {
    return {
      originalPath: inputPath,
      readPath: inputPath,
      originalName,
      tempPath: null,
    };
  }

  const convertedPath = await convertXlsToXlsx(inputPath);
  return {
    originalPath: inputPath,
    readPath: convertedPath,
    originalName,
    tempPath: convertedPath,
  };
};

const run = async () => {
  if (!filePath) {
    console.error("[Worker] Missing file path argument.");
    process.exit(1);
  }

  let tempPath = null;
  let normalized;
  try {
    await connectDB();
    await ensureDirectoriesExist();

    try {
      normalized = await normalizeInputFile(filePath);
      tempPath = normalized.tempPath;
    } catch (convertError) {
      console.error(
        `[Worker] XLS conversion failed for ${filePath}:`,
        convertError
      );
      await moveToFailed(filePath);
      process.exitCode = 1;
      return;
    }

    await processSingleFile({
      filePath: normalized.originalPath,
      originalName: normalized.originalName,
      readPath: normalized.readPath,
    });
  } catch (error) {
    console.error(`[Worker] Fatal error processing ${filePath}:`, error);
    process.exitCode = 1;
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
    try {
      await mongoose.connection.close();
    } catch {}
  }
};

process.on("disconnect", () => {
  process.exit(1);
});

run().then(() => {
  if (!process.exitCode) {
    process.exit(0);
  }
});
