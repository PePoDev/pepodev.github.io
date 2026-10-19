import rss from "@astrojs/rss";
import {
  getPostDescription,
  getPostLanguage,
  getPublishedPosts,
} from "@utils/blog";
import { BLOG_DESCRIPTION, BLOG_TITLE, SITE_URL } from "../consts";

function getPostLink(post) {
  return `/?blog=${encodeURIComponent(post.id)}`;
}

/** The channel has one language: the one most posts are written in. */
function getFeedLanguage(posts) {
  const thai = posts.filter((post) => getPostLanguage(post) === "th").length;
  return thai > posts.length / 2 ? "th" : "en";
}

export async function GET(context) {
  const posts = await getPublishedPosts();
  const site = context.site ?? SITE_URL;

  return rss({
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    site,
    trailingSlash: false,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: [
      `<language>${getFeedLanguage(posts)}</language>`,
      `<atom:link href="${new URL("rss.xml", site)}" rel="self" type="application/rss+xml"/>`,
    ].join(""),
    items: posts.map((post) => ({
      title: post.data.title,
      description: getPostDescription(post),
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: getPostLink(post),
    })),
  });
}
