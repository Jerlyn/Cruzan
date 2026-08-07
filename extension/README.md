# Crucian Word Lookup (browser extension)

Companion Chrome/Firefox extension for the Crucian Heritage Archive PWA (`../webapp`): word of the day, a "did you know" proverb card, quick search popup, right-click lookup on any selected text, saved words, and a daily streak. Built 2026-08-06, revised same day after a second review pass (see "Decisions" below).

## Stack

Vanilla HTML/CSS/JS, no framework, no runtime dependencies. The one build tool is `build.js` (Node, zero npm packages) — it exists solely to resolve the Chrome/Firefox manifest divergence below; everything else in this folder ships as-authored.

## Structure

```
src/                    Source of truth — edit here
  manifest.base.json     Shared manifest fields
  manifest.chrome.json    Chrome-only overrides
  manifest.firefox.json   Firefox-only overrides (browser_specific_settings)
  background.js           MV3 background context: context menu registration, opens the Archive
  popup.html/css/js       Browser-action popup: Today/Look Up tabs, About overlay (Support, Archive,
                            GitHub, designlady.com, made.png sign-off), word of the day, did-you-know
                            (proverb/heritage), quick search, streak
  shared/
    config.js               Live Archive URL + Ko-fi link — the one place to update either
    dictionary.js            Load + search the bundled dictionary.json
    wotd.js                   Deterministic date-seeded word-of-day / proverb-of-day picker
    storage.js                chrome.storage.sync wrappers (saved words, streak, theme)
    tokens.css                 Design tokens, duplicated from webapp/css/styles.css
  icons/                  16/32/48/128px, downsampled from webapp/icons/icon-512.png
  view.html/css/js        DEPRECATED — see "Deprecated files" below. Not shipped in dist/.
scripts/
  make_icons.py           Regenerate icons/ from the PWA's master icon
build.js                  node build.js → dist/chrome/ and dist/firefox/
dist/                      Build output (gitignored — regenerate, don't hand-edit)
```

## Building

```
node build.js
```

Load unpacked:
- Chrome — `chrome://extensions` → enable Developer mode → Load unpacked → `dist/chrome`
- Firefox — `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist/firefox/manifest.json`

## Keeping data in sync with the PWA

The extension never forks or hand-copies dictionary content. `build.js` copies `webapp/data/dictionary.json` into each `dist/<browser>/data/` folder fresh on every build. If you regenerate that file from the source docx:

```
cd ../webapp && python3 scripts/parse.py
cd ../extension && node build.js
```

## Why context-menu lookups and "Open in Archive" go to the live PWA, not a bundled page

Originally this extension shipped its own `view.html` — a bundled full-page copy of the lookup result, reachable via context menu or a popup link, meant as the accessible escape-hatch from the popup's fixed 800x600 box. Revised 2026-08-06: instead of maintaining a second, thinner dictionary UI, the popup's "Open in Crucian Heritage Archive" link and the context-menu lookup both now open `webapp/index.html` on GitHub Pages directly (`shared/config.js` → `CRUCIAN_ARCHIVE_URL`), with a `?word=` deep-link param.

That param is new in `webapp/js/app.js`'s `init()` (2026-08-06): if present, it forces the Dictionary tab open, fills `#main-search`, and runs the site's own `handleSearch()` — so matching/fuzziness lives in exactly one place (the PWA's existing search), not duplicated in the extension. This also means a lookup miss shows the PWA's own empty state instead of a custom "not in the glossary" message the extension would otherwise have to maintain.

This is a net accessibility improvement, not just a simplification: a real tab on the actual site gets normal browser zoom/text scaling, plus proverbs, grammar notes, heritage context, and the donate link that a bundled popup page never had. The tradeoff is a network dependency — offline, the popup itself still works fully (bundled JSON, no fetch), but "Open in Archive" and context-menu lookups need connectivity (or a previously-cached visit to the PWA, since it's a service-worker-backed PWA itself).

### Deprecated files

`src/view.html`, `src/view.css`, and `src/view.js` are the old bundled full-page UI described above. `build.js` no longer includes them in `dist/` (see the comment above `SHARED_ENTRIES`). They could not be deleted from disk in the environment this revision was built in — that environment doesn't allow unlinking files in this connected folder at all (git commits hit the identical wall; see project history). They're inert, unreferenced by the manifest, and safe to delete manually whenever you're next in Finder or VS Code.

## Why a build script, when the PWA has none

Chrome's MV3 background context is a service worker (`background.service_worker`); Firefox's isn't — as of Firefox 121+, Firefox starts the background page regardless of whether `service_worker` is present, but it still runs it via `background.scripts`, not as an actual service worker. Official guidance is to declare both keys and let each browser use the one it understands. That's a genuine per-browser manifest difference, not something a single static `manifest.json` can express, so `build.js` generates one from `manifest.base.json` + a per-browser override file. Source: [Firefox Extension Workshop, MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/); cross-check `extensionworkshop.com` directly before shipping, since Firefox's MV3 support has been a moving target and this may have shifted.

Firefox also requires `browser_specific_settings.gecko.id` for `storage.sync` to work at all — that's set in `manifest.firefox.json`.

`background.js` itself needs `shared/config.js` loaded first (for the Archive URL). Chrome's single-file service worker pulls it in with `importScripts()`; Firefox's background page instead gets it as a separate entry in `manifest.base.json`'s `background.scripts` array, since `importScripts()` is a Worker-only API that doesn't exist in a normal background page. `background.js` guards the call with `typeof importScripts === "function"` so the same file works in both.

`node build.js`'s clean step (delete-then-rebuild `dist/`) is best-effort: it silently falls back to overwrite-in-place if the filesystem refuses deletes (see the environment note above). On a normal machine this is invisible — `dist/` is always fully clean.

## Decisions

**2026-08-06, first pass:**
- **Word of the day is not synced with the PWA.** `webapp/js/app.js`'s `randomizeWotd()` picks a fresh random word on every load/shuffle — there's no "today's word" concept there. This extension needs one (for the streak and popup to mean anything), so `shared/wotd.js` hashes the local calendar date into a deterministic index (same mechanism now also drives the proverb-of-the-day card, with a different salt so the two picks don't correlate). The two surfaces will show different words at the same moment. Confirmed keeping this divergence rather than retrofitting the PWA to match.
- **Saved words are a separate list from the PWA's bookmarks**, by necessity as much as choice — an installed extension can't read a website's `localStorage` or vice versa, so `chrome.storage.sync` (key `crucianExtSaved`) and the PWA's `localStorage` key `crucianSaved` were never going to merge automatically. Confirmed keeping them separate rather than building an account/backend layer to unify them.
- **New-tab override (word of the day on every new tab) was discussed and deferred**, not built.
- **Permissions are kept to `contextMenus` and `storage` only** — no `host_permissions`, no `clipboardWrite`. Copy-to-clipboard uses `navigator.clipboard` with a `document.execCommand` fallback. Opening the Archive in a new tab (`chrome.tabs.create`) doesn't require `host_permissions` either — that permission only gates privileged cross-origin access (fetch/content-script injection), not simply creating a tab pointed at a URL.

**2026-08-06, second pass (after reviewing a reference screenshot of a similar Kwéyòl extension for structure, not visual style):**
- Added a **"did you know" proverb-of-the-day card** to the popup, same deterministic-per-day mechanism as word of the day, drawn from `data.proverbs` — so an extension-only user (never visits the PWA) still gets exposed to proverbs and heritage content, not just dictionary definitions.
- Added a **"Support the project" link** to the popup footer, pointing at the same Ko-fi (`https://ko-fi.com/designlady`) the PWA's "Support the Project" section already uses — one destination, referenced from `shared/config.js`, not duplicated.
- **Replaced the bundled full-view page with links to the live PWA** — see "Why context-menu lookups... go to the live PWA" above.
- Streak indicator restyled as a pill with an outline flame icon (SVG, not emoji) rather than plain text, closer in structure to the Kwéyòl reference without adopting its dark/mascot visual identity — stays in this project's teal/warm-stone tokens.

**2026-08-06, third pass (after a Kwéyòl-app reference screenshot for structure, not visual style):**
- Popup restructured into two ARIA tabs, **Today** (word of day, streak, did-you-know) and **Look Up** (search) — considered mirroring the reference's full five-tab set (Today/Dictionary/Proverbs/Alphabet/Grammar) and deliberately scoped back down to two: the original brief was "word of the day + quick search," and Proverbs/Grammar/Heritage already have a home in the PWA. Roving-tabindex + Left/Right/Home/End keyboard nav per the WAI-ARIA APG tabs pattern.
- Added an **About overlay** (hamburger icon in the header) holding what used to be plain footer links: Support (Ko-fi), Open in Archive, a GitHub link, a designlady.com link, and a "made with ❤️ Design Lady" sign-off image (`icons/made.png` — not committed by this pass; the `<img>` hides itself gracefully via an `error` handler if the file isn't there yet). This is a genuine modal *inside* an already-constrained popup, not a new page — see "Accessibility notes" below for how the focus trap works.
- **Did-you-know reworked**: previously showed the raw proverb text + a literal translation line, which read as a translation drill rather than something worth knowing. Now leads with the proverb's *meaning* as the hook, the Crucian text as supporting flavor, and ends in a contextual CTA. It also now alternates (same deterministic date-seed, third salt) between a proverb fact and a **heritage fact** pulled from `data.origins` — the same {labels, values} distribution behind the PWA's roots/heritage chart — so an extension-only user gets exposed to both proverbs and heritage, not just word definitions. Each fact type's CTA points at the matching PWA section (`?view=proverbs` or `?view=roots`), not a generic archive link.
- `shared/config.js`'s `archiveUrl()` generalized to take `{ word, view }` instead of just a word, so it can target any PWA section, not only the dictionary.

**2026-08-06, fourth pass (screenshot-driven fixes):**
- `.popup-wrap` height fixed at 580px instead of `max-height: 580px` — the About overlay is `position:absolute;inset:0` against it, so when a shorter tab (Look Up, no results yet) was active, the popup shrink-wrapped short and the overlay inherited that clipped height instead of getting the full canvas. Tradeoff: shorter tab content now leaves blank space below it rather than the popup shrinking to fit — intentional, not a bug.
- `.about-text-link` (View on GitHub, designlady.com, LinkedIn) centered — was a full-width row with left-aligned content, now full-width with centered content (kept the 44px-tall full row rather than shrinking to a small centered link, for the touch target).
- Added a LinkedIn link (`shared/config.js` → `LINKEDIN_URL`) alongside GitHub/website in the About overlay.

**2026-08-06, fifth pass:**
- Removed the GitHub link from the About overlay entirely (`GITHUB_URL` dropped from `shared/config.js`).
- designlady.com and LinkedIn are now icon buttons (globe / stylized "in" mark, both outline SVGs in this project's own currentColor palette, not the official LinkedIn brand asset) in a centered row, `.about-icon-row`, matching the Kwéyòl reference's icon-pair layout — replacing the two centered text links from the previous pass.
- The "made with ❤️ Design Lady" sign-off is now theme-aware: `icons/made.png` (light-on-dark) shows in dark mode, `icons/madeBlack.png` (dark-on-light) shows in light mode — the single light-colored image wasn't legible against the light theme's background. Swap happens in `initTheme()`'s `apply()` in `popup.js`, so it stays in sync with every toggle, not just initial load.
- Both `made.png` and `madeBlack.png` were originally dropped into `dist/chrome/icons/` and `dist/firefox/icons/` directly rather than `src/icons/` — copied into `src/icons/` (the actual source `build.js` manages) so they survive a real clean rebuild instead of only existing in build output.

**2026-08-06, sixth pass (screenshot-driven fixes):**
- `#about-close` no longer `position:absolute` — the overlay now has its own `.about-header` using the identical flex layout and container padding as `.popup-header`, so the close button lands in the exact same spot the hamburger trigger occupies, not an independently-eyeballed corner offset.
- `.about-title` was missing `font-style: italic` and `font-weight: 700` — it inherited the browser's default bold-but-upright `<h2>` styling instead of matching `.popup-title`'s italic Fraunces. Now copies that rule directly.
- `.about-panel` is `min-height: 100%` of the (fixed-height, see pass four) overlay, and `.about-signoff` has `margin-top: auto` — pins the sign-off/version to the true bottom of the panel instead of leaving a large dead gap beneath a short content stack.

**2026-08-06, seventh pass:**
- Did-you-know's hierarchy inverted to match the word-of-day card above it: previously led with the meaning (bold, sans) and followed with the proverb text (smaller italic serif) — now the proverb (or, for a heritage day, the origin label — "Spanish roots," "Undetermined roots") is the headline in the exact typography `.wotd-word` uses, and the meaning/stat follows in `.wotd-def`'s typography. `#dyk-hook`/`#dyk-support` renamed to `#dyk-word`/`#dyk-def` to name what they now actually are. Same headword→definition pattern as the card above it, not a visually distinct one.

**2026-08-06, eighth pass:**
- `.result-def` (search result definitions in the Look Up tab) no longer truncates with `white-space: nowrap` + ellipsis — it wraps in full. A "quick lookup" defeated its own point if reading the rest of a definition meant leaving the popup for the Archive; `.result-btn` has no fixed height, so the card grows to fit rather than clipping.

**2026-08-06, ninth pass:**
- Streak pill centered (`align-self: center`, was `flex-start`) and its flame icon switched from outline to filled (`fill="currentColor" stroke="none"`) — reads as a status badge distinct from the did-you-know card beneath it, which is left-aligned and outline-icon. Same "filled = active" language the save/heart icon already uses elsewhere in this popup.

**2026-08-06, tenth pass:**
- Popup and About-overlay titles now match `webapp/index.html`'s actual nav title exactly (`font-extrabold text-lg tracking-tight`, plain Plus Jakarta Sans) instead of the serif/italic treatment used until now — the two titles matched *each other* since pass six, but neither matched the PWA. Dropped `.serif` from both `<h1>`/`<h2>` elements; `.popup-title`/`.about-title` now `font-weight: 800; letter-spacing: -0.02em;`, no italic.
- Added the PWA's own "C" mark (`icons/icon-48.png`, the same rounded-square asset `webapp/scripts/make_icons.py`'s PWA original inspired `extension/scripts/make_icons.py`'s downsample from) in front of both titles, wrapped with the title text in a new `.title-group`. Decorative (`alt="" aria-hidden="true"`) since the adjacent visible text already says the same thing.

**2026-08-06, eleventh pass — Chrome Web Store prep:**
- `manifest.base.json` description shortened to 113 chars (was 153 — Chrome's hard limit for this field is 132). Version bumped `0.1.0` → `1.0.0` for the first public release (`package.json` matched).
- Added `webapp/privacy.html` — plain-language privacy page covering both the extension (collects/transmits nothing; saved words/streak/theme live only in the browser's own account-sync storage) and the website (Google Analytics, the optional Web3Forms suggestion form). Not strictly mandatory for this permission set under Chrome's policy (only `storage`/`contextMenus`, no data-access permissions), but CWS privacy-policy enforcement tightened 2026-08-01, and having one removes any ambiguity. Needs a real `git push` + live Pages deploy before its URL resolves.
- Built `extension/crucian-word-lookup-chrome-v1.0.0.zip` for upload — `dist/chrome/` minus `.DS_Store` and the deprecated `view.*` files. Built via Python's `zipfile` (truncate-write) rather than the `zip` CLI, which hit the same delete-on-replace restriction as git (see [[project-cruzan-environment-no-delete]] equivalent note) when writing to an already-existing output path.
- `extension/store-listing.md` — copy/paste-ready listing text (description, single-purpose statement, permission justifications, privacy disclosure answers, asset checklist) for the Developer Dashboard.

## Accessibility notes

- **The popup is a fixed, non-resizable surface** (Chrome caps action popups at 800x600; there's no user-facing resize). Widely reported that extension popups don't reliably honor the browser's page-zoom level (Ctrl+/Ctrl-) the way a normal tab does — I couldn't find a solid 2026-dated source confirming this is still true in current Chrome/Firefox, so treat it as "probably still true, verify by testing in your actual installed build" rather than settled fact.
- **The escape hatch is now the live PWA itself**, not a bundled page — see above. Normal browser zoom/text scaling apply there because it's a real website in a real tab.
- Popup reuses the PWA's existing focus-visible ring (`shared/tokens.css`, copied from `webapp/css/styles.css`), 44px minimum touch targets, and respects `prefers-reduced-motion`.
- Context-menu lookup is keyboard-reachable: select text with Shift+arrows, open the context menu with Shift+F10 or the Menu key, activate the item — it's not mouse-only, but that path is worth testing directly with a keyboard-only pass before shipping.
- On the PWA side, landing via `?word=` still runs through the site's normal `handleSearch()` → `renderDictionary()` path and focuses `#main-search` — it inherits whatever focus/announcement behavior that path already has, rather than introducing a new one.
- Color pairs in `shared/tokens.css` are the PWA's existing tokens verbatim; contrast was re-verified for every pair actually used here, including the new streak-pill and did-you-know accent-warm text/icon, the About overlay's buttons/links, and the tab bar's selected-indicator (light and dark) — all measured ≥ 4.5:1 for text, ≥ 3:1 for large text/UI/non-text indicators, against WCAG 2.x's formula.
- **The About overlay is a real modal, and is treated as one.** On open: focus moves to its close button, the rest of the popup (header included, so the trigger button itself can't be tabbed back into mid-interaction) gets the `inert` attribute — unreachable to keyboard and assistive tech, not just visually covered — Tab/Shift+Tab are trapped within the overlay's own focusable elements, and Escape closes it. On close: `inert` is lifted before focus is programmatically returned to the hamburger button (an `inert` element can't receive focus, so the order matters). `inert` is well-supported in both target browser floors (Chrome ≥102, Firefox ≥121 per `manifest.chrome.json`/`manifest.firefox.json`) — this was exactly the kind of small-popup accessibility tradeoff flagged as worth watching for from the first design pass, now that it's actually been built.
- Tabs follow the WAI-ARIA APG pattern (`role="tablist"/"tab"/"tabpanel"`, roving `tabindex`, Left/Right/Home/End move selection) rather than a plain button toggle, so screen readers announce them as tabs and keyboard users get the interaction pattern they'd expect from any other tabbed UI.

## Known gaps / next phase

- New-tab override: discussed, deferred.
- No automated test suite yet — verification so far is manual load-unpacked testing plus the contrast/logic checks run during this build (deterministic WOTD/proverb picks, search matching, manifest structure, dictionary.json parity, and the `?word=` deep-link all scripted and passing as of 2026-08-06).
- Icons are a straight downsample of the PWA's placeholder "C" mark (`webapp/scripts/make_icons.py`) — regenerate via `scripts/make_icons.py` whenever real brand art replaces it, same as the PWA's own README flags for its icons.
- Not yet submitted to the Chrome Web Store or AMO (Firefox); both require a review/signing pass beyond what's in this repo.
- `src/view.*` cleanup (see "Deprecated files") is a manual, outside-this-environment step.
- `icons/made.png` (the "made with ❤️ Design Lady" sign-off in the About overlay) isn't in this repo yet — you're adding it separately. The `<img>` tag is already wired up (`popup.html`/`popup.js`) and fails gracefully (hides itself) until it's there.
- No LinkedIn link in the About overlay yet (Kwéyòl's reference has one) — add the URL to `shared/config.js` and a link in `popup.html` whenever you want it in.
