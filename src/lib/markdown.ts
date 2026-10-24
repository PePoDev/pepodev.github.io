// Markdown and MDX rendering for the content layer (src/lib/content.ts).
//
// Sätteri parses both, the same parser `pnpm garden:sync` uses to check notes,
// with the pipeline Astro's markdown-satteri processor ran: GFM, no smart
// punctuation (so `--flags` and straight quotes match Obsidian), Shiki code
// highlighting (github-dark), github-slugger heading ids, and local images
// swapped for build-time WebP srcsets (src/lib/images.ts).
//
// Markdown becomes an HTML string, which is turned into React elements so the
// page places it directly inside its own markup (`.prose > p`, no wrapper).
// MDX is compiled and evaluated into a component.
import { type ComponentType, Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Slugger from "github-slugger";
import type { Element, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import {
  evaluate,
  type HastPluginDefinition,
  type HastPluginList,
  htmlToHast,
  markdownToHtml,
} from "satteri";
import { createHighlighter, type Highlighter } from "shiki";
import { getResponsiveImage, resolveImage } from "./images";

export interface MarkdownHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderedContent {
  /** The rendered document. MDX documents accept a `components` map. */
  Content: ComponentType<{ components?: Record<string, ComponentType<never>> }>;
  headings: MarkdownHeading[];
}

const FEATURES = { gfm: true, smartPunctuation: false } as const;

/** Heading ids (github-slugger, as Astro and the garden sync write them). */
function headingIdsPlugin(headings: MarkdownHeading[]): HastPluginDefinition {
  const slugger = new Slugger();
  return {
    name: "heading-ids",
    element: {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      visit(node, ctx) {
        const text = ctx.textContent(node);
        const existing = node.properties?.id;
        const slug = typeof existing === "string" ? existing : slugger.slug(text);
        headings.push({ depth: Number(node.tagName[1]), slug, text });
        if (typeof existing !== "string") ctx.setProperty(node, "id", slug);
      },
    },
  };
}

let highlighter: Promise<Highlighter> | undefined;

/** Shiki code blocks, like Astro's default `syntaxHighlight: "shiki"`. */
function highlightPlugin(): HastPluginDefinition {
  return {
    name: "shiki",
    element: {
      filter: ["pre"],
      async visit(node, ctx) {
        const code = node.children?.find(
          (child): child is Element => child.type === "element" && child.tagName === "code",
        );
        if (!code) return;
        const className = code.properties?.className;
        const languageClass = Array.isArray(className)
          ? className.find(
              (name): name is string =>
                typeof name === "string" && name.startsWith("language-"),
            )
          : undefined;
        const data = code.data as { lang?: string; meta?: string } | undefined;
        let lang = data?.lang ?? languageClass?.slice("language-".length) ?? "plaintext";
        if (lang === "math") return;

        highlighter ??= createHighlighter({ themes: ["github-dark"], langs: ["plaintext"] });
        const shiki = await highlighter;
        if (!shiki.getLoadedLanguages().includes(lang)) {
          try {
            await shiki.loadLanguage(lang as never);
          } catch {
            console.warn(`[shiki] Unknown language "${lang}", rendering it as plain text.`);
            lang = "plaintext";
          }
        }
        const root = shiki.codeToHast(ctx.textContent(code).replace(/\n$/, ""), {
          lang,
          theme: "github-dark",
          meta: data?.meta ? { __raw: data.meta } : undefined,
          transformers: [
            {
              pre(pre) {
                // As Astro rendered them: language on the block, scrolling
                // instead of wrapping.
                pre.properties.dataLanguage = lang;
                pre.properties.style = `${pre.properties.style ?? ""}; overflow-x: auto;`;
              },
            },
          ],
        });
        return root.children[0] as Element;
      },
    },
  };
}

/**
 * Local images (`![alt](../../assets/blog/x.png)`) become responsive WebP
 * <img>s at their own width. A missing file throws, which fails the build.
 * Remote and root-relative (public/) URLs are left alone.
 */
function imagesPlugin(filePath: string): HastPluginDefinition {
  return {
    name: "images",
    element: {
      filter: ["img"],
      async visit(node) {
        const { src, ...rest } = node.properties ?? {};
        if (typeof src !== "string" || !src || src.startsWith("/") || URL.canParse(src)) {
          return;
        }
        let image;
        try {
          image = await getResponsiveImage(await resolveImage(filePath, src));
        } catch (error) {
          throw new Error(
            `${path.relative(process.cwd(), filePath)}: ${(error as Error).message}`,
          );
        }
        return {
          type: "element",
          tagName: "img",
          properties: {
            ...rest,
            loading: "lazy",
            decoding: "async",
            sizes: image.sizes,
            width: image.width,
            height: image.height,
            src: image.src,
            ...(image.srcSet ? { srcSet: image.srcSet } : {}),
          },
          children: [],
        } satisfies Element;
      },
    },
  };
}

function plugins(filePath: string, headings: MarkdownHeading[]): HastPluginList {
  return [highlightPlugin(), imagesPlugin(filePath), headingIdsPlugin(headings)];
}

/** Turns rendered HTML into React elements (server-side only). */
function htmlToReact(html: string): ReactNode {
  const tree = htmlToHast(html, { fragment: true }) as Root;
  return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}

/** Renders a Markdown or MDX document body (frontmatter already removed). */
export async function renderMarkdown(
  body: string,
  filePath: string,
): Promise<RenderedContent> {
  const headings: MarkdownHeading[] = [];
  const options = {
    hastPlugins: plugins(filePath, headings),
    features: FEATURES,
    fileURL: pathToFileURL(filePath),
  };

  if (filePath.endsWith(".mdx")) {
    const module = await evaluate(body, {
      ...options,
      Fragment,
      jsx: jsx as (type: unknown, props: unknown, key?: unknown) => unknown,
      jsxs: jsxs as (type: unknown, props: unknown, key?: unknown) => unknown,
    });
    const MDXContent = module.default as RenderedContent["Content"];
    return { Content: MDXContent, headings };
  }

  const { html } = await markdownToHtml(body, options);
  const nodes = htmlToReact(html);
  const Content = () => nodes;
  return { Content, headings };
}
