"use client";
// The taskbar (port of Taskbar.astro): Start and palette buttons, one button
// per open window (named by its label, which phone widths hide only
// visually), the mode switch, and the tray: system audio and the clock,
// which open the tray panel (calendar, volume, mute).
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { AppIcon } from "./AppIcon";
import { APPS, taskbarLabel, type AppDefinition } from "./apps";
import { ModeSwitch } from "./ModeSwitch";
import { setStartMenu, setTrayOpen, useOverlayOpen } from "./overlay-state";
import { openPalette } from "./palette";
import { setSystemAudio, useSystemAudio } from "./system-audio";
import { useStore } from "./store";
import { formatTaskbarClock } from "./taskbar-clock";
import {
  activateWindow,
  isKeyboardInteraction,
  isMobileMode,
  minimizeWindow,
  restoreWindow,
  windowsStore,
} from "./window-manager";

/** The current time, refreshed every `interval` ms; null until mounted (no server time). */
export function useNow(interval: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

/**
 * Drops DOM focus from a window button pressed with the pointer, and starts
 * sequential focus at the start of the window buttons (#taskbar-apps), as
 * when the Astro taskbar rebuilt them: Tab then reaches the first window
 * button and Shift+Tab the palette button, not whatever follows the
 * pressed one. Browsers start Tab from the element that lost focus, so the
 * list itself takes focus for a moment.
 */
function releaseTaskbarFocus(apps: HTMLElement | null) {
  if (!apps) return;
  apps.tabIndex = -1;
  apps.focus({ preventScroll: true });
  apps.blur();
  apps.removeAttribute("tabindex");
}

const TaskbarApp = memo(function TaskbarApp({ app }: { app: AppDefinition }) {
  // Only what the button shows, so drags, resizes and z-order changes of its
  // window do not re-render it.
  const open = useStore(windowsStore, (state) => state.windows[app.id].open);
  const focused = useStore(
    windowsStore,
    (state) => state.focused === app.id && state.windows[app.id].open && !state.windows[app.id].minimized,
  );
  if (!open) return null;
  const label = taskbarLabel(app);
  return (
    <button
      type="button"
      className={"taskbar-app active" + (focused ? " focused" : "")}
      data-app-id={app.id}
      // The label names the button; phone widths hide it only visually, and
      // the icon is aria-hidden.
      title={label}
      onClick={(event) => {
        const moveFocus = isKeyboardInteraction();
        const button = event.currentTarget;
        const current = windowsStore.get();
        const win = current.windows[app.id];
        if (win.minimized) restoreWindow(app.id, moveFocus);
        else if (!isMobileMode() && current.focused === app.id) minimizeWindow(app.id);
        else activateWindow(app.id, moveFocus);
        // After a click or tap the keys belong to the focused window (README:
        // after a pointer action the next app gets the keys), so the button
        // must not keep DOM focus: app-keyboard.ts would treat the focused
        // taskbar control as the target, and Enter or Space would press it
        // again (minimizing the window). Keyboard users keep focus on it, or
        // follow it into the window.
        if (!moveFocus && document.activeElement === button) releaseTaskbarFocus(button.parentElement);
      }}
    >
      <AppIcon name={app.id} />
      <span>{label}</span>
    </button>
  );
});

const longDate = new Intl.DateTimeFormat("en", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

// Memoized, as are AudioControls: the tray panel re-renders on opening and
// closing, which changes neither.
const Calendar = memo(function Calendar({ today }: { today: Date | null }) {
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  useEffect(() => setVisibleMonth((month) => month ?? new Date()), []);
  const shift = (delta: number) =>
    setVisibleMonth((month) => month && new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const days: { key: string; day?: number; today?: boolean }[] = [];
  if (visibleMonth) {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const mondayBasedOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < mondayBasedOffset; i++) days.push({ key: `empty-${i}` });
    for (let day = 1; day <= lastDay; day++) {
      days.push({
        key: String(day),
        day,
        today:
          today !== null &&
          year === today.getFullYear() &&
          month === today.getMonth() &&
          day === today.getDate(),
      });
    }
  }

  return (
    <div className="tray-calendar">
      <div className="tray-calendar-header">
        <button id="calendar-prev" type="button" aria-label="Previous month" onClick={() => shift(-1)}>
          &lt;
        </button>
        <span id="calendar-title">{visibleMonth ? monthTitle.format(visibleMonth) : ""}</span>
        <button id="calendar-next" type="button" aria-label="Next month" onClick={() => shift(1)}>
          &gt;
        </button>
      </div>
      <div className="tray-calendar-grid tray-calendar-days" aria-hidden="true">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>
      <div id="calendar-grid" className="tray-calendar-grid">
        {days.map((cell) =>
          cell.day === undefined ? (
            <span key={cell.key} className="calendar-empty" />
          ) : (
            <span key={cell.key} className={cell.today ? "calendar-day today" : "calendar-day"}>
              {cell.day}
            </span>
          ),
        )}
      </div>
    </div>
  );
});

const AudioControls = memo(function AudioControls() {
  const { volume, muted } = useSystemAudio();
  const volumePercent = Math.round(volume * 100);
  const rangeRef = useRef<HTMLInputElement>(null);

  // A native listener: scripts (and tests) that set the value and dispatch
  // "input" do not pass React's change detection.
  useEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const onInput = () => setSystemAudio({ volume: Number(range.value) / 100, muted: false });
    range.addEventListener("input", onInput);
    return () => range.removeEventListener("input", onInput);
  }, []);

  useEffect(() => {
    const range = rangeRef.current;
    if (range && range.value !== String(volumePercent)) range.value = String(volumePercent);
  }, [volumePercent]);

  return (
    <>
      <div className="audio-control-row">
        <button id="audio-mute" type="button" aria-pressed={muted} onClick={() => setSystemAudio({ muted: !muted })}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <label htmlFor="audio-volume">Volume</label>
        <span id="audio-volume-value">{muted ? "Muted" : volumePercent + "%"}</span>
      </div>
      <input
        ref={rangeRef}
        id="audio-volume"
        type="range"
        min="0"
        max="100"
        defaultValue={volumePercent}
        style={{ "--range-progress": Math.max(0, Math.min(100, volumePercent)) + "%" } as CSSProperties}
      />
    </>
  );
});

function StartButton() {
  const open = useOverlayOpen("start-menu");
  return (
    <button
      id="taskbar-start"
      type="button"
      aria-label="Open start menu"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="start-menu"
      onClick={() => setStartMenu(!open, { restoreFocus: true })}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
      </svg>
    </button>
  );
}

// Opens the tray, so it has a fixed name and no pressed state; the mute
// toggle is in the tray. Its title carries the current state.
function AudioStatusButton() {
  const trayOpen = useOverlayOpen("tray-panel");
  const { muted } = useSystemAudio();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      id="taskbar-audio-status"
      type="button"
      aria-label="Audio settings"
      title={muted ? "Muted" : "Audio on"}
      className={muted ? "muted" : undefined}
      aria-expanded={trayOpen}
      aria-controls="tray-panel"
      onClick={() => setTrayOpen(!trayOpen, { opener: ref.current, restoreFocus: true })}
    >
      <svg className="audio-icon audio-icon-on" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path
          d="M16 8c1.3 1.2 1.3 6.8 0 8M19 5c2.7 3 2.7 11 0 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <svg className="audio-icon audio-icon-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M17 9l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// Named by its text, the time and date. DesktopClockScript writes them
// before first paint (hence suppressHydrationWarning: the server renders
// them empty, having no visitor's clock), so the button is never blank or
// nameless while the desktop loads.
function ClockButton({ now }: { now: Date | null }) {
  const trayOpen = useOverlayOpen("tray-panel");
  const ref = useRef<HTMLButtonElement>(null);
  const text = now ? formatTaskbarClock(now) : null;
  return (
    <button
      ref={ref}
      id="taskbar-clock-button"
      type="button"
      aria-expanded={trayOpen}
      aria-controls="tray-panel"
      onClick={() => setTrayOpen(!trayOpen, { opener: ref.current, restoreFocus: true })}
    >
      <span id="taskbar-clock" suppressHydrationWarning>
        {text?.time ?? ""}
      </span>
      <span id="taskbar-date" suppressHydrationWarning>
        {text?.date ?? ""}
      </span>
    </button>
  );
}

function TrayPanel({ now }: { now: Date | null }) {
  const open = useOverlayOpen("tray-panel");
  return (
    <div id="tray-panel" className={open ? "visible" : undefined} aria-hidden={!open} inert={!open}>
      <div className="tray-panel-header">
        <div>
          <div id="tray-time">{now ? formatTaskbarClock(now).time : ""}</div>
          <div id="tray-date">{now ? longDate.format(now) : ""}</div>
        </div>
        <span className="tray-status">Nominal</span>
      </div>

      <div className="tray-section">
        <div className="tray-section-title">Calendar</div>
        <Calendar today={now} />
      </div>

      <div className="tray-section">
        <div className="tray-section-title">Audio</div>
        <AudioControls />
      </div>
    </div>
  );
}

// Each part reads only the state it shows: opening an overlay re-renders
// its own button and panel, not every window button (measured with a render
// counter: 3 components for the tray, where the whole taskbar re-rendered).
export function Taskbar() {
  const now = useNow(30_000);
  return (
    <div id="taskbar">
      <StartButton />
      <button
        id="taskbar-command-palette"
        type="button"
        aria-label="Open command palette"
        title="Open command palette"
        onClick={() => openPalette()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <div id="taskbar-apps">
        {APPS.map((app) => (
          <TaskbarApp key={app.id} app={app} />
        ))}
      </div>
      <div id="taskbar-tray">
        <ModeSwitch id="taskbar-site-mode" variant="taskbar" />
        <AudioStatusButton />
        <ClockButton now={now} />
      </div>
      <TrayPanel now={now} />
    </div>
  );
}
