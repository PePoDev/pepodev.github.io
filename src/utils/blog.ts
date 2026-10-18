import { type CollectionEntry, getCollection } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

/** Posts without `publish: false`, newest first. */
export async function getPublishedPosts(): Promise<BlogEntry[]> {
  const posts = await getCollection(
    "blog",
    ({ data }) => data.publish !== false,
  );
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

/** `description`, falling back to the Obsidian `sub-title` property. */
export function getPostDescription(post: BlogEntry): string {
  return post.data.description || post.data["sub-title"] || "";
}

/** `heroImage`, falling back to the Obsidian `cover-picture` property. */
export function getPostHeroImage(post: BlogEntry) {
  return post.data.heroImage || post.data["cover-picture"];
}
