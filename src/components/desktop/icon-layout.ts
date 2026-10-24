// Desktop icon layout after hydration (port of DesktopIconController and
// ExternalLinkIconController). App icons (#desktop-icons) and link icons
// (#desktop-links) share one grid (icon-grid.ts). Above 768px icons sit at
// fixed positions and stay hidden until placed (data-desktop-icon-ready, see
// desktop.css), so the first layout does not shift; the parse-time script in
// DesktopScripts.tsx places them before first paint and this module takes
// over with the same result. At phone widths the CSS grid lays them out.
//
// Only a drag saves a position (pepodev.desktopIcon.v3.<appId>,
// pepodev.linkIcon.v4.<link id>); dropping on an occupied cell swaps the two
// icons. Resizes re-clamp in memory, and layout waits while the desktop is
// hidden (website mode measures it as 0x0).
import socialLinks from "@data/social-links.json";
import type { SocialLink } from "@app-types/data";
import { DESKTOP_ICON_ORDER, getApp } from "./apps";
import {
  createIconGrid,
  ICON_STORAGE_PREFIX,
  LINK_ICON_STORAGE_PREFIX,
  layoutIcons,
  readIconPosition,
  removeStaleIconPositions,
  type GridCell,
  type GridIcon,
  type GridPoint,
  type IconGrid,
} from "./icon-grid";
import { commit, createStore, useStore } from "./store";

export interface DesktopLink {
  /** Element id, link-<icon>; also its storage key suffix. */
  id: string;
  icon: string;
  label: string;
  href: string;
  /** Grid order down the right edge: Webring first. */
  shortcutIndex: number;
}

/** The external link shortcuts, in markup order (social-links.json). */
export const DESKTOP_LINKS: readonly DesktopLink[] = (socialLinks as SocialLink[]).map((link, index) => ({
  id: `link-${link.icon}`,
  icon: link.icon,
  label: link.label.split(" - ")[0],
  href: link.href,
  shortcutIndex: link.icon === "webring" ? 0 : index + 1,
}));

/** Every icon as the grid sees it: app icons in markup order, then links in shortcut order. */
export const GRID_ICONS: readonly GridIcon[] = [
  ...DESKTOP_ICON_ORDER.map((appId): GridIcon => {
    const { icon } = getApp(appId)!;
    return { id: appId, link: false, col: icon.col, row: icon.row, group: icon.group, index: icon.index };
  }),
  ...[...DESKTOP_LINKS]
    .sort((a, b) => a.shortcutIndex - b.shortcutIndex)
    .map((link): GridIcon => ({ id: link.id, link: true, shortcut: link.shortcutIndex })),
];

export interface IconState {
  /** Fixed position; null leaves the icon to the CSS grid. */
  position: GridPoint | null;
  /** data-desktop-icon-ready: placed once. */
  ready: boolean;
  /** Inline z-index while pressed ("30") and after ("5"). */
  zIndex: string;
  dragging: boolean;
}

const unplaced: IconState = { position: null, ready: false, zIndex: "", dragging: false };

export const iconStore = createStore<Record<string, IconState>>(
  Object.fromEntries(GRID_ICONS.map((icon) => [icon.id, unplaced])),
);

export function useIconState(id: string): IconState {
  return useStore(iconStore, (icons) => icons[id] ?? unplaced);
}

function patchIcon(id: string, change: Partial<IconState>) {
  iconStore.set((icons) => ({ ...icons, [id]: { ...(icons[id] ?? unplaced), ...change } }));
}

// --- Elements and runtime state ---------------------------------------------------

const elements = new Map<string, HTMLElement>();

export function registerIconElement(id: string, element: HTMLElement | null) {
  if (element) elements.set(id, element);
  else elements.delete(id);
}

const savedPositions = new Map<string, GridPoint>();
let occupied: Record<string, string> = {};
let cells: Record<string, GridCell> = {};
let mobileQuery: MediaQueryList | null = null;

export function isMobileLauncherMode(): boolean {
  return Boolean(mobileQuery?.matches);
}

function storageKey(id: string) {
  const isLink = GRID_ICONS.find((icon) => icon.id === id)?.link;
  return (isLink ? LINK_ICON_STORAGE_PREFIX : ICON_STORAGE_PREFIX) + id;
}

function firstIcon(): HTMLElement | undefined {
  return elements.get(GRID_ICONS[0].id);
}

// A hidden desktop measures as 0x0, so layout waits until it is shown.
function isDesktopShown() {
  return document.documentElement.dataset.siteMode === "desktop" && (firstIcon()?.offsetWidth ?? 0) > 0;
}

function currentGrid(): IconGrid | null {
  const icon = firstIcon();
  if (!icon) return null;
  return createIconGrid(window.innerWidth, window.innerHeight, icon.offsetWidth, icon.offsetHeight);
}

function clampFor(grid: IconGrid, id: string, point: GridPoint): GridPoint {
  const element = elements.get(id);
  return grid.clamp(point.x, point.y, element?.offsetWidth ?? 0, element?.offsetHeight ?? 0);
}

function samePoint(a: GridPoint | null, b: GridPoint | null) {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

/** Lays every icon out on the grid (or hands them to the CSS grid on phones). */
export function layoutDesktopIcons() {
  if (isMobileLauncherMode()) {
    commit(() => {
      for (const icon of GRID_ICONS) {
        const state = iconStore.get()[icon.id];
        if (state.position || state.zIndex) patchIcon(icon.id, { position: null, zIndex: "" });
      }
    });
    return;
  }
  if (!isDesktopShown()) return;
  const grid = currentGrid();
  if (!grid) return;
  const layout = layoutIcons(grid, [...GRID_ICONS], Object.fromEntries(savedPositions));
  occupied = layout.occupied;
  cells = layout.cells;
  commit(() => {
    for (const icon of GRID_ICONS) {
      const position = clampFor(grid, icon.id, grid.cellPosition(layout.cells[icon.id]));
      const state = iconStore.get()[icon.id];
      if (!state.ready || !samePoint(state.position, position)) patchIcon(icon.id, { position, ready: true });
    }
  });
}

// Only an explicit drag saves a position; resizes re-clamp in memory.
function saveIconPosition(id: string, position: GridPoint) {
  savedPositions.set(id, position);
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(position));
  } catch {
    // Dragging still works for the current session.
  }
}

/** Moves a dragged icon (clamped to the screen). */
export function moveIcon(id: string, x: number, y: number) {
  const grid = currentGrid();
  if (!grid) return;
  patchIcon(id, { position: clampFor(grid, id, { x, y }), dragging: true });
}

/**
 * Snaps a dragged icon to the nearest cell. An icon already in that cell,
 * app or link, swaps into the dragged icon's previous cell.
 */
export function dropIcon(id: string, x: number, y: number) {
  const grid = currentGrid();
  if (!grid) return;
  const cell = grid.cellFromPosition({ x, y });
  const occupiedId = occupied[grid.key(cell)];
  const previousCell = cells[id];
  const dropKeys = new Set([grid.key(cell)]);
  if (previousCell) dropKeys.add(grid.key(previousCell));

  // A saved icon displaced on this screen size would reclaim a cell of this
  // drop on the next layout; pin it where it is shown instead.
  savedPositions.forEach((position, other) => {
    if (other === id || other === occupiedId) return;
    const shownCell = cells[other];
    const savedKey = grid.key(grid.cellFromPosition(position));
    if (shownCell && dropKeys.has(savedKey) && savedKey !== grid.key(shownCell)) {
      saveIconPosition(other, grid.cellPosition(shownCell));
    }
  });

  if (occupiedId && occupiedId !== id && previousCell) {
    saveIconPosition(occupiedId, grid.cellPosition(previousCell));
  }
  saveIconPosition(id, grid.cellPosition(cell));
  commit(() => patchIcon(id, { dragging: false }));
  layoutDesktopIcons();
}

/** Raises a pressed icon above the others, and drops it back after. */
export function setIconPressed(id: string, pressed: boolean) {
  commit(() => patchIcon(id, { zIndex: pressed ? "30" : "5", ...(pressed ? {} : { dragging: false }) }));
}

function onSiteModeChange(event: Event) {
  if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "desktop") layoutDesktopIcons();
}

/** Loads saved positions, lays the icons out and follows resizes. */
export function startIconLayout(): () => void {
  mobileQuery = window.matchMedia("(max-width: 768px)");
  savedPositions.clear();
  try {
    removeStaleIconPositions(localStorage, ICON_STORAGE_PREFIX, LINK_ICON_STORAGE_PREFIX);
    for (const icon of GRID_ICONS) {
      const saved = readIconPosition(localStorage, storageKey(icon.id));
      if (saved) savedPositions.set(icon.id, saved);
    }
  } catch {
    // Without storage every icon takes its default cell.
  }
  layoutDesktopIcons();
  mobileQuery.addEventListener("change", layoutDesktopIcons);
  window.addEventListener("resize", layoutDesktopIcons);
  document.addEventListener("site:mode-change", onSiteModeChange);
  return () => {
    mobileQuery?.removeEventListener("change", layoutDesktopIcons);
    window.removeEventListener("resize", layoutDesktopIcons);
    document.removeEventListener("site:mode-change", onSiteModeChange);
  };
}
