"use client";
// Desktop icons and the pointer half of their controllers. App icons are
// buttons that open their app on a click without movement, Enter or Space;
// link shortcuts are real links. Above 768px both drag to the grid
// (icon-layout.ts). Before hydration the parse-time placement script sets
// their position and data-desktop-icon-ready, so they carry
// suppressHydrationWarning.
import { useCallback, useRef, type CSSProperties, type PointerEvent } from "react";
import { AppIcon } from "./AppIcon";
import type { AppDefinition } from "./apps";
import "./ExternalLinkIcon.css";
import {
  dropIcon,
  isMobileLauncherMode,
  moveIcon,
  registerIconElement,
  setIconPressed,
  useIconState,
  type DesktopLink,
  type IconState,
} from "./icon-layout";
import { requestOpenApp } from "./window-manager";

function iconStyle(state: IconState): CSSProperties | undefined {
  const zIndex = state.zIndex || undefined;
  if (!state.position) return zIndex ? { zIndex } : undefined;
  return {
    position: "fixed",
    left: state.position.x + "px",
    top: state.position.y + "px",
    right: "auto",
    bottom: "auto",
    zIndex,
  };
}

interface Press {
  startX: number;
  startY: number;
  iconX: number;
  iconY: number;
  down: boolean;
  dragging: boolean;
}

/** Pointer dragging shared by both kinds: returns the handlers and the press state. */
function useIconDrag(id: string, onTap?: () => void) {
  const press = useRef<Press>({ startX: 0, startY: 0, iconX: 0, iconY: 0, down: false, dragging: false });
  return {
    press,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (isMobileLauncherMode() || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        press.current = {
          startX: event.clientX,
          startY: event.clientY,
          iconX: rect.left,
          iconY: rect.top,
          down: true,
          dragging: false,
        };
        setIconPressed(id, true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = press.current;
        if (isMobileLauncherMode() || !current.down) return;
        const deltaX = event.clientX - current.startX;
        const deltaY = event.clientY - current.startY;
        if (!current.dragging && Math.hypot(deltaX, deltaY) < 4) return;
        current.dragging = true;
        moveIcon(id, current.iconX + deltaX, current.iconY + deltaY);
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const current = press.current;
        if (isMobileLauncherMode() || !current.down) return false;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        current.down = false;
        setIconPressed(id, false);
        if (current.dragging) {
          const rect = event.currentTarget.getBoundingClientRect();
          current.dragging = false;
          dropIcon(id, rect.left, rect.top);
          return true;
        }
        onTap?.();
        return false;
      },
      onPointerCancel() {
        press.current.down = false;
        press.current.dragging = false;
        setIconPressed(id, false);
      },
    },
  };
}

export function DesktopIcon({ app }: { app: AppDefinition }) {
  // Rendered for the apps in DESKTOP_ICON_ORDER, which all have one.
  const icon = app.icon!;
  const state = useIconState(app.id);
  const setElement = useCallback((element: HTMLElement | null) => registerIconElement(app.id, element), [app.id]);
  const openApp = () => requestOpenApp(app.id);
  const { handlers } = useIconDrag(app.id, openApp);

  return (
    <button
      ref={setElement}
      type="button"
      className={"desktop-icon" + (state.dragging ? " dragging" : "")}
      data-open-app={app.id}
      data-default-col={icon.col}
      data-default-row={icon.row}
      data-layout-group={icon.group}
      data-layout-index={icon.index}
      data-desktop-icon-ready={state.ready ? "true" : undefined}
      style={iconStyle(state)}
      suppressHydrationWarning
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={(event) => {
        handlers.onPointerUp(event);
      }}
      onPointerCancel={handlers.onPointerCancel}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        // Hydrated but not booted yet: nothing would open the window. Leave
        // the key its native click, which the parse-time input script keeps
        // for the boot to replay (DesktopScripts.tsx).
        if (!window.__pepodevWindowManagerReady) return;
        event.preventDefault();
        openApp();
      }}
      // Pointer and key opens are handled above. A click with detail 0 comes
      // from assistive tech (screen-reader activation), which sends no
      // pointer or key events; at phone widths every click opens.
      onClick={(event) => {
        if (!isMobileLauncherMode() && event.detail !== 0) return;
        event.preventDefault();
        openApp();
      }}
    >
      <AppIcon name={app.id} />
      <span>{app.label}</span>
    </button>
  );
}

export function ExternalLinkIcon({ link }: { link: DesktopLink }) {
  const state = useIconState(link.id);
  const setElement = useCallback((element: HTMLElement | null) => registerIconElement(link.id, element), [link.id]);
  const { handlers } = useIconDrag(link.id);
  // A drag ends in a click; it must not follow the link.
  const wasDragging = useRef(false);

  return (
    <a
      ref={setElement}
      id={link.id}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={"desktop-icon desktop-link-icon" + (state.dragging ? " dragging" : "")}
      data-shortcut-index={link.shortcutIndex}
      data-desktop-icon-ready={state.ready ? "true" : undefined}
      style={iconStyle(state)}
      suppressHydrationWarning
      onPointerDown={(event) => {
        if (isMobileLauncherMode() || event.button !== 0) return;
        wasDragging.current = false;
        handlers.onPointerDown(event);
        event.preventDefault();
      }}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={(event) => {
        if (handlers.onPointerUp(event)) {
          wasDragging.current = true;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerCancel={handlers.onPointerCancel}
      onClick={(event) => {
        if (!wasDragging.current) return;
        event.preventDefault();
        event.stopPropagation();
        wasDragging.current = false;
      }}
    >
      <div className="icon-wrapper">
        <AppIcon name={link.icon} />
        <svg className="link-badge" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect width="12" height="12" rx="2" fill="#1e293b" />
          <path
            d="M4 8L8 4M8 4H5.5M8 4V6.5"
            stroke="#22c55e"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span>{link.label}</span>
    </a>
  );
}
