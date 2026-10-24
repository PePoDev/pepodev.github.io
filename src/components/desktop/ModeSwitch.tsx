// The two-way mode switch (port of ModeSwitch.astro): an action button whose
// name says what it does, so it has no pressed state. Each variant shows
// only in its own mode, so the name never changes and is right before any
// script runs. site-mode.ts handles every [data-site-mode-toggle] click by
// delegation, so this renders from Server Components (website mode) and
// client components (the taskbar) alike.
import { MonitorIcon } from "./MonitorIcon";

export function ModeSwitch({ id, variant }: { id?: string; variant: "taskbar" | "website" }) {
  const nextMode = variant === "website" ? "desktop" : "website";
  const actionLabel = `Switch to ${nextMode} mode`;
  return (
    <button
      id={id}
      className={`site-mode-switch site-mode-switch--${variant}`}
      type="button"
      data-site-mode-toggle=""
      aria-label={actionLabel}
      title={actionLabel}
    >
      <MonitorIcon />
      {variant === "website" && <span data-site-mode-label="">Desktop mode</span>}
    </button>
  );
}
