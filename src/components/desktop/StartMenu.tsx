"use client";
// The Start menu. Search ranks labels that start with the query first, then
// other label matches, then descriptions (rankMatch in src/utils/search.ts);
// Enter opens the first match. Items are [data-open-app] launchers, which the
// desktop opens on click.
import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { rankMatch } from "@utils/search";
import { AppIcon } from "./AppIcon";
import { APPS } from "./apps";
import { startQueryStore, useOverlayOpen, useStartQuery } from "./overlay-state";

// Counts from the desktop's start, and ticks only while the menu is open
// (it is the one thing on the desktop that would re-render every second).
// Memoized: typing in the search box re-renders the menu, not the uptime.
const Uptime = memo(function Uptime({ open }: { open: boolean }) {
  const [text, setText] = useState("uptime: --");
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const diff = Date.now() - startedAt.current;
      setText("uptime: " + Math.floor(diff / 60000) + "m " + Math.floor((diff % 60000) / 1000) + "s");
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [open]);
  return <span id="start-menu-uptime">{text}</span>;
});

export function StartMenu() {
  const open = useOverlayOpen("start-menu");
  const query = useStartQuery();
  const q = query.trim().toLowerCase();
  // Matches first, by rank, so Enter opens the closest one.
  const ranked = APPS.map((app, index) => ({
    app,
    index,
    rank: rankMatch(app.label.toLowerCase(), app.startDescription.toLowerCase(), q),
  })).sort((a, b) => Number(a.rank < 0) - Number(b.rank < 0) || a.rank - b.rank || a.index - b.index);
  const anyMatch = ranked.some(({ rank }) => rank >= 0);

  // Enter in the search box opens the first match.
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const first = ranked.find(({ rank }) => rank >= 0);
    if (!first) return;
    event.preventDefault();
    document.querySelector<HTMLElement>(`#start-menu-apps [data-open-app="${first.app.id}"]`)?.click();
  };

  return (
    <div
      id="start-menu"
      className={open ? "visible" : undefined}
      role="dialog"
      aria-label="Start menu"
      tabIndex={-1}
      inert={!open}
    >
      <div id="start-menu-header">
        <h3>Quick Access</h3>
        <input
          type="text"
          id="start-menu-search"
          placeholder="Search apps..."
          aria-label="Search apps"
          autoComplete="off"
          value={query}
          onChange={(event) => startQueryStore.set(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      </div>
      <div id="start-menu-apps">
        {ranked.map(({ app, rank }) => (
          <button
            key={app.id}
            className="start-menu-app"
            type="button"
            data-open-app={app.id}
            style={rank < 0 ? { display: "none" } : undefined}
          >
            <AppIcon name={app.id} />
            <div className="start-menu-app-text">
              <strong>{app.label}</strong>
              <small>{app.startDescription}</small>
            </div>
          </button>
        ))}
      </div>
      <p id="start-menu-empty" role="status">
        {anyMatch ? "" : "No apps found"}
      </p>
      <div id="start-menu-footer">
        <span>system status: nominal</span>
        <Uptime open={open} />
      </div>
    </div>
  );
}
