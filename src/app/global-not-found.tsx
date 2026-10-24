// The branded 404, exported as out/404.html, which GitHub Pages serves for
// every unknown path, so every URL here must be root-relative. It renders
// outside the route groups' root layouts (experimental.globalNotFound).
import { Document } from "@components/Document";
import { SiteHeader } from "@components/SiteHeader";
import { buildMetadata, siteJsonLd, siteViewport } from "@lib/head";
import { NotFoundPath, NotFoundPathScript } from "./not-found/NotFoundPath";
import "./not-found/not-found.css";

export const viewport = siteViewport;

export async function generateMetadata() {
  const { robots: _robots, ...metadata } = await buildMetadata({
    title: "Page not found - PePoDev",
    description:
      "This page does not exist on pepo.dev. Head back to the desktop, the blog, or the resume.",
    path: "/404.html",
    noindex: true,
  });
  // Next.js adds <meta name="robots" content="noindex"> to not-found pages
  // itself; a second tag would duplicate it.
  return metadata;
}

export default async function GlobalNotFound() {
  return (
    // Static: no client components, so no React runtime in out/404.html.
    <Document runtime="none" bodyClassName="not-found-page" jsonLd={await siteJsonLd()}>
      <SiteHeader />
      <main className="not-found">
        <div className="not-found-content">
          <p className="not-found-eyebrow">HTTP 404</p>
          <h1>Page not found</h1>
          <p className="not-found-lead">
            There is nothing at this address. The page may have moved, or the link may have a
            typo.
          </p>
          <pre className="not-found-terminal">
            <span className="prompt">$</span> kubectl get page <NotFoundPath />
            {"\n"}
            <span className="error">Error from server (NotFound): page not found</span>
          </pre>
          <nav className="not-found-links" aria-label="Pages on this site">
            <a href="/">Go to the home page</a>
            <a href="/blog/">Read the blog</a>
            <a href="/resume/">View the resume</a>
          </nav>
        </div>
      </main>
      <NotFoundPathScript />
    </Document>
  );
}
