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
 * It prioritizes direct matches and ensures a canonical field, once matched directly,
 * is not used for a fuzzy match on another header.
 *
 * @param {Array<string>} fileHeaders - The headers from the user's file.
 * @param {Array<Object>} schemaSpec - The schema specification for the document type.
 * @returns {Object} A map where keys are file headers and values are canonical schema names.
 *                   Example: { "Part Nmber": "Part Number", "UOM": "Unit of measure" }
 */
const mapHeaders = (fileHeaders, schemaSpec) => {
  const headerMap = {};
  const searchableList = createSearchableList(schemaSpec);
  const unmatchedHeaders = [];

  // 1. First pass: Find all direct, case-insensitive matches
  fileHeaders.forEach((header) => {
    if (!header) return; // Skip empty/null headers

    const lowerHeader = String(header).toLowerCase().trim();
    let foundDirectMatch = false;

    for (const field of searchableList) {
      if (field.searchTerms.includes(lowerHeader)) {
        headerMap[header] = field.canonicalName;
        foundDirectMatch = true;
        console.log(
          `[HeaderMapper] Direct match for "${header}": "${field.canonicalName}"`
        );
        break; // Found the match for this header, move to the next
      }
    }

    if (!foundDirectMatch) {
      unmatchedHeaders.push(header);
    }
  });

  // 2. Second pass: Fuzzy match remaining headers against available canonical fields
  if (unmatchedHeaders.length > 0) {
    // Determine which canonical names were already claimed by direct matches
    const directlyMatchedCanonicals = new Set(Object.values(headerMap));

    // Create a new search list for Fuse that excludes already-matched fields
    const availableForFuzzy = searchableList.filter(
      (item) => !directlyMatchedCanonicals.has(item.canonicalName)
    );

    if (availableForFuzzy.length > 0) {
      const fuse = new Fuse(
        availableForFuzzy.map((item) => item.fuseItem),
        {
          keys: ["searchable"],
          includeScore: true,
          threshold: 0.4, // Adjust this: 0.0 = perfect match, 1.0 = any match
        }
      );

      unmatchedHeaders.forEach((header) => {
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
      });
    } else {
      // All possible fields were claimed by direct matches, so no fuzzy search is possible.
      unmatchedHeaders.forEach((header) => {
        console.warn(
          `[HeaderMapper] No suitable match found for header: "${header}"`
        );
      });
    }
  }

  return headerMap;
};

module.exports = { mapHeaders };