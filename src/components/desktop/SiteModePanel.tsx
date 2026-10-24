"use client";
// A site mode panel: #desktop or #website (data-site-mode-panel). Neither is
// hidden in the server HTML: html[data-site-mode] hides the other one from
// first paint (website-mode.css), and once the desktop boots the inactive
// panel is also hidden, inert and aria-hidden. Children may be Server
// Components (website mode passes its server-rendered content).
import type { ReactNode } from "react";
import { useSiteMode, type SiteMode } from "./site-mode";

export function SiteModePanel({
  mode,
  id,
  className,
  children,
}: {
  mode: SiteMode;
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const current = useSiteMode();
  const inactive = current !== null && current !== mode;
  return (
    <div
      id={id}
      className={className}
      data-site-mode-panel={mode}
      hidden={inactive}
      inert={inactive}
      aria-hidden={current === null ? undefined : inactive ? "true" : "false"}
    >
      {children}
    </div>
  );
}
