"use client";
// An app window: a non-modal dialog named by its title, rendered from its
// WindowState (window-manager.ts). The title bar drags it (clamped by the
// window manager), the handles resize it, with a mouse, a finger or a pen, and
// the app body mounts inside .window-content on the first launch. Closed and
// minimized windows are hidden from assistive tech and inert.
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AppWindowContext } from "./app-api";
import { AppBody } from "./app-bodies";
import { AppIcon } from "./AppIcon";
import type { AppDefinition, AppId } from "./apps";
import { prefsStore } from "./prefs";
import { useStore } from "./store";
import {
  beginWindowDrag,
  beginWindowResize,
  closeWindow,
  focusWindow,
  isMobileMode,
  minimizeWindow,
  registerWindowElement,
  toggleMaximize,
  useWindow,
  windowsStore,
  type DragSession,
} from "./window-manager";

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, iframe, [contenteditable], [tabindex]:not([tabindex="-1"])';

/**
 * Follows the pointer that pressed (a mouse, a finger or a pen) until it is
 * released or cancelled (or the page loses focus). Other fingers are ignored.
 */
function followPointer(session: DragSession | null, pointerId: number) {
  if (!session) return;
  document.body.style.userSelect = "none";
  const stop = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("blur", stop);
    document.body.style.userSelect = "";
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId === pointerId) stop();
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (event.buttons === 0) {
      stop();
      return;
    }
    session.move(event);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  window.addEventListener("pointerup", end);
  window.addEventListener("blur", stop);
}

/**
 * The app body and its context. Memoized on (id, data), which never change,
 * so the window's own re-renders (every drag and resize step, every raise)
 * do not reach the app; it re-renders from the hooks it uses (app-api.ts).
 */
const WindowBody = memo(function WindowBody({ id, data }: { id: AppId; data: unknown }) {
  return (
    <AppWindowContext.Provider value={id}>
      <AppBody appId={id} data={data as never} />
    </AppWindowContext.Provider>
  );
});

export function Window({ app, data }: { app: AppDefinition; data: unknown }) {
  const { id, title } = app;
  const state = useWindow(id);
  // A boolean, so a focus change re-renders only the two windows it concerns.
  const isFocusedWindow = useStore(windowsStore, (windows) => windows.focused === id);
  // macOS draws its controls close first, on the left (experiences.css), so
  // they render in that order and Tab meets them as drawn. The preferences
  // load after hydration, so the first render matches the server's.
  const closeFirst = useStore(prefsStore, (prefs) => prefs?.experience === "macos");
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollTabStop, setScrollTabStop] = useState(false);
  const shown = state.open && !state.minimized;
  const focused = shown && isFocusedWindow;
  const action = state.maximized ? "Restore" : "Maximize";

  const setElement = useCallback((element: HTMLElement | null) => registerWindowElement(id, element), [id]);

  // A scroller with nothing focusable inside gets its own tab stop, so
  // browsers that do not focus scrollers can still scroll it by keyboard.
  // Hidden and disabled controls (the unlocked Gallery's password form)
  // cannot take focus, so they do not count.
  const syncScrollableContent = useCallback(() => {
    const content = contentRef.current;
    if (!content || !windowsStore.get().windows[id].open) return;
    const needsTabStop =
      content.scrollHeight > content.clientHeight + 1 &&
      !Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE)).some(
        (element) =>
          !(element as HTMLButtonElement).disabled &&
          !element.closest("[hidden], [inert]") &&
          element.getClientRects().length > 0,
      );
    setScrollTabStop(needsTabStop);
  }, [id]);

  // Content that grows, shrinks, loads or changes view can start or stop
  // overflowing without the window resizing.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const resizeObserver = new ResizeObserver(syncScrollableContent);
    const observeChildren = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(content);
      Array.from(content.children).forEach((child) => resizeObserver.observe(child));
    };
    observeChildren();
    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      syncScrollableContent();
    });
    mutationObserver.observe(content, { childList: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [syncScrollableContent]);

  useLayoutEffect(() => {
    if (shown) syncScrollableContent();
  }, [shown, syncScrollableContent]);

  const onWindowMouseDown = () => {
    const current = windowsStore.get().windows[id];
    if (current.open && !current.minimized) focusWindow(id);
  };

  // Drags and resizes start from pointer events: a finger that moves sends
  // no mouse events. The title bar and handles are touch-action: none
  // (window.css), so the browser does not take the gesture to pan.
  const onTitlebarPointerDown = (event: ReactPointerEvent) => {
    if (!event.isPrimary || isMobileMode() || (event.target as Element).closest(".window-controls")) return;
    // A touch drag (and a pen's, on some systems) sends no mousedown to raise
    // the window.
    if (event.pointerType !== "mouse") onWindowMouseDown();
    followPointer(beginWindowDrag(id, event), event.pointerId);
  };

  const onTitlebarDoubleClick = (event: ReactMouseEvent) => {
    if (isMobileMode() || (event.target as Element).closest(".window-controls")) return;
    toggleMaximize(id);
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    const direction = event.currentTarget.dataset.resizeDirection || "corner";
    followPointer(beginWindowResize(id, direction, event), event.pointerId);
  };

  // A press on a handle neither raises the window nor moves focus.
  const onResizeMouseDown = (event: ReactMouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const minimizeButton = (
    <button
      key="min"
      className="min-btn"
      type="button"
      title="Minimize"
      aria-label={`Minimize ${title}`}
      onClick={() => minimizeWindow(id)}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <line x1="2" y1="6" x2="10" y2="6" />
      </svg>
    </button>
  );
  const maximizeButton = (
    <button
      key="max"
      className="max-btn"
      type="button"
      title={action}
      aria-label={`${action} ${title}`}
      onClick={() => toggleMaximize(id)}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="2" width="8" height="8" rx="1" />
      </svg>
    </button>
  );
  const closeButton = (
    <button
      key="close"
      className="close-btn"
      type="button"
      title="Close"
      aria-label={`Close ${title}`}
      onClick={() => closeWindow(id)}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <line x1="2" y1="2" x2="10" y2="10" />
        <line x1="10" y1="2" x2="2" y2="10" />
      </svg>
    </button>
  );

  const className = [
    "window",
    focused && "focused",
    state.minimized && "minimized",
    state.maximized && "maximized",
    state.opening && "opening",
    state.closing && "closing",
    state.mobile && "mobile-window",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      ref={setElement}
      id={`window-${id}`}
      className={className}
      data-window=""
      data-app-id={id}
      data-title={title}
      data-width={app.width}
      data-height={app.height}
      role="dialog"
      aria-labelledby={`window-${id}-title`}
      aria-hidden={shown ? "false" : "true"}
      hidden={state.hidden}
      // A window that never opened is hidden anyway.
      inert={!shown && state.hasOpened}
      style={state.style}
      onMouseDown={onWindowMouseDown}
      // Only the window manager makes the window itself focusable (keyboard
      // launches), until focus moves on (not when the browser window loses
      // focus). A click inside leaves focus where the browser puts it, so
      // keyboard scrolling still starts from the clicked content.
      onPointerDownCapture={(event) => event.currentTarget.removeAttribute("tabindex")}
      onBlur={(event) => {
        if (event.target === event.currentTarget && document.hasFocus()) {
          event.currentTarget.removeAttribute("tabindex");
        }
      }}
      // Tabbing into a window gives it the keyboard, just like clicking.
      onFocus={() => {
        const current = windowsStore.get();
        const win = current.windows[id];
        if (win.open && !win.minimized && current.focused !== id) focusWindow(id);
      }}
    >
      <div className="window-titlebar" onPointerDown={onTitlebarPointerDown} onDoubleClick={onTitlebarDoubleClick}>
        <div className="window-titlebar-icon">
          <AppIcon name={id} />
        </div>
        <span id={`window-${id}-title`} className="window-title">
          {title}
        </span>
        <div className="window-controls">
          {closeFirst
            ? [closeButton, minimizeButton, maximizeButton]
            : [minimizeButton, maximizeButton, closeButton]}
        </div>
      </div>
      <div
        ref={contentRef}
        className="window-content"
        {...(scrollTabStop ? { tabIndex: 0, role: "group", "aria-label": `${title} content` } : {})}
      >
        {state.mounted && <WindowBody id={id} data={data} />}
      </div>
      <div
        className="window-resize-handle window-resize-handle-right"
        data-resize-direction="right"
        onPointerDown={onResizePointerDown}
        onMouseDown={onResizeMouseDown}
      />
      <div
        className="window-resize-handle window-resize-handle-bottom"
        data-resize-direction="bottom"
        onPointerDown={onResizePointerDown}
        onMouseDown={onResizeMouseDown}
      />
      <div
        className="window-resize-handle window-resize-handle-corner"
        data-resize-direction="corner"
        onPointerDown={onResizePointerDown}
        onMouseDown={onResizeMouseDown}
      />
    </section>
  );
}
