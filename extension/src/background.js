/**
 * MV3 background context. Chrome runs this as a service worker
 * (background.service_worker); Firefox runs it as a persistent-ish
 * background page (background.scripts) — see manifest.base.json and
 * README.md for why both keys are declared. This file has no DOM and
 * doesn't need the dictionary — it hands lookups off to the live PWA
 * (webapp/js/app.js reads the ?word= param and runs its own search), so
 * matching/fuzziness is the PWA's job, not duplicated here. See
 * shared/config.js for the archive URL and README.md "Why context-menu
 * lookups open the Archive, not a bundled page" for the reasoning.
 */

// Chrome's service worker loads this file alone, so it needs
// importScripts() to pull in config.js. Firefox's background page instead
// gets shared/config.js as its own <script> tag first, per the
// background.scripts order in manifest.base.json — and importScripts is a
// Worker-only API that doesn't exist in a Firefox background page, hence
// the guard (MDN: WorkerGlobalScope.importScripts()).
if (typeof importScripts === "function") {
  importScripts("shared/config.js");
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "crucian-lookup",
    // %s is replaced with the selected text by the browser — lets the
    // user confirm what they selected before clicking, without us having
    // to build that confirmation ourselves.
    title: 'Look up "%s" in Crucian Archive',
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "crucian-lookup" || !info.selectionText) return;
  const word = info.selectionText.trim();
  if (!word) return;

  // Opens the live Archive in a real browser tab — not a synthetic popup
  // window, and (as of 2026-08-06) not a bundled page in this extension
  // either. A full tab gets normal browser zoom/text scaling and isn't
  // capped at 800x600 the way an action popup is; chrome.action.openPopup()
  // also can't be triggered from a context-menu click regardless (Chrome
  // only allows it from a direct user gesture on the toolbar icon). Sending
  // people to the Archive itself (proverbs, grammar, heritage notes, donate
  // link) rather than a stripped-down local copy was a deliberate choice —
  // see README.md.
  chrome.tabs.create({ url: self.CrucianConfig.archiveUrl(word) });
});
