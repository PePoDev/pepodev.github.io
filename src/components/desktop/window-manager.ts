// The window manager (port of WindowController.astro): which windows are
// open, minimized, maximized and focused, their z-order, bounds and
// animation classes, and the focus rules around them. Window.tsx renders a
// window from its WindowState; the functions here change state with
// commit(), so the DOM is current when they move focus or dispatch events.
//
// Rules (README, Interaction Invariants):
// - Windows are non-modal dialogs labelled by their title. Escape closes the
//   active window after overlays handle it.
// - Opening a window from the keyboard focuses it before desktop:window-open.
//   Every launch (a new window, a restore, or an already open one, from an
//   icon, the Start menu, the palette or the taskbar) and every hand-off of
//   focus into the next window then dispatches desktop:window-focus, whose
//   detail.keyboard says whether DOM focus moved into the window, and bumps
//   WindowState.focusRequest for apps (useAppWindow).
// - Closing or minimizing the focused window hands .focused to the topmost
//   remaining one. After a pointer close DOM focus is dropped; from the
//   keyboard it returns to the window's launcher if still shown, else into
//   the topmost window, else to the app's icon. Tabbing into a window
//   focuses it. Minimized and closed windows are inert and aria-hidden.
// - Dragging keeps a title bar above the taskbar with 120px of it on screen;
//   maximized windows end at the taskbar; phones get full-screen windows.
import { canTakeFocus } from "@utils/overlays";
import { loadAppChunk } from "./app-chunks";
import { APPS, getApp, isAppId, type AppDefinition, type AppId } from "./apps";
import { closeStartMenu, isOverlayOpen } from "./overlay-state";
import { getBlogDeepLink, isDesktopSiteMode } from "./site-mode";
import { commit, createStore, useStore } from "./store";

export interface WindowBoundsStyle {
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  zIndex?: number;
}

export interface WindowState {
  appId: AppId;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  /** The element's hidden attribute: closed and done animating out. */
  hidden: boolean;
  /** Animation classes. */
  opening: boolean;
  closing: boolean;
  /** .mobile-window: phone-width layout. */
  mobile: boolean;
  /** Inline position, size and stacking. */
  style: WindowBoundsStyle;
  /** Whether the app body is mounted (first launch, or "idle" apps). */
  mounted: boolean;
  /** Whether the window has opened before (desktop:window-open firstOpen). */
  hasOpened: boolean;
  /** Bumped on every launch and focus hand-off; keyboard as in desktop:window-focus. */
  focusRequest: { seq: number; keyboard: boolean };
}

export interface WindowsState {
  windows: Record<AppId, WindowState>;
  /** The window with .focused (open and not minimized), if any. */
  focused: AppId | null;
}

function initialWindow(appId: AppId): WindowState {
  return {
    appId,
    open: false,
    minimized: false,
    maximized: false,
    hidden: true,
    opening: false,
    closing: false,
    mobile: false,
    style: {},
    mounted: false,
    hasOpened: false,
    focusRequest: { seq: 0, keyboard: false },
  };
}

export const windowsStore = createStore<WindowsState>({
  windows: Object.fromEntries(APPS.map((app) => [app.id, initialWindow(app.id)])) as Record<
    AppId,
    WindowState
  >,
  focused: null,
});

export function useWindow(appId: AppId): WindowState {
  return useStore(windowsStore, (state) => state.windows[appId]);
}


// --- Elements --------------------------------------------------------------

const elements = new Map<AppId, HTMLElement>();

/** Window.tsx registers its <section> here (null on unmount). */
export function registerWindowElement(appId: AppId, element: HTMLElement | null) {
  if (element) elements.set(appId, element);
  else elements.delete(appId);
}

/** The window's <section id="window-<appId>">, once rendered. */
export function getWindowElement(appId: AppId): HTMLElement | null {
  return elements.get(appId) ?? null;
}

// --- Runtime state (not rendered) -------------------------------------------

const MIN_VISIBLE_TITLEBAR = 120;
let topZ = 100;
let mobileMode = false;
let userOpenedWindow = false;
let userInteracted = false;
// Set by keydown and cleared by pointerdown, so only windows opened from the
// keyboard take keyboard focus.
let keyboardInteraction = false;
const returnFocus = new Map<AppId, HTMLElement | null>();
const prevBounds = new Map<AppId, Bounds>();
// Where DOM focus was once each window's latest launch had moved it (or left
// it): useFocusOnLaunch compares against it when a body mounts late.
const launchFocus = new Map<AppId, Element | null>();

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Whether the latest input was a key press (not a pointer press). */
export function isKeyboardInteraction(): boolean {
  return keyboardInteraction;
}

export function isMobileMode(): boolean {
  return mobileMode;
}

function get(appId: AppId): WindowState {
  return windowsStore.get().windows[appId];
}

function patch(appId: AppId, change: Partial<WindowState>) {
  windowsStore.set((state) => ({
    ...state,
    windows: { ...state.windows, [appId]: { ...state.windows[appId], ...change } },
  }));
}

function patchStyle(appId: AppId, style: WindowBoundsStyle) {
  patch(appId, { style: { ...get(appId).style, ...style } });
}

function isShown(state: WindowState) {
  return state.open && !state.minimized;
}

export function isWindowFocused(appId: AppId): boolean {
  const state = windowsStore.get();
  return state.focused === appId && isShown(state.windows[appId]);
}

// --- Focus -------------------------------------------------------------------

/** Gives .focused (and the top of the stack) to the window, if it is shown. */
function setFocused(appId: AppId) {
  const state = get(appId);
  const focused = isShown(state) ? appId : null;
  windowsStore.set((current) => ({ ...current, focused }));
  if (focused) patchStyle(appId, { zIndex: ++topZ });
}

export function focusWindow(appId: AppId) {
  commit(() => setFocused(appId));
}

/** The focused window, else the topmost shown one. */
export function getActiveWindow(): AppId | null {
  const { windows, focused } = windowsStore.get();
  if (focused && isShown(windows[focused])) return focused;
  let top: WindowState | null = null;
  for (const state of Object.values(windows)) {
    if (!isShown(state)) continue;
    if (!top || (state.style.zIndex ?? 0) > (top.style.zIndex ?? 0)) top = state;
  }
  return top?.appId ?? null;
}

/** The window stays focusable only while it holds focus (Window.tsx drops it). */
function focusWindowElement(appId: AppId) {
  const element = elements.get(appId);
  if (!element) return;
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
}

// keyboard says whether DOM focus moved into the window. Apps that focus
// their own control on a launch skip that on touch screens unless it did, so
// a tap does not raise the on-screen keyboard.
function dispatchWindowFocus(appId: AppId, keyboard: boolean) {
  launchFocus.set(appId, document.activeElement);
  const seq = get(appId).focusRequest.seq + 1;
  commit(() => patch(appId, { focusRequest: { seq, keyboard } }));
  elements.get(appId)?.dispatchEvent(
    new CustomEvent("desktop:window-focus", { detail: { appId, keyboard } }),
  );
}

/**
 * The element that had DOM focus right after the window's latest launch or
 * focus hand-off (its launcher after a click, the window after a keyboard
 * launch, <body> after a Start menu or palette launch).
 */
export function getLaunchFocus(appId: AppId): Element | null {
  return launchFocus.get(appId) ?? null;
}

/** Raises the window and gives it the keys (an already open window's launch). */
export function activateWindow(appId: AppId, moveFocus = false) {
  focusWindow(appId);
  if (moveFocus) focusWindowElement(appId);
  dispatchWindowFocus(appId, moveFocus);
}

interface FocusSnapshot {
  active: Element | null;
  hadFocus: boolean;
}

/** Where DOM focus is before a window closes or minimizes (it moves after). */
function snapshotFocus(appId: AppId, closing: boolean): FocusSnapshot {
  const active = document.activeElement;
  const element = elements.get(appId);
  const hadFocus = Boolean(
    (element && active && element.contains(active)) ||
      active?.closest?.(`[data-open-app="${appId}"]`) ||
      // Closing removes the window's own taskbar button.
      (closing &&
        active instanceof HTMLElement &&
        active.closest("#taskbar-apps") &&
        active.dataset.appId === appId),
  );
  return { active, hadFocus };
}

// A closed or minimized window hands window focus to the next one (done in
// its commit), so app keys and Escape agree on the active window. DOM focus
// in it, or on its launcher, is dropped after a pointer action, so the next
// app gets the keys. From the keyboard it goes back to the launcher of a
// window opened from the keyboard while that is still shown, else into the
// next window, else to the control that reopens it.
function releaseWindowFocus(appId: AppId, snapshot: FocusSnapshot, next: AppId | null, closing: boolean) {
  if (!snapshot.hadFocus) return;
  const nextElement = next ? elements.get(next) : null;
  const target =
    keyboardInteraction &&
    [
      closing && returnFocus.get(appId),
      nextElement,
      closing
        ? document.querySelector(`#desktop-icons [data-open-app="${appId}"]`)
        : document.querySelector(`#taskbar-apps [data-app-id="${appId}"]`),
    ].find(canTakeFocus);
  if (!target) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
  } else if (next && target === nextElement) {
    focusWindowElement(next);
    dispatchWindowFocus(next, true);
  } else {
    target.focus({ preventScroll: true });
  }
}

// --- Geometry ----------------------------------------------------------------

export function getTaskbarHeight(): number {
  return Math.max(48, document.getElementById("taskbar")?.offsetHeight || 56);
}

function px(value: number) {
  return value + "px";
}

function boundsStyle(bounds: Bounds): WindowBoundsStyle {
  return { left: px(bounds.left), top: px(bounds.top), width: px(bounds.width), height: px(bounds.height) };
}

function getCenteredBounds(app: AppDefinition): Bounds {
  const taskbarHeight = getTaskbarHeight();
  const availableWidth = Math.max(280, window.innerWidth - 24);
  const availableHeight = Math.max(220, window.innerHeight - taskbarHeight - 24);
  const width = Math.min(app.width, availableWidth);
  const height = Math.min(app.height, availableHeight);
  return {
    left: Math.max(12, (window.innerWidth - width) / 2 + (Math.random() * 40 - 20)),
    top: Math.max(
      12,
      Math.min(
        (window.innerHeight - height - taskbarHeight) / 2 + (Math.random() * 30 - 15),
        window.innerHeight - height - taskbarHeight - 12,
      ),
    ),
    width,
    height,
  };
}

/**
 * Keeps a title bar reachable: above the taskbar, with at least 120px of it
 * on screen to grab. Off the left edge, the window controls at its right end
 * do not count.
 */
export function clampWindowOrigin(win: HTMLElement, left: number, top: number) {
  const titlebar = win.querySelector<HTMLElement>(".window-titlebar");
  const controls = win.querySelector<HTMLElement>(".window-controls");
  const titlebarBottom = win.clientTop + (titlebar?.offsetTop ?? 0) + (titlebar?.offsetHeight ?? 40);
  const controlsWidth = controls ? win.offsetWidth - win.clientLeft - controls.offsetLeft : 0;
  const visibleWidth = Math.min(MIN_VISIBLE_TITLEBAR, win.offsetWidth);
  const visibleLeftWidth = Math.min(MIN_VISIBLE_TITLEBAR + controlsWidth, win.offsetWidth);
  const maxTop = window.innerHeight - getTaskbarHeight() - titlebarBottom;
  return {
    left: Math.min(Math.max(left, visibleLeftWidth - win.offsetWidth), window.innerWidth - visibleWidth),
    top: Math.min(Math.max(0, top), Math.max(0, maxTop)),
  };
}

/** The clamped position of the window where it is now. */
function clampedPosition(appId: AppId): WindowBoundsStyle {
  const win = elements.get(appId);
  if (!win) return {};
  const next = clampWindowOrigin(win, win.offsetLeft, win.offsetTop);
  return { left: px(next.left), top: px(next.top) };
}

function desktopInitialBounds(appId: AppId): Partial<WindowState> {
  prevBounds.delete(appId);
  const app = getApp(appId)!;
  return {
    mobile: false,
    maximized: false,
    style: { ...get(appId).style, ...boundsStyle(getCenteredBounds(app)) },
  };
}

function mobileBounds(appId: AppId): Partial<WindowState> {
  prevBounds.delete(appId);
  return {
    maximized: true,
    mobile: true,
    style: {
      ...get(appId).style,
      left: "0",
      top: "0",
      width: "100vw",
      height: "calc(100dvh - var(--mobile-taskbar-height, 56px))",
    },
  };
}

// --- Lifecycle -----------------------------------------------------------------

const timers = new Set<number>();
function later(callback: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, ms);
  timers.add(id);
}

/**
 * Opens (or restores, or raises) a window. moveFocus hands keyboard focus to
 * it; every launch then dispatches desktop:window-focus.
 */
export function openWindow(appId: AppId, moveFocus = false) {
  const state = get(appId);
  if (!state) return;
  // Before rendering: a body whose code is there renders with its window;
  // otherwise its download starts now (or starts again after a failure).
  startBodyDownload(appId);
  if (state.open && state.minimized) {
    restoreWindow(appId, moveFocus);
    return;
  }
  if (state.open) {
    activateWindow(appId, moveFocus);
    return;
  }

  // Closing a window opened from the keyboard returns keyboard focus here
  // while it is shown. Start menu and palette items close with their overlay.
  const element = elements.get(appId);
  const active = document.activeElement;
  returnFocus.set(
    appId,
    moveFocus &&
      active instanceof HTMLElement &&
      active !== document.body &&
      !element?.contains(active) &&
      !active.closest("#start-menu, #command-palette, #tray-panel")
      ? active
      : null,
  );

  const firstOpen = !state.hasOpened;
  commit(() => {
    prevBounds.delete(appId);
    patch(appId, {
      open: true,
      minimized: false,
      hidden: false,
      closing: false,
      opening: true,
      mounted: true,
      hasOpened: true,
      ...(mobileMode ? mobileBounds(appId) : desktopInitialBounds(appId)),
    });
    patchStyle(appId, { zIndex: ++topZ });
    setFocused(appId);
  });
  later(() => commit(() => patch(appId, { opening: false })), 300);
  if (moveFocus) focusWindowElement(appId);
  elements.get(appId)?.dispatchEvent(
    new CustomEvent("desktop:window-open", { detail: { appId, firstOpen } }),
  );
  dispatchWindowFocus(appId, moveFocus);
}

export function closeWindow(appId: AppId) {
  const state = get(appId);
  if (!state || !state.open) return;

  elements.get(appId)?.dispatchEvent(new CustomEvent("desktop:window-close", { detail: { appId } }));
  const wasFocused = isWindowFocused(appId);
  const snapshot = snapshotFocus(appId, true);
  let next: AppId | null = null;
  commit(() => {
    patch(appId, { open: false, minimized: false, maximized: false, closing: true });
    if (windowsStore.get().focused === appId) windowsStore.set((current) => ({ ...current, focused: null }));
    next = getActiveWindow();
    if (wasFocused && next) setFocused(next);
  });
  releaseWindowFocus(appId, snapshot, next, true);
  later(() => {
    // Reopened while the closing animation ran.
    if (get(appId).open) return;
    commit(() => patch(appId, { hidden: true, closing: false }));
  }, 200);
}

export function minimizeWindow(appId: AppId) {
  const state = get(appId);
  if (!state || !state.open) return;
  const wasFocused = isWindowFocused(appId);
  const snapshot = snapshotFocus(appId, false);
  let next: AppId | null = null;
  commit(() => {
    patch(appId, { minimized: true });
    if (windowsStore.get().focused === appId) windowsStore.set((current) => ({ ...current, focused: null }));
    next = getActiveWindow();
    if (wasFocused && next) setFocused(next);
  });
  releaseWindowFocus(appId, snapshot, next, false);
}

export function restoreWindow(appId: AppId, moveFocus = false) {
  const state = get(appId);
  if (!state || !state.open) return;
  commit(() => {
    patch(appId, { minimized: false, hidden: false });
    if (mobileMode) patch(appId, mobileBounds(appId));
  });
  if (!mobileMode && !get(appId).maximized) commit(() => patchStyle(appId, clampedPosition(appId)));
  focusWindow(appId);
  if (moveFocus) focusWindowElement(appId);
  dispatchWindowFocus(appId, moveFocus);
}

function unmaximizeWindow(appId: AppId, bounds: Bounds | undefined = prevBounds.get(appId)) {
  if (!bounds) return;
  commit(() => {
    patch(appId, { maximized: false });
    patchStyle(appId, { ...boundsStyle(bounds), zIndex: ++topZ });
  });
  commit(() => patchStyle(appId, clampedPosition(appId)));
}

export function toggleMaximize(appId: AppId) {
  const state = get(appId);
  if (!state || !state.open) return;

  if (mobileMode) {
    commit(() => patch(appId, mobileBounds(appId)));
    focusWindow(appId);
    return;
  }

  if (!state.maximized) {
    const rect = elements.get(appId)?.getBoundingClientRect();
    if (rect) prevBounds.set(appId, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    commit(() => {
      patch(appId, { maximized: true });
      patchStyle(appId, {
        left: "0",
        top: "0",
        width: "100vw",
        height: `calc(100vh - ${getTaskbarHeight()}px)`,
        zIndex: ++topZ,
      });
    });
  } else if (prevBounds.has(appId)) {
    unmaximizeWindow(appId);
  } else {
    // Maximized at phone width, so there are no bounds to restore.
    commit(() => patch(appId, desktopInitialBounds(appId)));
  }
  focusWindow(appId);
}

export function closeAllWindows() {
  for (const app of APPS) {
    if (get(app.id).open) closeWindow(app.id);
  }
}

function startBodyDownload(appId: AppId) {
  loadAppChunk(appId).catch(() => {
    // The window shows the error and tries again on its next launch.
  });
}

/** Mounts an app body without opening its window ("idle" apps). */
export function mountWindowBody(appId: AppId) {
  if (get(appId).mounted) return;
  startBodyDownload(appId);
  commit(() => patch(appId, { mounted: true }));
}

// --- Dragging and resizing (Window.tsx title bar and handles) ----------------

export interface DragSession {
  move(event: MouseEvent): void;
}

/** Starts dragging a window by its title bar; null when it cannot move. */
export function beginWindowDrag(appId: AppId, event: { clientX: number; clientY: number }): DragSession | null {
  const win = elements.get(appId);
  if (!win || mobileMode) return null;
  let dragStartX = event.clientX;
  let dragStartY = event.clientY;
  let winStartX = win.offsetLeft;
  let winStartY = win.offsetTop;
  let wasMaximized = get(appId).maximized;

  return {
    move(moveEvent) {
      if (mobileMode) return;
      const deltaX = moveEvent.clientX - dragStartX;
      const deltaY = moveEvent.clientY - dragStartY;
      if (wasMaximized && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        const saved = prevBounds.get(appId);
        if (saved) {
          const clickRatioX = dragStartX / window.innerWidth;
          const restored = {
            ...saved,
            left: Math.max(0, dragStartX - saved.width * clickRatioX),
            top: 0,
          };
          unmaximizeWindow(appId, restored);
          winStartX = parseInt(win.style.left, 10);
          winStartY = parseInt(win.style.top, 10);
          dragStartX = moveEvent.clientX;
          dragStartY = moveEvent.clientY;
          wasMaximized = false;
        }
      } else if (!wasMaximized) {
        const next = clampWindowOrigin(win, winStartX + deltaX, winStartY + deltaY);
        patchStyle(appId, { left: px(next.left), top: px(next.top) });
      }
    },
  };
}

/** Starts resizing from a handle ("right", "bottom" or "corner"). */
export function beginWindowResize(
  appId: AppId,
  direction: string,
  event: { clientX: number; clientY: number },
): DragSession | null {
  const win = elements.get(appId);
  if (!win || mobileMode || get(appId).maximized) return null;
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = win.offsetWidth;
  const startHeight = win.offsetHeight;
  return {
    move(moveEvent) {
      if (mobileMode) return;
      const style: WindowBoundsStyle = {};
      if (direction === "right" || direction === "corner") {
        style.width = px(Math.max(320, startWidth + moveEvent.clientX - startX));
      }
      if (direction === "bottom" || direction === "corner") {
        style.height = px(Math.max(200, startHeight + moveEvent.clientY - startY));
      }
      patchStyle(appId, style);
    },
  };
}

// --- Viewport --------------------------------------------------------------------

function updateViewportAttributes() {
  const root = document.documentElement;
  root.dataset.viewportMode = mobileMode ? "mobile" : "desktop";
  root.style.setProperty("--mobile-taskbar-height", getTaskbarHeight() + "px");
}

let mobileQuery: MediaQueryList | null = null;

function syncViewportMode() {
  if (!isDesktopSiteMode() || !mobileQuery) return;
  const wasMobile = mobileMode;
  mobileMode = mobileQuery.matches;
  updateViewportAttributes();

  commit(() => {
    for (const app of APPS) {
      const state = get(app.id);
      if (state.mobile !== mobileMode) patch(app.id, { mobile: mobileMode });
      if (!isShown(state)) continue;
      if (mobileMode) patch(app.id, mobileBounds(app.id));
      else if (wasMobile) patch(app.id, desktopInitialBounds(app.id));
    }
  });
  if (!mobileMode && !wasMobile) {
    commit(() => {
      for (const app of APPS) {
        const state = get(app.id);
        if (!isShown(state) || state.maximized) continue;
        const position = clampedPosition(app.id);
        if (position.left !== state.style.left || position.top !== state.style.top) {
          patchStyle(app.id, position);
        }
      }
    });
  }
}

// --- First visit -----------------------------------------------------------------

const FIRST_VISIT_KEY = "pepodev.hasVisited";
let hasVisited = false;
let welcomeTimerId = 0;

function markVisited() {
  hasVisited = true;
  try {
    localStorage.setItem(FIRST_VISIT_KEY, "true");
  } catch {
    // Without storage every visit is a first one.
  }
}

/** Opens Welcome 1.5s after a first visit loads, unless the visitor acted first. */
function scheduleWelcomeWindow() {
  if (hasVisited || welcomeTimerId || !isDesktopSiteMode()) return;
  // A ?blog= deep link opens the article instead.
  if (getBlogDeepLink()) {
    markVisited();
    return;
  }
  welcomeTimerId = window.setTimeout(() => {
    welcomeTimerId = 0;
    if (!isDesktopSiteMode()) return;
    if (userInteracted || userOpenedWindow || getActiveWindow()) {
      markVisited();
      return;
    }
    openWindow("welcome");
    markVisited();
  }, 1500);
}

// --- Start -------------------------------------------------------------------------

function onOpenApp(event: Event) {
  if (!isDesktopSiteMode()) return;
  const appId = (event as CustomEvent<{ appId?: unknown }>).detail?.appId;
  // The Start menu closes on every launch, without taking focus back.
  closeStartMenu();
  if (!isAppId(appId)) return;
  userOpenedWindow = true;
  openWindow(appId, keyboardInteraction);
}

function onKeyTracking(event: KeyboardEvent) {
  if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) keyboardInteraction = true;
}

function onPointerTracking() {
  keyboardInteraction = false;
}

function onFirstInteraction() {
  userInteracted = true;
}

/** Counts input made before the boot (replayed by runtime.tsx), so Welcome stays closed. */
export function noteUserInteraction() {
  userInteracted = true;
}

function onEscape(event: KeyboardEvent) {
  if (!isDesktopSiteMode()) return;
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (isOverlayOpen()) return;
  const active = getActiveWindow();
  if (!active) return;
  event.preventDefault();
  closeWindow(active);
}

function onSiteModeChange(event: Event) {
  if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "desktop") {
    syncViewportMode();
    scheduleWelcomeWindow();
  }
}

/**
 * Starts the window manager: desktop:open-app and desktop:close-all-windows
 * (inputs), Escape, viewport changes and the first-visit Welcome window.
 */
export function startWindowManager(): () => void {
  mobileQuery = window.matchMedia("(max-width: 768px)");
  mobileMode = mobileQuery.matches;
  try {
    hasVisited = localStorage.getItem(FIRST_VISIT_KEY) === "true";
  } catch {
    hasVisited = false;
  }
  const firstInteraction = { capture: true, once: true } as const;
  document.addEventListener("desktop:open-app", onOpenApp);
  document.addEventListener("desktop:close-all-windows", closeAllWindows);
  document.addEventListener("keydown", onKeyTracking, true);
  document.addEventListener("pointerdown", onPointerTracking, true);
  for (const name of ["pointerdown", "keydown", "touchstart"]) {
    document.addEventListener(name, onFirstInteraction, firstInteraction);
  }
  // On window, so it runs after every document listener: overlays and apps
  // that handle an Escape themselves call preventDefault() first.
  window.addEventListener("keydown", onEscape);
  mobileQuery.addEventListener("change", syncViewportMode);
  window.addEventListener("resize", syncViewportMode);
  document.addEventListener("site:mode-change", onSiteModeChange);
  syncViewportMode();
  scheduleWelcomeWindow();

  return () => {
    document.removeEventListener("desktop:open-app", onOpenApp);
    document.removeEventListener("desktop:close-all-windows", closeAllWindows);
    document.removeEventListener("keydown", onKeyTracking, true);
    document.removeEventListener("pointerdown", onPointerTracking, true);
    for (const name of ["pointerdown", "keydown", "touchstart"]) {
      document.removeEventListener(name, onFirstInteraction, firstInteraction);
    }
    window.removeEventListener("keydown", onEscape);
    mobileQuery?.removeEventListener("change", syncViewportMode);
    window.removeEventListener("resize", syncViewportMode);
    document.removeEventListener("site:mode-change", onSiteModeChange);
    window.clearTimeout(welcomeTimerId);
    welcomeTimerId = 0;
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };
}

/** Asks the desktop to open an app, as every launcher does (desktop:open-app). */
export function requestOpenApp(appId: AppId) {
  document.dispatchEvent(new CustomEvent("desktop:open-app", { detail: { appId } }));
}
