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

/* ---------------- Scroll-triggered reveal ----------------
   Only used on static, render-once grids (home teasers, grammar cards).
   Deliberately NOT wired into Dictionary/Proverbs -- those re-render their
   innerHTML on every search keystroke and filter click, and re-hiding
   already-visible cards each time would read as flicker, not polish. */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let revealObserver = null;

function initScrollReveal(root = document) {
  if (prefersReducedMotion) return; // skip the whole system, don't just speed it up
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
  }
  root.querySelectorAll(".reveal-item:not(.in-view)").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 6) * 60}ms`;
    revealObserver.observe(el);
  });
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
  renderSavedDrawer();
  preloadShareFonts();
  initScrollReveal();

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
    const saveBtn = document.getElementById("wotd-save");
    if (saveBtn) {
      saveBtn.dataset.saveId = word.word;
      saveBtn.dataset.saveLabel = word.word;
      const saved = isSaved("dictionary", word.word);
      saveBtn.classList.toggle("saved", saved);
      saveBtn.setAttribute("aria-pressed", String(saved));
      saveBtn.setAttribute("aria-label", saved ? "Remove from saved" : "Save this word");
    }
    const shareBtn = document.getElementById("wotd-share");
    if (shareBtn) {
      shareBtn.dataset.word = word.word;
      shareBtn.dataset.def = word.definition;
    }
  }, 300);

  if (userInitiated) track("wotd_shuffle", { word: word.word });
}

/* ---------------- Navigation ---------------- */

function navTo(id) {
  const valid = ["home", "grammar", "proverbs", "dictionary", "roots"];
  if (!valid.includes(id)) id = "home";
  hideToast();
  document.querySelectorAll(".section-content").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.remove("nav-active");
    b.removeAttribute("aria-current");
  });
  [`btn-${id}`, `mobile-btn-${id}`].forEach((elId) => {
    const targetBtn = document.getElementById(elId);
    if (targetBtn) {
      targetBtn.classList.add("nav-active");
      targetBtn.setAttribute("aria-current", "page");
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  history.replaceState(null, "", `?view=${id}`);
  trackPageview(id);
}

function mobileToggle() {
  const menu = document.getElementById("mobile-menu");
  const btn = document.getElementById("mobile-menu-btn");
  const openIcon = document.getElementById("icon-menu-open");
  const closeIcon = document.getElementById("icon-menu-close");
  const willOpen = menu.classList.contains("hidden");

  menu.classList.toggle("hidden", !willOpen);
  document.body.classList.toggle("overflow-hidden", willOpen);
  btn.setAttribute("aria-expanded", String(willOpen));
  btn.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
  openIcon.classList.toggle("hidden", willOpen);
  closeIcon.classList.toggle("hidden", !willOpen);

  if (willOpen) {
    menu.querySelector(".mobile-nav-btn")?.focus();
  } else {
    btn.focus();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const menu = document.getElementById("mobile-menu");
  if (menu && !menu.classList.contains("hidden")) {
    mobileToggle();
    return;
  }
  const drawer = document.getElementById("saved-drawer");
  if (drawer && !drawer.classList.contains("hidden")) closeSavedDrawer();
});

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
      .map((n) => {
        // Most notes are "Title: explanation" (source docx style); a few
        // (the "deh" bullets) are plain sentences with no title — only
        // split when the colon shows up early enough to actually be one.
        const idx = n.indexOf(":");
        const hasTitle = idx > -1 && idx < 70;
        const title = hasTitle ? n.slice(0, idx).trim() : null;
        const body = hasTitle ? n.slice(idx + 1).trim() : n;
        // Single-letter sound refs ("c or k", "d or t") read as one word at a
        // glance — set each letter off in a monospace chip so they can't fuse.
        const bodyHtml = escapeHtml(body).replace(
          /\b([A-Za-z]) or ([A-Za-z])\b/g,
          '<code class="letter-chip">$1</code> or <code class="letter-chip">$2</code>'
        );
        return `
      <div class="grammar-note-card reveal-item">
        ${title ? `<h4 class="serif text-lg font-bold text-stone-900 mb-2">${escapeHtml(title)}</h4>` : ""}
        <p class="text-sm leading-relaxed font-medium text-stone-600">${bodyHtml}</p>
      </div>`;
      })
      .join("");
  }

  const exEl = document.getElementById("grammar-examples");
  if (exEl) {
    exEl.innerHTML = appData.grammarExamples
      .map(
        (group) => `
      <div class="modern-card reveal-item p-8 bg-white">
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

/* ---------------- Saved / bookmarks (localStorage) ---------------- */

const SAVED_KEY = "crucianSaved";

function getSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSaved(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Couldn't persist saved list:", err);
  }
}

function isSaved(type, id) {
  return getSaved().some((s) => s.type === type && s.id === id);
}

function saveButtonHtml(type, id, label, extraClass = "") {
  const saved = isSaved(type, id);
  return `
    <button type="button" class="copy-btn save-btn ${extraClass} ${saved ? "saved" : ""}"
      data-save-type="${type}" data-save-id="${attrEscape(id)}" data-save-label="${attrEscape(label)}"
      aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save this"}"
      onclick="event.stopPropagation(); handleSaveClick(this)">
      <svg class="icon-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"></path></svg>
    </button>`;
}

function handleSaveClick(btn) {
  const { saveType, saveId, saveLabel } = btn.dataset;
  if (!saveType || !saveId) return;
  toggleSaved(saveType, saveId, saveLabel || saveId);
}

function toggleSaved(type, id, label) {
  const list = getSaved();
  const idx = list.findIndex((s) => s.type === type && s.id === id);
  const nowSaved = idx === -1;
  if (nowSaved) {
    list.push({ type, id, label });
  } else {
    list.splice(idx, 1);
  }
  setSaved(list);
  syncSaveButtons(type, id, nowSaved);
  renderSavedDrawer();
  showToast(nowSaved ? "Saved." : "Removed from saved.");
  track(nowSaved ? "bookmark_add" : "bookmark_remove", { content_type: type, item: label.slice(0, 80) });
}

function syncSaveButtons(type, id, saved) {
  document.querySelectorAll(".save-btn").forEach((btn) => {
    if (btn.dataset.saveType !== type || btn.dataset.saveId !== id) return;
    btn.classList.toggle("saved", saved);
    btn.setAttribute("aria-pressed", String(saved));
    btn.setAttribute("aria-label", saved ? "Remove from saved" : "Save this");
    if (saved) {
      btn.classList.remove("pop");
      void btn.offsetWidth; // force reflow so a rapid re-save restarts the animation
      btn.classList.add("pop");
    }
  });
}

// One delegated listener handles cleanup for every .save-btn, including
// ones rendered after this fires (search re-renders, filter changes).
document.addEventListener("animationend", (e) => {
  if (e.animationName === "heartPop") e.target.classList.remove("pop");
});

function renderSavedDrawer() {
  const saved = getSaved();
  const badge = document.getElementById("saved-badge");
  if (badge) {
    badge.textContent = String(saved.length);
    badge.classList.toggle("hidden", saved.length === 0);
  }

  const list = document.getElementById("saved-list");
  const empty = document.getElementById("saved-empty");
  if (!list) return;

  if (saved.length === 0) {
    list.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  list.innerHTML = saved
    .map(
      (s) => `
    <li class="saved-item">
      <button type="button" class="saved-item-main" data-save-type="${s.type}" data-save-id="${attrEscape(s.id)}" onclick="jumpToSavedFromBtn(this)">
        <span class="saved-item-kind">${s.type === "dictionary" ? "Word" : "Proverb"}</span>
        <span class="saved-item-label">${escapeHtml(s.label)}</span>
      </button>
      <button type="button" class="saved-item-remove" data-save-type="${s.type}" data-save-id="${attrEscape(s.id)}" data-save-label="${attrEscape(s.label)}"
        aria-label="Remove ${escapeHtml(s.label)} from saved" onclick="handleSaveClick(this)">&times;</button>
    </li>`
    )
    .join("");
}

function toggleSavedDrawer() {
  const drawer = document.getElementById("saved-drawer");
  if (!drawer) return;
  if (drawer.classList.contains("hidden")) {
    renderSavedDrawer();
    drawer.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    track("saved_drawer_open");
    drawer.querySelector(".icon-btn")?.focus();
  } else {
    closeSavedDrawer();
  }
}

function closeSavedDrawer() {
  const drawer = document.getElementById("saved-drawer");
  if (!drawer) return;
  drawer.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  document.getElementById("saved-toggle-btn")?.focus();
}

function jumpToSavedFromBtn(btn) {
  jumpToSaved(btn.dataset.saveType, btn.dataset.saveId);
}

function jumpToSaved(type, id) {
  closeSavedDrawer();
  if (type === "dictionary") {
    const searchEl = document.getElementById("main-search");
    if (searchEl) searchEl.value = "";
    const allAlpha = document.querySelector(".alpha-btn");
    if (allAlpha) setActiveAlpha(allAlpha);
    renderDictionary();
    navTo("dictionary");
    highlightCard(".dictionary-card", id);
  } else {
    document.querySelectorAll(".prov-filter").forEach((b) => {
      b.classList.remove("active", "bg-white", "shadow-md");
      b.setAttribute("aria-pressed", "false");
    });
    const allFilter = document.querySelector('.prov-filter[data-type="all"]');
    if (allFilter) {
      allFilter.classList.add("active", "bg-white", "shadow-md");
      allFilter.setAttribute("aria-pressed", "true");
    }
    renderProverbs();
    navTo("proverbs");
    highlightCard(".proverb-card", id);
  }
}

function highlightCard(cardSelector, id) {
  setTimeout(() => {
    const el = [...document.querySelectorAll(cardSelector)].find((c) => c.dataset.itemId === id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("card-flash");
    setTimeout(() => el.classList.remove("card-flash"), 1800);
  }, 60);
}

/* ---------------- Share cards (Canvas-generated PNG) ---------------- */

let shareFontsPreloaded = false;

function preloadShareFonts() {
  if (shareFontsPreloaded || !("fonts" in document)) return;
  shareFontsPreloaded = true;
  ["italic 700 76px Fraunces", "800 26px 'Plus Jakarta Sans'", "500 34px 'Plus Jakarta Sans'", "700 24px 'Plus Jakarta Sans'"].forEach(
    (f) => document.fonts.load(f).catch(() => {})
  );
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawTracked(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

async function buildShareCard({ kicker, headline, body }) {
  const W = 1080;
  const H = 1080;
  const marginX = 96;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  if ("fonts" in document) {
    await Promise.all(
      ["italic 700 76px Fraunces", "800 26px 'Plus Jakarta Sans'", "500 34px 'Plus Jakarta Sans'", "700 24px 'Plus Jakarta Sans'"].map((f) =>
        document.fonts.load(f).catch(() => {})
      )
    );
    await document.fonts.ready;
  }

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1c1917");
  grad.addColorStop(1, "#292524");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(marginX, 88, 56, 56, 16);
  ctx.fill();
  ctx.fillStyle = "#1c1917";
  ctx.font = "800 28px 'Plus Jakarta Sans'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", marginX + 28, 88 + 30);

  // Kicker
  ctx.fillStyle = "#2dd4bf";
  ctx.font = "800 26px 'Plus Jakarta Sans'";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  drawTracked(ctx, kicker.toUpperCase(), marginX, 250, 4);

  // Headline (word or proverb), wrapped
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic 700 76px Fraunces";
  const headLines = wrapCanvasText(ctx, headline, W - marginX * 2);
  let y = 340;
  headLines.forEach((line) => {
    ctx.fillText(line, marginX, y);
    y += 84;
  });

  // Body (definition / meaning)
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 34px 'Plus Jakarta Sans'";
  const bodyLines = wrapCanvasText(ctx, body, W - marginX * 2);
  y += 24;
  bodyLines.forEach((line) => {
    ctx.fillText(line, marginX, y);
    y += 46;
  });

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "700 22px 'Plus Jakarta Sans'";
  const host = location.host && !/^(localhost|127\.0\.0\.1)/.test(location.host) ? `  ·  ${location.host.toUpperCase()}` : "";
  drawTracked(ctx, `CRUCIAN HERITAGE ARCHIVE${host}`, marginX, H - 80, 3);

  return canvas;
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "crucian"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleShareClick(btn) {
  const isWord = btn.id === "wotd-share";
  const kind = isWord ? "word" : "proverb";
  const headline = isWord ? btn.dataset.word : btn.dataset.proverbText;
  const body = isWord ? btn.dataset.def : btn.dataset.proverbMeaning;
  const kicker = isWord ? "Word of the Day" : "Crucian Proverb";

  if (!headline) return;

  const originalLabel = btn.getAttribute("aria-label");
  btn.disabled = true;
  btn.setAttribute("aria-label", "Generating image…");

  try {
    const canvas = await buildShareCard({ kicker, headline: `"${headline}"`, body: body || "" });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Canvas produced no image data");

    const filename = `crucian-${kind}-${slugify(headline)}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Crucian Heritage Archive",
        text: `"${headline}"${body ? " — " + body : ""}`
      });
      track("share_card_share", { content_type: kind });
    } else {
      downloadBlob(blob, filename);
      track("share_card_download", { content_type: kind });
    }
  } catch (err) {
    if (err && err.name !== "AbortError") {
      console.warn("Share card failed:", err);
      showToast("Couldn't create the image — try again.");
    }
  } finally {
    btn.disabled = false;
    btn.setAttribute("aria-label", originalLabel);
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
    <div class="modern-card proverb-card p-10 flex flex-col h-full bg-white" data-item-id="${attrEscape(p.text)}">
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
        <div class="flex items-center gap-2">
          ${saveButtonHtml("proverb", p.text, p.text)}
          ${copyButtonHtml(copyText, "", "proverb")}
          <button type="button" class="copy-btn" data-proverb-text="${attrEscape(p.text)}" data-proverb-meaning="${attrEscape(p.meaning)}"
            aria-label="Share this proverb as an image" onclick="event.stopPropagation(); handleShareClick(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path stroke-linecap="round" d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"></path></svg>
          </button>
        </div>
      </div>
      <p class="serif text-2xl font-bold text-stone-900 mb-4 leading-tight">"${escapeHtml(p.text)}"</p>
      ${p.translation ? `<p class="text-stone-600 text-sm mb-10 font-semibold italic">${escapeHtml(p.translation)}</p>` : "<div class='mb-10'></div>"}
      <div class="mt-auto pt-8 border-t border-stone-100">
        <p class="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-2">Meaning</p>
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
    <div class="modern-card dictionary-card p-8 pb-16 relative group hover:bg-stone-50 transition-all border border-transparent" data-item-id="${attrEscape(item.word)}">
      <div class="flex items-start justify-between gap-4 mb-2">
        <div>
          <h4 class="text-2xl font-black text-stone-900 group-hover:text-teal-700 transition-colors mb-2">${escapeHtml(item.word)}</h4>
          <p class="text-stone-700 font-medium text-sm leading-relaxed">${escapeHtml(item.definition)}</p>
        </div>
        <span class="shrink-0 text-[9px] font-black uppercase tracking-widest bg-stone-100/60 text-stone-600 px-3 py-1 rounded-lg">
          ${escapeHtml(item.origin)}
        </span>
      </div>
      ${item.pronunciation ? `<p class="text-xs text-stone-500 italic font-mono mt-3">/${escapeHtml(item.pronunciation)}/</p>` : ""}
      ${item.altSpellings ? `<p class="text-xs text-stone-500 mt-2"><span class="font-bold">Also:</span> ${escapeHtml(item.altSpellings)}</p>` : ""}
      ${item.example ? `<p class="text-xs text-stone-500 mt-2 italic">${escapeHtml(item.example)}</p>` : ""}
      <div class="absolute bottom-4 right-4 flex items-center gap-2">
        ${saveButtonHtml("dictionary", item.word, item.word)}
        ${copyButtonHtml(copyText, "", "dictionary")}
      </div>
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

function hideToast() {
  const el = document.getElementById("toast");
  if (!el) return;
  clearTimeout(toastTimer);
  el.classList.remove("show");
}

window.addEventListener("DOMContentLoaded", init);
