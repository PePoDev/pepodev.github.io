// The content layer, replacing `astro:content`.
//
// Collections are folders of Markdown/MDX files under src/content/. Entries
// get the ids Astro's glob loader gave them (each path segment through
// github-slugger, file extension dropped, a trailing /index removed, or a
// frontmatter `slug`), so post URLs, RSS links and `?blog=` deep links stay
// the same. Frontmatter is YAML parsed like Astro (timestamps as dates) and
// validated with the zod schemas below; an invalid entry fails the build.
//
// Server-only: it reads the file system. List posts through
// src/utils/blog.ts and notes through src/utils/garden.ts, not getCollection.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { slug as githubSlug } from "github-slugger";
import { parseDocument } from "yaml";
import { z } from "zod";
import { type ImageAsset, resolveImage } from "./images";
import { type RenderedContent, renderMarkdown } from "./markdown";

export type { MarkdownHeading, RenderedContent } from "./markdown";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

/** A frontmatter image: a path relative to the entry, which must exist. */
const image = (filePath: string) =>
  z.string().transform(async (src): Promise<ImageAsset> => {
    try {
      return await resolveImage(filePath, src);
    } catch (error) {
      throw new Error(`${relative(filePath)}: ${(error as Error).message}`);
    }
  });

const schemas = {
  blog: (filePath: string) =>
    z.object({
      // Required on every post; Obsidian edits them as properties alongside
      // the legacy fields below.
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(filePath).optional(),
      tags: z.array(z.string()).optional(),
      // Legacy Obsidian fields
      "url-slug": z.string().optional(),
      "sub-title": z.string().optional(),
      "cover-picture": image(filePath).optional(),
      publish: z.boolean().optional(),
      "dg-publish": z.boolean().optional(),
    }),
  // Written by `pnpm garden:sync` from the Obsidian vault; never edit by hand.
  garden: (_filePath: string) =>
    z.object({
      title: z.string(),
      folders: z.array(z.string()),
      updated: z.coerce.date().optional(),
      links: z.array(z.string()),
      // The sync writes published notes only; fail the build if anything
      // else lands here.
      "dg-publish": z.literal(true),
    }),
};

const collections = {
  blog: { dir: "blog", extensions: [".md", ".mdx"] },
  garden: { dir: "garden", extensions: [".md"] },
} satisfies Record<keyof typeof schemas, { dir: string; extensions: string[] }>;

export type CollectionName = keyof typeof schemas;

export interface CollectionEntry<C extends CollectionName> {
  id: string;
  collection: C;
  /** Absolute path of the source file. */
  filePath: string;
  /** The document without its frontmatter. */
  body: string;
  data: z.output<ReturnType<(typeof schemas)[C]>>;
}

// Astro's frontmatter fence: at the very start (after an optional BOM) or
// after leading blank lines.
const FRONTMATTER = /(?:^﻿?|^\s*\n)---([\s\S]*?\n)---/;

function parseFrontmatter(source: string, filePath: string) {
  const match = FRONTMATTER.exec(source);
  if (!match) return { data: {} as Record<string, unknown>, body: source };
  const document = parseDocument(match[1], {
    customTags: ["timestamp"],
    merge: true,
    schema: "core",
  });
  if (document.errors.length > 0) {
    throw new Error(`${relative(filePath)}: invalid frontmatter: ${document.errors[0].message}`);
  }
  const parsed = document.toJS();
  return {
    data: (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>,
    body: source.replace(match[0], ""),
  };
}

const relative = (filePath: string) => path.relative(process.cwd(), filePath);

/** Files in `dir` and below with one of `extensions`, skipping dotfiles. */
async function listFiles(dir: string, extensions: string[]): Promise<string[]> {
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    // The garden folder is gitignored and absent until `pnpm garden:sync`.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files = await Promise.all(
    names
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(full, extensions);
        return extensions.includes(path.extname(entry.name)) ? [full] : [];
      }),
  );
  return files.flat().sort();
}

/** Astro's glob-loader id: slugged path segments, no extension or /index. */
export function entryId(relativePath: string, frontmatterSlug?: unknown): string {
  if (frontmatterSlug) return String(frontmatterSlug);
  return relativePath
    .replace(new RegExp(`${path.extname(relativePath).replace(".", "\\.")}$`), "")
    .split(/[\\/]/)
    .map((segment) => githubSlug(segment))
    .join("/")
    .replace(/\/index$/, "");
}

async function loadEntry<C extends CollectionName>(
  collection: C,
  base: string,
  filePath: string,
): Promise<CollectionEntry<C>> {
  const { data: frontmatter, body } = parseFrontmatter(await readFile(filePath, "utf8"), filePath);
  const result = await schemas[collection](filePath).safeParseAsync(frontmatter);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`${relative(filePath)} does not match the ${collection} schema:\n${issues}`);
  }
  return {
    id: entryId(path.relative(base, filePath), frontmatter.slug),
    collection,
    filePath,
    body,
    data: result.data as CollectionEntry<C>["data"],
  };
}

const cache = new Map<string, { signature: string; entries: Promise<CollectionEntry<CollectionName>[]> }>();

async function loadCollection<C extends CollectionName>(
  collection: C,
  base = path.join(CONTENT_DIR, collections[collection].dir),
): Promise<CollectionEntry<C>[]> {
  const files = await listFiles(base, collections[collection].extensions);
  // Reloaded when a file is added, removed or edited, so `next dev` picks up
  // content changes on the next request.
  const signature = (
    await Promise.all(
      files.map(async (file) => {
        const { mtimeMs, size } = await stat(file);
        return `${file}:${mtimeMs}:${size}`;
      }),
    )
  ).join("\n");
  const key = `${collection}:${base}`;
  const cached = cache.get(key);
  if (cached?.signature === signature) return cached.entries as Promise<CollectionEntry<C>[]>;

  const entries = (async () => {
    const loaded = await Promise.all(files.map((file) => loadEntry(collection, base, file)));
    const seen = new Map<string, string>();
    for (const entry of loaded) {
      const other = seen.get(entry.id);
      if (other) {
        throw new Error(
          `${relative(entry.filePath)} and ${relative(other)} both have the ${collection} id "${entry.id}"`,
        );
      }
      seen.set(entry.id, entry.filePath);
    }
    return loaded;
  })();
  cache.set(key, { signature, entries });
  entries.catch(() => cache.delete(key));
  return entries;
}

/**
 * Every entry of a collection, in file-path order, optionally filtered.
 * `base` reads another folder instead of src/content/<collection> (tests).
 */
export async function getCollection<C extends CollectionName>(
  collection: C,
  filter?: (entry: CollectionEntry<C>) => boolean,
  { base }: { base?: string } = {},
): Promise<CollectionEntry<C>[]> {
  const entries = await loadCollection(collection, base);
  return filter ? entries.filter(filter) : [...entries];
}

/** One entry by id, or undefined. */
export async function getEntry<C extends CollectionName>(
  collection: C,
  id: string,
): Promise<CollectionEntry<C> | undefined> {
  return (await loadCollection(collection)).find((entry) => entry.id === id);
}

const rendered = new WeakMap<object, Promise<RenderedContent>>();

/**
 * Renders an entry: `<Content />` is its body as React elements (or the MDX
 * component), `headings` its h1-h6 with their ids. Cached per entry.
 */
export function render(entry: CollectionEntry<CollectionName>): Promise<RenderedContent> {
  let pending = rendered.get(entry);
  if (!pending) {
    pending = renderMarkdown(entry.body, entry.filePath);
    rendered.set(entry, pending);
  }
  return pending;
}
