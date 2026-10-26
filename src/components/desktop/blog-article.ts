// The Blog app's article bodies, loaded on demand. Every published post has
// a static file next to its page, /blog/<id>/article.json, written at build
// time by src/app/(post)/blog/[slug]/article.json/route.ts with the same
// Markdown/MDX pipeline as the post page (Shiki, heading ids, build-time
// WebP images). The home page never inlines article text.

/** The JSON in /blog/<id>/article.json. */
export interface BlogArticle {
  /** The post id (file name), as in ?blog=<id>. */
  id: string;
  /**
   * The rendered article body: what the post page renders inside `.prose`
   * after its title block, and what the Blog app renders into
   * `.blog-reader-body`. Trusted, build-time HTML.
   */
  html: string;
}

/** The URL of a post's article file (ids may be Thai, so it is encoded). */
export function blogArticleUrl(id: string): string {
  return `/blog/${encodeURIComponent(id)}/article.json`;
}

const cache = new Map<string, Promise<BlogArticle>>();

/**
 * Fetches a post's article once per page (concurrent and later calls share
 * the request). A failed request is forgotten, so the next call retries.
 */
export function loadBlogArticle(id: string): Promise<BlogArticle> {
  let article = cache.get(id);
  if (!article) {
    const url = blogArticleUrl(id);
    article = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
      return (await response.json()) as BlogArticle;
    });
    article.catch(() => cache.delete(id));
    cache.set(id, article);
  }
  return article;
}
