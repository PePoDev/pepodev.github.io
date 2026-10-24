"use client";
// The command palette (port of CommandPalette.astro's markup; its rules are
// in palette.ts). While searching, matches leave their sections for one
// flat list sorted by rank, so "set" puts Settings above Reset Desktop;
// every item stays in the DOM, hidden ones with display: none, so the
// visual, Tab and arrow-key order agree.
import type { FocusEvent } from "react";
import "./CommandPalette.css";
import { useOpenOverlay } from "./overlay-state";
import {
  closePalette,
  executePaletteEntry,
  PALETTE_ENTRIES,
  rankPaletteEntries,
  selectPaletteEntry,
  setPaletteQuery,
  usePalette,
  type PaletteEntry,
  type PaletteSection,
} from "./palette";

const SECTIONS: PaletteSection[] = ["Commands", "Apps", "External Links"];
const ORDER = new Map(PALETTE_ENTRIES.map((entry, index) => [entry.id, index]));

export function CommandPalette() {
  const open = useOpenOverlay() === "command-palette";
  const { query, selected, armed, status, tone } = usePalette();
  const searching = query.trim() !== "";
  const visible = rankPaletteEntries(query);
  const visibleIndex = new Map(visible.map((entry, index) => [entry.id, index]));

  const item = (entry: PaletteEntry, hidden: boolean) => {
    const index = visibleIndex.get(entry.id);
    const className = [
      "command-palette-item",
      !hidden && index === selected && "selected",
      armed === entry.id && "confirming",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <button
        key={entry.id}
        type="button"
        className={className}
        data-type={entry.type}
        data-id={entry.id}
        data-index={ORDER.get(entry.id)}
        data-href={entry.href}
        data-confirm={entry.confirm}
        data-confirm-touch={entry.confirmTouch}
        style={hidden ? { display: "none" } : undefined}
        onClick={() => {
          selectPaletteEntry(entry.id);
          executePaletteEntry(entry);
        }}
      >
        <span className="command-palette-item-icon">{entry.icon}</span>
        <div className="command-palette-item-content">
          <div className="command-palette-item-name">{entry.name}</div>
          <div className="command-palette-item-desc">{entry.description}</div>
        </div>
      </button>
    );
  };

  // The highlight follows keyboard focus, so Enter and the highlight agree.
  const onResultsFocus = (event: FocusEvent<HTMLDivElement>) => {
    const id = (event.target as Element).closest<HTMLElement>(".command-palette-item")?.dataset.id;
    if (id) selectPaletteEntry(id);
  };

  return (
    <div
      id="command-palette"
      className="command-palette"
      data-visible={open ? "true" : "false"}
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      inert={!open}
    >
      <div className="command-palette-backdrop" onClick={() => closePalette({ restoreFocus: true })} />
      <div className="command-palette-container">
        <div className="command-palette-header">
          <svg className="search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            id="command-palette-input"
            className="command-palette-input"
            placeholder="Search apps and commands..."
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setPaletteQuery(event.target.value)}
          />
          <kbd className="command-palette-hint">ESC</kbd>
        </div>
        <div id="command-palette-results" className="command-palette-results" onFocus={onResultsFocus}>
          <div id="command-palette-matches" className="command-palette-matches" hidden={!searching || !visible.length}>
            {searching && visible.map((entry) => item(entry, false))}
          </div>
          {SECTIONS.map((section) => (
            <div key={section} className="command-palette-section" hidden={searching}>
              <div className="command-palette-section-title">{section}</div>
              {PALETTE_ENTRIES.filter((entry) => entry.section === section).map((entry) =>
                searching ? (visibleIndex.has(entry.id) ? null : item(entry, true)) : item(entry, false),
              )}
            </div>
          ))}
        </div>
        <p id="command-palette-status" className="command-palette-status" role="status" data-tone={tone}>
          {status}
        </p>
      </div>
    </div>
  );
}
