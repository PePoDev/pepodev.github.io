import { FormattedDate } from "@components/FormattedDate";
import { ResponsiveImage } from "@components/ResponsiveImage";
import { SiteHeader } from "@components/SiteHeader";
import { BLOG_DESCRIPTION, BLOG_TITLE } from "@/consts";
import { buildMetadata } from "@lib/head";
import {
  getPostDescription,
  getPostHeroImage,
  getPostLanguage,
  getPublishedPosts,
} from "@utils/blog";
import "./blog-index.css";

export const generateMetadata = () =>
  buildMetadata({ title: BLOG_TITLE, description: BLOG_DESCRIPTION, path: "/blog/" });

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  return (
    <>
      <SiteHeader width={960} current="blog" />
      <main className="blog-index">
        <header className="intro">
          <h1>Engineering Blog</h1>
          <p>{BLOG_DESCRIPTION}</p>
        </header>
        <section aria-label="Posts">
          <ul>
            {posts.map((post, index) => {
              const description = getPostDescription(post);
              const lang = getPostLanguage(post);
              const heroImage = getPostHeroImage(post);
              return (
                <li key={post.id}>
                  <a href={`/blog/${post.id}/`}>
                    {/* Decorative: the title below names the link. */}
                    {heroImage && (
                      <ResponsiveImage
                        image={heroImage}
                        width={720}
                        height={360}
                        alt=""
                        sizes={
                          index === 0
                            ? "(min-width: 992px) 960px, 100vw"
                            : "(min-width: 992px) 464px, (min-width: 721px) 50vw, 100vw"
                        }
                        loading="lazy"
                      />
                    )}
                    <h2 className="title" lang={lang}>
                      {post.data.title}
                    </h2>
                    {description && (
                      <p className="description" lang={lang}>
                        {description}
                      </p>
                    )}
                    <p className="date">
                      <FormattedDate date={post.data.pubDate} />
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
