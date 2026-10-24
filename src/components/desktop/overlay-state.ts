// The desktop overlays: the Start menu (#start-menu), the tray panel
// (#tray-panel) and the command palette (#command-palette, palette.ts).
// Only one is open at a time: opening one dispatches desktop:overlay-open
// ({ id }) on document, and the open one closes and hands focus back to its
// button first. Closed overlays are inert. Escape, a toggle button, Ctrl/Cmd
// + K or a backdrop click return focus to the opener; launching an app does
// not. Tabbing out of the Start menu or tray closes it. Every overlay calls
// preventDefault() on the Escape it handles, so the window manager does not
// also close the window behind it.
import { focusFirst } from "@utils/overlays";
import { commit, createStore, useStore } from "./store";

export type OverlayId = "start-menu" | "tray-panel" | "command-palette";

export const overlayStore = createStore<OverlayId | null>(null);

export function useOpenOverlay(): OverlayId | null {
  return useStore(overlayStore, (open) => open);
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
 * focus that was inside it (or had dropped to <body>) to the first of
 * `returnTo` that can take it.
 */
export function closeOverlayPanel(
  panel: HTMLElement | null,
  update: () => void,
  { restoreFocus = false, returnTo = [] }: { restoreFocus?: boolean; returnTo?: (Element | null | undefined)[] },
) {
  const active = document.activeElement;
  const hadFocus = !active || active === document.body || Boolean(panel?.contains(active));
  if (active instanceof HTMLElement && panel?.contains(active)) active.blur();
  commit(update);
  if (restoreFocus && hadFocus) focusFirst(returnTo);
}

const byId = (id: string) => document.getElementById(id);

// --- Start menu ----------------------------------------------------------------

/** The Start menu's search text. */
export const startQueryStore = createStore("");

export function useStartQuery(): string {
  return useStore(startQueryStore, (query) => query);
}

// Phones and touch tablets, where focusing the search raises the on-screen
// keyboard over the menu.
const TOUCH_QUERY = "(max-width: 768px), (hover: none), (pointer: coarse)";

/**
 * Opens or closes the Start menu. restoreFocus returns focus to the Start
 * button; launching an app skips that, so app keys are not held back by a
 * focused taskbar button.
 */
export function setStartMenu(open: boolean, { restoreFocus = false } = {}) {
  if (open === isOverlayOpen("start-menu")) return;
  const menu = byId("start-menu");
  if (open) {
    announceOverlay("start-menu");
    commit(() => {
      overlayStore.set("start-menu");
      startQueryStore.set("");
    });
    // Touch screens open the menu without raising the on-screen keyboard.
    (window.matchMedia(TOUCH_QUERY).matches ? menu : byId("start-menu-search"))?.focus();
    return;
  }
  closeOverlayPanel(menu, () => overlayStore.set(null), { restoreFocus, returnTo: [byId("taskbar-start")] });
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
const OVERLAY_CONTROLS =
  "#taskbar-start, #start-menu, #taskbar-clock-button, #taskbar-audio-status, #taskbar-command-palette, #tray-panel";

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

// Tabbing out of a panel closes it, as a click outside does. Pressing its
// button (:active) also moves focus there, but that click toggles it itself.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
  if (!next) return;
  const target = event.target instanceof Element ? event.target : null;
  const menu = byId("start-menu");
  const tray = byId("tray-panel");
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

/** Starts the Start menu and tray listeners. */
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

/** Lets the palette (palette.ts) close when another overlay opens. */
export function registerOverlayCloser(id: OverlayId, close: () => void): () => void {
  closers.set(id, close);
  return () => closers.delete(id);
}
