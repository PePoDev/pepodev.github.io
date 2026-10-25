// Keys for apps: the listeners behind useAppKeyboard (app-api.ts) for apps
// that own the keyboard (Calculator, Snake), and the keys typed before an
// app's body is ready.
//
// - App handlers listen on document in the capture phase, so they run
//   before the desktop's own key listeners (React's handlers, the overlays,
//   the palette; the window manager's Escape is on window), as the Astro
//   apps' listeners did. isAppKeyboardEvent then still sees an overlay that
//   is about to close on this very Escape or Enter as open, and ignores the
//   key; and the app's own launcher, which re-launches on Enter, still hands
//   the key over.
// - A body can render after its window opened (its chunk was not there yet:
//   app-chunks.ts), so keys typed meanwhile would be lost; the Astro desktop
//   had every body in the page. Until the body has rendered (app-bodies.tsx
//   marks it ready), keys that belong to the focused window
//   (isAppKeyboardEvent, as for a rendered app) are kept, in order, and
//   replayed once it has, as long as the window is still open: they were the
//   app's when they were typed, so another window taking over in the
//   meantime does not drop them (typing "12+3" into Calculator, then opening
//   Snake, still leaves "12+3"). Closing the window drops them.
// - Where they go: if the body put focus on a text field in its window
//   (useFocusOnLaunch: Terminal's input, the Gallery password), the typed
//   text goes into it, Backspace deletes and Enter submits its form, as if
//   the field had had focus all along; otherwise the app's useAppKeyboard
//   handlers get the events. A body with neither ignores them.
import { isAppKeyboardEvent } from "@utils/app-keyboard";
import { getAppChunk } from "./app-chunks";
import type { AppId } from "./apps";
import { getWindowElement, windowsStore } from "./window-manager";

type KeyHandler = (event: KeyboardEvent) => void;

const handlers = new Map<AppId, Set<KeyHandler>>();
const readyBodies = new Set<AppId>();
const earlyKeys = new Map<AppId, KeyboardEvent[]>();
const MAX_EARLY_KEYS = 64;

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
 * registered its handlers and moved focus.
 */
export function setAppBodyReady(appId: AppId, ready: boolean) {
  if (!ready) {
    readyBodies.delete(appId);
    return;
  }
  readyBodies.add(appId);
  const events = earlyKeys.get(appId);
  earlyKeys.delete(appId);
  if (!events?.length) return;
  queueMicrotask(() => {
    if (!windowsStore.get().windows[appId].open) return;
    const field = focusedTextField(appId);
    if (field) {
      typeInto(field, events);
      return;
    }
    for (const event of events) handlers.get(appId)?.forEach((handler) => handler(event));
  });
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

function onKeyDown(event: KeyboardEvent) {
  const { focused, windows } = windowsStore.get();
  if (!focused || readyBodies.has(focused) || !windows[focused].mounted) return;
  // Its download failed: the window shows the error, not an app to type into.
  if (getAppChunk(focused)?.status === "failed") return;
  if (!isAppKeyboardEvent(event, getWindowElement(focused))) return;
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
  };
}
