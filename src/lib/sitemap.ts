// The sitemap's URL list: every exported page except the 404. A new route
// must be added here: scripts/postbuild.mjs fails the build when this list
// and the exported pages (out/**/index.html) differ.
import { SITE_URL } from "@/consts";
import { getPublishedPosts } from "@utils/blog";
import { gardenHref, getGardenNotes } from "@utils/garden";

export async function getSitemapUrls(): Promise<string[]> {
  const paths = [
    "/",
    "/blog/",
    ...(await getPublishedPosts()).map((post) => `/blog/${post.id}/`),
    "/garden/",
    ...(await getGardenNotes()).map(gardenHref),
    "/resume/",
  ];
  // Sorted by URL, as @astrojs/sitemap listed them.
  return [...new Set(paths.map((path) => new URL(path, SITE_URL).href))].sort();
}
