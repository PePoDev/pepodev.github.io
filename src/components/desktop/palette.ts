// The command palette's rules: Ctrl/Cmd + K (any case) or the taskbar button
// opens it in desktop mode. The open palette is modal: Tab and Shift+Tab cycle
// through its input and visible results. Search ranks names that start with
// the query first, then other name matches, then description matches
// (rankMatch in src/utils/search.ts), as one flat list across sections. Enter
// runs the top match, or the focused item; Reset Desktop runs only on a second
// Enter, click or tap, with the reason in the status line.
import type { SocialLink } from "@app-types/data";
import socialLinks from "@data/social-links.json";
import { getFocusedWindow } from "@utils/overlays";
import { rankMatch } from "@utils/search";
import { APPS } from "./apps";
import { announceOverlay, closeOverlayPanel, isOverlayOpen, overlayStore, registerOverlayCloser } from "./overlay-state";
import { isDesktopSiteMode } from "./site-mode";
import { commit, createStore, useStore } from "./store";

export type PaletteSection = "Commands" | "Apps" | "External Links";

export interface PaletteEntry {
  id: string;
  type: "command" | "app" | "external";
  section: PaletteSection;
  name: string;
  description: string;
  icon: string;
  href?: string;
  /** Destructive commands: the first Enter, click or tap only shows this. */
  confirm?: string;
  confirmTouch?: string;
}

const commands: PaletteEntry[] = [
  {
    id: "reset-desktop",
    type: "command",
    section: "Commands",
    name: "Reset Desktop",
    description: "Clear all settings and state for a fresh start",
    icon: "🔄",
    confirm: "Press Enter or click Reset Desktop again to clear all settings and reload.",
    confirmTouch: "Tap Reset Desktop again to clear all settings and reload.",
  },
  {
    id: "toggle-theme",
    type: "command",
    section: "Commands",
    name: "Toggle Theme",
    description: "Switch between dark and light theme",
    icon: "🌓",
  },
  {
    id: "close-all-windows",
    type: "command",
    section: "Commands",
    name: "Close All Windows",
    description: "Close all open application windows",
    icon: "❌",
  },
];

/** Every palette item in section order. */
export const PALETTE_ENTRIES: readonly PaletteEntry[] = [
  ...commands,
  ...APPS.map(
    (app): PaletteEntry => ({
      id: app.id,
      type: "app",
      section: "Apps",
      name: app.label,
      description: app.paletteDescription,
      icon: "📦",
    }),
  ),
  ...(socialLinks as SocialLink[]).map(
    (link): PaletteEntry => ({
      id: `external-${link.icon}`,
      type: "external",
      section: "External Links",
      name: link.label.split(" - ")[0],
      description: `Open ${link.label}`,
      icon: "🔗",
      href: link.href,
    }),
  ),
];

/** The entries a query shows, best match first (all, in order, when empty). */
export function rankPaletteEntries(query: string): PaletteEntry[] {
  const lowerQuery = query.trim().toLowerCase();
  return PALETTE_ENTRIES.map((entry, order) => ({
    entry,
    order,
    rank: rankMatch(entry.name.toLowerCase(), entry.description.toLowerCase(), lowerQuery),
  }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ entry }) => entry);
}

export interface PaletteState {
  query: string;
  /** Index into the visible entries. */
  selected: number;
  /** A destructive command waiting for its confirming Enter, click or tap. */
  armed: string | null;
  status: string;
  tone: "" | "warning";
}

const initialState: PaletteState = { query: "", selected: 0, armed: null, status: "", tone: "" };

// Nothing is highlighted until the palette first opens, as before.
export const paletteStore = createStore<PaletteState>({ ...initialState, selected: -1 });

export function usePalette(): PaletteState {
  return useStore(paletteStore, (state) => state);
}

export function isPaletteOpen(): boolean {
  return isOverlayOpen("command-palette");
}

function visibleEntries(): PaletteEntry[] {
  return rankPaletteEntries(paletteStore.get().query);
}

function emptyStatus(query: string): Pick<PaletteState, "status" | "tone"> {
  return {
    status: rankPaletteEntries(query).length ? "" : "No matching apps or commands",
    tone: "",
  };
}

const byId = (id: string) => document.getElementById(id);

/** The rendered, visible item buttons, in order. */
function visibleItemElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("#command-palette-results .command-palette-item"),
  ).filter((item) => item.style.display !== "none");
}

function scrollSelectionIntoView() {
  visibleItemElements()[paletteStore.get().selected]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// The control that had focus before the palette opened.
let returnFocusTo: HTMLElement | null = null;

export function openPalette() {
  if (!isDesktopSiteMode() || isPaletteOpen()) return;
  // The Start menu and tray close first and hand focus back to their buttons,
  // so that is where closing the palette returns it.
  announceOverlay("command-palette");
  const palette = byId("command-palette");
  const active = document.activeElement;
  returnFocusTo =
    active instanceof HTMLElement && active !== document.body && !palette?.contains(active) ? active : null;
  commit(() => {
    overlayStore.set("command-palette");
    paletteStore.set({ ...initialState, ...emptyStatus("") });
  });
  // The commit rendered the palette open (no longer inert), so the input
  // takes focus now: keys typed straight after Ctrl/Cmd + K reach the search
  // instead of being lost before a delayed focus, which left Enter to run
  // the first item (arming Reset Desktop).
  byId("command-palette-input")?.focus();
}

/**
 * Closes the palette. restoreFocus hands focus back to whatever opened it,
 * or, when that is gone (Close All Windows), to the topmost window or the
 * palette button. Launching an app skips that: focus left on a control
 * outside the new window would keep app keys (Calculator, Snake) away from it.
 */
export function closePalette({ restoreFocus = false } = {}) {
  if (!isPaletteOpen()) return;
  closeOverlayPanel(
    byId("command-palette"),
    () => {
      overlayStore.set(null);
      paletteStore.set((state) => ({ ...state, armed: null, status: "", tone: "" }));
    },
    {
      restoreFocus,
      returnTo: returnFocusTo ? [returnFocusTo, getFocusedWindow(), byId("taskbar-command-palette")] : [],
    },
  );
  returnFocusTo = null;
}

export function togglePalette() {
  if (isPaletteOpen()) closePalette({ restoreFocus: true });
  else openPalette();
}

/** Typing filters and disarms. */
export function setPaletteQuery(query: string) {
  commit(() => paletteStore.set({ ...initialState, query, ...emptyStatus(query) }));
  scrollSelectionIntoView();
}

function setSelected(index: number) {
  const state = paletteStore.get();
  const entries = visibleEntries();
  // Selecting another item cancels a pending confirmation.
  const disarm = state.armed !== null && entries[index]?.id !== state.armed;
  commit(() =>
    paletteStore.set({
      ...state,
      selected: index,
      ...(disarm ? { armed: null, status: "", tone: "" as const } : {}),
    }),
  );
  scrollSelectionIntoView();
}

/** The highlight follows keyboard focus and clicks. */
export function selectPaletteEntry(id: string) {
  const index = visibleEntries().findIndex((entry) => entry.id === id);
  if (index < 0 || index === paletteStore.get().selected) return;
  setSelected(index);
}

function moveSelection(delta: number) {
  const focusedItem = byId("command-palette-results")?.contains(document.activeElement);
  const count = visibleEntries().length;
  setSelected(Math.max(0, Math.min(paletteStore.get().selected + delta, count - 1)));
  // Keep keyboard focus on the highlighted item once Tab has moved it there.
  if (focusedItem) visibleItemElements()[paletteStore.get().selected]?.focus();
}

function arm(entry: PaletteEntry) {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  commit(() =>
    paletteStore.set((state) => ({
      ...state,
      armed: entry.id,
      status: (coarse && entry.confirmTouch) || entry.confirm || "",
      tone: "warning",
    })),
  );
}

/** Clears every pepodev.* key and reloads (Reset Desktop, Settings' reset). */
export function resetDesktop(delay = 500) {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("pepodev.")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing saved to clear.
  }
  window.setTimeout(() => window.location.reload(), delay);
}

function executeCommand(id: string) {
  if (id === "reset-desktop") {
    closePalette();
    resetDesktop();
  } else if (id === "toggle-theme") {
    // The preferences store (prefs.ts) applies it, as for Settings.
    document.dispatchEvent(new CustomEvent("desktop:toggle-theme"));
    closePalette({ restoreFocus: true });
  } else if (id === "close-all-windows") {
    document.dispatchEvent(new CustomEvent("desktop:close-all-windows"));
    closePalette({ restoreFocus: true });
  }
}

export function executePaletteEntry(entry: PaletteEntry) {
  if (entry.type === "command") {
    if (entry.confirm && paletteStore.get().armed !== entry.id) {
      arm(entry);
      return;
    }
    executeCommand(entry.id);
  } else if (entry.type === "app") {
    document.dispatchEvent(new CustomEvent("desktop:open-app", { detail: { appId: entry.id } }));
    closePalette();
  } else if (entry.href) {
    window.open(entry.href, "_blank", "noopener,noreferrer");
    closePalette({ restoreFocus: true });
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (!isDesktopSiteMode()) return;

  if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === "k") {
    event.preventDefault();
    togglePalette();
    return;
  }

  if (!isPaletteOpen()) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closePalette({ restoreFocus: true });
    return;
  }

  // The open palette is modal: Tab and Shift+Tab cycle through its input and
  // visible results.
  if (event.key === "Tab") {
    event.preventDefault();
    const input = byId("command-palette-input");
    const stops = [input, ...visibleItemElements()].filter((stop): stop is HTMLElement => Boolean(stop));
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    // From anywhere else, Tab starts at the input, Shift+Tab at the end.
    const from = at >= 0 ? at : event.shiftKey ? 0 : -1;
    stops[(from + step + stops.length) % stops.length]?.focus();
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(event.key === "ArrowDown" ? 1 : -1);
    return;
  }

  if (event.key === "Enter") {
    // A focused item runs through its native button click instead.
    if (byId("command-palette-results")?.contains(document.activeElement) || event.isComposing) return;
    event.preventDefault();
    const entry = visibleEntries()[paletteStore.get().selected];
    if (entry) executePaletteEntry(entry);
  }
}

function onSiteModeChange(event: Event) {
  if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "website") closePalette();
}

const onOpenCommandPalette = () => openPalette();

export function startPalette(): () => void {
  const unregister = registerOverlayCloser("command-palette", () => closePalette());
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("site:mode-change", onSiteModeChange);
  document.addEventListener("desktop:open-command-palette", onOpenCommandPalette);
  return () => {
    unregister();
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("site:mode-change", onSiteModeChange);
    document.removeEventListener("desktop:open-command-palette", onOpenCommandPalette);
  };
}
