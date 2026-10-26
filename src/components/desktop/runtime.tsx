// Boots the desktop once React has hydrated it: every slice reads storage
// and the DOM and starts its listeners, input made before the boot is
// replayed, then window.__pepodevWindowManagerReady tells tests (and the
// parse-time input script) the desktop takes input. Also here: generic
// [data-open-app] launchers, the Quick Access tip and the "idle" app bodies
// (registry mount: "idle"); app-chunks.ts prefetches the other apps.
import { useEffect } from "react";
import { migrateLegacySnakeBest } from "@components/apps/snake-best";
import { APPS, isAppId } from "./apps";
import { startAppPrefetch } from "./app-chunks";
import { startAppKeys } from "./app-keys";
import { startBlogDeepLink } from "./deep-link";
import type { EarlyInput } from "./DesktopScripts";
import { startIconLayout } from "./icon-layout";
import { whenIdle } from "./idle";
import { isOverlayOpen, setStartMenu, setTrayOpen, startOverlays } from "./overlay-state";
import { startPrefs } from "./prefs";
import { openQuickAccess, startQuickAccess } from "./quick-access";
import { isDesktopSiteMode, startSiteMode } from "./site-mode";
import { startSystemAudio } from "./system-audio";
import { showToast, startToasts } from "./toast-state";
import { mountWindowBody, noteUserInteraction, requestOpenApp, startWindowManager } from "./window-manager";

declare global {
  interface Window {
    /** Set once the desktop has booted and takes input. */
    __pepodevWindowManagerReady?: boolean;
    /** Set by the parse-time icon placement script (DesktopScripts.tsx). */
    __pepodevDesktopIconsReady?: boolean;
    /** Input made before the boot (DesktopScripts.tsx); the boot replays it. */
    __pepodevEarlyInput?: EarlyInput[];
    /** The website scroll position an early switch to desktop saved (DesktopScripts.tsx). */
    __pepodevWebsiteScrollY?: number;
  }
}

// Between the first paint and the boot (React hydrates after the page has
// loaded), the parse-time input script took every click on a launcher or a
// taskbar control, and Ctrl/Cmd + K, in the order they came (it applied mode
// switches itself). Do what each would have done; Ctrl/Cmd + K opens Quick
// Access with focus in its search box (pressed again while nothing showed, it
// still means "open").
function replayEarlyInput() {
  const early = window.__pepodevEarlyInput ?? [];
  window.__pepodevEarlyInput = [];
  if (early.length === 0) return;
  // The visitor acted first, so the first-visit Welcome window stays closed.
  noteUserInteraction();
  if (!isDesktopSiteMode()) return;
  for (const input of early) {
    if (input.type === "mode") continue;
    if (input.type === "launch") {
      // The key press came before the window manager listened for keys.
      if (isAppId(input.appId)) requestOpenApp(input.appId, input.keyboard);
    } else if (input.type === "quick-access") {
      openQuickAccess();
    } else if (input.control === "taskbar-start") {
      setStartMenu(!isOverlayOpen("start-menu"), { restoreFocus: true });
    } else {
      setTrayOpen(!isOverlayOpen("tray-panel"), {
        opener: document.getElementById(input.control),
        restoreFocus: true,
      });
    }
  }
}

// Any [data-open-app] element outside the desktop icons (which handle their
// own pointer and key presses) launches its app: Quick Access app items, and
// app content that links to another app.
function onLauncherClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  const trigger = target?.closest<HTMLElement>("[data-open-app]");
  if (!trigger || trigger.classList.contains("desktop-icon")) return;
  const appId = trigger.dataset.openApp;
  if (isAppId(appId)) requestOpenApp(appId);
}

function startLaunchers() {
  document.addEventListener("click", onLauncherClick);
  return () => document.removeEventListener("click", onLauncherClick);
}

// The Quick Access tip (Ctrl/Cmd + K): hidden at widths <= 768px, otherwise
// shown 3s after load on a first visit or every seven days, in desktop mode
// only; it closes itself after eight seconds. The key keeps the name it had
// when the shortcut opened the command palette, so returning visitors are
// not shown the tip again.
const HINT_KEY = "pepodev.commandPaletteHintShown";

function startQuickAccessTip() {
  let timer = 0;
  const schedule = () => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile || !isDesktopSiteMode() || timer) return;
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(HINT_KEY);
    } catch {
      // Show it; it cannot be remembered anyway.
    }
    const daysSinceLastShown = lastShown ? (Date.now() - Number(lastShown)) / (1000 * 60 * 60 * 24) : Infinity;
    if (lastShown && daysSinceLastShown <= 7) return;
    timer = window.setTimeout(() => {
      timer = 0;
      if (!isDesktopSiteMode()) return;
      // Closes itself so the tip stops covering the top-right icons.
      showToast(
        <>
          Quick tip: Press <kbd>Ctrl + K</kbd> (<kbd>Cmd</kbd> on Mac) to open Quick Access
        </>,
        { duration: 8000 },
      );
      try {
        localStorage.setItem(HINT_KEY, String(Date.now()));
      } catch {
        // Shown again next time.
      }
    }, 3000);
  };
  const onModeChange = (event: Event) => {
    if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "desktop") {
      schedule();
    } else if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
  };
  schedule();
  document.addEventListener("site:mode-change", onModeChange);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("site:mode-change", onModeChange);
  };
}

// "idle" app bodies mount, hidden, once the desktop is idle in desktop mode
// (waiting at most a second for that: idle.ts).
function startIdleMounts() {
  let cancel: (() => void) | null = null;
  let mounted = false;
  const mountAll = () => {
    cancel = null;
    if (mounted || !isDesktopSiteMode()) return;
    mounted = true;
    APPS.filter((app) => app.mount === "idle").forEach((app) => mountWindowBody(app.id));
  };
  const schedule = () => {
    if (mounted || cancel || !isDesktopSiteMode()) return;
    cancel = whenIdle(mountAll, 1000);
  };
  const onModeChange = (event: Event) => {
    if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "desktop") schedule();
  };
  schedule();
  document.addEventListener("site:mode-change", onModeChange);
  return () => {
    cancel?.();
    document.removeEventListener("site:mode-change", onModeChange);
  };
}

function boot(): () => void {
  // Storage an app leaves behind from older versions of the site goes on
  // every load, whether or not the app is opened (README).
  migrateLegacySnakeBest();
  const cleanups = [
    startPrefs(),
    startToasts(),
    startOverlays(),
    startQuickAccess(),
    // Site mode first: its boot site:mode-change reaches only what started
    // before it.
    startSiteMode(),
    startIconLayout(),
    startWindowManager(),
    startLaunchers(),
    startQuickAccessTip(),
    startIdleMounts(),
    startAppPrefetch(),
    startAppKeys(),
    startSystemAudio(),
    startBlogDeepLink(),
  ];
  replayEarlyInput();
  window.__pepodevWindowManagerReady = true;
  return () => cleanups.forEach((cleanup) => cleanup());
}

/** Boots the desktop after hydration (Desktop.tsx renders it once). */
export function useDesktopRuntime() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    // Outside React's commit, so the boot can commit state synchronously.
    queueMicrotask(() => {
      if (!cancelled) cleanup = boot();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
}
