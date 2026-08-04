/* Crucian Heritage Archive — application logic.
   Loads data/dictionary.json (parsed from the source docx), renders every
   section, and wires up search, filters, dark mode, install prompt, and the
   service worker. */

const ORIGIN_COLORS = {
  "West African": "#0d9488",
  "English/Irish": "#57534e",
  "Danish": "#c2410c",
  "Dutch Creole": "#ea580c",
  "Spanish": "#3b82f6",
  "French": "#8b5cf6",
  "Rastafarian": "#16a34a",
  "Amerindian": "#ca8a04",
  "Local / Undetermined": "#d1d5db"
};

let appData = null;
let dictSort = "az"; // az | origin

/* ---------------- Analytics (GA4) ----------------
   gtag() is defined inline in index.html's <head> regardless of whether the
   remote googletagmanager.com script actually loads (ad blockers etc.), so
   these calls are safe no-ops rather than throwing when analytics is blocked. */

function track(name, params = {}) {
  if (typeof gtag === "function") gtag("event", name, params);
}

const VIEW_TITLES = {
  home: "Home",
  grammar: "Grammar & Phonetics",
  proverbs: "Oral History",
  dictionary: "Interactive Glossary",
  roots: "Etymological Map"
};

function trackPageview(viewId) {
  if (typeof gtag !== "function") return;
  gtag("event", "page_view", {
    page_title: `Crucian Heritage Archive — ${VIEW_TITLES[viewId] || viewId}`,
    page_location: location.href,
    page_path: location.pathname + location.search
  });
}

/* ---------------- Data loading ---------------- */

async function loadData() {
  const res = await fetch("./data/dictionary.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load dictionary data");
  return res.json();
}

/* ---------------- Init ---------------- */

async function init() {
  try {
    appData = await loadData();
  } catch (err) {
    console.error(err);
    showToast("Couldn't load the archive data — check your connection.");
    return;
  }

  renderPronouns();
  renderProverbs();
  renderDictionary();
  renderAlphaNav();
  renderGrammar();
  initChart();
  randomizeWotd();

  const params = new URLSearchParams(location.search);
  navTo(params.get("view") || "home");

  initTheme();
  initInstallPrompt();
  registerServiceWorker();
}

/* ---------------- Word of the Day ---------------- */

function randomizeWotd(userInitiated = false) {
  const word = appData.dictionary[Math.floor(Math.random() * appData.dictionary.length)];
  const wordEl = document.getElementById("wotd-word");
  const defEl = document.getElementById("wotd-def");

  wordEl.style.opacity = 0;
  defEl.style.opacity = 0;

  setTimeout(() => {
    wordEl.innerText = word.word;
    defEl.innerText = word.definition;
    wordEl.style.opacity = 1;
    defEl.style.opacity = 1;
    const copyBtn = document.getElementById("wotd-copy");
    if (copyBtn) copyBtn.dataset.copyText = `${word.word} — ${word.definition}`;
  }, 300);

  if (userInitiated) track("wotd_shuffle", { word: word.word });
}

/* ---------------- Navigation ---------------- */

function navTo(id) {
  const valid = ["home", "grammar", "proverbs", "dictionary", "roots"];
  if (!valid.includes(id)) id = "home";
  document.querySelectorAll(".section-content").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.remove("nav-active");
    b.removeAttribute("aria-current");
  });
  const targetBtn = document.getElementById(`btn-${id}`);
  if (targetBtn) {
    targetBtn.classList.add("nav-active");
    targetBtn.setAttribute("aria-current", "page");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  history.replaceState(null, "", `?view=${id}`);
  trackPageview(id);
}

function mobileToggle() {
  document.getElementById("mobile-menu").classList.toggle("hidden");
}

/* ---------------- Suggest a word (accordion + form) ---------------- */

function toggleSuggest(forceOpen) {
  const panel = document.getElementById("suggest-panel");
  const icon = document.getElementById("suggest-icon");
  const btn = document.getElementById("suggest-toggle");
  if (!panel || !icon || !btn) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !shouldOpen);
  icon.textContent = shouldOpen ? "−" : "+";
  btn.setAttribute("aria-expanded", String(shouldOpen));
}

async function handleSuggestSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const endpoint = form.getAttribute("action") || "";

  if (!endpoint) {
    showToast("Suggestion form isn't connected yet — check back soon.");
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    });
    // Web3Forms returns HTTP 200 with a JSON { success: false, ... } body on
    // validation errors, so a non-erroring fetch isn't proof it worked.
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Submission failed (${res.status})`);
    }
    showToast("Thanks — your suggestion was submitted.");
    track("generate_lead", { method: "web3forms" });
    form.reset();
    toggleSuggest(false);
  } catch (err) {
    console.warn("Suggestion submit failed:", err);
    showToast("Couldn't submit — try again, or use the GitHub Issue link below.");
    track("form_submit_error", { method: "web3forms", message: String(err.message || err).slice(0, 100) });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/* ---------------- Pronouns ---------------- */

function renderPronouns() {
  document.getElementById("pronoun-body").innerHTML = appData.pronouns
    .map(
      (p) => `
    <tr class="hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
      <td class="py-6 font-medium text-stone-500">${p.person}</td>
      <td class="py-6 text-teal-700">${p.subject}</td>
      <td class="py-6 text-stone-800">${p.object}</td>
      <td class="py-6 text-stone-800">${p.possessive}</td>
      <td class="py-6 text-stone-600 font-semibold italic">${p.reflexive}</td>
    </tr>`
    )
    .join("");
}

/* ---------------- Grammar & phonetics ---------------- */

function renderGrammar() {
  const notesEl = document.getElementById("grammar-notes");
  if (notesEl) {
    notesEl.innerHTML = appData.grammarNotes
      .map(
        (n) => `
      <div class="grammar-note-card">
        <p class="text-sm leading-relaxed font-medium text-stone-700">${escapeHtml(n)}</p>
      </div>`
      )
      .join("");
  }

  const exEl = document.getElementById("grammar-examples");
  if (exEl) {
    exEl.innerHTML = appData.grammarExamples
      .map(
        (group) => `
      <div class="modern-card p-8 bg-white">
        <h4 class="serif text-xl font-bold mb-6 text-stone-900">${escapeHtml(group.group)}</h4>
        ${group.pairs
          .map(
            (pair) => `
          <div class="example-pair">
            <p class="crucian">${escapeHtml(pair.crucian)}</p>
            ${pair.standard ? `<p class="standard">${escapeHtml(pair.standard)}</p>` : ""}
          </div>`
          )
          .join("")}
      </div>`
      )
      .join("");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function attrEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------------- Copy to clipboard ---------------- */

function copyButtonHtml(text, extraClass = "", contentType = "dictionary") {
  return `
    <button type="button" class="copy-btn ${extraClass}" data-copy-text="${attrEscape(text)}" data-content-type="${contentType}"
      aria-label="Copy to clipboard" onclick="event.stopPropagation(); handleCopyClick(this)">
      <svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 012-2h10"></path></svg>
      <svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
    </button>`;
}

function handleCopyClick(btn) {
  copyToClipboard(btn.dataset.copyText, btn, btn.dataset.contentType || "unknown");
}

async function copyToClipboard(text, btn, contentType = "unknown") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("Copied to clipboard.");
    track("copy_text", { content_type: contentType, item: text.slice(0, 80) });
    if (btn) {
      btn.classList.add("copied");
      btn.setAttribute("aria-label", "Copied");
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => {
        btn.classList.remove("copied");
        btn.setAttribute("aria-label", "Copy to clipboard");
      }, 1600);
    }
  } catch (err) {
    console.warn("Copy failed:", err);
    showToast("Couldn't copy — try selecting the text.");
  }
}

/* ---------------- Proverbs ---------------- */

function renderProverbs() {
  const grid = document.getElementById("proverb-grid");
  const currentFilter = document.querySelector(".prov-filter.active").dataset.type;
  const filtered =
    currentFilter === "all" ? appData.proverbs : appData.proverbs.filter((p) => p.category === currentFilter);

  grid.innerHTML = filtered
    .map((p) => {
      const copyText = [p.text, p.translation, p.meaning].filter(Boolean).join(" — ");
      return `
    <div class="modern-card p-10 flex flex-col h-full bg-white">
      <div class="mb-6 flex items-start justify-between gap-3">
        <span class="text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ${
          p.category === "Advice"
            ? "bg-teal-50 text-teal-800"
            : p.category === "Warnings"
            ? "bg-orange-50 text-orange-800"
            : "bg-stone-100 text-stone-700"
        }">
          ${p.category}
        </span>
        ${copyButtonHtml(copyText, "", "proverb")}
      </div>
      <p class="serif text-2xl font-bold text-stone-900 mb-4 leading-tight">"${escapeHtml(p.text)}"</p>
      ${p.translation ? `<p class="text-stone-600 text-sm mb-10 font-semibold italic">${escapeHtml(p.translation)}</p>` : "<div class='mb-10'></div>"}
      <div class="mt-auto pt-8 border-t border-stone-100">
        <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">Meaning</p>
        <p class="text-stone-800 text-sm font-semibold leading-relaxed">${escapeHtml(p.meaning)}</p>
      </div>
    </div>`;
    })
    .join("");
}

function filterProverbs(cat) {
  document.querySelectorAll(".prov-filter").forEach((b) => {
    b.classList.remove("active", "bg-white", "shadow-md");
    b.setAttribute("aria-pressed", "false");
    if (b.dataset.type === cat) {
      b.classList.add("active", "bg-white", "shadow-md");
      b.setAttribute("aria-pressed", "true");
    }
  });
  renderProverbs();
  track("filter_proverbs", { category: cat });
}

/* ---------------- Dictionary ---------------- */

function renderDictionary(data = appData.dictionary) {
  const results = document.getElementById("dictionary-results");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("result-count");

  if (count) count.textContent = `${data.length} of ${appData.dictionary.length} terms`;

  if (data.length === 0) {
    results.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  results.innerHTML = data
    .map((item) => {
      const copyText = `${item.word} — ${item.definition}`;
      return `
    <div class="modern-card p-8 pb-16 relative group hover:bg-stone-50 transition-all border border-transparent">
      <div class="flex items-start justify-between gap-4 mb-2">
        <div>
          <h4 class="text-2xl font-black text-stone-900 group-hover:text-teal-700 transition-colors mb-2">${escapeHtml(item.word)}</h4>
          <p class="text-stone-700 font-medium text-sm leading-relaxed">${escapeHtml(item.definition)}</p>
        </div>
        <span class="shrink-0 text-[9px] font-black uppercase tracking-widest bg-stone-100/60 text-stone-600 px-3 py-1 rounded-lg">
          ${escapeHtml(item.origin)}
        </span>
      </div>
      ${item.pronunciation ? `<p class="text-xs text-stone-400 italic font-mono mt-3">/${escapeHtml(item.pronunciation)}/</p>` : ""}
      ${item.altSpellings ? `<p class="text-xs text-stone-500 mt-2"><span class="font-bold">Also:</span> ${escapeHtml(item.altSpellings)}</p>` : ""}
      ${item.example ? `<p class="text-xs text-stone-500 mt-2 italic">${escapeHtml(item.example)}</p>` : ""}
      ${copyButtonHtml(copyText, "absolute bottom-4 right-4", "dictionary")}
    </div>`;
    })
    .join("");
}

function renderAlphaNav() {
  const nav = document.getElementById("alpha-nav");
  // Only render letters that actually have entries — no dead/disabled
  // buttons taking up space, and it self-updates as the glossary grows.
  const present = [
    ...new Set(appData.dictionary.map((i) => i.word.replace(/[^a-zA-Z]/g, "").charAt(0).toUpperCase()))
  ]
    .filter(Boolean)
    .sort();

  nav.innerHTML = `
    <button onclick="renderDictionary(); setActiveAlpha(this)" class="alpha-btn active shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all" aria-pressed="true">All</button>
    ${present
      .map(
        (l) =>
          `<button onclick="filterByAlpha('${l}', this)" class="alpha-btn shrink-0 w-10 h-10 rounded-xl text-[10px] font-black transition-all text-stone-500 hover:bg-white hover:shadow-sm" aria-pressed="false">${l}</button>`
      )
      .join("")}
  `;
}

function setActiveAlpha(btn) {
  document.querySelectorAll(".alpha-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  btn.classList.add("active");
  btn.setAttribute("aria-pressed", "true");
}

function filterByAlpha(l, btn) {
  setActiveAlpha(btn);
  const filtered = appData.dictionary.filter((i) => i.word.toUpperCase().startsWith(l));
  renderDictionary(filtered);
  document.getElementById("main-search").value = "";
  track("filter_alpha", { letter: l, results_count: filtered.length });
}

let searchTrackTimer = null;

function handleSearch() {
  const query = document.getElementById("main-search").value.toLowerCase().trim();
  document.querySelectorAll(".alpha-btn").forEach((b) => b.classList.remove("active"));
  if (!query) {
    document.querySelector(".alpha-btn").classList.add("active");
    renderDictionary();
    clearTimeout(searchTrackTimer);
    return;
  }
  const filtered = appData.dictionary.filter(
    (i) =>
      i.word.toLowerCase().includes(query) ||
      i.definition.toLowerCase().includes(query) ||
      i.origin.toLowerCase().includes(query) ||
      (i.altSpellings && i.altSpellings.toLowerCase().includes(query))
  );
  renderDictionary(filtered);

  // Debounced so we send one event per pause-in-typing, not one per keystroke.
  clearTimeout(searchTrackTimer);
  searchTrackTimer = setTimeout(() => {
    track("search", { search_term: query, results_count: filtered.length });
    if (filtered.length === 0) track("search_no_results", { search_term: query });
  }, 800);
}

/* ---------------- Origins chart ---------------- */

let originsChartInstance = null;

function initChart() {
  const canvas = document.getElementById("originsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const legend = document.getElementById("chart-legend");

  const total = appData.origins.values.reduce((a, b) => a + b, 0);
  const colors = appData.origins.labels.map((l) => ORIGIN_COLORS[l] || ORIGIN_COLORS["Local / Undetermined"]);
  const percents = appData.origins.values.map((v) => Math.round((v / total) * 1000) / 10);

  legend.innerHTML = appData.origins.labels
    .map(
      (l, i) => `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-3 h-3 rounded-full" style="background:${colors[i]}"></div>
        <span class="font-bold text-stone-700 text-sm">${l}</span>
      </div>
      <span class="text-stone-500 font-mono text-xs font-bold">${percents[i]}%</span>
    </div>`
    )
    .join("");

  if (originsChartInstance) originsChartInstance.destroy();
  originsChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: appData.origins.labels,
      datasets: [
        {
          data: appData.origins.values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 2,
          borderAlign: "inner",
          hoverOffset: 10,
          borderRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "78%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1c1917",
          padding: 16,
          cornerRadius: 15,
          displayColors: false,
          titleFont: { size: 14, weight: "bold" },
          bodyFont: { size: 12 },
          callbacks: {
            label: (item) => `${item.label}: ${item.raw} words`
          }
        }
      }
    }
  });
}

/* ---------------- Dark mode ---------------- */

function initTheme() {
  const stored = localStorage.getItem("crucian-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);

  const btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", toggleTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("crucian-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  const sun = document.getElementById("icon-sun");
  const moon = document.getElementById("icon-moon");
  if (sun && moon) {
    sun.classList.toggle("hidden", theme !== "dark");
    moon.classList.toggle("hidden", theme === "dark");
  }
  if (originsChartInstance) initChart();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  track("theme_toggle", { theme: next });
}

/* ---------------- Install prompt (PWA) ---------------- */

let deferredInstallPrompt = null;

function initInstallPrompt() {
  const btn = document.getElementById("install-btn");
  if (!btn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.classList.add("visible");
  });

  btn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    track("install_click");
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    showToast(choice.outcome === "accepted" ? "Archive installed. Aiight!" : "Maybe next time.");
    track("pwa_install_prompt_outcome", { outcome: choice.outcome });
    deferredInstallPrompt = null;
    btn.classList.remove("visible");
  });

  window.addEventListener("appinstalled", () => {
    btn.classList.remove("visible");
    showToast("Archive installed to your home screen.");
    track("pwa_installed");
  });
}

/* ---------------- Service worker ---------------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });

  window.addEventListener("online", () => {
    showToast("Back online.");
    track("connectivity_change", { status: "online" });
  });
  window.addEventListener("offline", () => {
    showToast("You're offline — cached content still works.");
    track("connectivity_change", { status: "offline" });
  });
}

/* ---------------- Toast ---------------- */

let toastTimer = null;
function showToast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

window.addEventListener("DOMContentLoaded", init);
