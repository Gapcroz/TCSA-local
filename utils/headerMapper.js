// utils/headerMapper.js
const Fuse = require("fuse.js");

/**
 * Creates a searchable list from the schema spec for fuzzy matching.
 * Each item in the list includes the canonical name and all its aliases.
 * @param {Array<Object>} schemaSpec - The schema specification array.
 * @returns {Array<Object>} A list formatted for Fuse.js.
 */
const createSearchableList = (schemaSpec) => {
  const list = [];
  schemaSpec.forEach((field) => {
    // We search against the canonical name and all defined aliases
    const searchTerms = [field.dataElement, ...(field.aliases || [])];
    list.push({
      canonicalName: field.dataElement,
      // For direct, case-insensitive matching
      searchTerms: searchTerms.map((term) => term.toLowerCase()),
      // For fuzzy matching with Fuse.js
      fuseItem: {
        canonicalName: field.dataElement,
        searchable: [field.dataElement, ...(field.aliases || [])],
      },
    });
  });
  return list;
};

/**
 * Maps headers from an uploaded file to the canonical dataElement names from the schema.
 * It uses direct case-insensitive matching first, then falls back to fuzzy matching for typos.
 *
 * @param {Array<string>} fileHeaders - The headers from the user's file.
 * @param {Array<Object>} schemaSpec - The schema specification for the document type.
 * @returns {Object} A map where keys are file headers and values are canonical schema names.
 *                   Example: { "Part Nmber": "Part Number", "UOM": "Unit of measure" }
 */
const mapHeaders = (fileHeaders, schemaSpec) => {
  const headerMap = {};
  const searchableList = createSearchableList(schemaSpec);
  const fuse = new Fuse(
    searchableList.map((item) => item.fuseItem),
    {
      keys: ["searchable"],
      includeScore: true,
      threshold: 0.4, // Adjust this: 0.0 = perfect match, 1.0 = any match
    }
  );

  fileHeaders.forEach((header) => {
    if (!header) return; // Skip empty/null headers

    const lowerHeader = String(header).toLowerCase().trim();
    let foundMatch = false;

    // 1. Direct, case-insensitive match (fastest and most reliable)
    for (const field of searchableList) {
      if (field.searchTerms.includes(lowerHeader)) {
        headerMap[header] = field.canonicalName;
        foundMatch = true;
        break;
      }
    }

    // 2. Fallback to fuzzy matching for typos
    if (!foundMatch) {
      const results = fuse.search(header);
      if (results.length > 0 && results[0].score < 0.4) {
        const bestMatch = results[0];
        console.log(
          `[HeaderMapper] Fuzzy match for "${header}": "${bestMatch.item.canonicalName}" (Score: ${bestMatch.score})`
        );
        headerMap[header] = bestMatch.item.canonicalName;
      } else {
        console.warn(
          `[HeaderMapper] No suitable match found for header: "${header}"`
        );
      }
    }
  });

  return headerMap;
};

module.exports = { mapHeaders };