import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../consts";

const markdownExtensionPattern = /\.mdx?$/;

function getPostTitle(post) {
  if (post.data.title) {
    return post.data.title;
  }

  const fileName = post.filePath?.split(/[\\/]/).pop();
  return fileName?.replace(markdownExtensionPattern, "") ?? post.id;
}

function getPostDescription(post) {
  return post.data.description ?? post.data["sub-title"] ?? "";
}

function getPostDate(post) {
  return post.data.pubDate ?? post.data.updatedDate;
}

export async function GET(context) {
  const posts = (await getCollection("blog"))
    .filter((post) => post.data.publish !== false)
    .sort((a, b) => {
      const aDate = getPostDate(a) ?? new Date(0);
      const bDate = getPostDate(b) ?? new Date(0);
      return bDate.valueOf() - aDate.valueOf();
    });

  return rss({
    title: `${SITE_TITLE} Blog`,
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    items: posts.map((post) => ({
      title: getPostTitle(post),
      description: getPostDescription(post),
      pubDate: getPostDate(post),
      categories: post.data.tags,
      link: `/blog/${post.id}/`,
    })),
  });
}
