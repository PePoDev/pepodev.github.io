// Quick Access (#start-menu, StartMenu.tsx): the desktop's one launcher, for
// apps, commands and links. The Start button or Ctrl/Cmd + K (any case)
// opens it in desktop mode; it is non-modal, and overlay-state.ts opens and
// closes it (one overlay at a time, focus return, tabbing out closes it).
//
// - An empty query shows three titled sections: Apps, Commands, Links.
//   Searching shows one flat list, ranked by rankMatch (src/utils/search.ts):
//   names that start with the query (or a word in them) first, then other
//   name matches, then description matches, so "set" puts Settings above
//   Reset Desktop. Every item stays in the DOM (hidden ones display: none),
//   so the visual, Tab and arrow-key orders agree.
// - The top match is highlighted; ArrowUp and ArrowDown move the highlight
//   (and focus, when it is on an item), and it follows focus and clicks.
//   Enter in the search box runs the highlighted entry.
// - Reset Desktop runs only on a second Enter, click or tap: the first arms
//   it and the status line says why. Typing, choosing another item or
//   closing disarms it.
import type { SocialLink } from "@app-types/data";
import socialLinks from "@data/social-links.json";
import { rankMatch } from "@utils/search";
import { APPS } from "./apps";
import {
  isOverlayOpen,
  QUICK_ACCESS_FRESH,
  quickAccessStore,
  setStartMenu,
  type QuickAccessState,
} from "./overlay-state";
import { isDesktopSiteMode } from "./site-mode";
import { commit, useStore } from "./store";

export type QuickAccessSection = "Apps" | "Commands" | "Links";

export const QUICK_ACCESS_SECTIONS: readonly QuickAccessSection[] = ["Apps", "Commands", "Links"];

export interface QuickAccessEntry {
  /** The app id, the command id, or link-<icon> for a link. */
  id: string;
  type: "app" | "command" | "link";
  section: QuickAccessSection;
  name: string;
  description: string;
  /** An AppIcon name (apps and links) or a command id (StartMenu.tsx draws those). */
  icon: string;
  href?: string;
  /** Destructive commands: the first Enter, click or tap only shows this. */
  confirm?: string;
  confirmTouch?: string;
}

const commands: QuickAccessEntry[] = [
  {
    id: "toggle-theme",
    type: "command",
    section: "Commands",
    name: "Toggle Theme",
    description: "Switch between dark and light theme",
    icon: "toggle-theme",
  },
  {
    id: "close-all-windows",
    type: "command",
    section: "Commands",
    name: "Close All Windows",
    description: "Close all open application windows",
    icon: "close-all-windows",
  },
  {
    id: "reset-desktop",
    type: "command",
    section: "Commands",
    name: "Reset Desktop",
    description: "Clear all settings and state for a fresh start",
    icon: "reset-desktop",
    confirm: "Press Enter or click Reset Desktop again to clear all settings and reload.",
    confirmTouch: "Tap Reset Desktop again to clear all settings and reload.",
  },
];

/** Every entry, in section order. */
export const QUICK_ACCESS_ENTRIES: readonly QuickAccessEntry[] = [
  ...APPS.map(
    (app): QuickAccessEntry => ({
      id: app.id,
      type: "app",
      section: "Apps",
      name: app.label,
      description: app.startDescription,
      icon: app.id,
    }),
  ),
  ...commands,
  ...(socialLinks as SocialLink[]).map(
    (link): QuickAccessEntry => ({
      id: `link-${link.icon}`,
      type: "link",
      section: "Links",
      name: link.label.split(" - ")[0],
      description: `Open ${link.label}`,
      icon: link.icon,
      href: link.href,
    }),
  ),
];

/** The entries a query shows, best match first (all, in section order, when empty). */
export function rankQuickAccessEntries(query: string): QuickAccessEntry[] {
  const lowerQuery = query.trim().toLowerCase();
  return QUICK_ACCESS_ENTRIES.map((entry, order) => ({
    entry,
    order,
    rank: rankMatch(entry.name.toLowerCase(), entry.description.toLowerCase(), lowerQuery),
  }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ entry }) => entry);
}

export function useQuickAccess(): QuickAccessState {
  return useStore(quickAccessStore, (state) => state);
}

const byId = (id: string) => document.getElementById(id);

function visibleEntries(): QuickAccessEntry[] {
  return rankQuickAccessEntries(quickAccessStore.get().query);
}

/** The rendered, visible items, in order (the same order as visibleEntries). */
function visibleItemElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("#start-menu-results .start-menu-item")).filter(
    (item) => item.style.display !== "none",
  );
}

function scrollSelectionIntoView() {
  visibleItemElements()[quickAccessStore.get().selected]?.scrollIntoView({ block: "nearest" });
}

/**
 * Opens Quick Access with focus in its search box, also on touch screens
 * (Ctrl/Cmd + K, desktop:open-quick-access, the replay of an early Ctrl/Cmd +
 * K), or focuses the search box when it is open already.
 */
export function openQuickAccess() {
  if (!isDesktopSiteMode()) return;
  if (isOverlayOpen("start-menu")) byId("start-menu-search")?.focus();
  else setStartMenu(true, { focusSearch: true });
}

/** Ctrl/Cmd + K: opens Quick Access, or closes it and returns focus. */
export function toggleQuickAccess() {
  if (isOverlayOpen("start-menu")) setStartMenu(false, { restoreFocus: true });
  else openQuickAccess();
}

/** Typing filters, highlights the top match and disarms. */
export function setQuickAccessQuery(query: string) {
  commit(() => quickAccessStore.set({ ...QUICK_ACCESS_FRESH, query, selected: 0 }));
  scrollSelectionIntoView();
}

function setSelected(index: number) {
  const state = quickAccessStore.get();
  // Choosing another item cancels a pending confirmation.
  const disarm = state.armed !== null && visibleEntries()[index]?.id !== state.armed;
  if (index === state.selected && !disarm) return;
  commit(() =>
    quickAccessStore.set({ ...state, selected: index, ...(disarm ? { armed: null, confirm: "" } : {}) }),
  );
  scrollSelectionIntoView();
}

/** The highlight follows keyboard focus and clicks. */
export function selectQuickAccessEntry(id: string) {
  const index = visibleEntries().findIndex((entry) => entry.id === id);
  if (index >= 0) setSelected(index);
}

/** ArrowUp and ArrowDown; focus moves along once it is on an item. */
export function moveQuickAccessSelection(delta: number) {
  const items = visibleItemElements();
  if (items.length === 0) return;
  const focusedItem = items.includes(document.activeElement as HTMLElement);
  setSelected(Math.max(0, Math.min(quickAccessStore.get().selected + delta, items.length - 1)));
  if (focusedItem) visibleItemElements()[quickAccessStore.get().selected]?.focus();
}

/**
 * Enter in the search box: runs the highlighted entry through its item's
 * click, as a pointer would (apps are [data-open-app] launchers). Returns
 * whether there was one.
 */
export function runHighlightedEntry(): boolean {
  const item = visibleItemElements()[quickAccessStore.get().selected];
  item?.click();
  return Boolean(item);
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

function arm(entry: QuickAccessEntry) {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  commit(() =>
    quickAccessStore.set((state) => ({
      ...state,
      armed: entry.id,
      confirm: (coarse && entry.confirmTouch) || entry.confirm || "",
    })),
  );
}

function runCommand(id: string) {
  if (id === "reset-desktop") {
    setStartMenu(false);
    resetDesktop();
  } else if (id === "toggle-theme") {
    // The preferences store (prefs.ts) applies it, as for Settings.
    document.dispatchEvent(new CustomEvent("desktop:toggle-theme"));
    setStartMenu(false, { restoreFocus: true });
  } else if (id === "close-all-windows") {
    document.dispatchEvent(new CustomEvent("desktop:close-all-windows"));
    // No window is left to take focus back.
    setStartMenu(false, { restoreFocus: true, returnTo: [byId("taskbar-start")] });
  }
}

/**
 * Runs a command or opens a link (their items' clicks). App items are
 * [data-open-app] launchers, which the desktop opens (runtime.tsx); the
 * launch closes Quick Access without taking focus back, as the window takes it.
 */
export function runQuickAccessEntry(entry: QuickAccessEntry) {
  if (entry.type === "command") {
    if (entry.confirm && quickAccessStore.get().armed !== entry.id) {
      arm(entry);
      return;
    }
    runCommand(entry.id);
  } else if (entry.type === "link" && entry.href) {
    window.open(entry.href, "_blank", "noopener,noreferrer");
    setStartMenu(false, { restoreFocus: true });
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (!isDesktopSiteMode()) return;
  if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === "k") {
    event.preventDefault();
    toggleQuickAccess();
  }
}

// Website mode has no Quick Access; the mode switch hands focus over itself.
function onSiteModeChange(event: Event) {
  if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "website") setStartMenu(false);
}

const onOpenQuickAccess = () => openQuickAccess();

// desktop:open-command-palette is the name the event had before Quick
// Access took over the command palette; it stays an alias.
const OPEN_EVENTS = ["desktop:open-quick-access", "desktop:open-command-palette"] as const;

/** Starts Ctrl/Cmd + K and the open events (the boot). */
export function startQuickAccess(): () => void {
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("site:mode-change", onSiteModeChange);
  for (const name of OPEN_EVENTS) document.addEventListener(name, onOpenQuickAccess);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("site:mode-change", onSiteModeChange);
    for (const name of OPEN_EVENTS) document.removeEventListener(name, onOpenQuickAccess);
  };
}
