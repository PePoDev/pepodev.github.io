// Root layout of a blog post: <html lang> is the post's language, and the
// head carries its BlogPosting structured data. Like the blog index, it is
// part of website mode (html[data-site-mode="website"]; BlogShell.tsx
// imports the stylesheets), with the theme script in <head>.
import type { ReactNode } from "react";
import { BlogThemeScript } from "@components/blog/BlogScripts";
import { Document } from "@components/Document";
import { buildJsonLd, siteViewport } from "@lib/head";
import { getPostLanguage } from "@utils/blog";
import { getPost, getPostHead, type PostParams } from "./post-data";

export const viewport = siteViewport;

export default async function PostLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: PostParams;
}) {
  const post = await getPost(params);
  return (
    <Document
      runtime="none"
      lang={getPostLanguage(post)}
      htmlData={{ "data-site-mode": "website" }}
      // The theme script sets data-theme and the accent before first paint.
      suppressHydrationWarning
      head={<BlogThemeScript />}
      jsonLd={await buildJsonLd(getPostHead(post))}
    >
      {children}
    </Document>
  );
}
