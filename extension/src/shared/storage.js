/**
 * chrome.storage.sync wrappers for saved words and the daily streak.
 *
 * Deliberately a separate store from the PWA's localStorage "crucianSaved"
 * bookmarks (key name below is different on purpose) — an installed
 * extension cannot read a website's localStorage or vice versa, so there's
 * no way to unify these automatically. Discussed and confirmed 2026-08-06:
 * keep them separate for now; a unified list would need an account/backend
 * layer, out of scope for this build. The {type, id, label} shape below
 * mirrors the PWA's saved-item shape purely for internal consistency, not
 * because the two lists are linked.
 *
 * chrome.storage.sync quotas: 100KB total, 8KB per item, 512 items. A
 * personal saved-words list stored as one JSON array under one key is
 * nowhere near either ceiling in practice, but if this ever needs to hold
 * thousands of entries, split it into multiple keys.
 */

const SAVED_KEY = "crucianExtSaved";
const STREAK_KEY = "crucianExtStreak";

async function getSaved() {
  const result = await chrome.storage.sync.get(SAVED_KEY);
  const list = result[SAVED_KEY];
  return Array.isArray(list) ? list : [];
}

async function isSaved(type, id) {
  const list = await getSaved();
  return list.some((item) => item.type === type && item.id === id);
}

async function toggleSaved(type, id, label) {
  const list = await getSaved();
  const idx = list.findIndex((item) => item.type === type && item.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({ type, id, label });
  }
  await chrome.storage.sync.set({ [SAVED_KEY]: list });
  return idx < 0; // true if it was just saved, false if just removed
}

async function removeSaved(type, id) {
  const list = await getSaved();
  const next = list.filter((item) => !(item.type === type && item.id === id));
  await chrome.storage.sync.set({ [SAVED_KEY]: next });
}

async function getStreak() {
  const result = await chrome.storage.sync.get(STREAK_KEY);
  return result[STREAK_KEY] || { count: 0, lastDayKey: null };
}

/**
 * Call once per popup/view open. Increments the streak if the user was
 * also here yesterday, resets to 1 if they missed a day (or this is the
 * first visit ever), and leaves it untouched if they've already been
 * counted today (so opening the popup five times today doesn't inflate it).
 */
async function recordVisit() {
  const { dayKey, yesterdayKey } = self.CrucianWotd;
  const today = dayKey();
  const streak = await getStreak();

  let next;
  if (streak.lastDayKey === today) {
    next = streak;
  } else if (streak.lastDayKey === yesterdayKey()) {
    next = { count: streak.count + 1, lastDayKey: today };
  } else {
    next = { count: 1, lastDayKey: today };
  }

  await chrome.storage.sync.set({ [STREAK_KEY]: next });
  return next;
}

self.CrucianStorage = { getSaved, isSaved, toggleSaved, removeSaved, getStreak, recordVisit };
