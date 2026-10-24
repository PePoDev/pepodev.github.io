// Keys for apps that own the keyboard (Calculator, Snake): the listeners
// behind useAppKeyboard (app-api.ts), and the keys typed before an app's
// body is ready.
//
// - App handlers listen on document in the capture phase, so they run
//   before the desktop's own key listeners (React's handlers, the overlays,
//   the palette; the window manager's Escape is on window), as the Astro
//   apps' listeners did. isAppKeyboardEvent then still sees an overlay that
//   is about to close on this very Escape or Enter as open, and ignores the
//   key; and the app's own launcher, which re-launches on Enter, still hands
//   the key over.
// - A body loads after its window opens (its chunk downloads on the first
//   launch), so keys typed meanwhile would be lost. Until the body has
//   rendered (app-bodies.tsx marks it ready), keys that belong to the
//   focused window are kept and replayed to its handlers once it is, if the
//   window is still the active one. Bodies that register no handler drop
//   them.
import { isAppKeyboardEvent, isAppWindowActive } from "@utils/app-keyboard";
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
 * while it loaded. The replay waits for a microtask: this runs in an effect,
 * after the body's own effects registered its handlers.
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
    if (!isAppWindowActive(getWindowElement(appId))) return;
    for (const event of events) handlers.get(appId)?.forEach((handler) => handler(event));
  });
}

function onKeyDown(event: KeyboardEvent) {
  const { focused, windows } = windowsStore.get();
  if (!focused || readyBodies.has(focused) || !windows[focused].mounted) return;
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
