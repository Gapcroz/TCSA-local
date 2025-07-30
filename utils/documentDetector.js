// utils/documentDetector.js
const ExcelJS = require("exceljs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const {
  getRegistryEntry,
  schemaUniquenessMap, // Import the uniqueness map
} = require("../data/documentTypeRegistry");
const { mapHeaders } = require("./headerMapper");
const path = require("path");

// (The getHeaders function remains the same as the previous version)
async function getHeaders(buffer, fileExtension) {
  if (fileExtension === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      const headerText =
        cell.value && cell.value.richText
          ? cell.value.richText.map((rt) => rt.text).join("")
          : cell.value;
      headers.push(String(headerText || "").trim());
    });
    return headers;
  }
  if (fileExtension === ".csv") {
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer);
      const parser = stream.pipe(csv());
      parser.on("headers", (headers) => {
        parser.destroy();
        resolve(headers.map((h) => String(h || "").trim()));
      });
      parser.on("error", reject);
      parser.on("end", () => resolve([]));
    });
  }
  return [];
}

const detectDocumentType = async (fileBuffer, originalName) => {
  const fileExtension = path.extname(originalName).toLowerCase();
  if (fileExtension !== ".xlsx" && fileExtension !== ".csv") {
    return null;
  }

  const fileHeaders = await getHeaders(fileBuffer, fileExtension);
  if (fileHeaders.length === 0) {
    return null;
  }

  const detailedScores = {};
  const docTypes = ["finishedProduct", "rawMaterial", "billOfMaterials"];
  const UNIQUENESS_BONUS_POINTS = 5; // Points awarded for each unique field found

  for (const docType of docTypes) {
    const { schemaSpec } = getRegistryEntry(docType);
    const headerMap = mapHeaders(fileHeaders, schemaSpec);
    const mappedCanonicals = new Set(Object.values(headerMap));

    // --- Base Score Calculation (Mandatory Fields) ---
    const mandatoryFields = schemaSpec.filter((f) => f.requirement === "M");
    let foundMandatoryCount = 0;
    if (mandatoryFields.length > 0) {
      foundMandatoryCount = mandatoryFields.filter((field) =>
        mappedCanonicals.has(field.dataElement)
      ).length;
    }
    const baseScore =
      mandatoryFields.length > 0
        ? (foundMandatoryCount / mandatoryFields.length) * 100
        : 100; // Score 100 if no mandatory fields exist

    // --- Uniqueness Bonus Calculation ---
    const uniqueFieldsForSchema = schemaUniquenessMap[docType];
    const foundUniqueFields = [...uniqueFieldsForSchema].filter((field) =>
      mappedCanonicals.has(field)
    );
    const uniquenessBonus =
      foundUniqueFields.length * UNIQUENESS_BONUS_POINTS;

    detailedScores[docType] = {
      baseScore: baseScore,
      uniquenessBonus: uniquenessBonus,
      finalScore: baseScore + uniquenessBonus,
      foundUniqueFields: foundUniqueFields,
    };
  }

  // --- Enhanced Diagnostic Logging ---
  console.log("\n[Detector] --- Detailed Detection Report ---");
  for (const docType of docTypes) {
    const details = detailedScores[docType];
    console.log(`[Detector] Analyzing Schema: '${docType}'`);
    console.log(
      `[Detector]   - Base Score (Mandatory Fields): ${details.baseScore.toFixed(
        2
      )}%`
    );
    console.log(
      `[Detector]   - Uniqueness Bonus: +${
        details.uniquenessBonus
      } (Found: ${
        details.foundUniqueFields.length > 0
          ? details.foundUniqueFields.join(", ")
          : "None"
      })`
    );
    console.log(
      `[Detector]   - Final Score: ${details.finalScore.toFixed(2)}`
    );
  }
  console.log("[Detector] --- End of Report ---\n");

  // Find the best match based on the new finalScore
  let bestMatch = null;
  let highestScore = -1;
  for (const docType in detailedScores) {
    if (detailedScores[docType].finalScore > highestScore) {
      highestScore = detailedScores[docType].finalScore;
      bestMatch = docType;
    }
  }

  const CONFIDENCE_THRESHOLD = 75.0;
  // The confidence check should be on the base score to ensure it's a good fundamental fit
  if (detailedScores[bestMatch].baseScore < CONFIDENCE_THRESHOLD) {
    console.log(
      `[Detector] Best match '${bestMatch}' has a base score of ${detailedScores[
        bestMatch
      ].baseScore.toFixed(
        2
      )}%, which is below the confidence threshold of ${CONFIDENCE_THRESHOLD}%.`
    );
    return null;
  }

  // Ambiguity Check on the final score
  let secondHighestScore = -1;
  for (const docType in detailedScores) {
    if (
      docType !== bestMatch &&
      detailedScores[docType].finalScore > secondHighestScore
    ) {
      secondHighestScore = detailedScores[docType].finalScore;
    }
  }

  // The ambiguity margin can be smaller now, as the bonus points create separation
  const AMBIGUITY_MARGIN = 1;
  if (
    secondHighestScore > -1 &&
    highestScore - secondHighestScore < AMBIGUITY_MARGIN
  ) {
    console.log(
      `[Detector] Match is ambiguous. Best score (${highestScore.toFixed(
        2
      )}) is not sufficiently higher than second best (${secondHighestScore.toFixed(
        2
      )}).`
    );
    return null;
  }

  console.log(
    `[Detector] Confidently detected document type: ${bestMatch} with final score ${highestScore.toFixed(
      2
    )}`
  );
  return bestMatch;
};

module.exports = { detectDocumentType };