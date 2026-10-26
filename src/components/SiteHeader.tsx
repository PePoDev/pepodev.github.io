// Header for the 404 page, so visitors arriving from a broken link can reach
// the rest of the site. (The blog pages and the garden use website mode's
// header: BlogShell.tsx, GardenShell.tsx.)
import type { CSSProperties } from "react";
import "./SiteHeader.css";

interface SiteHeaderProps {
  /** Max width in px, to line up with the page's content column. */
  width?: number;
}

export function SiteHeader({ width = 1020 }: SiteHeaderProps) {
  return (
    <header
      className="site-header"
      lang="en"
      style={{ "--site-header-width": `${width}px` } as CSSProperties}
    >
      <div className="site-header-inner">
        <a className="site-header-brand" href="/">
          PePoDev
        </a>
        <nav className="site-header-nav" aria-label="Site">
          <a href="/blog/">Blog</a>
          <a href="/rss.xml">RSS</a>
        </nav>
      </div>
    </header>
  );
}
