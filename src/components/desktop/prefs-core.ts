// Desktop preferences (pepodev.desktopPrefs): reading them with their
// defaults and applying them to <html>. The parse-time preferences script
// (DesktopScripts.tsx, before first paint) and the preferences store
// (prefs.ts, after hydration) run these same functions; the script inlines
// them with Function#toString, so each must stay self-contained (only its
// parameters, no imports or module-level names).

export interface DesktopPrefs {
  /** "dark" or "light". */
  theme: string;
  /** A key of accentMap (src/utils/desktop-prefs.ts). */
  accent: string;
  /** A key of backgroundMap; a missing one follows the theme. */
  background: string;
  /** Window corner radius in px. */
  radius: number;
  /** Window glass opacity in percent. */
  glass: number;
  backgroundEffect: boolean;
  windowGlass: boolean;
  /** A key of experienceMap: the desktop's look (macOS, Windows, Linux). */
  experience: string;
  /** One of the experience's variants (experienceVariants). */
  variant: string;
}

export const PREFS_KEY = "pepodev.desktopPrefs";
/** A mirror of desktopPrefs.theme, read when the preferences have no theme. */
export const THEME_KEY = "pepodev.theme";

/**
 * The saved preferences over the defaults. A missing or unknown background
 * follows the theme ("cloud" when light, else "network"), so a light theme
 * never starts on a dark background. An unknown experience is the default
 * one, and an unknown variant its experience's first.
 */
export function loadDesktopPrefs(
  storage: Storage | null | undefined,
  backgrounds: Record<string, unknown>,
  experiences: Record<string, string[]>,
): DesktopPrefs {
  let theme = "dark";
  let saved: Partial<DesktopPrefs> = {};
  try {
    theme = storage?.getItem("pepodev.theme") || "dark";
    saved = JSON.parse(storage?.getItem("pepodev.desktopPrefs") || "{}") || {};
  } catch {
    // Corrupt or unavailable storage: the defaults apply.
  }
  const prefs = {
    theme,
    accent: "green",
    background: "",
    radius: 6,
    glass: 55,
    backgroundEffect: true,
    windowGlass: true,
    experience: "pepodev",
    variant: "",
    ...saved,
  };
  if (!Object.prototype.hasOwnProperty.call(backgrounds, prefs.background)) {
    prefs.background = prefs.theme === "light" ? "cloud" : "network";
  }
  if (!Object.prototype.hasOwnProperty.call(experiences, prefs.experience)) prefs.experience = "pepodev";
  const variants = experiences[prefs.experience] || [];
  if (variants.indexOf(prefs.variant) < 0) prefs.variant = variants[0] || "";
  return prefs;
}

/**
 * Applies preferences to <html>: data-theme, data-background-effect,
 * data-window-glass, data-experience, data-experience-variant and the
 * accent, radius, glass and background variables.
 */
export function applyDesktopPrefs(
  root: HTMLElement,
  prefs: DesktopPrefs,
  accents: Record<string, { primary: string; secondary: string }>,
  backgrounds: Record<string, { bg: string; primary: string; secondary: string }>,
) {
  const accent = accents[prefs.accent] || accents.green;
  const background = backgrounds[prefs.background] || backgrounds.network;
  const style = root.style;
  root.setAttribute("data-theme", prefs.theme);
  style.setProperty("--accent-primary", accent.primary);
  style.setProperty("--accent-secondary", accent.secondary);
  // The older accent variables some app styles still read.
  style.setProperty("--accent-green", accent.primary);
  style.setProperty("--accent-cyan", accent.secondary);
  style.setProperty("--window-radius", prefs.radius + "px");
  style.setProperty(
    "--glass-bg",
    "rgba(" +
      (prefs.theme === "light" ? "255, 255, 255" : "44, 44, 46") +
      ", " +
      prefs.glass / 100 +
      ")",
  );
  style.setProperty("--desktop-bg-color", background.bg);
  style.setProperty("--particle-primary-rgb", background.primary);
  style.setProperty("--particle-secondary-rgb", background.secondary);
  root.setAttribute("data-background-effect", prefs.backgroundEffect ? "on" : "off");
  root.setAttribute("data-window-glass", prefs.windowGlass ? "on" : "off");
  root.setAttribute("data-experience", prefs.experience);
  root.setAttribute("data-experience-variant", prefs.variant);
}
