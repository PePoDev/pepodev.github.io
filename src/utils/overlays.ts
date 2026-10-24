/**
 * Focus rules shared by the desktop's overlays (the Start menu, the tray
 * panel and the command palette, in src/components/desktop/overlay-state.ts
 * and palette.ts) and its window manager (window-manager.ts).
 */

/**
 * Whether focus can move to `element`: it is connected and rendered, and not
 * inside something closed (inert, hidden, aria-hidden, or a window playing its
 * closing animation).
 */
export function canTakeFocus(
  element: Element | null | undefined | false,
): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element !== document.body &&
    element.isConnected &&
    !element.closest("[inert], [hidden], [aria-hidden='true'], .closing") &&
    element.getClientRects().length > 0
  );
}

/**
 * Focuses the first candidate that can take focus and returns it. A desktop
 * window only takes focus while it has tabindex, which the window manager
 * removes once focus leaves it, so it gets tabindex="-1" back first.
 */
export function focusFirst(
  candidates: (Element | null | undefined)[],
): HTMLElement | null {
  for (const candidate of candidates) {
    if (!canTakeFocus(candidate)) continue;
    if (candidate.matches("[data-window]")) candidate.tabIndex = -1;
    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) return candidate;
  }
  return null;
}

/** The open window that has the keyboard (the topmost one), if any. */
export function getFocusedWindow(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    "[data-window].focused:not([aria-hidden='true'])",
  );
}
