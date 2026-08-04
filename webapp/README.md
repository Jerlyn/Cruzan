# Crucian Heritage Archive

An installable, offline-capable PWA documenting the Crucian dialect (Virgin Islands Creole as spoken on St. Croix, U.S. Virgin Islands): a 216-term glossary, 78 proverbs and social expressions, grammar/phonetics notes, and a pronoun matrix, all sourced from original research (`Crucian Dictionary, Grammar & Glossary.docx`).

## Stack

Vanilla HTML/CSS/JS, no build step. Tailwind CDN for utility classes, Chart.js for the origins doughnut chart. No hero visual — two were tried (a three.js particle constellation, then a lightweight SVG diagram) and both got cut as not worth their weight; see git history if curious. Data lives in `data/dictionary.json`, generated from the source docx by `scripts/parse.py`.

## Structure

```
index.html            App shell (nav, sections)
css/styles.css         Design tokens (light + dark), a11y layer, dark-mode overrides
js/app.js               Data fetch, rendering, search/filter, dark mode, install prompt, SW registration
data/dictionary.json    Parsed dictionary, proverbs, grammar notes, pronouns, origin distribution
manifest.json           PWA manifest (icons, shortcuts, standalone display)
service-worker.js       Cache-first shell, network-first data, stale-while-revalidate CDN libs
offline.html             Fallback page when navigation fails offline
icons/                   App icons (192/512/maskable/apple-touch/favicon)
scripts/parse.py         Docx → JSON extraction (re-run if the source docx changes)
scripts/make_icons.py    Icon generation (PIL)
```

## Running locally

No build step. From this folder:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Service worker registration requires `http://localhost` or HTTPS (won't register on a plain `file://` open, though the page itself still works).

## Regenerating data from the docx

```
pip install python-docx --break-system-packages
python3 scripts/parse.py
```

Origin tagging (West African / Danish / Dutch Creole / Spanish / French / Rastafarian / Amerindian / English-Irish / Local-Undetermined) is a keyword heuristic run against each entry's definition text, not a manually verified etymology. About 68% of entries land in "Local / Undetermined" because the source dictionary doesn't state an explicit root for every word — that's disclosed in-app on the Heritage tab rather than papered over.

## Known gaps / next phase

- Chrome extension (companion lookup tool) is planned as a separate phase, sharing this same `data/dictionary.json`.
- Icon glyph is a placeholder "C" mark generated programmatically; swap for real brand art whenever it's ready.
- Grammar example pairs lost their original arrow glyph on docx extraction (python-docx couldn't read it) and are reconstructed as `→` by a regex heuristic in `scripts/parse.py` — spot check `data/dictionary.json` → `grammarExamples` if anything reads oddly.
