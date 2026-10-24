// Root layout of the blog index.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { siteJsonLd, siteViewport } from "@lib/head";

export const viewport = siteViewport;

export default async function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <Document runtime="none" jsonLd={await siteJsonLd()}>
      {children}
    </Document>
  );
}
