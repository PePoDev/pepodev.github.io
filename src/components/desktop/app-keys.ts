// Keys for apps: the listeners behind useAppKeyboard (app-api.ts) for apps
// that own the keyboard (Calculator, Snake), and the keys typed before an
// app's body is ready.
//
// - App handlers listen on document in the capture phase, so they run
//   before the desktop's own key listeners (React's handlers, the overlays,
//   Ctrl/Cmd + K; the window manager's Escape is on window). isAppKeyboardEvent
//   then still sees an overlay that is about to close on this very Escape or
//   Enter as open, and ignores the key; and the app's own launcher, which
//   re-launches on Enter, still hands the key over.
// - A body can render after its window opened (its chunk was not there yet:
//   app-chunks.ts), so keys typed meanwhile would be lost. Until the body has
//   rendered (app-bodies.tsx marks it ready), keys that belong to the focused
//   window (isAppKeyboardEvent, as for a rendered app) are kept, in order, and
//   replayed once it has, as long as the window is still open: they were the
//   app's when they were typed, so another window taking over in the
//   meantime does not drop them (typing "12+3" into Calculator, then opening
//   Snake, still leaves "12+3"). Closing the window drops them, and so does
//   the window showing the load error instead (a failed download, a body
//   that threw: app-bodies.tsx), which keeps no keys while it shows.
// - Where they go: if the body put focus on a text field in its window
//   (useFocusOnLaunch: Terminal's input, the Gallery password), the typed
//   text goes into it, Backspace deletes and Enter submits its form, as if
//   the field had had focus all along; otherwise the app's useAppKeyboard
//   handlers get the events. A body with neither ignores them.
// - Tab: meanwhile the window holds only its title-bar controls, so Tab
//   from the last of them would leave it for the taskbar, and the keys
//   typed next would act there (the Start button, then Quick Access's Reset
//   Desktop). That Tab, and every Tab or Shift+Tab after it, is held instead:
//   focus waits on the window, so the keys typed next are kept too. The replay
//   then moves focus on from where the first held Tab was pressed, as those
//   Tabs would have moved it with the body there (into it, or past it), and
//   the keys typed after them go to the control they reached: a text field as
//   above, Enter (or Space, except on a link) presses a button or link in the
//   window, and other form fields and controls outside the window get none. A
//   body that took focus as it rendered (useFocusOnLaunch, a ?blog= article:
//   deep-link.ts) drops the held Tabs instead, and the other keys go where
//   they would with that focus. Tab within the title bar moves as usual.
import { isAppKeyboardEvent } from "@utils/app-keyboard";
import { canTakeFocus, focusFirst } from "@utils/overlays";
import type { AppId } from "./apps";
import { getWindowElement, windowsStore } from "./window-manager";

type KeyHandler = (event: KeyboardEvent) => void;

const handlers = new Map<AppId, Set<KeyHandler>>();
const readyBodies = new Set<AppId>();
const failedBodies = new Set<AppId>();
const earlyKeys = new Map<AppId, KeyboardEvent[]>();
const MAX_EARLY_KEYS = 64;
// Tabs held while the body loaded, and where the first one was pressed.
const heldTabs = new WeakSet<KeyboardEvent>();
const tabbedFrom = new Map<AppId, Element>();

/**
 * Calls `handler` for document keydowns that belong to the app (capture
 * phase, isAppKeyboardEvent). Returns the cleanup.
 */
export function addAppKeyHandler(appId: AppId, handler: KeyHandler): () => void {
  const appHandlers = handlers.get(appId) ?? new Set<KeyHandler>();
  appHandlers.add(handler);
  handlers.set(appId, appHandlers);
  const onKeyDown = (event: KeyboardEvent) => {
    if (isAppKeyboardEvent(event, getWindowElement(appId))) handler(event);
  };
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    appHandlers.delete(handler);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}

/**
 * Marks an app's body as rendered (or gone), and replays the keys typed
 * while it loaded, if its window is still open. The replay waits for a
 * microtask: this runs in an effect, after the body's own effects
 * registered its handlers and moved focus, and after the deep link their
 * registration runs in an earlier microtask (deep-link.ts) has opened.
 */
export function setAppBodyReady(appId: AppId, ready: boolean) {
  if (!ready) {
    readyBodies.delete(appId);
    return;
  }
  readyBodies.add(appId);
  const events = earlyKeys.get(appId);
  const from = tabbedFrom.get(appId);
  earlyKeys.delete(appId);
  tabbedFrom.delete(appId);
  if (!events?.length) return;
  queueMicrotask(() => {
    const windowEl = getWindowElement(appId);
    if (!windowEl || !windowsStore.get().windows[appId].open) return;
    // The held Tabs move focus on while it still waits on the window (the
    // body did not take it, nothing else did).
    let stop = from && document.activeElement === windowEl ? from : null;
    let tabbed = false;
    for (const event of events) {
      if (heldTabs.has(event)) {
        // Once on a frame (Garden's), the next Tabs would move through the
        // frame's own page, so focus stays on the frame.
        const next = stop && !(stop instanceof HTMLIFrameElement) && nextTabStop(document, stop, event.shiftKey);
        if (next) {
          next.focus();
          stop = next;
          tabbed = true;
        }
        continue;
      }
      const field = focusedTextField(appId);
      if (field) typeInto(field, [event]);
      else if (!tabbed || !sendToFocusedControl(windowEl, event)) {
        handlers.get(appId)?.forEach((handler) => handler(event));
      }
    }
  });
}

/**
 * Marks an app's window as showing the load error (or no longer): "This app
 * could not load" (app-bodies.tsx). The keys kept while it loaded are
 * dropped, and none are kept while the error shows: there is no app to type
 * into, and Tab moves through the window as usual.
 */
export function setAppBodyFailed(appId: AppId, failed: boolean) {
  if (!failed) {
    failedBodies.delete(appId);
    return;
  }
  failedBodies.add(appId);
  earlyKeys.delete(appId);
  tabbedFrom.delete(appId);
}

// What Tab stops at, in tree order (the desktop sets no positive tabindex).
const TAB_STOPS = "a[href], button, input:not([type='hidden']), select, textarea, summary, iframe, [tabindex]";

/** The control in `scope` that Tab (or Shift+Tab) moves to from `from`, if any. */
function nextTabStop(scope: ParentNode, from: Element, back: boolean): HTMLElement | null {
  const position = back ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
  const stops = Array.from(scope.querySelectorAll<HTMLElement>(TAB_STOPS)).filter(
    (stop) =>
      stop.tabIndex >= 0 &&
      !stop.matches(":disabled") &&
      canTakeFocus(stop) &&
      Boolean(from.compareDocumentPosition(stop) & position),
  );
  return (back ? stops.at(-1) : stops[0]) ?? null;
}

/**
 * A key typed after the held Tabs, once they moved focus, is the control's
 * they reached (as isAppKeyboardEvent has it for a typed key): Enter, or
 * Space except on a link, presses a button or link in the window, as the
 * key would have; a form field, or a control outside the window, keeps
 * every key, and no one gets it. Returns false for a key the app gets.
 */
function sendToFocusedControl(windowEl: HTMLElement, { key }: KeyboardEvent): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === windowEl) return false;
  if (!windowEl.contains(active) || active.isContentEditable || active.closest("input, textarea, select")) return true;
  const control = active.closest<HTMLElement>("button, a[href], summary, [role='button']");
  if (!control || (key !== "Enter" && key !== " ")) return false;
  if (key === "Enter" || !control.matches("a[href]")) control.click();
  return true;
}

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** The text field in the app's window that has focus, if any (one that takes typed text). */
function focusedTextField(appId: AppId): TextField | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  if (!getWindowElement(appId)?.contains(active) || active.readOnly || active.disabled) return null;
  // Inputs without a text selection (email, number, checkbox...) cannot be typed into this way.
  return typeof active.selectionStart === "number" ? active : null;
}

/** Types the kept keys into the field: characters, Backspace, and Enter (submits its form). */
function typeInto(field: TextField, events: KeyboardEvent[]) {
  for (const { key, isComposing } of events) {
    if (isComposing) continue;
    if (key === "Enter" && field instanceof HTMLInputElement) {
      // Implicit submission, as Enter in the field does.
      field.form?.requestSubmit();
      continue;
    }
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    const text = key === "Enter" ? "\n" : [...key].length === 1 ? key : null;
    if (text !== null) field.setRangeText(text, start, end, "end");
    else if (key === "Backspace" && end > 0) field.setRangeText("", start === end ? start - 1 : start, end, "end");
    else continue;
    // setRangeText bypasses the value setter, so React's onChange sees the change.
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: text === null ? "deleteContentBackward" : "insertText",
        data: text,
      }),
    );
  }
}

/**
 * Holds a Tab that would leave the window for the taskbar, and every Tab
 * after it until the body renders, with focus waiting on the window.
 */
function holdTab(appId: AppId, windowEl: HTMLElement, event: KeyboardEvent) {
  const active = document.activeElement;
  // Not from the app's launcher (a pointer launch leaves focus there).
  if (!active || !windowEl.contains(active)) return;
  const waiting = active === windowEl && tabbedFrom.has(appId);
  if (!waiting && (event.shiftKey || nextTabStop(windowEl, active, false))) return;
  event.preventDefault();
  heldTabs.add(event);
  if (waiting) return;
  tabbedFrom.set(appId, active);
  focusFirst([windowEl]);
}

function onKeyDown(event: KeyboardEvent) {
  const { focused, windows } = windowsStore.get();
  // A window that shows the load error has no app to type into.
  if (!focused || readyBodies.has(focused) || failedBodies.has(focused) || !windows[focused].mounted) return;
  const windowEl = getWindowElement(focused);
  if (!windowEl || !isAppKeyboardEvent(event, windowEl)) return;
  if (event.key === "Tab") holdTab(focused, windowEl, event);
  const events = earlyKeys.get(focused) ?? [];
  if (events.length < MAX_EARLY_KEYS) events.push(event);
  earlyKeys.set(focused, events);
}

// Keys kept for a window that closes are dropped with it.
function dropClosedWindows() {
  const { windows } = windowsStore.get();
  for (const appId of earlyKeys.keys()) {
    if (!windows[appId].open) earlyKeys.delete(appId);
  }
  for (const appId of tabbedFrom.keys()) {
    if (!windows[appId].open) tabbedFrom.delete(appId);
  }
}

/** Keeps the keys typed into windows whose body is still loading (the boot starts it). */
export function startAppKeys(): () => void {
  // Registered at the boot, before any body's handler: it runs first.
  document.addEventListener("keydown", onKeyDown, true);
  const unsubscribe = windowsStore.subscribe(dropClosedWindows);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    unsubscribe();
    earlyKeys.clear();
    tabbedFrom.clear();
  };
}
