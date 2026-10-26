// Desktop preferences (theme, accent, background, radius, glass, background
// effect, window glass, experience and variant), saved in
// pepodev.desktopPrefs with the theme mirrored in pepodev.theme. The
// parse-time script in DesktopScripts.tsx applies them before first paint;
// this store owns them after hydration.
// Every change applies them to <html> (prefs-core.ts), saves them and
// dispatches desktop:preferences ({ detail: prefs }) on document. The
// command palette's Toggle Theme dispatches desktop:toggle-theme, which
// lands here, so Settings and the palette apply the same preferences.
import { accentMap, backgroundMap, experienceVariants } from "@utils/desktop-prefs";
import { applyDesktopPrefs, loadDesktopPrefs, PREFS_KEY, THEME_KEY, type DesktopPrefs } from "./prefs-core";
import { createStore, useStore } from "./store";

export type { DesktopPrefs } from "./prefs-core";

/** null until the desktop boots. */
export const prefsStore = createStore<DesktopPrefs | null>(null);

export function useDesktopPrefs(): DesktopPrefs | null {
  return useStore(prefsStore, (prefs) => prefs);
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The saved preferences over the defaults, read from storage now. */
export function readDesktopPrefs(): DesktopPrefs {
  return loadDesktopPrefs(storage(), backgroundMap, experienceVariants);
}

export function getDefaultBackground(theme: string): string {
  return theme === "light" ? "cloud" : "network";
}

/** Applies, saves and announces a complete set of preferences. */
export function setDesktopPrefs(prefs: DesktopPrefs) {
  applyDesktopPrefs(document.documentElement, prefs, accentMap, backgroundMap);
  try {
    localStorage.setItem(THEME_KEY, prefs.theme);
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // The preferences still apply for this page.
  }
  prefsStore.set(prefs);
  document.dispatchEvent(new CustomEvent("desktop:preferences", { detail: prefs }));
}

/**
 * Changes some preferences. A new theme starts on its own default
 * background, and a new experience on its default variant, unless the
 * change names one.
 */
export function updateDesktopPrefs(change: Partial<DesktopPrefs>) {
  const current = prefsStore.get() ?? readDesktopPrefs();
  const next = { ...current, ...change };
  if (change.theme !== undefined && change.theme !== current.theme && change.background === undefined) {
    next.background = getDefaultBackground(next.theme);
  }
  if (change.experience !== undefined && change.experience !== current.experience && change.variant === undefined) {
    next.variant = experienceVariants[next.experience]?.[0] ?? "";
  }
  setDesktopPrefs(next);
}

/** Switches between the dark and light theme (each on its default background). */
export function toggleTheme() {
  const current = prefsStore.get() ?? readDesktopPrefs();
  updateDesktopPrefs({ theme: current.theme === "light" ? "dark" : "light" });
}

const onToggleTheme = () => toggleTheme();

/**
 * Boots the preferences: applies and saves them with their defaults (as
 * Settings did on load), and handles desktop:toggle-theme.
 */
export function startPrefs(): () => void {
  setDesktopPrefs(readDesktopPrefs());
  document.addEventListener("desktop:toggle-theme", onToggleTheme);
  return () => document.removeEventListener("desktop:toggle-theme", onToggleTheme);
}
