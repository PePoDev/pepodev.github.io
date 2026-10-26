"use client";
// Quick Access, the Start menu (#start-menu): the desktop's one launcher, for
// apps, commands and links (its rules are in quick-access.ts; opening,
// closing and focus return in overlay-state.ts). An empty query shows the
// Apps, Commands and Links sections. While searching, matches leave their
// sections for one flat list sorted by rank, so "set" puts Settings above
// Reset Desktop; every item stays in the DOM, hidden ones with display: none,
// so the visual, Tab and arrow-key orders agree. App items are
// [data-open-app] launchers, which the desktop opens on click (runtime.tsx)
// and app-chunks.ts prefetches on hover or focus.
import { memo, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { AppIcon } from "./AppIcon";
import { useOverlayOpen } from "./overlay-state";
import {
  moveQuickAccessSelection,
  QUICK_ACCESS_ENTRIES,
  QUICK_ACCESS_SECTIONS,
  rankQuickAccessEntries,
  runHighlightedEntry,
  runQuickAccessEntry,
  selectQuickAccessEntry,
  setQuickAccessQuery,
  useQuickAccess,
  type QuickAccessEntry,
} from "./quick-access";

const NO_MATCH = "No matching apps, commands or links";

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

// The commands' icons, drawn like the app icons (AppIcon.tsx): a dark tile
// in the command's colour. Decorative; the item carries the name.
const CommandIcon = memo(function CommandIcon({ id }: { id: string }) {
  const color = id === "reset-desktop" ? "#ff453a" : id === "close-all-windows" ? "#64d2ff" : "#ff9f0a";
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="7" fill="#1e293b" stroke={color} strokeWidth="1.5" />
      {id === "toggle-theme" && (
        <>
          <circle cx="20" cy="20" r="7" stroke={color} strokeWidth="1.5" />
          <path d="M20 13A7 7 0 0 1 20 27Z" fill={color} opacity="0.85" />
          <path
            d="M20 8.5V10M20 30V31.5M8.5 20H10M30 20H31.5"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </>
      )}
      {id === "close-all-windows" && (
        <>
          <rect x="14" y="10" width="16" height="12" rx="2" stroke={color} strokeWidth="1.2" opacity="0.5" />
          <rect x="10" y="15" width="17" height="15" rx="2" fill="#1e293b" stroke={color} strokeWidth="1.5" />
          <path d="M10 19.5H27" stroke={color} strokeWidth="1.2" opacity="0.6" />
          <path d="M16 22.5L21 27.5M21 22.5L16 27.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {id === "reset-desktop" && (
        <g
          transform="translate(9.8 9.8) scale(0.85)"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 4V10H17" />
          <path d="M20.49 15A9 9 0 1 1 18.37 5.64L23 10" />
        </g>
      )}
    </svg>
  );
});

function ItemIcon({ entry }: { entry: QuickAccessEntry }) {
  return (
    <span className="start-menu-item-icon">
      {entry.type === "command" ? <CommandIcon id={entry.id} /> : <AppIcon name={entry.icon} />}
    </span>
  );
}

export function StartMenu() {
  const open = useOverlayOpen("start-menu");
  const { query, selected, armed, confirm } = useQuickAccess();
  const searching = query.trim() !== "";
  const visible = rankQuickAccessEntries(query);
  const visibleIndex = new Map(visible.map((entry, index) => [entry.id, index]));
  const status = armed ? confirm : searching && visible.length === 0 ? NO_MATCH : "";

  const item = (entry: QuickAccessEntry, hidden: boolean) => {
    const className = [
      "start-menu-item",
      `start-menu-${entry.type}`,
      !hidden && visibleIndex.get(entry.id) === selected && "selected",
      armed === entry.id && "confirming",
    ]
      .filter(Boolean)
      .join(" ");
    const shared = {
      className,
      "data-type": entry.type,
      "data-id": entry.id,
      style: hidden ? { display: "none" } : undefined,
    };
    const content = (
      <>
        <ItemIcon entry={entry} />
        <span className="start-menu-item-text">
          <strong>{entry.name}</strong>
          <small>{entry.description}</small>
        </span>
      </>
    );
    if (entry.type === "app") {
      // The desktop launches it (a [data-open-app] launcher); the click only
      // moves the highlight.
      return (
        <button
          key={entry.id}
          {...shared}
          type="button"
          data-open-app={entry.id}
          onClick={() => selectQuickAccessEntry(entry.id)}
        >
          {content}
        </button>
      );
    }
    if (entry.type === "link") {
      return (
        <a
          key={entry.id}
          {...shared}
          href={entry.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            selectQuickAccessEntry(entry.id);
            runQuickAccessEntry(entry);
          }}
        >
          {content}
          <svg className="start-menu-item-external" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M4 8L8 4M8 4H5M8 4V7"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      );
    }
    return (
      <button
        key={entry.id}
        {...shared}
        type="button"
        onClick={() => {
          selectQuickAccessEntry(entry.id);
          runQuickAccessEntry(entry);
        }}
      >
        {content}
      </button>
    );
  };

  // ArrowUp and ArrowDown move the highlight; Enter in the search box (or on
  // the menu, which touch screens focus) runs it. A focused item runs
  // through its own native Enter instead.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveQuickAccessSelection(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      if ((event.target as Element).closest(".start-menu-item")) return;
      if (runHighlightedEntry()) event.preventDefault();
    }
  };

  // The highlight follows keyboard focus, so Enter and the highlight agree.
  const onResultsFocus = (event: FocusEvent<HTMLDivElement>) => {
    const id = (event.target as Element).closest<HTMLElement>(".start-menu-item")?.dataset.id;
    if (id) selectQuickAccessEntry(id);
  };

  return (
    <div
      id="start-menu"
      className={open ? "visible" : undefined}
      role="dialog"
      aria-label="Start menu"
      tabIndex={-1}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      <div id="start-menu-header">
        <h3>Quick Access</h3>
        <input
          type="text"
          id="start-menu-search"
          placeholder="Search apps, commands and links..."
          aria-label="Search apps, commands and links"
          aria-controls="start-menu-results"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuickAccessQuery(event.target.value)}
        />
      </div>
      <div id="start-menu-results" onFocus={onResultsFocus}>
        <div id="start-menu-matches" className="start-menu-items" hidden={!searching || visible.length === 0}>
          {searching && visible.map((entry) => item(entry, false))}
        </div>
        {QUICK_ACCESS_SECTIONS.map((section) => {
          const titleId = `start-menu-section-${section.toLowerCase()}`;
          return (
            <div
              key={section}
              className="start-menu-section"
              role="group"
              aria-labelledby={titleId}
              hidden={searching}
            >
              <h4 id={titleId} className="start-menu-section-title">
                {section}
              </h4>
              <div className="start-menu-items">
                {QUICK_ACCESS_ENTRIES.filter((entry) => entry.section === section).map((entry) =>
                  searching ? (visibleIndex.has(entry.id) ? null : item(entry, true)) : item(entry, false),
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p id="start-menu-status" role="status" data-tone={armed ? "warning" : undefined}>
        {status}
      </p>
      <div id="start-menu-footer">
        <span>system status: nominal</span>
        <Uptime open={open} />
      </div>
    </div>
  );
}
