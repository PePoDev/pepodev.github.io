/** Whether an app window is open, focused and not minimized in desktop mode. */
export function isAppWindowActive(
  windowEl: Element | null,
): windowEl is HTMLElement {
  return (
    document.documentElement.dataset.siteMode !== "website" &&
    windowEl instanceof HTMLElement &&
    !windowEl.hidden &&
    !windowEl.classList.contains("minimized") &&
    windowEl.classList.contains("focused")
  );
}

/** The overlays WindowController's isEscapeOwnedByOverlay defers to. */
function isDesktopOverlayOpen(): boolean {
  return Boolean(
    document.querySelector(
      '#command-palette[data-visible="true"], #start-menu.visible, #tray-panel.visible',
    ),
  );
}

/**
 * Whether keys aimed at `element` belong to the app in `windowEl`. Form fields
 * and controls focused outside the window (taskbar, tray, other windows) keep
 * their keys; the app's own launcher hands them over.
 */
function ownsElement(element: Element | null, windowEl: HTMLElement): boolean {
  if (!(element instanceof HTMLElement) || element === document.body)
    return true;
  if (element.isContentEditable || element.closest("input, textarea, select"))
    return false;
  if (windowEl.contains(element)) return true;

  const launcher = element.closest<HTMLElement>("[data-open-app]");
  return launcher?.dataset.openApp === windowEl.dataset.appId;
}

/** Whether the app in `windowEl` currently owns the keyboard. */
export function isAppKeyboardOwner(
  windowEl: Element | null,
): windowEl is HTMLElement {
  return (
    isAppWindowActive(windowEl) &&
    !isDesktopOverlayOpen() &&
    ownsElement(document.activeElement, windowEl)
  );
}

/**
 * Whether a document-level keydown belongs to the app in `windowEl`. Browser
 * shortcuts, open overlays and keys aimed at other controls are left alone,
 * and a focused button or link in the window (a title-bar control, a
 * Calculator key) keeps its native Enter and Space.
 */
export function isAppKeyboardEvent(
  event: Event,
  windowEl: Element | null,
): boolean {
  // Autofill and other scripts can dispatch plain Events named "keydown".
  if (!(event instanceof KeyboardEvent)) return false;
  // Windows reports AltGr, which some layouts need for * or /, as Ctrl+Alt.
  const altGraph = event.getModifierState("AltGraph");
  if (event.metaKey || ((event.ctrlKey || event.altKey) && !altGraph))
    return false;
  if (!isAppWindowActive(windowEl) || isDesktopOverlayOpen()) return false;

  const target = event.target instanceof Element ? event.target : null;
  if (
    (event.key === "Enter" || event.key === " ") &&
    windowEl.contains(target) &&
    target?.closest("button, a[href], summary, [role='button']")
  )
    return false;
  return ownsElement(target, windowEl);
}
