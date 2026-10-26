// The <html> shell of every page. Each route group's root layout
// (src/app/(group)/layout.tsx) renders one, so pages can differ in <html>
// attributes (lang, data-site-mode, classes) and parse-time <head> scripts.
// Page metadata comes from buildMetadata (src/lib/head.ts); Next.js adds
// those tags, the stylesheets and its scripts to <head>.
import type { ReactNode } from "react";
// Shared desktop, app, and article styles on every page. Feature styles are
// imported by their components.
import "@styles/global.css";
// Inter and JetBrains Mono (--font-inter, --font-jetbrains-mono), defined on
// every page and downloaded only where text uses them.
import "@styles/fonts-desktop.css";
import { JsonLd } from "./JsonLd";
import { Prefetch } from "./Prefetch";

type DataAttributes = { [key: `data-${string}`]: string | undefined };

/**
 * Whether the exported page keeps the React and Next.js runtime.
 *
 * - "none": a static page. scripts/postbuild.mjs removes Next.js's scripts,
 *   script preloads and inline RSC payload from the exported HTML (and the
 *   page's .txt payload files), so only <InlineScript>s run. For pages without
 *   client components ("use client"): their server-rendered HTML is all there
 *   is, and nothing hydrates.
 * - "react": the page hydrates (about 133 KB of gzipped JavaScript, plus an
 *   RSC payload that roughly doubles the HTML). Needed as soon as the page
 *   renders a client component. postbuild adds data-cfasync="false" to
 *   Next.js's scripts so Cloudflare Rocket Loader does not delay hydration.
 *
 * `next dev` always hydrates; the difference exists only in out/.
 */
export type PageRuntime = "none" | "react";

/** Read by scripts/postbuild.mjs, which strips the runtime and this tag. */
export const RUNTIME_NONE_META = "pepodev-runtime";

interface DocumentProps {
  /** See PageRuntime. Required, so every root layout decides. */
  runtime: PageRuntime;
  /** Page language (BCP 47). */
  lang?: string;
  /** Extra classes on <html>. */
  className?: string;
  /** data-* attributes on <html>, e.g. data-site-mode. */
  htmlData?: DataAttributes;
  /**
   * Set when a parse-time script in `head` changes <html> attributes
   * (data-theme, data-site-mode, style), so hydration does not report them.
   */
  suppressHydrationWarning?: boolean;
  /** Parse-time scripts (<InlineScript>) for <head>, run before first paint. */
  head?: ReactNode;
  /** Structured data for <head> (buildJsonLd in src/lib/head.ts). */
  jsonLd?: Record<string, unknown>;
  bodyClassName?: string;
  children: ReactNode;
}

export function Document({
  runtime,
  lang = "en",
  className,
  htmlData,
  suppressHydrationWarning,
  head,
  jsonLd,
  bodyClassName,
  children,
}: DocumentProps) {
  return (
    <html
      lang={lang}
      className={className}
      suppressHydrationWarning={suppressHydrationWarning}
      {...htmlData}
    >
      <head>
        {runtime === "none" && <meta name={RUNTIME_NONE_META} content="none" />}
        {head}
        {jsonLd && <JsonLd data={jsonLd} />}
      </head>
      <body className={bodyClassName}>
        {children}
        <Prefetch />
      </body>
    </html>
  );
}
