#!/usr/bin/env node
// Runs after `next build` (pnpm build). Finishes the export in out/ and fails
// the build when it is not what GitHub Pages should serve.
//
// 1. Removes out/404/ and out/_not-found/: copies of out/404.html that would
//    answer /404/ and /_not-found/ with status 200. GitHub Pages serves
//    out/404.html, with status 404, for every unknown path.
// 2. Page runtime (PageRuntime in src/components/Document.tsx):
//    - pages marked <meta name="pepodev-runtime" content="none"> lose
//      Next.js's scripts, script preloads, inline RSC payload, hydration-only
//      markup and their .txt payload files, so they ship only their own
//      inline scripts (and any script a post or note writes as raw HTML), as
//      on the Astro site;
//    - every other page hydrates, and its Next.js scripts get
//      data-cfasync="false" so Cloudflare Rocket Loader does not hold back
//      hydration (README, Parse-Time Scripts and Rocket Loader).
//    The runtime must match the page: a static page that renders a client
//    component (it would never hydrate), or a hydrating page that renders
//    none (React for nothing), fails the build.
// 3. Checks every root-relative src, srcset, href and content URL (and
//    https://pepo.dev/... share-image URLs) in out/**/*.html, and the asset
//    URLs a hydrating page's RSC payload names (app data, such as the Music
//    tracks), so a missing build-time image (src/lib/images.ts) or asset
//    breaks the build instead of the page.
// 4. Checks that sitemap-0.xml lists exactly the exported pages (every
//    out/**/index.html), and that sitemap-index.xml points to it.
// 5. Checks that every post (out/blog/<id>/index.html) has its Blog app
//    article file, out/blog/<id>/article.json ({ id, html }), and that the
//    files the article references exist (step 3's check, on its html).
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "out");
const SITE = "https://pepo.dev";
// Document's marker (RUNTIME_NONE_META in src/components/Document.tsx).
const RUNTIME_NONE = /<meta name="pepodev-runtime" content="none"\s*\/?>/;

// --- 2. Page runtime (pure helpers; scripts/postbuild.test.mjs) ---------------

/** Scripts the site writes itself: its inline scripts (InlineScript) and JSON-LD. */
export const ownScript = (attributes) =>
  /\sdata-cfasync="false"/.test(attributes) || /\stype="application\/ld\+json"/.test(attributes);

/**
 * Next.js's own scripts: its chunks (and the nomodule polyfill), the
 * Turbopack bootstrap and the inline RSC payload (self.__next_f, and
 * self.__next_s for next/script). Anything else, such as a script a post or
 * a garden note writes as raw HTML (a Gist embed), is the page's content.
 */
export const nextScript = (attributes, body) =>
  /\ssrc="\/_next\//.test(attributes) || /^\s*\(?\s*(?:self\.__next_[fs]\b|globalThis\["TURBOPACK"\])/.test(body);

const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

/**
 * The client modules a client reference manifest (.next/server/app/**
 * /*_client-reference-manifest.js) lists, as [id, module path] pairs: what
 * each `I[id, chunks, name]` row of a page's RSC payload refers to. Route
 * keys can hold brackets ("/(post)/blog/[slug]/page"), so the key is read as
 * a JSON string. Null when the file holds no manifest.
 */
export function readClientManifest(source) {
  const entries = [];
  let found = false;
  for (const [, , json] of source.matchAll(
    /__RSC_MANIFEST\[("(?:[^"\\]|\\.)*")\]\s*=\s*(\{.*?\});?\s*$/gm,
  )) {
    found = true;
    for (const [modulePath, { id }] of Object.entries(JSON.parse(json).clientModules ?? {})) {
      entries.push([String(id), modulePath.replace(/^\[project\]\//, "").replace(/ <.*>$/, "")]);
    }
  }
  return found ? entries : null;
}

const nextBuiltIn = (modulePath) => /(^|\/)node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?next\//.test(modulePath);

/** The page's inline RSC payload (the self.__next_f pushes), as one string. */
export function rscPayload(html) {
  let payload = "";
  for (const [, args] of html.matchAll(
    /<script(?: data-cfasync="false")?>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g,
  )) {
    const [type, chunk] = JSON.parse(args);
    if (type === 1 && typeof chunk === "string") payload += chunk;
  }
  return payload;
}

/** Client components (not Next.js's own) the page's RSC payload references. */
export function ownClientComponents(html, clientModules) {
  const found = new Set();
  for (const [, id] of rscPayload(html).matchAll(/^[0-9a-f]+:I\[("?[^,"]+"?),/gm)) {
    const modulePath = clientModules.get(id.replace(/"/g, ""));
    if (!modulePath) found.add(`client module ${id} (not in the manifests)`);
    else if (!nextBuiltIn(modulePath)) found.add(modulePath);
  }
  return [...found];
}

/**
 * A static page without Next.js: returns the HTML without its runtime, and
 * what keeps the page from working without it (client components, streamed
 * Suspense content, leftovers of the runtime).
 */
export function stripRuntime(html, clientModules) {
  const problems = [];
  const components = ownClientComponents(html, clientModules);
  if (components.length > 0) {
    problems.push(
      `renders client components, which would never hydrate: ${components.join(", ")}. ` +
        "Give its layout runtime=\"react\", or make them Server Components and InlineScripts.",
    );
  }
  const stripped = html
    .replace(RUNTIME_NONE, "")
    // Script preloads (<link rel="preload" as="script">, modulepreload).
    .replace(/<link\b[^>]*>/g, (tag) =>
      /\srel="(preload|modulepreload)"/.test(tag) && /\sas="script"|modulepreload/.test(tag) ? "" : tag,
    )
    // Next.js chunks, its Turbopack bootstrap, the self.__next_f RSC payload.
    .replace(scriptTag, (tag, attributes, body) =>
      !ownScript(attributes) && nextScript(attributes, body) ? "" : tag,
    )
    // React's empty metadata boundary, which only hydration uses.
    .replaceAll('<div hidden=""><!--$--><!--/$--></div>', "")
    // Turbopack's font manifest makes Next.js add these to every page, though
    // the site uses no next/font (fonts-desktop.css): a preconnect to the
    // page's own origin and an empty marker for next/font's fallbacks.
    .replaceAll('<link rel="preconnect" href="/" crossorigin=""/>', "")
    .replaceAll('<meta name="next-size-adjust" content=""/>', "");

  // Without the runtime, nothing would reveal streamed Suspense content or
  // run a client component; a page that has either must use runtime "react".
  for (const [pattern, what] of [
    [/\/_next\/static\/chunks\/[^"']+\.js/, "a reference to a Next.js script chunk"],
    [/self\.__next_[fs]\b|globalThis\["TURBOPACK"\]/, "RSC payload or runtime code"],
    [/<template\b|<div hidden id="S:|\$R[CSX]\(/, "streamed Suspense content"],
  ]) {
    if (pattern.test(stripped)) problems.push(`still contains ${what}`);
  }
  return { html: stripped, problems };
}

/** A hydrating page: its Next.js scripts opt out of Rocket Loader. */
export function markScripts(html) {
  return html.replace(/<script\b([^>]*)>/g, (tag, attributes) =>
    ownScript(attributes) ? tag : `<script data-cfasync="false"${attributes}>`,
  );
}

const ASSET_URL = /"(\/[^"\\\s]+\.(?:avif|gif|ico|jpe?g|png|svg|webp|m4a|mp3|mp4|ogg|wav|webm|pdf|json|woff2?))"/gi;

/** Root-relative asset URLs named in a hydrating page's RSC payload (props, app data). */
export function payloadAssetUrls(html) {
  return [...new Set([...rscPayload(html).matchAll(ASSET_URL)].map(([, url]) => url))];
}

// --- The build ------------------------------------------------------------------

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(ROOT, "_next")) yield* htmlFiles(full);
    } else if (entry.name.endsWith(".html")) yield full;
  }
}

function* manifestFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* manifestFiles(full);
    else if (entry.name.endsWith("_client-reference-manifest.js")) yield full;
  }
}

function main() {
  const errors = [];
  const fail = (message) => errors.push(message);
  const rel = (file) => path.relative(ROOT, file);

  // --- 1. Duplicates of the 404 ---------------------------------------------

  if (!existsSync(path.join(ROOT, "404.html"))) {
    throw new Error("out/404.html is missing; GitHub Pages needs it for unknown paths.");
  }
  for (const duplicate of ["404", "_not-found"]) {
    rmSync(path.join(ROOT, duplicate), { recursive: true, force: true });
  }

  // --- 2. Page runtime ------------------------------------------------------

  // Client modules by id, from the client reference manifests next build
  // leaves in .next/.
  const clientModules = new Map();
  for (const file of manifestFiles(path.join(ROOT, "..", ".next", "server", "app"))) {
    const entries = readClientManifest(readFileSync(file, "utf8"));
    if (!entries) {
      fail(`${path.relative(path.join(ROOT, ".."), file)} holds no client reference manifest postbuild can read.`);
      continue;
    }
    for (const [id, modulePath] of entries) clientModules.set(id, modulePath);
  }

  let staticPages = 0;
  let reactPages = 0;
  for (const file of htmlFiles(ROOT)) {
    const html = readFileSync(file, "utf8");
    if (RUNTIME_NONE.test(html)) {
      const { html: stripped, problems } = stripRuntime(html, clientModules);
      for (const problem of problems) fail(`${rel(file)} has runtime "none" but ${problem}`);
      writeFileSync(file, stripped);
      staticPages += 1;
      // The page's RSC payload files (index.txt, __next.*.txt) next to it; only
      // client-side navigation would read them.
      if (path.basename(file) === "index.html") {
        const dir = path.dirname(file);
        for (const name of readdirSync(dir)) {
          if (name === "index.txt" || (name.startsWith("__next.") && name.endsWith(".txt"))) {
            rmSync(path.join(dir, name));
          }
        }
      }
    } else if (/self\.__next_f/.test(html)) {
      // A page that renders no client component of its own would ship the
      // runtime for nothing.
      if (ownClientComponents(html, clientModules).length === 0) {
        fail(`${rel(file)} has runtime "react" but renders no client components; give its layout runtime="none".`);
      }
      writeFileSync(file, markScripts(html));
      reactPages += 1;
    } else {
      staticPages += 1; // stripped by an earlier run
    }
  }

  // --- 3. Local references --------------------------------------------------

  const missing = new Map();
  const checkUrl = (url, file) => {
    url = url.replaceAll("&amp;", "&");
    if (url.startsWith(`${SITE}/`)) url = url.slice(SITE.length);
    if (!url.startsWith("/") || url.startsWith("//")) return;
    let pathname;
    try {
      pathname = decodeURIComponent(url.replace(/[?#].*$/, ""));
    } catch {
      pathname = url;
    }
    let target = path.join(ROOT, pathname);
    if (pathname.endsWith("/")) target = path.join(target, "index.html");
    if (existsSync(target) && statSync(target).isFile()) return;
    if (existsSync(`${target}.html`)) return;
    const pages = missing.get(pathname) ?? new Set();
    pages.add(rel(file));
    missing.set(pathname, pages);
  };
  const attribute = /\s(src|href|srcset|content|poster)="([^"]*)"/gi;
  const checkReferences = (html, file) => {
    for (const [, name, value] of html.matchAll(attribute)) {
      const candidates =
        name.toLowerCase() === "srcset"
          ? value.split(",").map((entry) => entry.trim().split(/\s+/)[0])
          : [value];
      for (const url of candidates) checkUrl(url, file);
    }
  };
  for (const file of htmlFiles(ROOT)) {
    const html = readFileSync(file, "utf8");
    checkReferences(html, file);
    for (const url of payloadAssetUrls(html)) checkUrl(url, file);
  }

  // --- 5. Blog article files (read by the desktop Blog app) -----------------

  let articles = 0;
  const blogDir = path.join(ROOT, "blog");
  for (const entry of existsSync(blogDir) ? readdirSync(blogDir, { withFileTypes: true }) : []) {
    const dir = path.join(blogDir, entry.name);
    if (!entry.isDirectory() || !existsSync(path.join(dir, "index.html"))) continue;
    const file = path.join(dir, "article.json");
    if (!existsSync(file)) {
      fail(`${rel(file)} is missing; the Blog app loads every post's body from it (article.json/route.ts).`);
      continue;
    }
    let article;
    try {
      article = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      fail(`${rel(file)} is not valid JSON: ${error.message}`);
      continue;
    }
    if (article?.id !== entry.name || typeof article.html !== "string" || article.html.length === 0) {
      fail(`${rel(file)} should be { id: "${entry.name}", html: "<the rendered article>" }.`);
      continue;
    }
    checkReferences(article.html, file);
    articles += 1;
  }

  for (const [url, pages] of missing) {
    fail(`pages reference ${url}, which is not in out/ (in ${[...pages].join(", ")})`);
  }

  // --- 4. Sitemap -----------------------------------------------------------

  const pagePaths = new Set(
    [...htmlFiles(ROOT)]
      .filter((file) => path.basename(file) === "index.html")
      .map((file) => `/${path.relative(ROOT, path.dirname(file)).split(path.sep).join("/")}/`.replace(/^\/\/$/, "/")),
  );
  const locs = (file) =>
    [...readFileSync(path.join(ROOT, file), "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) =>
      loc.replaceAll("&amp;", "&"),
    );
  const sitemapPaths = new Set();
  for (const loc of locs("sitemap-0.xml")) {
    const url = new URL(loc);
    if (url.origin !== SITE) {
      fail(`sitemap-0.xml lists ${loc}, which is not on ${SITE}`);
      continue;
    }
    sitemapPaths.add(decodeURIComponent(url.pathname));
  }
  for (const page of pagePaths) {
    if (!sitemapPaths.has(page)) {
      fail(`out${page}index.html is not in sitemap-0.xml; add its route to src/lib/sitemap.ts`);
    }
  }
  for (const page of sitemapPaths) {
    if (!pagePaths.has(page)) fail(`sitemap-0.xml lists ${page}, but out${page}index.html was not exported`);
  }
  const index = locs("sitemap-index.xml");
  if (index.length !== 1 || index[0] !== `${SITE}/sitemap-0.xml`) {
    fail(`sitemap-index.xml should point to ${SITE}/sitemap-0.xml only, not ${index.join(", ")}`);
  }

  if (errors.length > 0) {
    console.error(`postbuild: out/ is not ready to deploy:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    process.exit(1);
  }
  console.log(
    `postbuild: out/ is complete. ${staticPages} static pages (runtime "none", Next.js scripts removed), ` +
      `${reactPages} hydrating pages; every referenced local file exists; the sitemap lists the ${pagePaths.size} exported pages; ` +
      `${articles} Blog app article files.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
