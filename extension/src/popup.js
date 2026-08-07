const THEME_KEY = "crucianExtTheme";

function copyText(str) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(str).catch(() => legacyCopy(str));
  }
  return legacyCopy(str);
}

function legacyCopy(str) {
  // Fallback that needs no clipboardWrite permission — kept intentionally
  // out of the manifest to keep the permission list minimal (see
  // manifest.base.json / README "Permissions").
  const ta = document.createElement("textarea");
  ta.value = str;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
  return Promise.resolve();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Theme ---------------- */

async function initTheme() {
  const btn = document.getElementById("theme-toggle");
  const iconMoon = document.getElementById("icon-moon");
  const iconSun = document.getElementById("icon-sun");
  const stored = await chrome.storage.sync.get(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let theme = stored[THEME_KEY] || (prefersDark ? "dark" : "light");

  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    iconMoon.classList.toggle("hidden", t === "dark");
    iconSun.classList.toggle("hidden", t !== "dark");
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");

    // madeBlack.png is the dark-on-light variant (legible on the light-mode
    // bg-main), made.png is the light-on-dark variant — the light PNG on
    // its own wasn't readable against the light theme's background.
    const madeImg = document.getElementById("about-made-img");
    if (madeImg) madeImg.src = t === "dark" ? "icons/made.png" : "icons/madeBlack.png";
  }

  apply(theme);
  btn.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    apply(theme);
    chrome.storage.sync.set({ [THEME_KEY]: theme });
  });
}

/* ---------------- Tabs (WAI-ARIA APG "Tabs" pattern) ----------------
 * Roving tabindex: only the selected tab is in the Tab-key sequence;
 * Left/Right (and Home/End) move selection between tabs directly. */

function initTabs() {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = {
    "tab-today": document.getElementById("panel-today"),
    "tab-lookup": document.getElementById("panel-lookup"),
  };

  function select(tab) {
    for (const t of tabs) {
      const isSelected = t === tab;
      t.setAttribute("aria-selected", String(isSelected));
      t.tabIndex = isSelected ? 0 : -1;
      panels[t.id].classList.toggle("hidden", !isSelected);
    }
    tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length]);
      else if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length]);
      else if (e.key === "Home") select(tabs[0]);
      else if (e.key === "End") select(tabs[tabs.length - 1]);
    });
  });
}

/* ---------------- About overlay (real modal, see popup.css comment) ----------------
 * Focus trap + `inert` on the rest of the popup while open, Escape to
 * close, focus returns to the button that opened it. */

function initAboutOverlay() {
  const openBtn = document.getElementById("about-open");
  const closeBtn = document.getElementById("about-close");
  const overlay = document.getElementById("about-overlay");
  const main = document.getElementById("popup-main");
  const header = document.querySelector(".popup-header");
  const panel = overlay.querySelector(".about-panel");

  function focusableIn(container) {
    return Array.from(
      container.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
  }

  function trapKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = focusableIn(panel);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open() {
    overlay.classList.remove("hidden");
    openBtn.setAttribute("aria-expanded", "true");
    // Everything except the overlay itself becomes unreachable to
    // keyboard/AT users, not just visually covered — including the header
    // that contains the trigger button, so Tab can't leak out through it.
    main.inert = true;
    header.inert = true;
    document.addEventListener("keydown", trapKeydown);
    closeBtn.focus();
  }

  function close() {
    overlay.classList.add("hidden");
    main.inert = false;
    header.inert = false; // restore before focusing openBtn — inert elements can't take focus
    openBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", trapKeydown);
    openBtn.focus();
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(); // click on the backdrop itself, not the panel
  });
}

function initAboutLinks() {
  document.getElementById("about-open-archive").addEventListener("click", () => openArchive());
  document.getElementById("about-support-link").href = self.CrucianConfig.SUPPORT_URL;
  document.getElementById("about-website-link").href = self.CrucianConfig.WEBSITE_URL;
  document.getElementById("about-linkedin-link").href = self.CrucianConfig.LINKEDIN_URL;
  document.getElementById("about-version").textContent = `v${chrome.runtime.getManifest().version}`;

  // Belt-and-suspenders: hide gracefully rather than show a broken-image
  // icon if whichever made*.png the current theme calls for isn't there;
  // un-hide on a successful load since the src can change (theme toggle).
  const madeImg = document.getElementById("about-made-img");
  madeImg.addEventListener("error", () => { madeImg.style.display = "none"; });
  madeImg.addEventListener("load", () => { madeImg.style.display = ""; });
}

/* ---------------- Word of the Day ---------------- */

function renderWotd(entry) {
  document.getElementById("wotd-word").textContent = entry.word;
  document.getElementById("wotd-def").textContent = entry.definition || "";
  document.getElementById("wotd-pron").textContent = entry.pronunciation || "";

  const copyBtn = document.getElementById("wotd-copy");
  copyBtn.dataset.copyText = entry.definition ? `${entry.word} — ${entry.definition}` : entry.word;
  copyBtn.onclick = async () => {
    await copyText(copyBtn.dataset.copyText);
    copyBtn.classList.add("copied");
    copyBtn.setAttribute("aria-label", "Copied");
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.setAttribute("aria-label", "Copy word and definition");
    }, 1600);
  };

  wireSaveButton(document.getElementById("wotd-save"), "dictionary", entry.word, entry.word);
}

async function wireSaveButton(btn, type, id, label) {
  const saved = await self.CrucianStorage.isSaved(type, id);
  paintSaveButton(btn, saved);
  btn.onclick = async () => {
    const nowSaved = await self.CrucianStorage.toggleSaved(type, id, label);
    paintSaveButton(btn, nowSaved);
  };
}

function paintSaveButton(btn, saved) {
  btn.classList.toggle("saved", saved);
  btn.setAttribute("aria-pressed", String(saved));
  btn.setAttribute("aria-label", saved ? "Remove from saved words" : "Save this word");
}

async function renderStreak() {
  const streak = await self.CrucianStorage.recordVisit();
  document.getElementById("streak-text").textContent =
    streak.count <= 1 ? "Day 1 — welcome!" : `${streak.count}-day streak`;
}

/* ---------------- Did You Know: alternates proverb / heritage fact ---------------- */

const ORIGIN_LABEL_DETAIL = {
  "Local / Undetermined":
    "hasn't been pinned to a single origin yet — that gap is disclosed on the Archive, not papered over.",
};

/**
 * Mirrors renderWotd()'s word→definition order and typography on purpose
 * (dyk-word/.dyk-word and dyk-def/.dyk-def are literal copies of
 * wotd-word/.wotd-word and wotd-def/.wotd-def) — the proverb or origin
 * label is the "headword," its meaning is the "definition," same pattern
 * as the card above it, not a visually distinct one. Confirmed 2026-08-06.
 */
function renderDidYouKnow(data) {
  const type = self.CrucianWotd.didYouKnowTypeOfDay();
  const wordEl = document.getElementById("dyk-word");
  const defEl = document.getElementById("dyk-def");
  const cta = document.getElementById("dyk-cta");

  if (type === "proverb") {
    const { entry } = self.CrucianWotd.proverbOfDay(data.proverbs);
    wordEl.textContent = entry.text;
    defEl.textContent = entry.meaning || entry.translation || "";
    cta.textContent = "See more proverbs";
    cta.onclick = () => openArchive(undefined, "proverbs");
  } else {
    const fact = self.CrucianWotd.originFactOfDay(data.origins);
    const detailNote = ORIGIN_LABEL_DETAIL[fact.label];
    wordEl.textContent = detailNote ? "Undetermined roots" : `${fact.label} roots`;
    defEl.textContent = detailNote
      ? `${fact.percent}% of this glossary ${detailNote}`
      : `${fact.percent}% of this glossary traces here — ${fact.value} of ${fact.total} words.`;
    cta.textContent = "Explore Crucian heritage";
    cta.onclick = () => openArchive(undefined, "roots");
  }
}

/* ---------------- Search ---------------- */

function renderResults(data, query) {
  const list = document.getElementById("search-results");
  const status = document.getElementById("search-status");
  list.innerHTML = "";

  if (!query) {
    status.textContent = "";
    return;
  }

  const results = self.CrucianDictionary.searchDictionary(data, query).slice(0, 8);
  status.textContent = results.length
    ? `${results.length} result${results.length === 1 ? "" : "s"}`
    : `No matches for "${query}"`;

  if (!results.length) {
    const empty = document.createElement("li");
    empty.className = "no-results";
    empty.textContent = `No matches for "${query}" yet — try a different spelling, or `;
    const link = document.createElement("button");
    link.type = "button";
    link.className = "footer-link";
    link.textContent = "search the full Archive";
    link.addEventListener("click", () => openArchive(query));
    empty.appendChild(link);
    list.appendChild(empty);
    return;
  }

  for (const entry of results) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-btn";
    btn.innerHTML = `<span class="result-word">${escapeHtml(entry.word)}</span><span class="result-def">${escapeHtml(entry.definition || "")}</span>`;
    btn.addEventListener("click", () => openArchive(entry.word));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function openArchive(word, view) {
  chrome.tabs.create({ url: self.CrucianConfig.archiveUrl({ word, view }) });
}

/* ---------------- Init ---------------- */

async function init() {
  await initTheme();
  initTabs();
  initAboutOverlay();
  initAboutLinks();

  const data = await self.CrucianDictionary.loadDictionary();
  const { entry } = self.CrucianWotd.wordOfDay(data.dictionary);
  renderWotd(entry);
  renderStreak();
  renderDidYouKnow(data);

  const input = document.getElementById("search-input");
  input.addEventListener("input", () => renderResults(data, input.value));
}

document.addEventListener("DOMContentLoaded", init);
