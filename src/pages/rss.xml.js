import rss from "@astrojs/rss";
import { getPostDescription, getPublishedPosts } from "@utils/blog";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../consts";

function getPostLink(post) {
  return `/?blog=${encodeURIComponent(post.id)}`;
}

export async function GET(context) {
  const posts = await getPublishedPosts();

  return rss({
    title: `${SITE_TITLE} Blog`,
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: getPostDescription(post),
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: getPostLink(post),
    })),
  });
}
