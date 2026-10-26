// The desktop icon grid: app icons and external link icons share one grid
// and one occupancy map, so neither kind can be placed on top of the other.
// Saved positions claim their cells first, then app defaults, then links
// down the right edge (Webring first), each taking the nearest free cell.
//
// Pure functions of the viewport, the icons' data attributes and the saved
// positions. Two callers run the same code: the parse-time placement script
// (DesktopScripts.tsx inlines these functions with Function#toString, so the
// first paint is already laid out) and icon-layout.ts after hydration. So
// each exported function must stay self-contained: no references to imports
// or other module-level names, only its parameters (the server bundle may
// rename module-level names).

export interface GridCell {
  column: number;
  row: number;
}

export interface GridPoint {
  x: number;
  y: number;
}

/** An icon as the grid sees it: its id and its data-* placement hints. */
export interface GridIcon {
  id: string;
  /** External link shortcut (stacks down the right edge). */
  link: boolean;
  /** data-default-col / data-default-row of app icons. */
  col?: string;
  row?: string;
  /** data-layout-group / data-layout-index of app icons. */
  group?: string;
  index?: number;
  /** data-shortcut-index of link icons (Webring is 0). */
  shortcut?: number;
}

export type IconGrid = ReturnType<typeof createIconGrid>;

/**
 * The desktop's free area (readDesktopInsets): `top` is covered by a top
 * bar, `bottom` by the taskbar, dock or panel.
 */
export interface DesktopInsets {
  top: number;
  bottom: number;
}

/**
 * The desktop's insets, from --desktop-inset-top and --desktop-inset-bottom
 * on <html> (variables.css, experiences.css): what the experience's bars
 * cover. Self-contained, for the parse-time icon script.
 */
export function readDesktopInsets(root: HTMLElement): DesktopInsets {
  const style = getComputedStyle(root);
  return {
    top: parseFloat(style.getPropertyValue("--desktop-inset-top")) || 0,
    bottom: parseFloat(style.getPropertyValue("--desktop-inset-bottom")) || 56,
  };
}

/**
 * The grid for a viewport. Columns fit between equal side margins; columns
 * right of the center column are anchored to the right edge, so spare width
 * stays in the middle and the link column sits against the right edge.
 * `iconWidth` and `iconHeight` are the first icon's size; rows start below
 * `insets.top` and end above `insets.bottom`.
 */
export function createIconGrid(
  viewportWidth: number,
  viewportHeight: number,
  iconWidth: number,
  iconHeight: number,
  insets: DesktopInsets = { top: 0, bottom: 56 },
) {
  const originX = 20;
  const originY = 20 + insets.top;
  const columnStep = 88;
  const rowStep = 98;
  const margin = 8;
  const taskbarReserve = insets.bottom;
  // Keeps "center" icons clear of the left-hand app group on narrow screens.
  const minCenterColumn = 6;

  const rightColumnX = viewportWidth - iconWidth - originX;
  const maxColumn = Math.max(0, Math.floor((rightColumnX - originX) / columnStep));
  const maxRow = Math.max(
    0,
    Math.floor((viewportHeight - iconHeight - taskbarReserve - originY) / rowStep),
  );
  const centerColumn = Math.min(maxColumn, Math.max(minCenterColumn, Math.round(maxColumn / 2)));

  function key(cell: GridCell) {
    return cell.column + "," + cell.row;
  }

  function columnX(column: number) {
    return column > centerColumn
      ? rightColumnX - (maxColumn - column) * columnStep
      : originX + column * columnStep;
  }

  function cellPosition(cell: GridCell): GridPoint {
    return { x: columnX(cell.column), y: originY + cell.row * rowStep };
  }

  // Column spacing is uneven around the middle, so pick the nearest column.
  function cellFromPosition(position: GridPoint): GridCell {
    let column = 0;
    for (let next = 1; next <= maxColumn; next++) {
      if (Math.abs(columnX(next) - position.x) < Math.abs(columnX(column) - position.x)) {
        column = next;
      }
    }
    const row = Math.round((position.y - originY) / rowStep);
    return { column, row: Math.min(Math.max(0, row), maxRow) };
  }

  function gridIndex(
    value: string | undefined,
    maxIndex: number,
    fallback: number,
    centerIndex = Math.round(maxIndex / 2),
  ) {
    const centerMatch = String(value || "").match(/^center([+-]\d+)?$/);
    if (centerMatch) {
      const offset = Number.parseInt(centerMatch[1] || "0", 10);
      return Math.min(Math.max(0, centerIndex + offset), maxIndex);
    }
    if (value === "right" || value === "bottom") return maxIndex;
    const parsed = Number.parseInt(value ?? "", 10);
    if (Number.isFinite(parsed)) return Math.min(Math.max(0, parsed), maxIndex);
    return fallback;
  }

  function utilityCell(index: number): GridCell {
    const shortViewportCells = [
      { column: maxColumn - 2, row: 0 },
      { column: maxColumn - 2, row: 1 },
      { column: maxColumn - 2, row: 2 },
      { column: maxColumn - 2, row: 3 },
      { column: maxColumn - 1, row: 0 },
      { column: maxColumn - 1, row: 1 },
      { column: maxColumn - 1, row: 2 },
    ];
    const cell = shortViewportCells[index] || { column: index, row: 0 };
    return {
      column: Math.min(Math.max(0, cell.column), maxColumn),
      row: Math.min(Math.max(0, cell.row), maxRow),
    };
  }

  function defaultCell(icon: GridIcon): GridCell {
    if (icon.link) {
      // Links stack down the right edge and wrap into the column to its left.
      const index = icon.shortcut || 0;
      return {
        column: Math.max(0, maxColumn - Math.floor(index / (maxRow + 1))),
        row: index % (maxRow + 1),
      };
    }
    let column = gridIndex(icon.col, maxColumn, 0, centerColumn);
    let row = gridIndex(icon.row, maxRow, 0);
    if (icon.group === "utility" && maxRow <= 6) {
      const cell = utilityCell(icon.index || 0);
      column = cell.column;
      row = cell.row;
    } else if (icon.group === "left-mid" && maxRow <= 6) {
      row = Math.max(2, maxRow - 2 + (icon.index || 0));
    }
    return { column, row };
  }

  /** Keeps an icon of this size on screen, below a top bar and above the taskbar. */
  function clamp(x: number, y: number, width: number, height: number): GridPoint {
    const minY = margin + insets.top;
    const maxX = Math.max(margin, viewportWidth - width - margin);
    const maxY = Math.max(minY, viewportHeight - height - taskbarReserve);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(minY, y), maxY),
    };
  }

  return { maxColumn, maxRow, key, cellPosition, cellFromPosition, defaultCell, clamp };
}

export interface IconLayout {
  /** Each icon's cell. */
  cells: Record<string, GridCell>;
  /** Which icon holds each cell, by IconGrid.key. */
  occupied: Record<string, string>;
}

/**
 * Places `icons` (app icons in DOM order, then links in shortcut order) on
 * `grid`: icons with a saved position first, at the cell nearest it, then
 * the rest at their default cells. A taken cell sends the icon to the
 * nearest free one by grid steps, preferring the same column; the target
 * itself when every cell is taken.
 */
export function layoutIcons(
  grid: IconGrid,
  icons: GridIcon[],
  saved: Record<string, GridPoint | undefined>,
): IconLayout {
  const cells: Record<string, GridCell> = {};
  const occupied: Record<string, string> = {};

  function nearestFreeCell(target: GridCell): GridCell {
    let nearest = target;
    let nearestDistance = Infinity;
    let nearestColumnDistance = Infinity;
    for (let row = 0; row <= grid.maxRow; row++) {
      for (let column = 0; column <= grid.maxColumn; column++) {
        if (occupied[grid.key({ column, row })] !== undefined) continue;
        const columnDistance = Math.abs(column - target.column);
        const distance = columnDistance + Math.abs(row - target.row);
        if (
          distance < nearestDistance ||
          (distance === nearestDistance && columnDistance < nearestColumnDistance)
        ) {
          nearest = { column, row };
          nearestDistance = distance;
          nearestColumnDistance = columnDistance;
        }
      }
    }
    return nearest;
  }

  function place(icon: GridIcon, target: GridCell) {
    const cell = occupied[grid.key(target)] !== undefined ? nearestFreeCell(target) : target;
    occupied[grid.key(cell)] = icon.id;
    cells[icon.id] = cell;
  }

  icons.forEach((icon) => {
    const position = saved[icon.id];
    if (position) place(icon, grid.cellFromPosition(position));
  });
  icons.forEach((icon) => {
    if (!saved[icon.id]) place(icon, grid.defaultCell(icon));
  });
  return { cells, occupied };
}

/** Saved icon positions: pepodev.desktopIcon.v3.<appId>, pepodev.linkIcon.v4.<link id>. */
export const ICON_STORAGE_PREFIX = "pepodev.desktopIcon.v3.";
export const LINK_ICON_STORAGE_PREFIX = "pepodev.linkIcon.v4.";

/**
 * Removes positions saved by older layout versions (v3/v4 drop layouts that
 * older versions re-saved on every resize). Self-contained: the parse-time
 * script runs it too.
 */
export function removeStaleIconPositions(storage: Storage, appPrefix: string, linkPrefix: string) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (
        key &&
        /^pepodev\.(desktopIcon|linkIcon)\.v\d+\./.test(key) &&
        !key.startsWith(appPrefix) &&
        !key.startsWith(linkPrefix)
      ) {
        stale.push(key);
      }
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage can be unavailable; stale keys are never read.
  }
}

/** A saved icon position, or null when missing or corrupt. Self-contained. */
export function readIconPosition(storage: Storage, key: string): GridPoint | null {
  try {
    const saved = JSON.parse(storage.getItem(key) || "null");
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? { x: saved.x, y: saved.y } : null;
  } catch {
    return null;
  }
}
