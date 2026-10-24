// Root layout of / (the desktop and website mode). The head scripts pick the
// mode and theme before first paint.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { HomeHeadScripts } from "@components/home/HomeHeadScripts";
import { siteJsonLd, siteViewport } from "@lib/head";
// Website mode type. Not preloaded: desktop mode never uses it.
import "@styles/fonts-website.css";

export const viewport = siteViewport;

export default async function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <Document
      // The placeholder has no client components. The desktop port switches
      // to "react" if it starts its controllers from a client component (see
      // MIGRATION.md, "Page runtime").
      runtime="none"
      htmlData={{ "data-site-mode": "desktop" }}
      suppressHydrationWarning
      head={<HomeHeadScripts />}
      jsonLd={await siteJsonLd()}
    >
      {children}
    </Document>
  );
}
