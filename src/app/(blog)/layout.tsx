// Root layout of the blog index. The blog is part of website mode: same
// tokens, type and header (html[data-site-mode="website"]; BlogShell.tsx
// imports the stylesheets). A static page (runtime "none"): the theme
// script in <head> is an <InlineScript>.
import type { ReactNode } from "react";
import { BlogThemeScript } from "@components/blog/BlogScripts";
import { Document } from "@components/Document";
import { siteJsonLd, siteViewport } from "@lib/head";

export const viewport = siteViewport;

export default async function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <Document
      runtime="none"
      htmlData={{ "data-site-mode": "website" }}
      // The theme script sets data-theme and the accent before first paint.
      suppressHydrationWarning
      head={<BlogThemeScript />}
      jsonLd={await siteJsonLd()}
    >
      {children}
    </Document>
  );
}
