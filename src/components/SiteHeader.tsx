// Header for the standalone pages (blog index, posts, and 404), so visitors
// arriving from search or a shared link can reach the rest of the site.
import type { CSSProperties } from "react";
import "./SiteHeader.css";

interface SiteHeaderProps {
  /** Max width in px, to line up with the page's content column. */
  width?: number;
  /** Marks the Blog link as the current page (the blog index). */
  current?: "blog";
}

export function SiteHeader({ width = 1020, current }: SiteHeaderProps) {
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
          <a href="/blog/" aria-current={current === "blog" ? "page" : undefined}>
            Blog
          </a>
          <a href="/rss.xml">RSS</a>
        </nav>
      </div>
    </header>
  );
}
