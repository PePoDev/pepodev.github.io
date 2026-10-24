// Root layout of the digital garden (/garden/ and, once ported, its notes).
// The garden is part of website mode: same tokens, type, and header.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { siteJsonLd, siteViewport } from "@lib/head";
import "@styles/fonts-website.css";

export const viewport = siteViewport;

export default async function GardenLayout({ children }: { children: ReactNode }) {
  return (
    <Document
      runtime="none"
      htmlData={{ "data-site-mode": "website" }}
      jsonLd={await siteJsonLd()}
    >
      {children}
    </Document>
  );
}
