// The page around the blog index and every post: website mode's header,
// the page's <main> (the children, which carry id="blog-main" for the skip
// link) and website mode's footer. The blog is part of website mode: same
// tokens, type, light and dark themes and accent (html[data-site-mode=
// "website"], website-mode.css), like the garden (GardenShell.tsx). The
// <html> shell and the theme script are the blog root layouts'
// (src/app/(blog)/layout.tsx, src/app/(post)/blog/[slug]/layout.tsx).
import type { ReactNode } from "react";
import { BrandMark } from "@components/BrandMark";
import socialLinks from "@data/social-links.json";
import { getGardenNotes } from "@utils/garden";
import "@styles/fonts-website.css";
import "@styles/website-mode.css";
import "./BlogShell.css";

export const BLOG_MAIN_ID = "blog-main";

const issueLink = socialLinks.find((link) => link.icon === "issue");

function RssIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="3.5" cy="12.5" r="1.75" fill="currentColor" />
      <path
        d="M2 7.25a6.75 6.75 0 0 1 6.75 6.75M2 2.5A11.5 11.5 0 0 1 13.5 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export async function BlogShell({
  current,
  children,
}: {
  /** The blog index marks Writing as the page; a post as its section. */
  current: "index" | "post";
  children: ReactNode;
}) {
  // Like website mode, the header links the garden only once it has notes.
  const hasGarden = (await getGardenNotes()).some((note) => note.id !== "index");
  const year = new Date().getFullYear();
  return (
    <div className="blog-shell">
      <a className="website-skip-link" href={`#${BLOG_MAIN_ID}`} lang="en">
        Skip to content
      </a>{" "}
      <header className="website-header blog-header" lang="en">
        <div className="ws-header-inner">
          <a className="ws-brand" href="/" aria-label="pepo.dev home">
            <BrandMark size={26} /> <span>pepo.dev</span>
          </a>{" "}
          <nav className="ws-nav" aria-label="Site">
            <a href="/blog/" aria-current={current === "index" ? "page" : "true"}>
              Writing
            </a>{" "}
            {hasGarden && <a href="/garden/">Garden</a>}{" "}
            <a href="/resume/">Resume</a>
          </nav>{" "}
          <div className="ws-header-actions">
            <a className="blog-rss-link" href="/rss.xml">
              <RssIcon />
              RSS feed
            </a>
          </div>
        </div>
      </header>{" "}
      {children}{" "}
      <footer className="ws-footer ws-wrap" lang="en">
        <p>{`© ${year} Thiwanon Chomcharoen · pepo.dev`}</p>{" "}
        <p className="ws-foot-links">
          <a href="/">Home</a> <a href="/blog/">Writing</a> <a href="/rss.xml">RSS</a>{" "}
          {issueLink && (
            <a href={issueLink.href} target="_blank" rel="noopener noreferrer">
              Report an issue
              <span className="ws-ext" aria-hidden="true">
                ↗
              </span>
            </a>
          )}
        </p>
      </footer>
    </div>
  );
}
