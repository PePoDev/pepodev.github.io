// /blog/<id>/article.json: a post's rendered body for the desktop Blog app,
// which loads articles on demand instead of inlining them in the home page
// (src/components/desktop/blog-article.ts). Written at build time next to
// the post's page, from the same Markdown/MDX pipeline (renderHtml). Not a
// page: the sitemap ignores it, and scripts/postbuild.mjs checks that every
// post has one and that the files it references exist.
import type { BlogArticle } from "@components/desktop/blog-article";
import { renderHtml } from "@lib/content";
import { getPost, getPostParams, type PostParams } from "../post-data";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = getPostParams;

export async function GET(_request: Request, { params }: { params: PostParams }) {
  const post = await getPost(params);
  const article: BlogArticle = { id: post.id, html: await renderHtml(post) };
  return Response.json(article);
}
