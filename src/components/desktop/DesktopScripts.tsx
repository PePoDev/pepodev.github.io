// The desktop's parse-time scripts (Server Components). They only set
// attributes and styles from storage before first paint, and the taskbar
// clock's text (in elements marked suppressHydrationWarning), which
// hydration keeps (README, Hydration Rules, rule 1); the React desktop takes
// over after hydration with the same functions, which these scripts inline
// with Function#toString (see icon-grid.ts, prefs-core.ts and
// taskbar-clock.ts).
import { InlineScript, scriptValue } from "@components/InlineScript";
import { accentMap, backgroundMap, experienceVariants } from "@utils/desktop-prefs";
import {
  createIconGrid,
  ICON_STORAGE_PREFIX,
  LINK_ICON_STORAGE_PREFIX,
  layoutIcons,
  readDesktopInsets,
  readIconPosition,
  removeStaleIconPositions,
} from "./icon-grid";
import { applyDesktopPrefs, loadDesktopPrefs } from "./prefs-core";
import { formatTaskbarClock } from "./taskbar-clock";

// site-mode.ts's VIEW_MODE_KEY (that module is client-only).
const VIEW_MODE_STORAGE_KEY = "pepodev.viewMode";

// For <head>, after HomeHeadScripts' theme script (which website mode needs
// even if this one is dropped).
const prefsScript = `(() => {
  // Initialize theme immediately to prevent flash: the background, glass,
  // radius, effect and experience preferences, before first paint.
  const accentMap = ${scriptValue(accentMap)};
  const backgroundMap = ${scriptValue(backgroundMap)};
  const experiences = ${scriptValue(experienceVariants)};
  const loadPrefs = ${loadDesktopPrefs.toString()};
  const applyPrefs = ${applyDesktopPrefs.toString()};
  let storage = null;
  try {
    storage = window.localStorage;
  } catch {}
  applyPrefs(document.documentElement, loadPrefs(storage, backgroundMap, experiences), accentMap, backgroundMap);
})();`;

/** Applies every desktop preference before first paint (prefs-core.ts). */
export function DesktopPrefsScript() {
  return <InlineScript code={prefsScript} />;
}

/** Input the parse-time input script took before the boot; runtime.tsx replays it. */
export type EarlyInput =
  | { type: "launch"; appId: string | undefined; keyboard: boolean }
  | { type: "control"; control: (typeof EARLY_CONTROLS)[number] }
  // Ctrl/Cmd + K: the boot opens Quick Access with focus in its search box.
  | { type: "quick-access" }
  // A mode switch, already applied; it only counts as interaction.
  | { type: "mode" };

/** Taskbar controls whose clicks before the boot are replayed. */
export const EARLY_CONTROLS = ["taskbar-start", "taskbar-clock-button", "taskbar-audio-status"] as const;

// For <head>, after the mode script: the listeners must exist before the
// desktop is painted.
const earlyInputScript = `(() => {
  // The desktop boots once React has hydrated it, after the page has loaded:
  // later than the first paint by up to a few seconds on slow devices. Until
  // then this takes the clicks and keys the desktop would handle, so a quick
  // visitor's input is not lost: launches ([data-open-app]), the taskbar's
  // Start and tray buttons, and Ctrl/Cmd + K are kept in order and
  // replayed by the boot (runtime.tsx); a launch from the keyboard (a click
  // with detail 0) still moves focus into its window. A mode switch applies
  // at once, with the attributes and storage the site-mode store uses (it
  // takes over at the boot), keeps the website scroll position
  // (window.__pepodevWebsiteScrollY, which the store takes over too), hands
  // focus to the other panel's switch, and counts as interaction. Website
  // mode's Copy email button copies until React has hydrated it.
  const early = (window.__pepodevEarlyInput = []);
  const root = document.documentElement;
  const isDesktop = () => root.dataset.siteMode !== "website";
  const controls = ${scriptValue(EARLY_CONTROLS.map((id) => "#" + id).join(", "))};
  const take = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  // A hydration error (text a browser extension or Cloudflare changed before
  // React hydrated) makes React render the page again from scratch, which
  // resets <html> to its server attributes: the desktop, no theme. Until the
  // boot, put back what the parse-time scripts set (the mode, and the theme
  // and preferences' attributes and variables) before the next paint.
  const kept = [
    "data-site-mode",
    "data-theme",
    "data-background-effect",
    "data-window-glass",
    "data-experience",
    "data-experience-variant",
    "style",
  ];
  const saved = {};
  const save = () => kept.forEach((name) => (saved[name] = root.getAttribute(name)));
  save();
  const keeper = new MutationObserver(() => {
    if (window.__pepodevWindowManagerReady) return keeper.disconnect();
    kept.forEach((name) => {
      if (saved[name] !== null && root.getAttribute(name) !== saved[name]) root.setAttribute(name, saved[name]);
    });
  });
  keeper.observe(root, { attributeFilter: kept });
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const copyButton = window.__pepodevCopyEmailReady ? null : target.closest("#website [data-copy-email]");
      if (copyButton) {
        take(event);
        // Now, while the press still allows it; the button shows the
        // result once it has hydrated (CopyEmailButton.tsx).
        window.__pepodevEarlyCopyEmail = new Promise((resolve) =>
          resolve(navigator.clipboard.writeText(copyButton.dataset.copyEmail)),
        ).then(() => true, () => false);
        return;
      }
      if (window.__pepodevWindowManagerReady) return;
      const modeSwitch = target.closest("[data-site-mode-toggle], [data-site-mode-target]");
      if (modeSwitch) {
        take(event);
        const current = isDesktop() ? "desktop" : "website";
        const wanted = modeSwitch.hasAttribute("data-site-mode-toggle")
          ? current === "desktop" ? "website" : "desktop"
          : modeSwitch.dataset.siteModeTarget;
        const mode = wanted === "website" ? "website" : "desktop";
        if (mode === current) return;
        // Desktop mode locks the page to one screen, which resets its scroll.
        if (mode === "desktop") window.__pepodevWebsiteScrollY = window.scrollY;
        root.dataset.siteMode = mode;
        save();
        try {
          localStorage.setItem(${scriptValue(VIEW_MODE_STORAGE_KEY)}, mode);
        } catch {}
        const url = new URL(window.location.href);
        if (url.searchParams.has("blog")) {
          url.searchParams.delete("blog");
          history.replaceState(history.state, "", url);
        }
        // What was meant for the other mode no longer applies; the switch
        // itself is the visitor acting first (Welcome stays closed).
        early.length = 0;
        early.push({ type: "mode" });
        // The icon placement script places the icons of a desktop it skipped.
        if (mode === "desktop") window.dispatchEvent(new Event("resize"));
        else window.scrollTo({ top: window.__pepodevWebsiteScrollY || 0, behavior: "instant" });
        document
          .querySelector('[data-site-mode-panel="' + mode + '"] [data-site-mode-toggle]')
          ?.focus({ preventScroll: true });
        return;
      }
      if (!isDesktop()) return;
      const launcher = target.closest("[data-open-app]");
      const control = launcher ? null : target.closest(controls);
      if (launcher) early.push({ type: "launch", appId: launcher.dataset.openApp, keyboard: event.detail === 0 });
      else if (control) early.push({ type: "control", control: control.id });
      else return;
      take(event);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (window.__pepodevWindowManagerReady || !isDesktop()) return;
      if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === "k") {
        take(event);
        early.push({ type: "quick-access" });
      }
    },
    true,
  );
})();`;

/**
 * Takes clicks and Ctrl/Cmd + K made before the desktop boots (replayed by
 * runtime.tsx), and keeps the parse-time <html> attributes until then.
 */
export function DesktopEarlyInputScript() {
  return <InlineScript code={earlyInputScript} />;
}

// Right after #desktop, so its icons exist and the page's CSS applies.
const iconScript = `(() => {
  // Places the desktop icons on their grid before first paint, so they
  // never show stacked and then jump (icon-layout.ts takes over once the
  // desktop boots). Above 768px only; phones use the CSS grid. Until the
  // boot, a resize (or a mode switch to the desktop, which the early-input
  // script announces as one) places them again.
  window.__pepodevDesktopIconsReady = true;
  const createIconGrid = ${createIconGrid.toString()};
  const readInsets = ${readDesktopInsets.toString()};
  const layoutIcons = ${layoutIcons.toString()};
  const removeStale = ${removeStaleIconPositions.toString()};
  const readPosition = ${readIconPosition.toString()};
  const appPrefix = ${scriptValue(ICON_STORAGE_PREFIX)};
  const linkPrefix = ${scriptValue(LINK_ICON_STORAGE_PREFIX)};
  const index = (value) => Number.parseInt(value || "0", 10);
  const apps = Array.from(document.querySelectorAll("#desktop-icons .desktop-icon[data-open-app]"));
  const links = Array.from(document.querySelectorAll("#desktop-links .desktop-link-icon[id]")).sort(
    (a, b) => index(a.dataset.shortcutIndex) - index(b.dataset.shortcutIndex),
  );
  const icons = apps.concat(links);
  const descriptors = icons.map((icon) =>
    icon.dataset.openApp
      ? {
          id: icon.dataset.openApp,
          link: false,
          col: icon.dataset.defaultCol,
          row: icon.dataset.defaultRow,
          group: icon.dataset.layoutGroup,
          index: index(icon.dataset.layoutIndex),
        }
      : { id: icon.id, link: true, shortcut: index(icon.dataset.shortcutIndex) },
  );
  const setPosition = (icon, left, top, fixed) => {
    icon.style.position = fixed ? "fixed" : "";
    icon.style.left = left;
    icon.style.top = top;
    icon.style.right = fixed ? "auto" : "";
    icon.style.bottom = fixed ? "auto" : "";
  };
  const place = () => {
    if (document.documentElement.dataset.siteMode !== "desktop") return;
    if (window.matchMedia("(max-width: 768px)").matches) {
      icons.forEach((icon) => setPosition(icon, "", "", false));
      return;
    }
    const first = icons[0];
    if (!first || !first.offsetWidth) return;
    const saved = {};
    try {
      const storage = window.localStorage;
      removeStale(storage, appPrefix, linkPrefix);
      descriptors.forEach((icon) => {
        const position = readPosition(storage, (icon.link ? linkPrefix : appPrefix) + icon.id);
        if (position) saved[icon.id] = position;
      });
    } catch {}
    const grid = createIconGrid(
      window.innerWidth,
      window.innerHeight,
      first.offsetWidth,
      first.offsetHeight,
      readInsets(document.documentElement),
    );
    const layout = layoutIcons(grid, descriptors, saved);
    icons.forEach((icon, i) => {
      const cell = grid.cellPosition(layout.cells[descriptors[i].id]);
      const point = grid.clamp(cell.x, cell.y, icon.offsetWidth, icon.offsetHeight);
      setPosition(icon, point.x + "px", point.y + "px", true);
      icon.dataset.desktopIconReady = "true";
    });
  };
  place();
  window.addEventListener("resize", () => {
    if (!window.__pepodevWindowManagerReady) place();
  });
})();`;

/** Places the desktop icons before first paint (icon-grid.ts). */
export function DesktopIconScript() {
  return <InlineScript code={iconScript} />;
}

// After #desktop, with the icon script.
const clockScript = `(() => {
  // Writes the taskbar clock before first paint: the server has no
  // visitor's clock, and the taskbar's own one starts with hydration, which
  // on a slow device comes seconds later (an empty, nameless button until
  // then). Its spans carry suppressHydrationWarning (Taskbar.tsx).
  const format = ${formatTaskbarClock.toString()};
  const now = format(new Date());
  const time = document.getElementById("taskbar-clock");
  const date = document.getElementById("taskbar-date");
  if (time) time.textContent = now.time;
  if (date) date.textContent = now.date;
})();`;

/** Fills the taskbar clock before first paint (taskbar-clock.ts). */
export function DesktopClockScript() {
  return <InlineScript code={clockScript} />;
}
