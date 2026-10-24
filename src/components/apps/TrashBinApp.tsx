"use client";
// Trash Bin (port of TrashBinApp.astro). Restore marks an item "Restored-ish",
// fades it out and removes it 450 ms later; Empty trash removes every item,
// one every 80 ms. When the restored item held focus (a keyboard press, or a
// click, which focuses the button), focus moves to the next Restore button,
// the previous one, or Empty trash.
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { AppProps } from "@components/desktop/app-api";

const TRASH_ITEMS = [
  {
    name: "final-final-v7-actually-final.md",
    type: "Document",
    deleted: "42 minutes ago",
    note: "A postmortem draft that was mostly the word 'oops' in headings.",
  },
  {
    name: "node_modules_backup_do_not_open.zip",
    type: "Archive",
    deleted: "Yesterday",
    note: "Estimated restore time: three business quarters.",
  },
  {
    name: "prod-hotfix-from-friday-night.sh",
    type: "Script",
    deleted: "Last sprint",
    note: "Removed after it tried to fix DNS with confidence and no evidence.",
  },
  {
    name: "slo-budget-excuses.csv",
    type: "Spreadsheet",
    deleted: "Two incidents ago",
    note: "Rows include 'cosmic rays', 'cache had feelings', and 'it worked on staging'.",
  },
  {
    name: "meeting-that-could-have-been-a-logline.ics",
    type: "Calendar",
    deleted: "Just now",
    note: "Restoring this may summon a 30-minute alignment sync.",
  },
];

const RESTORE_MS = 450;
const EMPTY_STEP_MS = 80;

export default function TrashBinApp(_props: AppProps<"trash">) {
  const [items, setItems] = useState(() => TRASH_ITEMS.map((item, id) => ({ ...item, id })));
  const [restoring, setRestoring] = useState<ReadonlySet<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const emptyButtonRef = useRef<HTMLButtonElement>(null);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const removeLater = (id: number, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setItems((current) => current.filter((item) => item.id !== id));
    }, delay);
    timers.current.add(timer);
  };

  // The restored item's button is about to be disabled and removed, so the
  // keyboard moves to the next Restore button, the previous one, or Empty trash.
  const focusAfterRestore = (restoreButton: HTMLButtonElement) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-restore-trash]:not(:disabled)") ?? [],
    );
    const index = buttons.indexOf(restoreButton);
    (buttons[index + 1] ?? buttons[index - 1] ?? emptyButtonRef.current)?.focus();
  };

  const restore = (event: MouseEvent<HTMLButtonElement>, id: number) => {
    const restoreButton = event.currentTarget;
    if (restoreButton.closest("[data-trash-item]")?.contains(document.activeElement)) {
      focusAfterRestore(restoreButton);
    }
    setRestoring((current) => new Set(current).add(id));
    removeLater(id, RESTORE_MS);
  };

  const emptyTrash = () => {
    items.forEach((item, index) => removeLater(item.id, index * EMPTY_STEP_MS));
  };

  const remaining = items.length;

  return (
    <div className="app-content trash-app" data-trash-app="">
      <div className="trash-toolbar">
        <div>
          <h2>Trash Bin</h2>
          <p data-trash-count="">
            {remaining === 1
              ? "1 questionable artifact quarantined"
              : `${remaining} questionable artifacts quarantined`}
          </p>
        </div>
        <button type="button" data-empty-trash="" ref={emptyButtonRef} onClick={emptyTrash}>
          Empty trash
        </button>
      </div>

      <div className="trash-list" data-trash-list="" ref={listRef}>
        {items.map((item) => {
          const restored = restoring.has(item.id);
          return (
            <article key={item.id} className={restored ? "trash-item restored" : "trash-item"} data-trash-item="">
              <div className="trash-item-icon" aria-hidden="true">
                TR
              </div>
              <div>
                <div className="trash-item-title">
                  <h3>{item.name}</h3>
                  <span>{item.type}</span>
                </div>
                <p>{item.note}</p>
                <small>{`Deleted ${item.deleted}`}</small>
              </div>
              <button
                type="button"
                data-restore-trash=""
                disabled={restored}
                onClick={(event) => restore(event, item.id)}
              >
                {restored ? "Restored-ish" : "Restore"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="trash-empty" data-trash-empty="" hidden={remaining > 0}>
        <strong>Trash is empty.</strong>
        <span>The desktop feels lighter. Suspiciously lighter.</span>
      </div>
    </div>
  );
}
