/**
 * Loads and searches the bundled dictionary.json snapshot (copied from
 * webapp/data/dictionary.json by build.js — see build.js header comment).
 * Shared between popup.js and view.js so lookup behavior can't drift
 * between the two surfaces.
 */

let _cache = null;

async function loadDictionary() {
  if (_cache) return _cache;
  const url = chrome.runtime.getURL("data/dictionary.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load dictionary.json (${res.status})`);
  _cache = await res.json();
  return _cache;
}

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

/**
 * Substring match against word, altSpellings, and definition — the
 * glossary is only 216 terms, so a simple contains-match surfaces
 * reasonable results without needing a fuzzy-match dependency.
 */
function searchDictionary(data, query) {
  const q = normalize(query);
  if (!q) return [];
  return data.dictionary
    .filter((entry) => {
      return (
        normalize(entry.word).includes(q) ||
        normalize(entry.altSpellings).includes(q) ||
        normalize(entry.definition).includes(q)
      );
    })
    .sort((a, b) => {
      // Exact/prefix matches on the headword itself outrank definition hits.
      const aWord = normalize(a.word);
      const bWord = normalize(b.word);
      const aScore = aWord === q ? 0 : aWord.startsWith(q) ? 1 : 2;
      const bScore = bWord === q ? 0 : bWord.startsWith(q) ? 1 : 2;
      return aScore - bScore;
    });
}

/**
 * Best-effort single match for context-menu lookups, where the user
 * selected exact text on a page rather than typing a search query.
 * Returns null (not an empty array) when nothing matches, so callers can
 * show a clear "not in the glossary yet" state instead of a silent miss.
 */
function findBestMatch(data, selection) {
  const results = searchDictionary(data, selection);
  return results.length ? results[0] : null;
}

// Exposed as globals — this project intentionally has no bundler, so
// popup.js/view.js/background.js load these as plain <script>/importScripts
// includes rather than ES modules.
self.CrucianDictionary = { loadDictionary, searchDictionary, findBestMatch };
