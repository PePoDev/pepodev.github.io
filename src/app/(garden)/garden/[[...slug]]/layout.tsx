// Root layout of the digital garden: /garden/ and every note. It sits in the
// catch-all segment so it gets the route's params and can give each note
// its BlogPosting structured data (the home gets the site's Person).
//
// The garden is part of website mode: same tokens, type and header
// (html[data-site-mode="website"], website-mode.css), plus garden.css. A
// static page (runtime "none"): the theme script in <head> and the filter
// and frame script at the end of <body> are <InlineScript>s.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { GardenThemeScript } from "@components/garden/GardenScripts";
import { buildJsonLd, siteViewport } from "@lib/head";
import "@styles/fonts-website.css";
import "@styles/website-mode.css";
import "@styles/garden.css";
import { getGardenHead, getGardenPage, type GardenParams } from "./garden-data";

export const viewport = siteViewport;

export default async function GardenLayout({ children, params }: { children: ReactNode; params: GardenParams }) {
  const page = await getGardenPage(params);
  return (
    <Document
      runtime="none"
      htmlData={{ "data-site-mode": "website" }}
      // The theme script sets data-theme (and data-embed in the desktop's
      // Garden window) before first paint.
      suppressHydrationWarning
      head={<GardenThemeScript />}
      jsonLd={await buildJsonLd(getGardenHead(page))}
    >
      {children}
    </Document>
  );
}
