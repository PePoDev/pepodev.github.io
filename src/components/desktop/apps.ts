// The app registry: every desktop app, once. Windows, desktop icons, the
// Start menu, the command palette and the taskbar all read it. Each app's
// body is a lazily loaded client component at a fixed path,
// src/components/apps/<Name>App.tsx (app-bodies.tsx), with optional
// build-time data from src/components/apps/<Name>App.data.ts (app-data.ts).
// Plain data, no "use client": the server page and client components share it.

/** Window order: the windows container and the taskbar list apps in this order. */
export const APP_IDS = [
  "welcome",
  "blog",
  "garden",
  "project",
  "work",
  "me",
  "sregame",
  "snake",
  "music",
  "whitenoise",
  "calculator",
  "settings",
  "terminal",
  "certs",
  "gallery",
  "trash",
] as const;

export type AppId = (typeof APP_IDS)[number];

export interface AppDefinition {
  id: AppId;
  /** Window title (dialog name). The taskbar label is the part before "-". */
  title: string;
  /** Desktop icon, Start menu and command palette name. */
  label: string;
  /** Default window size; phones get a full-screen window instead. */
  width: number;
  height: number;
  /** Start menu description. */
  startDescription: string;
  /** Command palette description. */
  paletteDescription: string;
  /**
   * Default desktop icon cell (the grid in icon-grid.ts): a column or row
   * number, "center" (+/- an offset), "right" or "bottom". "left-mid" icons
   * move up next to the middle of the left column on short screens.
   */
  icon: { col: string; row: string; group?: "left-mid" | "utility"; index?: number };
  /**
   * When the body mounts. "open": on the first launch. "idle": once the
   * desktop has booted in desktop mode and the browser is idle, hidden in its
   * closed window, for apps whose markup or controller must exist before the
   * window opens (Settings drives Music; the SRE game's text is read early).
   * A mounted body stays mounted when its window closes.
   */
  mount: "open" | "idle";
}

export const APPS: readonly AppDefinition[] = [
  {
    id: "welcome",
    title: "Welcome - Login",
    label: "Welcome",
    width: 680,
    height: 600,
    startDescription: "Login & introduction",
    paletteDescription: "Login & introduction",
    icon: { col: "center", row: "0" },
    mount: "open",
  },
  {
    id: "blog",
    title: "Blog - Articles",
    label: "Blog",
    width: 700,
    height: 520,
    startDescription: "Read articles & write-ups",
    paletteDescription: "Read articles and posts",
    icon: { col: "1", row: "0" },
    mount: "open",
  },
  {
    id: "garden",
    title: "Garden - Digital Garden",
    label: "Garden",
    width: 960,
    height: 640,
    startDescription: "Browse evolving notes",
    paletteDescription: "Browse digital garden notes",
    icon: { col: "5", row: "0" },
    mount: "open",
  },
  {
    id: "project",
    title: "Projects - Showcase",
    label: "Projects",
    width: 700,
    height: 500,
    startDescription: "Showcase of work",
    paletteDescription: "Browse project showcase",
    icon: { col: "3", row: "0" },
    mount: "open",
  },
  {
    id: "work",
    title: "Work - Experience",
    label: "Work",
    width: 680,
    height: 540,
    startDescription: "Experience & career",
    paletteDescription: "Career timeline",
    icon: { col: "2", row: "0" },
    mount: "open",
  },
  {
    id: "me",
    title: "About Me",
    label: "About Me",
    width: 600,
    height: 560,
    startDescription: "Contact & personal info",
    paletteDescription: "Learn more about me",
    icon: { col: "0", row: "0" },
    mount: "open",
  },
  {
    id: "sregame",
    title: "SRE Game - Taming Chaos",
    label: "SRE Game",
    width: 800,
    height: 600,
    startDescription: "Chaos simulation game",
    paletteDescription: "Play the chaos game",
    icon: { col: "0", row: "4", group: "left-mid", index: 0 },
    mount: "idle",
  },
  {
    id: "snake",
    title: "Snake",
    label: "Snake",
    width: 560,
    height: 680,
    startDescription: "Classic grid survival game",
    paletteDescription: "Play the classic grid game",
    icon: { col: "0", row: "5", group: "left-mid", index: 1 },
    mount: "open",
  },
  {
    id: "music",
    title: "Music Player",
    label: "Music",
    width: 560,
    height: 490,
    startDescription: "Ambient desktop player",
    paletteDescription: "Play ambient desktop music",
    icon: { col: "0", row: "bottom" },
    mount: "idle",
  },
  {
    id: "whitenoise",
    title: "White Noise",
    label: "Noise",
    width: 480,
    height: 540,
    startDescription: "Rainy white noise loop",
    paletteDescription: "Play rainy white noise",
    icon: { col: "4", row: "bottom" },
    mount: "open",
  },
  {
    id: "calculator",
    title: "Calculator",
    label: "Calculator",
    width: 360,
    height: 520,
    startDescription: "Quick calculations",
    paletteDescription: "Run quick calculations",
    icon: { col: "1", row: "bottom" },
    mount: "open",
  },
  {
    id: "settings",
    title: "Settings",
    label: "Settings",
    width: 620,
    height: 560,
    startDescription: "Customize desktop",
    paletteDescription: "Customize the desktop",
    icon: { col: "5", row: "bottom" },
    mount: "open",
  },
  {
    id: "terminal",
    title: "Terminal",
    label: "Terminal",
    width: 720,
    height: 480,
    startDescription: "Interactive shell",
    paletteDescription: "Use the interactive shell",
    icon: { col: "center", row: "bottom" },
    mount: "open",
  },
  {
    id: "certs",
    title: "Certifications",
    label: "Certs",
    width: 700,
    height: 520,
    startDescription: "Certification wallet",
    paletteDescription: "View certification wallet",
    icon: { col: "4", row: "0" },
    mount: "open",
  },
  {
    id: "gallery",
    title: "Gallery",
    label: "Gallery",
    width: 680,
    height: 560,
    startDescription: "Password protected pictures",
    paletteDescription: "Open protected pictures",
    icon: { col: "3", row: "bottom" },
    mount: "open",
  },
  {
    id: "trash",
    title: "Trash Bin",
    label: "Trash",
    width: 680,
    height: 520,
    startDescription: "Deleted desktop nonsense",
    paletteDescription: "Inspect deleted desktop nonsense",
    icon: { col: "2", row: "bottom" },
    mount: "open",
  },
];

/**
 * Desktop icon order: their order in #desktop-icons, which is the Tab order
 * and the order the grid places icons without a saved position in.
 */
export const DESKTOP_ICON_ORDER: readonly AppId[] = [
  "me",
  "blog",
  "work",
  "project",
  "certs",
  "garden",
  "welcome",
  "sregame",
  "snake",
  "gallery",
  "music",
  "whitenoise",
  "calculator",
  "trash",
  "terminal",
  "settings",
];

const byId = new Map(APPS.map((app) => [app.id, app]));

export function getApp(id: string): AppDefinition | undefined {
  return byId.get(id as AppId);
}

export function isAppId(id: unknown): id is AppId {
  return typeof id === "string" && byId.has(id as AppId);
}

/** The taskbar label: the title up to its first "-" ("Projects", "About Me"). */
export function taskbarLabel(app: AppDefinition): string {
  return app.title.split("-")[0].trim();
}
