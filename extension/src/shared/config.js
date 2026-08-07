/**
 * Single place the extension points at the live PWA. Confirmed 2026-08-06:
 * GitHub Pages default for this repo. If the Archive moves to a custom
 * domain later, this is the only line that needs to change.
 */
const CRUCIAN_ARCHIVE_URL = "https://jerlyn.github.io/Cruzan/webapp/";
const SUPPORT_URL = "https://ko-fi.com/designlady"; // same destination as webapp/index.html's "Support the Project" section
const WEBSITE_URL = "https://designlady.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/jerlyn/";

/**
 * `view` matches the PWA's own nav ids (navTo() in webapp/js/app.js):
 * "home" | "grammar" | "proverbs" | "dictionary" | "roots". Defaults to
 * "dictionary" since most links here are word lookups; the did-you-know
 * card's CTA overrides it to "proverbs" or "roots" depending on which
 * fact type is showing (see popup.js renderDidYouKnow()).
 */
function archiveUrl({ word, view = "dictionary" } = {}) {
  const url = new URL(CRUCIAN_ARCHIVE_URL);
  url.searchParams.set("view", view);
  if (word) url.searchParams.set("word", word);
  return url.toString();
}

self.CrucianConfig = { CRUCIAN_ARCHIVE_URL, SUPPORT_URL, WEBSITE_URL, LINKEDIN_URL, archiveUrl };
