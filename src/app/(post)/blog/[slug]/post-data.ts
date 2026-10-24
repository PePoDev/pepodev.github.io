// Shared by the post page and its root layout: the post for a route param,
// and the PageHead both build their metadata from.
import type { PageHead } from "@lib/head";
import { decodeParam, staticParams } from "@lib/static-params";
import {
  type BlogEntry,
  getPostDescription,
  getPostHeroImage,
  getPostLanguage,
  getPublishedPosts,
} from "@utils/blog";

export type PostParams = Promise<{ slug: string }>;

/** Every published post's id, the route's static params. */
export async function getPostParams() {
  return staticParams((await getPublishedPosts()).map((post) => ({ slug: post.id })));
}

/** The post for a route param (Thai ids may arrive percent-encoded). */
export async function getPost(params: PostParams): Promise<BlogEntry> {
  const id = decodeParam((await params).slug);
  const post = (await getPublishedPosts()).find((entry) => entry.id === id);
  if (!post) throw new Error(`No published post with the id "${id}"`);
  return post;
}

export function getPostHead(post: BlogEntry): PageHead {
  const heroImage = getPostHeroImage(post);
  return {
    title: post.data.title,
    description: getPostDescription(post),
    path: `/blog/${post.id}/`,
    image: heroImage,
    // For share cards only: on the page, the cover sits right above the h1
    // and is decorative.
    imageAlt: heroImage ? `Cover image for ${post.data.title}` : undefined,
    type: "article",
    lang: getPostLanguage(post),
    publishedTime: post.data.pubDate,
    modifiedTime: post.data.updatedDate,
  };
}
