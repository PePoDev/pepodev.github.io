// The API desktop apps use (MIGRATION.md, "App contract"). An app is the
// default export of src/components/apps/<Name>App.tsx, rendered inside its
// window's .window-content once the window first opens (or, for apps the
// registry marks mount: "idle", once the desktop is idle), and kept mounted
// when the window closes. It learns about its window through these hooks
// instead of desktop:window-* listeners, and changes the desktop only
// through the functions exported here.

import { createContext, useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import { isAppKeyboardOwner } from "@utils/app-keyboard";
import type { AppDataMap } from "@components/apps/app-data";
import { addAppKeyHandler } from "./app-keys";
import type { AppId } from "./apps";
import { setDeepLinkHandler, type DeepLinkHandler } from "./deep-link";
import { useSiteMode } from "./site-mode";
import { useStore } from "./store";
import { getLaunchFocus, getWindowElement, mountWindowBody, requestOpenApp, windowsStore } from "./window-manager";

export type { AppId } from "./apps";
export type { AppDataMap } from "@components/apps/app-data";
export type { SiteMode } from "./site-mode";
export type { DesktopPrefs } from "./prefs";
export type { SystemAudio } from "./system-audio";

/** Props of every app body. `data` comes from its <Name>App.data.ts at build time. */
export interface AppProps<Id extends AppId = AppId> {
  appId: Id;
  data: AppDataMap[Id];
}

/** Provided by Window.tsx around the app body. */
export const AppWindowContext = createContext<AppId | null>(null);

export function useAppId(): AppId {
  const appId = useContext(AppWindowContext);
  if (!appId) throw new Error("useAppId() is only available inside a desktop app window.");
  return appId;
}

export interface AppWindow {
  appId: AppId;
  /** The window is open (possibly minimized). */
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  /** The window has .focused: it is the active window and gets app keys. */
  focused: boolean;
  /** Open, not minimized, and the site is in desktop mode: on screen. */
  visible: boolean;
  /**
   * Bumped on every launch (open, restore, or launch of an open window, from
   * any launcher) and every hand-off of focus into this window, after the
   * window manager moved focus. `keyboard` says whether DOM focus moved
   * into the window (desktop:window-focus detail.keyboard).
   */
  focusRequest: { seq: number; keyboard: boolean };
}

/**
 * The app's window state. Re-renders only when one of these values changes:
 * dragging, resizing or raising the window does not reach the app. The
 * object keeps its identity while nothing changed, so it can be an effect
 * dependency.
 */
export function useAppWindow(): AppWindow {
  const appId = useAppId();
  const open = useStore(windowsStore, (state) => state.windows[appId].open);
  const minimized = useStore(windowsStore, (state) => state.windows[appId].minimized);
  const maximized = useStore(windowsStore, (state) => state.windows[appId].maximized);
  const focused = useStore(windowsStore, (state) => state.focused === appId);
  const focusRequest = useStore(windowsStore, (state) => state.windows[appId].focusRequest);
  const siteMode = useSiteMode();
  const shown = open && !minimized;
  return useMemo(
    () => ({
      appId,
      open,
      minimized,
      maximized,
      focused: shown && focused,
      visible: shown && siteMode === "desktop",
      focusRequest,
    }),
    [appId, open, minimized, maximized, shown, focused, siteMode, focusRequest],
  );
}

/** The app's window element (<section id="window-<appId>">), for app-keyboard.ts and DOM queries. */
export function useAppWindowElement(): () => HTMLElement | null {
  const appId = useAppId();
  return () => getWindowElement(appId);
}

// Phones and touch tablets, where focusing a field raises the on-screen keyboard.
const TOUCH_QUERY = "(max-width: 768px), (hover: none), (pointer: coarse)";

/**
 * Focuses `target` on every launch of the window (Terminal's input, the
 * Gallery password). Touch screens wait for a tap unless the keyboard opened
 * the window, so a tap does not raise the on-screen keyboard. A body that
 * mounts after its window opened (every first launch: its chunk loads after
 * the window opens) takes focus only if nothing took it since the launch:
 * focus is still on <body>, on the window, or where the launch left it (the
 * icon that was clicked). A body mounted before any launch (registry
 * mount: "idle") waits for the first one.
 */
export function useFocusOnLaunch(target: RefObject<HTMLElement | null>) {
  const appId = useAppId();
  const focusRequest = useStore(windowsStore, (state) => state.windows[appId].focusRequest);
  const handled = useRef(-1);
  useEffect(() => {
    const { seq } = focusRequest;
    if (handled.current === seq) return;
    const lateMount = handled.current === -1;
    handled.current = seq;
    if (seq === 0) return;
    let keyboard = focusRequest.keyboard;
    if (lateMount) {
      const win = getWindowElement(appId);
      const active = document.activeElement;
      const shown = win?.classList.contains("focused") && win.getAttribute("aria-hidden") === "false";
      const untouched = !active || active === document.body || active === win || active === getLaunchFocus(appId);
      if (!shown || !untouched) return;
      keyboard = keyboard && active === win;
    }
    if (keyboard || !window.matchMedia(TOUCH_QUERY).matches) target.current?.focus({ preventScroll: true });
  }, [appId, focusRequest, target]);
}

/**
 * Calls `handler` for document keydowns that belong to this app: its window
 * is focused in desktop mode, no overlay is open, no Ctrl, Meta or Alt
 * (AltGr allowed), and the key is not aimed at a form field or at a focused
 * button or link's own Enter/Space (src/utils/app-keyboard.ts). It listens
 * in the capture phase, before the desktop's own key listeners (app-keys.ts),
 * and also gets the keys typed while the app's chunk was loading, replayed
 * once the body has rendered. Call preventDefault() on the keys it uses.
 */
export function useAppKeyboard(handler: (event: KeyboardEvent) => void) {
  const appId = useAppId();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => addAppKeyHandler(appId, (event) => latest.current(event)), [appId]);
}

/**
 * Handles deep links into this app (today: ?blog=<slug> for the Blog app).
 * Return whether the target exists; false shows the "Article not found"
 * toast. The desktop calls it after opening and maximizing the window, once
 * the app has mounted.
 */
export function useDeepLinkHandler(handler: DeepLinkHandler) {
  const appId = useAppId();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    setDeepLinkHandler(appId, (slug) => latest.current(slug));
    return () => setDeepLinkHandler(appId, null);
  }, [appId]);
}

/** Whether this app owns the keyboard right now (Snake pauses when it does not). */
export function hasAppKeyboard(appId: AppId): boolean {
  return isAppKeyboardOwner(getWindowElement(appId));
}

export { useSiteMode } from "./site-mode";
export { updateDesktopPrefs, toggleTheme, useDesktopPrefs } from "./prefs";
export { setSystemAudio, useSystemAudio } from "./system-audio";
export { showToast } from "./toasts";
export { resetDesktop } from "./palette";
export { blogArticleUrl, loadBlogArticle, type BlogArticle } from "./blog-article";

// Opening and mounting commit synchronously (flushSync), which React refuses
// inside its render and lifecycle methods (an effect, a ref callback). These
// two are the actions apps call from effects, so they wait for a microtask:
// the window or body appears before the current task ends.

/** Opens an app like any launcher (desktop:open-app), in a microtask. Terminal's `projects`, Welcome's buttons. */
export function openApp(appId: AppId) {
  queueMicrotask(() => requestOpenApp(appId));
}

/**
 * Mounts another app's body without opening its window (as mount: "idle"
 * does), in a microtask, e.g. Settings making sure Music's controller exists
 * before driving it. Its chunk then loads; wait for whatever the app
 * publishes when ready.
 */
export function mountApp(appId: AppId) {
  queueMicrotask(() => mountWindowBody(appId));
}

export { isAppKeyboardEvent, isAppKeyboardOwner } from "@utils/app-keyboard";
