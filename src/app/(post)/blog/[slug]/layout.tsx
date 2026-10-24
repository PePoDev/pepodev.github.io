// Root layout of a blog post: <html lang> is the post's language, and the
// head carries its BlogPosting structured data.
import type { ReactNode } from "react";
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
      jsonLd={await buildJsonLd(getPostHead(post))}
    >
      {children}
    </Document>
  );
}
