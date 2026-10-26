// The page around every garden page: website mode's header, the note itself,
// the filterable note tree and, on wide screens, the note's table of contents.
// The <html> shell, the theme script and the stylesheets are the garden root
// layout's (src/app/(garden)/garden/[[...slug]]/layout.tsx).
import type { ReactNode } from "react";
import { BrandMark } from "@components/BrandMark";
import type { MarkdownHeading } from "@lib/content";
import { buildGardenTree, getGardenNotes } from "@utils/garden";
import { GardenPageScript } from "./GardenScripts";
import { GardenTree } from "./GardenTree";

export async function GardenShell({
  current,
  headings = [],
  children,
}: {
  /** Id of the note being shown; omitted on the garden home. */
  current?: string;
  headings?: MarkdownHeading[];
  children: ReactNode;
}) {
  const tree = buildGardenTree(await getGardenNotes());
  const toc = headings.filter(({ depth }) => depth <= 3);
  return (
    <>
      <div className="garden-shell">
        <a className="website-skip-link" href="#garden-main">
          Skip to content
        </a>{" "}
        {/* Inside the desktop Garden window the frame script gives the links
            that leave the garden target and rel before `next dev` hydrates
            (GardenScripts.tsx). These three are on every page, so they skip
            React's hydration check instead of logging a mismatch each time. */}
        <header className="website-header garden-header">
          <div className="ws-header-inner">
            <a className="ws-brand" href="/" aria-label="pepo.dev home" suppressHydrationWarning>
              <BrandMark size={26} /> <span>pepo.dev</span>
            </a>{" "}
            <nav className="ws-nav" aria-label="Site">
              <a href="/garden/" aria-current={current ? undefined : "page"}>
                Garden
              </a>{" "}
              <a href="/blog/" suppressHydrationWarning>
                Writing
              </a>{" "}
              <a href="/resume/" suppressHydrationWarning>
                Resume
              </a>
            </nav>
          </div>
        </header>{" "}
        <div className="garden-layout">
          <main id="garden-main" className="garden-main">
            {children}
          </main>{" "}
          <aside className="garden-sidebar" aria-label="Garden notes">
            <input
              className="garden-filter"
              type="search"
              placeholder="Filter notes"
              aria-label="Filter notes"
              data-garden-filter=""
            />{" "}
            <div data-garden-tree="">
              <GardenTree folder={tree} current={current} />
            </div>{" "}
            <p className="garden-filter-empty" data-garden-filter-empty="" hidden>
              No notes match.
            </p>
          </aside>{" "}
          {toc.length > 1 && (
            <nav className="garden-toc" aria-label="On this page">
              <p>On this page</p>
              <ul>
                {toc.map(({ depth, slug, text }) => (
                  <li key={slug} data-depth={depth}>
                    <a href={`#${slug}`}>{text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
      <GardenPageScript />
    </>
  );
}
