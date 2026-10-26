// A blog post (/blog/<id>/), inside BlogShell: the title, lede and byline,
// the article in a website-mode panel (cover, then the Markdown in .prose),
// and beside it, on wide screens, the table of contents and more posts.
import { BLOG_MAIN_ID, BlogShell } from "@components/blog/BlogShell";
import { BrandMark } from "@components/BrandMark";
import { FormattedDate } from "@components/FormattedDate";
import { ResponsiveImage } from "@components/ResponsiveImage";
import { render } from "@lib/content";
import { buildMetadata } from "@lib/head";
import {
  getPostDescription,
  getPostHeroImage,
  getPostLanguage,
  getPublishedPosts,
  getReadingMinutes,
} from "@utils/blog";
import { getPost, getPostHead, getPostParams, type PostParams } from "./post-data";
import "./post.css";

// Only the posts that exist; anything else is the 404.
export const dynamicParams = false;
export const generateStaticParams = getPostParams;

export async function generateMetadata({ params }: { params: PostParams }) {
  return buildMetadata(getPostHead(await getPost(params)));
}

export default async function PostPage({ params }: { params: PostParams }) {
  const post = await getPost(params);
  const { Content, headings } = await render(post);
  const { title, pubDate, updatedDate, tags = [] } = post.data;
  const heroImage = getPostHeroImage(post);
  const description = getPostDescription(post);
  const lang = getPostLanguage(post);
  // English page chrome inside a Thai post.
  const chromeLang = lang === "en" ? undefined : "en";
  // The contents: sections (h2, numbered like website mode's nav) and their
  // subsections (h3).
  let sections = 0;
  const toc = headings
    .filter(({ depth }) => depth === 2 || depth === 3)
    .map((heading) => ({
      ...heading,
      number: heading.depth === 2 ? String(++sections).padStart(2, "0") : undefined,
    }));
  const morePosts = (await getPublishedPosts()).filter((other) => other.id !== post.id).slice(0, 3);

  return (
    <BlogShell current="post">
      <main id={BLOG_MAIN_ID} className="blog-post ws-wrap" tabIndex={-1}>
        <div className="post-layout">
          <article className="post-article" aria-labelledby="post-title">
            <header className="post-head">
              <h1 id="post-title">{title}</h1>{" "}
              {description && <p className="post-lede">{description}</p>}{" "}
              <div className="post-byline" lang={chromeLang}>
                <BrandMark size={40} />{" "}
                <p>
                  <b>Thiwanon Chomcharoen</b>{" "}
                  <span className="ws-dots">
                    <span className="post-date">
                      <FormattedDate date={pubDate} />
                    </span>{" "}
                    {updatedDate && (
                      <span className="post-updated">
                        Updated <FormattedDate date={updatedDate} />
                      </span>
                    )}{" "}
                    <span>{`${getReadingMinutes(post)} min read`}</span>
                  </span>
                </p>
              </div>
            </header>{" "}
            <div className="ws-panel post-doc">
              {/* The desktop Blog app's reader shows the same command. */}
              <div className="ws-panel-head post-doc-bar" aria-hidden="true">
                <p>
                  <span>$</span> cat articles/{post.id}
                </p>{" "}
                <span className="ws-lang-tag">{lang.toUpperCase()}</span>
              </div>{" "}
              {heroImage && (
                <figure className="hero-image">
                  {/* Decorative: the h1 above names the post. */}
                  <ResponsiveImage
                    image={heroImage}
                    width={1020}
                    height={510}
                    alt=""
                    sizes="(min-width: 75em) 800px, (min-width: 60em) 66vw, 100vw"
                    loading="eager"
                    fetchPriority="high"
                  />
                </figure>
              )}{" "}
              <div className="prose">
                <Content />
              </div>{" "}
              {tags.length > 0 && (
                <p className="post-topics" lang={chromeLang}>
                  <span>Topics</span>{" "}
                  <span className="ws-post-topics">
                    {/* Keyed by position: front matter can repeat a tag. */}
                    {tags.map((tag, index) => (
                      <span key={index}>{tag}</span>
                    ))}
                  </span>
                </p>
              )}
            </div>{" "}
            <nav className="post-footer" aria-label="Blog" lang={chromeLang}>
              <a className="ws-btn" href="/blog/">
                <span aria-hidden="true">←</span>All posts
              </a>{" "}
              <a className="ws-btn" href="/rss.xml">
                Subscribe via RSS
              </a>
            </nav>
          </article>{" "}
          <div className="post-rail">
            {toc.length > 1 && (
              <nav className="ws-panel post-toc" aria-labelledby="post-toc-title">
                <div className="ws-panel-head" lang={chromeLang}>
                  <h2 id="post-toc-title">On this page</h2>{" "}
                  <small>
                    {sections > 0
                      ? `${sections} ${sections === 1 ? "section" : "sections"}`
                      : `${toc.length} headings`}
                  </small>
                </div>{" "}
                <ol>
                  {toc.map(({ depth, slug, text, number }) => (
                    <li key={slug} data-depth={depth}>
                      <a href={`#${slug}`}>
                        {number && <span aria-hidden="true">{number}</span>}
                        {text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}{" "}
            {morePosts.length > 0 && (
              <section className="ws-panel post-more" aria-labelledby="post-more-title" lang={chromeLang}>
                <div className="ws-panel-head">
                  <h2 id="post-more-title">More writing</h2>{" "}
                  <a className="ws-head-link" href="/blog/">
                    All posts <span aria-hidden="true">→</span>
                  </a>
                </div>{" "}
                <ul>
                  {morePosts.map((other) => (
                    <li key={other.id}>
                      <a href={`/blog/${other.id}/`} lang={getPostLanguage(other)}>
                        {other.data.title}
                      </a>{" "}
                      <FormattedDate date={other.data.pubDate} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </BlogShell>
  );
}
