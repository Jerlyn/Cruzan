const THEME_KEY = "crucianExtTheme";

function copyText(str) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(str).catch(() => legacyCopy(str));
  }
  return legacyCopy(str);
}

function legacyCopy(str) {
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
  }

  apply(theme);
  btn.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    apply(theme);
    chrome.storage.sync.set({ [THEME_KEY]: theme });
  });
}

async function wireSaveButton(btn, type, id, label) {
  const saved = await self.CrucianStorage.isSaved(type, id);
  paintSaveButton(btn, saved);
  btn.onclick = async () => {
    const nowSaved = await self.CrucianStorage.toggleSaved(type, id, label);
    paintSaveButton(btn, nowSaved);
    renderSavedList(currentData);
  };
}

function paintSaveButton(btn, saved) {
  btn.classList.toggle("saved", saved);
  btn.setAttribute("aria-pressed", String(saved));
  btn.setAttribute("aria-label", saved ? "Remove from saved words" : "Save this word");
}

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

async function renderStreak() {
  const streak = await self.CrucianStorage.recordVisit();
  const el = document.getElementById("streak-line");
  el.textContent = streak.count <= 1
    ? "Day 1 of your streak — come back tomorrow."
    : `${streak.count}-day streak.`;
}

/**
 * Renders whatever word the user landed on (context-menu selection, a
 * saved-word click, or a search result click) into #lookup-result, then
 * moves focus there. This is the key a11y behavior for the "open a tab
 * instead of a synthetic popup" decision in background.js: someone who
 * triggered this via a context menu shouldn't have to hunt the page for
 * what happened next.
 */
function showLookupResult(data, rawWord) {
  const section = document.getElementById("lookup-result");
  const match = self.CrucianDictionary.findBestMatch(data, rawWord);

  if (match) {
    section.innerHTML = `
      <h2 class="serif">${escapeHtml(match.word)}</h2>
      ${match.pronunciation ? `<p class="wotd-pron">${escapeHtml(match.pronunciation)}</p>` : ""}
      <p>${escapeHtml(match.definition || "")}</p>
      ${match.example ? `<p><em>${escapeHtml(match.example)}</em></p>` : ""}
    `;
  } else {
    section.innerHTML = `
      <h2 class="serif">"${escapeHtml(rawWord)}"</h2>
      <p class="not-found">Not in the 216-term glossary yet. Try the search box below for a close spelling, or it may be a word only used in a longer phrase.</p>
    `;
  }

  section.hidden = false;
  section.focus();
}

function renderSearchResults(data, query, listElId, statusElId, cap) {
  const list = document.getElementById(listElId);
  const status = document.getElementById(statusElId);
  list.innerHTML = "";

  if (!query) {
    status.textContent = "";
    return;
  }

  const results = self.CrucianDictionary.searchDictionary(data, query).slice(0, cap);
  status.textContent = results.length
    ? `${results.length} result${results.length === 1 ? "" : "s"}`
    : `No matches for "${query}"`;

  for (const entry of results) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-btn";
    btn.innerHTML = `<span class="result-word">${escapeHtml(entry.word)}</span><span class="result-def">${escapeHtml(entry.definition || "")}</span>`;
    btn.addEventListener("click", () => showLookupResult(data, entry.word));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function renderSavedList(data) {
  const list = document.getElementById("saved-list");
  const empty = document.getElementById("saved-empty");
  const saved = await self.CrucianStorage.getSaved();
  list.innerHTML = "";
  empty.classList.toggle("hidden", saved.length > 0);

  for (const item of saved) {
    const li = document.createElement("li");
    li.className = "saved-item";

    const wordBtn = document.createElement("button");
    wordBtn.type = "button";
    wordBtn.className = "saved-item-word";
    wordBtn.textContent = item.label;
    wordBtn.addEventListener("click", () => showLookupResult(data, item.id));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "saved-item-remove";
    removeBtn.setAttribute("aria-label", `Remove ${item.label} from saved words`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", async () => {
      await self.CrucianStorage.removeSaved(item.type, item.id);
      renderSavedList(data);
    });

    li.appendChild(wordBtn);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

let currentData = null;

async function init() {
  await initTheme();

  currentData = await self.CrucianDictionary.loadDictionary();
  const { entry } = self.CrucianWotd.wordOfDay(currentData.dictionary);
  renderWotd(entry);
  renderStreak();
  renderSavedList(currentData);

  const input = document.getElementById("search-input");
  input.addEventListener("input", () =>
    renderSearchResults(currentData, input.value, "search-results", "search-status", 40)
  );

  const params = new URLSearchParams(location.search);
  const word = params.get("word");
  if (word) {
    showLookupResult(currentData, word);
  } else {
    input.focus();
  }
}

document.addEventListener("DOMContentLoaded", init);
