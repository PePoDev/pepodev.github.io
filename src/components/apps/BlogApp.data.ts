// Build-time data of the Blog app: list metadata only, newest first
// (src/utils/blog.ts). Article bodies are never inlined in the page: the
// reader loads each from /blog/<id>/article.json when it opens
// (loadBlogArticle in the app API).
import { getPostDescription, getPostLanguage, getPublishedPosts } from "@utils/blog";

export interface BlogListPost {
  /** The post id (file name), as in ?blog=<id>. */
  id: string;
  title: string;
  description: string;
  lang: "th" | "en";
  tags: string[];
  /** pubDate as an ISO string, for <time datetime>. */
  date: string;
  /** pubDate as FormattedDate writes it ("Jan 14, 2024", UTC), fixed at build time. */
  dateText: string;
}

export default async function loadBlogData(): Promise<BlogListPost[]> {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    description: getPostDescription(post),
    lang: getPostLanguage(post),
    tags: post.data.tags ?? [],
    date: post.data.pubDate.toISOString(),
    dateText: post.data.pubDate.toLocaleDateString("en-us", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  }));
}
