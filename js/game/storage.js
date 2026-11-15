const KEY = "missionforge.progress.v1";
const MAX_ATTEMPTS = 20;

let override;

export function useStorage(store) {
  override = store;
}

function getStore() {
  if (override !== undefined) return override;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function emptyProgress() {
  return { best: 0, achievements: [], lastDesign: null, attempts: [] };
}

export function loadProgress() {
  const empty = emptyProgress();
  try {
    const store = getStore();
    if (!store) return empty;
    const raw = store.getItem(KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw);
    return {
      best: typeof p.best === "number" && Number.isFinite(p.best) ? p.best : 0,
      achievements: Array.isArray(p.achievements)
        ? p.achievements.filter((x) => typeof x === "string")
        : [],
      lastDesign:
        p.lastDesign && typeof p.lastDesign === "object" ? p.lastDesign : null,
      attempts: Array.isArray(p.attempts)
        ? p.attempts.slice(-MAX_ATTEMPTS)
        : [],
    };
  } catch {
    return empty;
  }
}

export function saveProgress(progress) {
  try {
    const store = getStore();
    if (!store) return false;
    store.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function recordAttempt(progress, attempt, unlockedIds = []) {
  const p = progress || emptyProgress();
  return {
    best: Math.max(p.best || 0, attempt.score || 0),
    achievements: [...new Set([...(p.achievements || []), ...unlockedIds])],
    lastDesign: attempt.designSummary || p.lastDesign || null,
    attempts: [...(p.attempts || []), attempt].slice(-MAX_ATTEMPTS),
  };
}
