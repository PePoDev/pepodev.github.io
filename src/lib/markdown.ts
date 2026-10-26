// Markdown and MDX rendering for the content layer (src/lib/content.ts).
//
// Sätteri parses both, the same parser `pnpm garden:sync` uses to check notes,
// with this pipeline: GFM, no smart punctuation (so `--flags` and straight
// quotes match Obsidian), Shiki code highlighting (github-dark), github-slugger
// heading ids, and local images swapped for build-time WebP srcsets
// (src/lib/images.ts).
//
// Markdown becomes an HTML string, which is turned into React elements so the
// page places it directly inside its own markup (`.prose > p`, no wrapper).
// MDX is compiled and evaluated into a component.
//
// renderMarkdownToHtml gives the same document as an HTML string, for files
// written at build time (the Blog app's /blog/<id>/article.json): route
// handlers cannot render React to HTML (react-dom/server is not available
// to them), so Markdown keeps Sätteri's HTML and MDX is evaluated with a
// JSX runtime that builds hast, serialized like Shiki does.
import { type ComponentType, Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Slugger from "github-slugger";
import type { Element, ElementContent, Properties, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import {
  evaluate,
  type HastPluginDefinition,
  type HastPluginList,
  htmlToHast,
  markdownToHtml,
} from "satteri";
import { createHighlighter, hastToHtml, type Highlighter } from "shiki";
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

/** Heading ids (github-slugger, as the garden sync writes them). */
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

/** Shiki code blocks. */
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
                // Language on the block, scrolling instead of wrapping.
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

// --- HTML strings (build-time files) ------------------------------------------

// MDX documents evaluated with this runtime return hast instead of React
// elements. Props are React-cased (className, htmlFor, srcSet, tabIndex,
// strokeWidth), which hast-util-to-html maps to attributes itself; style
// objects become CSS text as React writes it.
const HAST_FRAGMENT = Symbol("hast fragment");

const UNITLESS = new Set([
  "animationIterationCount", "aspectRatio", "columnCount", "columns", "flex", "flexGrow", "flexShrink",
  "fontWeight", "gridColumn", "gridRow", "lineHeight", "opacity", "order", "orphans", "scale", "tabSize",
  "widows", "zIndex", "zoom", "fillOpacity", "strokeOpacity", "strokeWidth",
]);

function styleText(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && typeof value !== "boolean")
    .map(([name, value]) => {
      const property = name.startsWith("--")
        ? name
        : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, "-ms-");
      const text =
        typeof value === "number" && value !== 0 && !name.startsWith("--") && !UNITLESS.has(name)
          ? `${value}px`
          : String(value);
      return `${property}:${text}`;
    })
    .join(";");
}

type HastNode = Root | ElementContent;

function hastChildren(value: unknown): ElementContent[] {
  if (value === null || value === undefined || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap(hastChildren);
  if (typeof value === "string" || typeof value === "number") return [{ type: "text", value: String(value) }];
  const node = value as HastNode;
  return node.type === "root" ? (node.children as ElementContent[]) : [node];
}

function hastJsx(type: unknown, props: Record<string, unknown> | null): HastNode {
  const { children, ...rest } = props ?? {};
  if (type === HAST_FRAGMENT) return { type: "root", children: hastChildren(children) };
  if (typeof type === "function") {
    return { type: "root", children: hastChildren((type as (props: unknown) => unknown)(props ?? {})) };
  }
  if (typeof type !== "string") throw new Error(`MDX rendered an element of an unsupported type (${String(type)}).`);
  const properties: Properties = {};
  let rawHtml: string | undefined;
  for (const [name, value] of Object.entries(rest)) {
    if (name === "key" || name === "ref" || value === undefined || typeof value === "function") continue;
    if (name === "dangerouslySetInnerHTML") {
      rawHtml = String((value as { __html?: unknown } | null)?.__html ?? "");
    } else if (name === "style" && value && typeof value === "object") {
      properties.style = styleText(value as Record<string, unknown>);
    } else {
      properties[name] = value as Properties[string];
    }
  }
  return {
    type: "element",
    tagName: type,
    properties,
    // "raw" nodes are serialized as is (allowDangerousHtml below).
    children: rawHtml === undefined ? hastChildren(children) : [{ type: "raw", value: rawHtml } as never],
  };
}

/**
 * Renders a Markdown or MDX document body (frontmatter already removed) to
 * an HTML string: the document `renderMarkdown` gives as React elements,
 * through the same pipeline (Shiki, heading ids, build-time images).
 */
export async function renderMarkdownToHtml(body: string, filePath: string): Promise<string> {
  const options = {
    hastPlugins: plugins(filePath, []),
    features: FEATURES,
    fileURL: pathToFileURL(filePath),
  };
  if (!filePath.endsWith(".mdx")) return (await markdownToHtml(body, options)).html;

  const module = await evaluate(body, {
    ...options,
    Fragment: HAST_FRAGMENT,
    jsx: hastJsx as (type: unknown, props: unknown, key?: unknown) => unknown,
    jsxs: hastJsx as (type: unknown, props: unknown, key?: unknown) => unknown,
  });
  const content = module.default as (props: Record<string, unknown>) => unknown;
  return hastToHtml(
    { type: "root", children: hastChildren(content({})) },
    { allowDangerousHtml: true, characterReferences: { useNamedReferences: true } },
  );
}

