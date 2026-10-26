import { type CollectionEntry, getCollection } from "@lib/content";
import type { ImageAsset } from "@lib/images";

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
export function getPostHeroImage(post: BlogEntry): ImageAsset | undefined {
  return post.data.heroImage || post.data["cover-picture"];
}

/** "th" when the title or description uses Thai script, otherwise "en". */
export function getPostLanguage(post: BlogEntry): "th" | "en" {
  return /[\u0E00-\u0E7F]/.test(
    `${post.data.title} ${getPostDescription(post)}`,
  )
    ? "th"
    : "en";
}

const WORDS_PER_MINUTE = 230;
// Thai has no spaces between words; ICU's dictionary segmenter finds them.
const wordSegmenter = new Intl.Segmenter("th", { granularity: "word" });

/**
 * Estimated reading time in whole minutes (at least 1): the words of the
 * post's prose, without code blocks, image alt text, link URLs or HTML.
 */
export function getReadingMinutes(post: BlogEntry): number {
  const prose = post.body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");
  let words = 0;
  for (const segment of wordSegmenter.segment(prose)) {
    if (segment.isWordLike) words += 1;
  }
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
