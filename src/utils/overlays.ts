/**
 * Focus and open/close rules shared by the desktop overlays: the Start menu
 * (StartMenu.astro), the tray panel (Taskbar.astro) and the command palette
 * (CommandPalette.astro). Only one of them is open at a time.
 */

const overlayOpenEvent = "desktop:overlay-open";

/**
 * Whether focus can move to `element`: it is connected and rendered, and not
 * inside something closed (inert, hidden, aria-hidden, or a window playing its
 * closing animation). WindowController.astro runs while the page parses and
 * cannot import this, so its canTakeFocus applies the same rules.
 */
export function canTakeFocus(
  element: Element | null | undefined,
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
 * window only takes focus while it has tabindex, which WindowController
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

/**
 * Takes a closing overlay out of the tab order and the accessibility tree.
 * With restoreFocus, focus that was inside it (or had dropped to <body>)
 * moves to the first of `returnTo` that can take it.
 */
export function closeOverlay(
  panel: HTMLElement,
  {
    restoreFocus = false,
    returnTo = [],
  }: { restoreFocus?: boolean; returnTo?: (Element | null | undefined)[] } = {},
) {
  const active = document.activeElement;
  const hadFocus =
    !active || active === document.body || panel.contains(active);
  if (active instanceof HTMLElement && panel.contains(active)) active.blur();
  panel.inert = true;
  if (restoreFocus && hadFocus) focusFirst(returnTo);
}

/**
 * Opens an overlay after closing the others, which hand focus back to their
 * buttons first, so read the opener after calling this.
 */
export function openOverlay(id: string, panel: HTMLElement) {
  document.dispatchEvent(
    new CustomEvent(overlayOpenEvent, { detail: { id } }),
  );
  panel.inert = false;
}

/** Runs `close` whenever another overlay opens. */
export function onOtherOverlayOpen(id: string, close: () => void) {
  document.addEventListener(overlayOpenEvent, (event) => {
    if ((event as CustomEvent<{ id?: string }>).detail?.id !== id) close();
  });
}
