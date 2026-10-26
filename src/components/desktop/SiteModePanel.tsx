// A site mode panel: #desktop or #website (data-site-mode-panel). Neither is
// hidden in the server HTML: html[data-site-mode] hides the other one from
// first paint (website-mode.css), and once the desktop boots site-mode.ts
// also makes the inactive panel hidden, inert and aria-hidden. A Server
// Component: the desktop hydrates inside its panel (browser-entry.tsx), and
// website mode is server-rendered HTML.
import type { ReactNode } from "react";
import type { SiteMode } from "./site-mode";

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
  return (
    <div id={id} className={className} data-site-mode-panel={mode}>
      {children}
    </div>
  );
}
