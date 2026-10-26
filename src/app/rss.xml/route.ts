// /rss.xml, written at build time. README: item links and guids come from post
// ids (file names) and must not change; they open the post in the desktop Blog
// reader.
import { BLOG_DESCRIPTION, BLOG_TITLE, SITE_URL } from "@/consts";
import { escapeXml as x, xmlResponse } from "@lib/xml";
import {
  type BlogEntry,
  getPostDescription,
  getPostLanguage,
  getPublishedPosts,
} from "@utils/blog";

export const dynamic = "force-static";

function getPostLink(post: BlogEntry) {
  return new URL(`/?blog=${encodeURIComponent(post.id)}`, SITE_URL).href;
}

/** The channel has one language: the one most posts are written in. */
function getFeedLanguage(posts: BlogEntry[]) {
  const thai = posts.filter((post) => getPostLanguage(post) === "th").length;
  return thai > posts.length / 2 ? "th" : "en";
}

export async function GET() {
  const posts = await getPublishedPosts();
  const site = new URL(SITE_URL).href.replace(/\/$/, "");
  const items = posts.map((post) => {
    const link = x(getPostLink(post));
    const description = getPostDescription(post);
    return [
      "<item>",
      `<title>${x(post.data.title)}</title>`,
      `<link>${link}</link>`,
      `<guid isPermaLink="true">${link}</guid>`,
      description ? `<description>${x(description)}</description>` : "",
      `<pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
      ...(post.data.tags ?? []).map((tag) => `<category>${x(tag)}</category>`),
      "</item>",
    ].join("");
  });
  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${x(BLOG_TITLE)}</title>`,
    `<description>${x(BLOG_DESCRIPTION)}</description>`,
    `<link>${x(site)}</link>`,
    `<language>${getFeedLanguage(posts)}</language>`,
    `<atom:link href="${x(new URL("rss.xml", SITE_URL).href)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "</channel></rss>",
  ].join("");
  return xmlResponse(feed, "application/rss+xml");
}
