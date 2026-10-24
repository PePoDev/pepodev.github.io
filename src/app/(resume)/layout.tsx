// Root layout of /resume/.
import type { ReactNode } from "react";
import { Document } from "@components/Document";
import { siteJsonLd, siteViewport } from "@lib/head";

export const viewport = siteViewport;

export default async function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <Document runtime="none" className="resume-document" jsonLd={await siteJsonLd()}>
      {children}
    </Document>
  );
}
