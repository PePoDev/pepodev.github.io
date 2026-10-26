// The blog index (/blog/): every post, newest first, in website mode's
// Writing layout (a posts panel beside "Read elsewhere"), inside BlogShell.
import { BLOG_MAIN_ID, BlogShell } from "@components/blog/BlogShell";
import { FormattedDate } from "@components/FormattedDate";
import { ResponsiveImage } from "@components/ResponsiveImage";
import { BLOG_DESCRIPTION, BLOG_TITLE } from "@/consts";
import socialLinks from "@data/social-links.json";
import { buildMetadata } from "@lib/head";
import {
  getPostDescription,
  getPostHeroImage,
  getPostLanguage,
  getPublishedPosts,
  getReadingMinutes,
} from "@utils/blog";
import { getGardenNotes } from "@utils/garden";
import "./blog-index.css";

export const generateMetadata = () =>
  buildMetadata({ title: BLOG_TITLE, description: BLOG_DESCRIPTION, path: "/blog/" });

const blogLink = socialLinks.find((link) => link.icon === "blog");
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  const thaiPosts = posts.filter((post) => getPostLanguage(post) === "th").length;
  const hasGarden = (await getGardenNotes()).some((note) => note.id !== "index");
  // Each post's first tag, in post order, once.
  const topics = [...new Set(posts.map((post) => post.data.tags?.[0]).filter(Boolean))] as string[];
  return (
    <BlogShell current="index">
      <main id={BLOG_MAIN_ID} className="blog-index ws-wrap" tabIndex={-1}>
        <header className="blog-index-head">
          <div className="ws-sec-head">
            <h1>Engineering Blog</h1>{" "}
            <p className="ws-sec-meta">
              {`${posts.length} posts${thaiPosts > 0 ? ` · ${thaiPosts} in Thai` : ""}`}
            </p>
          </div>{" "}
          <p className="blog-index-lede">{BLOG_DESCRIPTION}</p>
        </header>{" "}
        <div className="ws-wr-grid">
          <section className="ws-panel blog-index-posts" aria-label="Posts">
            <div className="ws-panel-head">
              <p className="blog-panel-title">All posts</p> <small>Newest first</small>
            </div>{" "}
            <ul>
              {posts.map((post, index) => {
                const description = getPostDescription(post);
                const lang = getPostLanguage(post);
                const heroImage = getPostHeroImage(post);
                return (
                  <li key={post.id}>
                    <p className="date">
                      <FormattedDate date={post.data.pubDate} />
                    </p>{" "}
                    <div className="blog-index-main">
                      <h2 className="title" lang={lang}>
                        <a href={`/blog/${post.id}/`}>{post.data.title}</a>
                      </h2>{" "}
                      {description && (
                        <p className="description" lang={lang}>
                          {description}
                        </p>
                      )}{" "}
                      <p className="blog-index-tags">
                        <span className="ws-lang-tag" title={lang === "th" ? "Written in Thai" : "Written in English"}>
                          {lang.toUpperCase()}
                        </span>{" "}
                        <span>{`${getReadingMinutes(post)} min read`}</span>{" "}
                        <span className="ws-post-topics">
                          {/* Keyed by position: front matter can repeat a tag. */}
                          {post.data.tags?.slice(0, 3).map((tag, tagIndex) => (
                            <span key={tagIndex}>{tag}</span>
                          ))}
                        </span>
                      </p>
                    </div>{" "}
                    {/* Decorative: the title names the link. */}
                    {heroImage && (
                      <ResponsiveImage
                        image={heroImage}
                        width={320}
                        height={160}
                        alt=""
                        sizes="(min-width: 47.5em) 10rem, 6rem"
                        loading={index < 3 ? "eager" : "lazy"}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>{" "}
          <section className="ws-panel ws-elsewhere blog-index-elsewhere" aria-labelledby="blog-elsewhere-title">
            <div className="ws-panel-head">
              <h2 id="blog-elsewhere-title">Read elsewhere</h2>
            </div>{" "}
            <ul>
              <li>
                <a href="/rss.xml">
                  <b>RSS feed</b> <span>pepo.dev/rss.xml</span> <i aria-hidden="true">→</i>
                </a>
              </li>{" "}
              {blogLink && (
                <li>
                  <a href={blogLink.href} {...external}>
                    <b>Engineering blog</b> <span>{blogLink.label.split(" - ")[1]}</span>{" "}
                    <i aria-hidden="true">↗</i>
                  </a>
                </li>
              )}{" "}
              {hasGarden && (
                <li>
                  <a href="/garden/">
                    <b>Digital garden</b> <span>pepo.dev/garden</span> <i aria-hidden="true">→</i>
                  </a>
                </li>
              )}{" "}
              <li>
                <a href="/">
                  <b>Portfolio</b> <span>pepo.dev</span> <i aria-hidden="true">→</i>
                </a>
              </li>
            </ul>{" "}
            {topics.length > 0 && (
              <p className="ws-note">{`Topics so far: ${topics.slice(0, -1).join(", ")}${
                topics.length > 1 ? ` and ${topics.at(-1)}` : topics[0]
              }.`}</p>
            )}
          </section>
        </div>
      </main>
    </BlogShell>
  );
}
