// Page metadata, the port of BaseHead.astro. Every page describes itself
// with a PageHead and gets the same tags the Astro site had:
//
//   export const generateMetadata = () => buildMetadata(head);   // page.tsx
//   <Document jsonLd={await buildJsonLd(head)}>                   // layout.tsx
//
// buildMetadata returns a complete Next.js Metadata object (title,
// description, canonical, Open Graph, Twitter, icons, manifest, RSS, robots),
// so a page never merges with a layout's metadata. JSON-LD is not part of
// the Metadata API; root layouts render it in <head> through <Document>.
import type { Metadata, Viewport } from "next";
import nextPackage from "next/package.json";
import {
  BLOG_TITLE,
  SITE_LOCALE,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_ALT,
  SITE_TITLE,
  SITE_URL,
} from "@/consts";
import { getSocialImage, type ImageAsset } from "./images";

export interface PageHead {
  title: string;
  description: string;
  /** The page's own path with its trailing slash, e.g. "/blog/". */
  path: string;
  /** Share image: a local image (resized to a JPEG) or a public/ path. */
  image?: ImageAsset | string;
  imageAlt?: string;
  type?: "website" | "article";
  /** Page language (BCP 47), "en" by default; sets og:locale and inLanguage. */
  lang?: string;
  /** Article dates for article:* tags and BlogPosting structured data. */
  publishedTime?: Date;
  modifiedTime?: Date;
  /** Keep the page out of search results and omit its URL tags (the 404). */
  noindex?: boolean;
}

const OG_LOCALES: Record<string, string> = { th: "th_TH" };
const AUTHOR = {
  "@type": "Person",
  name: "Thiwanon Chomcharoen (PePo)",
} as const;
const siteURL = new URL(SITE_URL);

/** theme-color and the viewport tag; export it from every root layout. */
export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a1a",
};

async function resolveHead(head: PageHead) {
  const image = head.image ?? SITE_OG_IMAGE;
  // Share a resized JPEG, not the original upload (up to 1.3 MB, sometimes
  // WebP, which some link-preview crawlers do not render).
  const social =
    typeof image === "string"
      ? { src: image, width: 1200, height: 630 }
      : await getSocialImage(image);
  return {
    ...head,
    type: head.type ?? "website",
    lang: head.lang ?? "en",
    imageAlt: head.imageAlt ?? SITE_OG_IMAGE_ALT,
    canonical: new URL(head.path, siteURL).href,
    social: { ...social, url: new URL(social.src, siteURL).href },
  };
}

export async function buildMetadata(head: PageHead): Promise<Metadata> {
  const page = await resolveHead(head);
  const images = [
    {
      url: page.social.url,
      secureUrl: page.social.url,
      width: page.social.width,
      height: page.social.height,
      alt: page.imageAlt,
    },
  ];
  return {
    metadataBase: siteURL,
    title: { absolute: page.title },
    description: page.description,
    generator: `Next.js ${nextPackage.version}`,
    authors: [{ name: "PePoDev" }],
    robots: page.noindex ? "noindex" : "index, follow",
    // The ICO's sizes keep Chromium on the SVG; the ICO is for old browsers.
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "32x32" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
      other: [{ rel: "sitemap", url: "/sitemap-index.xml" }],
    },
    manifest: "/manifest.webmanifest",
    alternates: {
      ...(page.noindex ? {} : { canonical: page.canonical }),
      types: {
        "application/rss+xml": [{ url: new URL("rss.xml", siteURL).href, title: BLOG_TITLE }],
      },
    },
    openGraph: {
      type: page.type,
      siteName: SITE_TITLE,
      locale: OG_LOCALES[page.lang] ?? SITE_LOCALE,
      ...(page.noindex ? {} : { url: page.canonical }),
      title: page.title,
      description: page.description,
      images,
      ...(page.type === "article"
        ? {
            publishedTime: page.publishedTime?.toISOString(),
            modifiedTime: page.modifiedTime?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [{ url: page.social.url, alt: page.imageAlt }],
    },
    other: {
      title: page.title,
      ...(page.noindex ? {} : { "twitter:url": page.canonical }),
    },
  };
}

/** Structured data: BlogPosting for articles, the site's Person otherwise. */
export async function buildJsonLd(head: PageHead): Promise<Record<string, unknown>> {
  const page = await resolveHead(head);
  if (page.type === "article") {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: page.title,
      description: page.description,
      image: page.social.url,
      datePublished: page.publishedTime?.toISOString(),
      dateModified: (page.modifiedTime ?? page.publishedTime)?.toISOString(),
      inLanguage: page.lang,
      url: page.canonical,
      mainEntityOfPage: page.canonical,
      author: { ...AUTHOR, url: siteURL.href },
    };
  }
  return {
    "@context": "https://schema.org",
    ...AUTHOR,
    jobTitle: "Site Reliability Engineer",
    url: siteURL.href,
    image: page.social.url,
    sameAs: [
      "https://github.com/pepodev",
      "https://linkedin.com/in/pepodev",
      "https://blog.pepo.dev",
    ],
    knowsAbout: [
      "Kubernetes",
      "Terraform",
      "Cloud Infrastructure",
      "Site Reliability Engineering",
    ],
  };
}

/** The Person JSON-LD of every page that is not an article. */
export const siteJsonLd = () =>
  buildJsonLd({ title: SITE_TITLE, description: "", path: "/" });
