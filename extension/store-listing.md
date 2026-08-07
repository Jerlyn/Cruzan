# Chrome Web Store listing — copy/paste reference

Everything below is drafted so you can paste it straight into the Developer Dashboard. Written 2026-08-06 against the manifest's actual permissions (`contextMenus`, `storage`, no `host_permissions`) — if permissions change later, these justifications need to change with them, since Chrome cross-checks what you write against what the extension actually requests.

## Store listing tab

**Name:** Crucian Word Lookup

**Summary** (this is the manifest's 132-char `description`, shown in search results — already set in `manifest.base.json`):
> Daily word, quick lookup, and right-click search for Crucian dialect — companion to the Crucian Heritage Archive.

**Description** (the longer field on the store page itself, no hard limit):
> A quick-lookup companion for the Crucian Heritage Archive — a dictionary, proverb collection, and grammar guide for Crucian, the English-based creole spoken on St. Croix, U.S. Virgin Islands.
>
> • Word of the day and a daily "did you know" — alternates between a Crucian proverb and a heritage/origins fact
> • Quick search of the 216-term glossary, right from the toolbar
> • Right-click any selected text on any page to look it up in the Archive
> • Save words across your devices (synced via your browser account)
> • Daily streak
> • Light and dark themes
>
> Everything beyond a quick definition — the full proverb collection, grammar notes, heritage/origins breakdown, and a way to support the project — opens the Archive itself in a new tab, so you're always looking at the same, up-to-date source.

**Category:** Education & Reference is the closest fit if it's offered in the current category list; Productivity/Tools is a reasonable fallback. Pick from what's actually in the dropdown when you get there — categories get renamed occasionally.

**Language:** English

## Privacy practices tab

**Single purpose statement:**
> Provides a quick-lookup companion to the Crucian Heritage Archive website — word of the day, dictionary search, and right-click lookup for the Crucian dialect (Virgin Islands Creole).

**Permission justifications:**

- `contextMenus` — Adds a "Look up '...' in Crucian Archive" item to the right-click menu when text is selected, so a user can look up a word without leaving the page they're on.
- `storage` — Stores the user's saved words, daily streak, and light/dark theme choice locally and synced via the browser's own account sync. Not used to collect, transmit, or share any data with us or anyone else.

**Data collection disclosure:** none of the categories Chrome asks about apply — no personally identifiable information, health info, financial info, authentication info, personal communications, location, web history, user activity, or website content is collected or transmitted. (`chrome.storage.sync` data lives in the user's own Google/Firefox account infrastructure; it's never sent to a server we control.)

**Privacy policy URL:** `https://jerlyn.github.io/Cruzan/webapp/privacy.html`
This file is written (`webapp/privacy.html`) but needs a `git push` from your Mac and a live GitHub Pages deploy before that URL actually resolves — do that before you reach this step in the dashboard, or the reviewer will hit a 404.

## Assets

- **Store icon (128×128):** `extension/dist/chrome/icons/icon-128.png` — already bundled in the zip; most dashboards also want it uploaded separately as the listing icon, same file works.
- **Screenshots (at least one required, 1280×800 or 640×400):** none exist yet — these need to come from you actually running the extension (see the testing walkthrough). Good candidates: the Today tab in light mode, the Today tab in dark mode, the Look Up tab with a search result showing, the About overlay, and the right-click context menu mid-selection on a webpage.
- **Promotional tile images** (440×280 small, 1400×560 marquee): optional, skip for now unless you want the extension featured/promoted later.

## Package

Upload `extension/crucian-word-lookup-chrome-v1.0.0.zip` (built from `dist/chrome/`, 17 files, `manifest.json` at the zip root as required).
