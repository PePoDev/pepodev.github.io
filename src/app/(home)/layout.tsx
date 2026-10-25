// Root layout of / (the desktop and website mode). It hydrates: the desktop
// is a React app (README, "The React Desktop"). The head scripts pick
// the mode, theme and the other desktop preferences before first paint, and
// take the input made before the desktop boots.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { DesktopEarlyInputScript, DesktopPrefsScript } from "@components/desktop/DesktopScripts";
import { HomeHeadScripts } from "@components/home/HomeHeadScripts";
import { siteJsonLd, siteViewport } from "@lib/head";
// Website mode type. Not preloaded: desktop mode never uses it.
import "@styles/fonts-website.css";

export const viewport = siteViewport;

export default async function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <Document
      runtime="react"
      htmlData={{ "data-site-mode": "desktop" }}
      suppressHydrationWarning
      head={
        <>
          <HomeHeadScripts />
          <DesktopPrefsScript />
          <DesktopEarlyInputScript />
        </>
      }
      jsonLd={await siteJsonLd()}
    >
      {children}
    </Document>
  );
}
