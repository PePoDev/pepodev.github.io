/**
 * Desktop accent and background colours, keyed by the ids Settings saves in
 * pepodev.desktopPrefs. The <head> theme script (HomeHeadScripts.tsx, which
 * inlines them with scriptValue) and SettingsApp read them from here, so
 * every script applies the same values. A missing background follows the
 * theme: "cloud" when light, else "network".
 */
export const accentMap: Record<
  string,
  { primary: string; secondary: string }
> = {
  green: { primary: "#30d158", secondary: "#64d2ff" },
  cyan: { primary: "#64d2ff", secondary: "#30d158" },
  purple: { primary: "#bf5af2", secondary: "#64d2ff" },
  amber: { primary: "#ff9f0a", secondary: "#64d2ff" },
};

export const backgroundMap: Record<
  string,
  { bg: string; primary: string; secondary: string }
> = {
  network: {
    bg: "#0a0e17",
    primary: "34, 197, 94",
    secondary: "6, 182, 212",
  },
  aurora: {
    bg: "#07111f",
    primary: "20, 184, 166",
    secondary: "168, 85, 247",
  },
  midnight: {
    bg: "#101018",
    primary: "99, 102, 241",
    secondary: "14, 165, 233",
  },
  ember: {
    bg: "#170d0a",
    primary: "245, 158, 11",
    secondary: "239, 68, 68",
  },
  ocean: {
    bg: "#0a1420",
    primary: "0, 191, 255",
    secondary: "64, 224, 208",
  },
  glacier: {
    bg: "#0f1419",
    primary: "176, 224, 230",
    secondary: "127, 255, 212",
  },
  void: {
    bg: "#0d0d0f",
    primary: "147, 112, 219",
    secondary: "100, 149, 237",
  },
  neon: {
    bg: "#1a0b2e",
    primary: "255, 20, 147",
    secondary: "0, 255, 255",
  },
  plasma: {
    bg: "#0e0520",
    primary: "138, 43, 226",
    secondary: "30, 144, 255",
  },
  storm: {
    bg: "#1c1c24",
    primary: "224, 255, 255",
    secondary: "70, 130, 180",
  },
  matrix: {
    bg: "#0d0208",
    primary: "0, 255, 65",
    secondary: "50, 205, 50",
  },
  sakura: {
    bg: "#1a0f1f",
    primary: "255, 183, 197",
    secondary: "221, 160, 221",
  },
  forest: {
    bg: "#0a1409",
    primary: "34, 139, 34",
    secondary: "124, 252, 0",
  },
  sunset: {
    bg: "#1f1108",
    primary: "255, 140, 0",
    secondary: "255, 105, 180",
  },
  copper: {
    bg: "#18100d",
    primary: "184, 115, 51",
    secondary: "205, 127, 50",
  },
  // Light theme backgrounds
  cloud: {
    bg: "#f0f4f8",
    primary: "100, 149, 237",
    secondary: "135, 206, 235",
  },
  daylight: {
    bg: "#fef9e7",
    primary: "255, 193, 7",
    secondary: "255, 152, 0",
  },
  mint: {
    bg: "#f0fdf4",
    primary: "52, 211, 153",
    secondary: "16, 185, 129",
  },
  peach: {
    bg: "#fff5f0",
    primary: "255, 159, 64",
    secondary: "255, 127, 80",
  },
  sky: {
    bg: "#e0f2fe",
    primary: "14, 165, 233",
    secondary: "56, 189, 248",
  },
  lavender: {
    bg: "#f5f3ff",
    primary: "167, 139, 250",
    secondary: "196, 181, 253",
  },
  cream: {
    bg: "#fefce8",
    primary: "234, 179, 8",
    secondary: "250, 204, 21",
  },
  rose: {
    bg: "#fff1f2",
    primary: "251, 113, 133",
    secondary: "244, 63, 94",
  },
  sage: {
    bg: "#f0fdf4",
    primary: "74, 222, 128",
    secondary: "134, 239, 172",
  },
  coral: {
    bg: "#fff7ed",
    primary: "251, 146, 60",
    secondary: "249, 115, 22",
  },
  powder: {
    bg: "#ecfeff",
    primary: "6, 182, 212",
    secondary: "34, 211, 238",
  },
  lemon: {
    bg: "#fefce8",
    primary: "250, 204, 21",
    secondary: "253, 224, 71",
  },
  blush: {
    bg: "#fce7f3",
    primary: "236, 72, 153",
    secondary: "244, 114, 182",
  },
  seafoam: {
    bg: "#ecfdf5",
    primary: "16, 185, 129",
    secondary: "52, 211, 153",
  },
  sand: {
    bg: "#fef3c7",
    primary: "217, 119, 6",
    secondary: "245, 158, 11",
  },
};

/**
 * Desktop experiences (pepodev.desktopPrefs `experience` and `variant`): the
 * look of the window chrome, taskbar, dock or panels, and type
 * (src/styles/experiences.css, applied as <html data-experience> and
 * data-experience-variant). Each follows the theme and accent preferences.
 * The first variant is the experience's default; `glass: false` marks an
 * opaque look, for which Settings hides the glass preferences.
 */
export const experienceMap: Record<
  string,
  { label: string; variants: { id: string; label: string; glass?: false }[] }
> = {
  pepodev: { label: "PePoDev", variants: [{ id: "default", label: "Default" }] },
  macos: {
    label: "macOS",
    variants: [
      { id: "tahoe", label: "Tahoe (Liquid Glass)" },
      { id: "sequoia", label: "Sequoia" },
    ],
  },
  windows: {
    label: "Windows",
    variants: [
      { id: "11", label: "Windows 11" },
      { id: "10", label: "Windows 10", glass: false },
    ],
  },
  linux: {
    label: "Linux",
    variants: [
      { id: "gnome", label: "GNOME", glass: false },
      { id: "kde", label: "KDE Plasma", glass: false },
    ],
  },
};

/** Each experience's variant ids, default first: what loadDesktopPrefs accepts. */
export const experienceVariants: Record<string, string[]> = Object.fromEntries(
  Object.entries(experienceMap).map(([id, { variants }]) => [id, variants.map((variant) => variant.id)]),
);
