// Snake's best score in storage (pepodev.snake.best.v2). Kept apart from
// the game so the desktop's boot can drop the old key on every page load
// (README: "The old `pepodev.snake.best` is removed on load") without
// loading the Snake body: runtime.tsx calls migrateLegacySnakeBest().

export const BEST_KEY = "pepodev.snake.best.v2";
// The old key was seeded with a made-up best of 170, so only a higher value
// there is a real score worth carrying over.
const LEGACY_BEST_KEY = "pepodev.snake.best";
const LEGACY_SEED_BEST = 170;

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // The score still counts for this page.
  }
}

/** Removes the old key, carrying a real score over when there is no new one. */
export function migrateLegacySnakeBest() {
  const legacy = readStorage(LEGACY_BEST_KEY);
  if (legacy === null) return;
  writeStorage(LEGACY_BEST_KEY, null);
  const legacyBest = Number.parseInt(legacy || "0", 10) || 0;
  if (legacyBest > LEGACY_SEED_BEST && !readStorage(BEST_KEY)) {
    writeStorage(BEST_KEY, String(legacyBest));
  }
}

/** The saved best (after the same migration, in case the boot could not run it). */
export function loadBest() {
  migrateLegacySnakeBest();
  return Number.parseInt(readStorage(BEST_KEY) || "0", 10) || 0;
}

export function saveBest(best: number) {
  writeStorage(BEST_KEY, String(best));
}
