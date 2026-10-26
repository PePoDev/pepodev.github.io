// The code of the app bodies. Each body (src/components/apps/<Name>App.tsx)
// is its own chunk, never part of the page's initial chunks; this module
// loads them, remembers what arrived, and prefetches them.
//
// - A launch starts its app's download before React renders the window
//   (window-manager.ts), and app-bodies.tsx renders the body from here as
//   plain state: a body whose code has arrived renders in the same commit as
//   its window, and one that arrives later renders as soon as it does. (With
//   React.lazy every first launch committed a Suspense fallback, and React
//   then held the body back until 300 ms after the most recent fallback
//   anywhere on the page, so other windows opening or idle mounts kept
//   pushing it out: keys typed meanwhile and the body's entry animation ran
//   late.)
// - Prefetching: a launcher's hover, focus or press fetches its app (desktop
//   icons, Quick Access app items), and once the desktop has
//   settled every app is fetched, one at a time in idle time (waiting at
//   most 300 ms for it), unless the visitor saves data or is on a 2G
//   connection. Website mode fetches none.
// - A failed download is fetched again by the next launch or "Try again"
//   (Turbopack retries a chunk once itself, then forgets it); a prefetch
//   leaves a failure to the launch.
import type { ComponentType } from "react";
import type { AppProps } from "./app-api";
import { APP_IDS, DESKTOP_ICON_ORDER, isAppId, type AppId } from "./apps";
import { whenIdle } from "./idle";
import { isDesktopSiteMode } from "./site-mode";

type AppModule<Id extends AppId> = { default: ComponentType<AppProps<Id>> };

// Fixed paths, so each body gets its own chunk.
const loaders: { [Id in AppId]: () => Promise<AppModule<Id>> } = {
  welcome: () => import("@components/apps/WelcomeApp"),
  blog: () => import("@components/apps/BlogApp"),
  garden: () => import("@components/apps/GardenApp"),
  project: () => import("@components/apps/ProjectsApp"),
  work: () => import("@components/apps/WorkApp"),
  me: () => import("@components/apps/AboutApp"),
  sregame: () => import("@components/apps/SreGameApp"),
  snake: () => import("@components/apps/SnakeApp"),
  music: () => import("@components/apps/MusicPlayerApp"),
  whitenoise: () => import("@components/apps/WhiteNoiseApp"),
  calculator: () => import("@components/apps/CalculatorApp"),
  settings: () => import("@components/apps/SettingsApp"),
  terminal: () => import("@components/apps/TerminalApp"),
  certs: () => import("@components/apps/CertificationsWalletApp"),
  gallery: () => import("@components/apps/GalleryApp"),
  trash: () => import("@components/apps/TrashBinApp"),
};

/** An app's code once its download has settled. */
export type AppChunk<Id extends AppId = AppId> =
  | { status: "loaded"; Body: ComponentType<AppProps<Id>> }
  | { status: "failed"; error: unknown };

// What app-bodies.tsx renders from (useSyncExternalStore): changes only when
// a download settles or a failed one starts again, never during a render.
const settled = new Map<AppId, AppChunk>();
const pending = new Map<AppId, Promise<void>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeAppChunks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The app's code if its download has settled, else undefined (not started or loading). */
export function getAppChunk<Id extends AppId>(appId: Id): AppChunk<Id> | undefined {
  return settled.get(appId) as AppChunk<Id> | undefined;
}

/**
 * Downloads the app's code, once: later calls share the download, and a
 * failed one starts again. Resolves once the body can render. Call it from
 * event handlers, timers and effects, not while React renders (starting
 * again after a failure notifies the bodies).
 */
export function loadAppChunk(appId: AppId): Promise<void> {
  const current = settled.get(appId);
  if (current?.status === "loaded") return Promise.resolve();
  const inFlight = pending.get(appId);
  if (inFlight) return inFlight;
  if (current) {
    // Failed before: the body shows "Loading…" again while this try runs.
    settled.delete(appId);
    notify();
  }
  const download = loaders[appId]().then(
    (module) => {
      pending.delete(appId);
      settled.set(appId, { status: "loaded", Body: module.default as ComponentType<AppProps> });
      notify();
    },
    (error: unknown) => {
      pending.delete(appId);
      settled.set(appId, { status: "failed", error });
      notify();
      throw error;
    },
  );
  pending.set(appId, download);
  return download;
}

/** Fetches the app's code ahead of a launch, unless it is loaded, loading or failed before. */
export function prefetchAppChunk(appId: AppId) {
  if (settled.has(appId) || pending.has(appId)) return;
  loadAppChunk(appId).catch(() => {
    // The launch tries again and shows the error if it fails too.
  });
}

// --- Prefetching ----------------------------------------------------------------

// Hover, focus or press on a launcher ([data-open-app]): desktop icons,
// Quick Access app items, and app content that opens another app.
function onLauncherIntent(event: Event) {
  if (!isDesktopSiteMode()) return;
  const target = event.target instanceof Element ? event.target : null;
  const appId = target?.closest<HTMLElement>("[data-open-app]")?.dataset.openApp;
  if (isAppId(appId)) prefetchAppChunk(appId);
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");
}

// Idle prefetching waits this long after the boot, so it never competes with
// the boot itself, the "idle" app mounts or the first-visit Welcome (1.5 s);
// a launch before then fetches its own app (and a hover before it).
const IDLE_PREFETCH_DELAY_MS = 2000;
// How long each app waits for an idle period. Short: on a slow device the
// animated background leaves none, and with a long wait every app would
// take that long (13 apps over about a minute at 4x CPU slowdown).
const IDLE_PREFETCH_TIMEOUT_MS = 300;

// The desktop icons' order, then the apps without an icon (Settings).
const PREFETCH_ORDER: readonly AppId[] = [
  ...DESKTOP_ICON_ORDER,
  ...APP_IDS.filter((id) => !DESKTOP_ICON_ORDER.includes(id)),
];

function startIdlePrefetch(): () => void {
  let timer = 0;
  let cancelIdle: (() => void) | null = null;
  let stopped = false;
  // One app at a time, the next once it has settled; website mode pauses it
  // until the visitor switches back.
  const fetchNext = () => {
    cancelIdle = null;
    if (stopped || !isDesktopSiteMode() || savesData()) return;
    const appId = PREFETCH_ORDER.find((id) => !settled.has(id) && !pending.has(id));
    if (!appId) return;
    loadAppChunk(appId).catch(() => {}).finally(scheduleNext);
  };
  const scheduleNext = () => {
    if (stopped || cancelIdle || timer) return;
    cancelIdle = whenIdle(fetchNext, IDLE_PREFETCH_TIMEOUT_MS);
  };
  const onModeChange = (event: Event) => {
    if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "desktop") scheduleNext();
  };
  timer = window.setTimeout(() => {
    timer = 0;
    scheduleNext();
  }, IDLE_PREFETCH_DELAY_MS);
  document.addEventListener("site:mode-change", onModeChange);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    cancelIdle?.();
    document.removeEventListener("site:mode-change", onModeChange);
  };
}

const INTENT_EVENTS = ["pointerover", "pointerdown", "focusin"] as const;

/** Prefetches app code on launcher intent and in idle time (the boot starts it). */
export function startAppPrefetch(): () => void {
  for (const name of INTENT_EVENTS) document.addEventListener(name, onLauncherIntent, { capture: true, passive: true });
  const stopIdle = startIdlePrefetch();
  return () => {
    for (const name of INTENT_EVENTS) document.removeEventListener(name, onLauncherIntent, { capture: true });
    stopIdle();
  };
}
