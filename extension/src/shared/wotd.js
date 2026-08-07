/**
 * Deterministic "pick of the day," seeded from the local calendar date —
 * used for both the word of the day and the proverb ("did you know") card.
 *
 * This is intentionally different from the PWA: webapp/js/app.js picks a
 * fresh random word on every load and on every "New Random Word" click
 * (see randomizeWotd() there) — there's no concept of a stable "today's
 * word" in the PWA today. Deliberate, discussed choice (2026-08-06): the
 * two surfaces show independent words, so this file's output will not
 * match whatever the PWA happens to be showing at the same moment.
 */

function dayKey(date = new Date()) {
  // Local calendar day, not UTC — "today" should match the user's clock,
  // not flip over at midnight UTC while it's still yesterday evening locally.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yesterdayKey(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

// djb2 — small, deterministic, no dependency. We only need a stable,
// well-distributed index into small arrays (216 words / 78 proverbs), not
// cryptographic strength.
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * `salt` decorrelates two picks made from the same day-key against
 * different arrays (word vs. proverb) so they don't happen to land on
 * matching indices by coincidence.
 */
function pickOfDay(items, date = new Date(), salt = "") {
  const key = dayKey(date);
  const index = hashString(key + salt) % items.length;
  return { item: items[index], dayKey: key };
}

function wordOfDay(dictionaryEntries, date = new Date()) {
  const { item, dayKey: dk } = pickOfDay(dictionaryEntries, date, ":word");
  return { entry: item, dayKey: dk };
}

function proverbOfDay(proverbs, date = new Date()) {
  const { item, dayKey: dk } = pickOfDay(proverbs, date, ":proverb");
  return { entry: item, dayKey: dk };
}

/**
 * Picks one origin label from data.origins (the same {labels, values}
 * distribution behind the PWA's roots/heritage doughnut chart) and returns
 * its share of the 216-word glossary. Used to alternate the did-you-know
 * card between a proverb fact and a heritage fact — see popup.js.
 */
function originFactOfDay(origins, date = new Date()) {
  const total = origins.values.reduce((a, b) => a + b, 0);
  const { item: index, dayKey: dk } = pickOfDay(origins.labels.map((_, i) => i), date, ":origin");
  const label = origins.labels[index];
  const value = origins.values[index];
  const percent = Math.round((value / total) * 1000) / 10;
  return { label, value, total, percent, dayKey: dk };
}

/**
 * Deterministic ~50/50 choice of which did-you-know type to show today —
 * same hash mechanism, different salt again, so it doesn't correlate with
 * either the word or proverb pick.
 */
function didYouKnowTypeOfDay(date = new Date()) {
  const key = dayKey(date);
  return hashString(key + ":dyk-type") % 2 === 0 ? "proverb" : "heritage";
}

self.CrucianWotd = {
  dayKey,
  yesterdayKey,
  pickOfDay,
  wordOfDay,
  proverbOfDay,
  originFactOfDay,
  didYouKnowTypeOfDay,
};
