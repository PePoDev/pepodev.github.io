import { FormattedDate } from "@components/FormattedDate";
import { ResponsiveImage } from "@components/ResponsiveImage";
import { SiteHeader } from "@components/SiteHeader";
import { render } from "@lib/content";
import { buildMetadata } from "@lib/head";
import { getPostHeroImage, getPostLanguage } from "@utils/blog";
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
  const { Content } = await render(post);
  const { title, pubDate, updatedDate } = post.data;
  const heroImage = getPostHeroImage(post);
  // English page chrome inside a Thai post.
  const chromeLang = getPostLanguage(post) === "en" ? undefined : "en";

  return (
    <>
      <SiteHeader />
      <main className="blog-post">
        <article>
          <div className="hero-image">
            {heroImage && (
              <ResponsiveImage
                image={heroImage}
                width={1020}
                height={510}
                alt=""
                loading="eager"
                fetchPriority="high"
              />
            )}
          </div>
          <div className="prose">
            <div className="title">
              <div className="date" lang={chromeLang}>
                <FormattedDate date={pubDate} />
                {updatedDate && (
                  <div className="last-updated-on">
                    Last updated on <FormattedDate date={updatedDate} />
                  </div>
                )}
              </div>
              <h1>{title}</h1>
              <hr />
            </div>
            <Content />
          </div>
        </article>
        <nav className="post-footer" aria-label="Blog" lang={chromeLang}>
          <a href="/blog/">
            <span aria-hidden="true">← </span>All posts
          </a>
          <a href="/rss.xml">Subscribe via RSS</a>
        </nav>
      </main>
    </>
  );
}
