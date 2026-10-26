// The desktop overlays: Quick Access (#start-menu, the Start menu, whose
// search, commands and links are in quick-access.ts) and the tray panel
// (#tray-panel). Only one is open at a time: opening one dispatches
// desktop:overlay-open ({ id }) on document, and the open one closes and
// hands focus back to its button first. Closed overlays are inert. Escape, a
// toggle button or Ctrl/Cmd + K return focus to what had it before the
// overlay opened; launching an app does not. Both are non-modal: tabbing out
// of one (into a frame too) closes it. Every overlay calls preventDefault()
// on the Escape it handles, so the window manager does not also close the
// window behind it.
import { focusFirst, getFocusedWindow } from "@utils/overlays";
import { commit, createStore, useStore } from "./store";

export type OverlayId = "start-menu" | "tray-panel";

export const overlayStore = createStore<OverlayId | null>(null);

/** Whether `id` is the open overlay; re-renders only when that changes. */
export function useOverlayOpen(id: OverlayId): boolean {
  return useStore(overlayStore, (open) => open === id);
}

export function isOverlayOpen(id?: OverlayId): boolean {
  const open = overlayStore.get();
  return id ? open === id : open !== null;
}

const closers = new Map<OverlayId, () => void>();

/** Closes the other overlays (restoring focus to their buttons) and announces `id`. */
export function announceOverlay(id: OverlayId) {
  document.dispatchEvent(new CustomEvent("desktop:overlay-open", { detail: { id } }));
}

// One overlay at a time, also for overlays outside this module that
// dispatch desktop:overlay-open.
function onOverlayOpen(event: Event) {
  const id = (event as CustomEvent<{ id?: string }>).detail?.id;
  const open = overlayStore.get();
  if (open && open !== id) closers.get(open)?.();
}

/**
 * Takes a closing overlay out of the tab order: blurs focus inside it, runs
 * `update` (which renders it closed and inert), then with restoreFocus moves
 * focus that was inside it (or on its `toggle` button, which a press on it
 * focuses, or had dropped to <body>) to the first of `returnTo` that can
 * take it, and returns that element.
 */
export function closeOverlayPanel(
  panel: HTMLElement | null,
  update: () => void,
  {
    restoreFocus = false,
    returnTo = [],
    toggle = null,
  }: { restoreFocus?: boolean; returnTo?: (Element | null | undefined)[]; toggle?: Element | null },
): HTMLElement | null {
  const active = document.activeElement;
  const hadFocus =
    !active || active === document.body || Boolean(panel?.contains(active)) || (toggle !== null && active === toggle);
  if (active instanceof HTMLElement && panel?.contains(active)) active.blur();
  commit(update);
  return restoreFocus && hadFocus ? focusFirst(returnTo) : null;
}

const byId = (id: string) => document.getElementById(id);

// --- Quick Access (the Start menu) ------------------------------------------------

export interface QuickAccessState {
  query: string;
  /** Index into the visible entries (rankQuickAccessEntries in quick-access.ts). */
  selected: number;
  /** A destructive command waiting for its confirming Enter, click or tap. */
  armed: string | null;
  /** What the armed command asks for (the status line). */
  confirm: string;
}

/** Quick Access as it opens: no query, the top item highlighted, nothing armed. */
export const QUICK_ACCESS_FRESH: QuickAccessState = { query: "", selected: 0, armed: null, confirm: "" };

// Nothing is highlighted until it first opens.
export const quickAccessStore = createStore<QuickAccessState>({ ...QUICK_ACCESS_FRESH, selected: -1 });

// Phones and touch tablets, where focusing the search raises the on-screen
// keyboard over the menu.
const TOUCH_QUERY = "(max-width: 768px), (hover: none), (pointer: coarse)";

// What had focus before Quick Access opened, and when that is a frame (the
// Garden window), the element focused inside it, which the frame forgets as
// focus leaves it.
let quickAccessOpener: HTMLElement | null = null;
let quickAccessOpenerInFrame: HTMLElement | null = null;

/** The element focused inside a same-origin frame, if any. */
function focusedInFrame(element: Element | null): HTMLElement | null {
  if (!(element instanceof HTMLIFrameElement)) return null;
  const frameDocument = element.contentDocument;
  const inner = frameDocument?.activeElement;
  return frameDocument && inner && inner !== frameDocument.body ? (inner as HTMLElement) : null;
}

/**
 * Opens or closes Quick Access (the Start menu). Opening focuses its search
 * box, or on phones and touch tablets the menu itself, so no on-screen
 * keyboard covers it; focusSearch (Ctrl/Cmd + K) focuses the search box on
 * every screen. It opens scrolled to the top, where the highlight is.
 * Closing with restoreFocus returns focus to what had it before Quick Access
 * opened (a window or a field inside the Garden's frame included), else to
 * the topmost window, else to the Start button; `returnTo` replaces that
 * order. Launching an app skips it: the window takes focus.
 */
export function setStartMenu(
  open: boolean,
  {
    restoreFocus = false,
    focusSearch = false,
    returnTo,
  }: { restoreFocus?: boolean; focusSearch?: boolean; returnTo?: (Element | null | undefined)[] } = {},
) {
  if (open === isOverlayOpen("start-menu")) return;
  const menu = byId("start-menu");
  const startButton = byId("taskbar-start");
  if (open) {
    // The tray closes first and hands focus back to its button, so that is
    // where closing Quick Access returns it.
    announceOverlay("start-menu");
    const active = document.activeElement;
    quickAccessOpener =
      active instanceof HTMLElement && active !== document.body && !menu?.contains(active) ? active : null;
    quickAccessOpenerInFrame = focusedInFrame(quickAccessOpener);
    commit(() => {
      overlayStore.set("start-menu");
      quickAccessStore.set(QUICK_ACCESS_FRESH);
    });
    // The results keep their scroll position while closed.
    const results = byId("start-menu-results");
    if (results) results.scrollTop = 0;
    // The commit rendered the menu open (no longer inert), so focus moves
    // now: keys typed straight after Ctrl/Cmd + K reach the search instead
    // of being lost before a delayed focus, which left Enter to run the
    // first item.
    const touch = !focusSearch && window.matchMedia(TOUCH_QUERY).matches;
    (touch ? menu : byId("start-menu-search"))?.focus();
    return;
  }
  const opener = quickAccessOpener;
  const openerInFrame = quickAccessOpenerInFrame;
  quickAccessOpener = quickAccessOpenerInFrame = null;
  const restored = closeOverlayPanel(
    menu,
    () => {
      overlayStore.set(null);
      // Closing disarms Reset Desktop.
      quickAccessStore.set((state) => ({ ...state, armed: null, confirm: "" }));
    },
    {
      restoreFocus,
      // A press on the Start button focuses it before it closes the menu.
      toggle: startButton,
      returnTo: returnTo ?? [opener, getFocusedWindow(), startButton],
    },
  );
  // Focusing the frame alone leaves focus on its <body>.
  if (restored === opener && openerInFrame?.isConnected) openerInFrame.focus({ preventScroll: true });
}

export function closeStartMenu() {
  setStartMenu(false);
}

// --- Tray panel ------------------------------------------------------------------

let trayOpener: HTMLElement | null = null;

/** Opens or closes the tray. restoreFocus returns focus to the button that opened it. */
export function setTrayOpen(
  open: boolean,
  { opener = null, restoreFocus = false }: { opener?: HTMLElement | null; restoreFocus?: boolean } = {},
) {
  if (open === isOverlayOpen("tray-panel")) return;
  if (open) {
    trayOpener = opener;
    announceOverlay("tray-panel");
    commit(() => overlayStore.set("tray-panel"));
    return;
  }
  closeOverlayPanel(byId("tray-panel"), () => overlayStore.set(null), {
    restoreFocus,
    returnTo: [trayOpener],
  });
  trayOpener = null;
}

// --- Shared listeners ----------------------------------------------------------------

// Clicks on these never close an overlay by clicking "outside": each toggles
// or opens one itself (the old controllers stopped their propagation).
const OVERLAY_CONTROLS = "#taskbar-start, #start-menu, #taskbar-clock-button, #taskbar-audio-status, #tray-panel";

function onDocumentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(OVERLAY_CONTROLS)) return;
  setStartMenu(false);
  setTrayOpen(false);
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (isOverlayOpen("start-menu")) {
    event.preventDefault();
    setStartMenu(false, { restoreFocus: true });
  } else if (isOverlayOpen("tray-panel")) {
    event.preventDefault();
    setTrayOpen(false, { restoreFocus: true });
  }
}

// Focus that leaves a panel for a frame (Shift+Tab into the Garden window)
// has no relatedTarget, so where it went shows only once it has moved: on
// the frame, while the page keeps focus (it does not when the browser
// window loses it).
function closeForFocusedFrame() {
  if (!(document.activeElement instanceof HTMLIFrameElement) || !document.hasFocus()) return;
  setStartMenu(false);
  setTrayOpen(false);
}

// Tabbing out of a panel closes it, as a click outside does. Pressing its
// button (:active) also moves focus there, but that click toggles it itself.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
  const target = event.target instanceof Element ? event.target : null;
  const menu = byId("start-menu");
  const tray = byId("tray-panel");
  if (!next) {
    if (target && (menu?.contains(target) || tray?.contains(target))) window.setTimeout(closeForFocusedFrame);
    return;
  }
  if (isOverlayOpen("start-menu") && menu && target && menu.contains(target) && !menu.contains(next)) {
    const startButton = byId("taskbar-start");
    if (startButton?.contains(next) && startButton.matches(":active")) return;
    setStartMenu(false);
  }
  if (isOverlayOpen("tray-panel") && tray && target && tray.contains(target) && !tray.contains(next)) {
    const trayButton = [byId("taskbar-clock-button"), byId("taskbar-audio-status")].find((button) =>
      button?.contains(next),
    );
    if (trayButton?.matches(":active")) return;
    setTrayOpen(false);
  }
}

/** Starts the Quick Access and tray listeners (Ctrl/Cmd + K: quick-access.ts). */
export function startOverlays(): () => void {
  closers.set("start-menu", () => setStartMenu(false, { restoreFocus: true }));
  closers.set("tray-panel", () => setTrayOpen(false, { restoreFocus: true }));
  document.addEventListener("desktop:overlay-open", onOverlayOpen);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onEscape);
  document.addEventListener("focusout", onFocusOut);
  return () => {
    closers.delete("start-menu");
    closers.delete("tray-panel");
    document.removeEventListener("desktop:overlay-open", onOverlayOpen);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("focusout", onFocusOut);
  };
}

/** Lets an overlay kept outside this module close when another one opens. */
export function registerOverlayCloser(id: OverlayId, close: () => void): () => void {
  closers.set(id, close);
  return () => closers.delete(id);
}
