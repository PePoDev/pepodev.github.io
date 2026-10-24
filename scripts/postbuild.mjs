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
//      inline scripts, as on the Astro site;
//    - every other page hydrates, and its Next.js scripts get
//      data-cfasync="false" so Cloudflare Rocket Loader does not hold back
//      hydration (README: Rocket Loader).
//    The runtime must match the page: a static page that renders a client
//    component (it would never hydrate), or a hydrating page that renders
//    none (React for nothing), fails the build.
// 3. Checks every root-relative src, srcset, href and content URL (and
//    https://pepo.dev/... share-image URLs) in out/**/*.html, so a missing
//    build-time image (src/lib/images.ts) or asset breaks the build instead of
//    the page.
// 4. Checks that sitemap-0.xml lists exactly the exported pages (every
//    out/**/index.html), and that sitemap-index.xml points to it.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "out");
const SITE = "https://pepo.dev";
// Document's marker (RUNTIME_NONE_META in src/components/Document.tsx).
const RUNTIME_NONE = /<meta name="pepodev-runtime" content="none"\s*\/?>/;

const errors = [];
const fail = (message) => errors.push(message);
const rel = (file) => path.relative(root, file);

if (!existsSync(path.join(root, "404.html"))) {
  throw new Error("out/404.html is missing; GitHub Pages needs it for unknown paths.");
}
for (const duplicate of ["404", "_not-found"]) {
  rmSync(path.join(root, duplicate), { recursive: true, force: true });
}

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(root, "_next")) yield* htmlFiles(full);
    } else if (entry.name.endsWith(".html")) yield full;
  }
}

// --- 2. Page runtime -------------------------------------------------------

/** Scripts a page may keep without the runtime: its own inline scripts and JSON-LD. */
const ownScript = (attributes) =>
  /\sdata-cfasync="false"/.test(attributes) || /\stype="application\/ld\+json"/.test(attributes);
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

// Client modules by id, from the client reference manifests next build
// leaves in .next/: what each `I[id, chunks, name]` row of a page's RSC
// payload refers to.
const clientModules = new Map();
function* manifestFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* manifestFiles(full);
    else if (entry.name.endsWith("_client-reference-manifest.js")) yield full;
  }
}
for (const file of manifestFiles(path.join(root, "..", ".next", "server", "app"))) {
  const source = readFileSync(file, "utf8");
  for (const [, json] of source.matchAll(/__RSC_MANIFEST\[[^\]]*\]\s*=\s*(\{.*?\});?\s*$/gm)) {
    for (const [modulePath, { id }] of Object.entries(JSON.parse(json).clientModules ?? {})) {
      clientModules.set(String(id), modulePath.replace(/^\[project\]\//, "").replace(/ <.*>$/, ""));
    }
  }
}
const nextBuiltIn = (modulePath) => /(^|\/)node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?next\//.test(modulePath);

/** Client components (not Next.js's own) the page's RSC payload references. */
function ownClientComponents(html) {
  let payload = "";
  for (const [, args] of html.matchAll(
    /<script(?: data-cfasync="false")?>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g,
  )) {
    const [type, chunk] = JSON.parse(args);
    if (type === 1 && typeof chunk === "string") payload += chunk;
  }
  const found = new Set();
  for (const [, id] of payload.matchAll(/^[0-9a-f]+:I\[("?[^,"]+"?),/gm)) {
    const modulePath = clientModules.get(id.replace(/"/g, ""));
    if (!modulePath) found.add(`client module ${id} (not in the manifests)`);
    else if (!nextBuiltIn(modulePath)) found.add(modulePath);
  }
  return [...found];
}

function stripRuntime(html, file) {
  const components = ownClientComponents(html);
  if (components.length > 0) {
    fail(
      `${rel(file)} has runtime "none" but renders client components, which would never hydrate: ` +
        `${components.join(", ")}. Give its layout runtime="react", or make them Server Components and InlineScripts.`,
    );
  }
  const stripped = html
    .replace(RUNTIME_NONE, "")
    // Script preloads (<link rel="preload" as="script">, modulepreload).
    .replace(/<link\b[^>]*>/g, (tag) =>
      /\srel="(preload|modulepreload)"/.test(tag) && /\sas="script"|modulepreload/.test(tag) ? "" : tag,
    )
    // Next.js chunks, its Turbopack bootstrap, the self.__next_f RSC payload.
    .replace(scriptTag, (tag, attributes) => (ownScript(attributes) ? tag : ""))
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
    [/<script\b(?![^>]*\sdata-cfasync="false")(?![^>]*application\/ld\+json)[^>]*>/, "a Next.js script"],
    [/\/_next\/static\/chunks\/[^"']+\.js/, "a reference to a Next.js script chunk"],
    [/self\.__next_[fs]\b|globalThis\["TURBOPACK"\]/, "RSC payload or runtime code"],
    [/<template\b|<div hidden id="S:|\$RC\(|\$RS\(/, "streamed Suspense content"],
  ]) {
    if (pattern.test(stripped)) {
      fail(`${rel(file)} has runtime "none" but still contains ${what}; give its layout runtime="react".`);
    }
  }
  return stripped;
}

function markScripts(html) {
  return html.replace(/<script\b([^>]*)>/g, (tag, attributes) =>
    ownScript(attributes) ? tag : `<script data-cfasync="false"${attributes}>`,
  );
}

let staticPages = 0;
let reactPages = 0;
for (const file of htmlFiles(root)) {
  const html = readFileSync(file, "utf8");
  if (RUNTIME_NONE.test(html)) {
    writeFileSync(file, stripRuntime(html, file));
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
    if (ownClientComponents(html).length === 0) {
      fail(`${rel(file)} has runtime "react" but renders no client components; give its layout runtime="none".`);
    }
    writeFileSync(file, markScripts(html));
    reactPages += 1;
  } else {
    staticPages += 1; // stripped by an earlier run
  }
}

// --- 3. Local references ---------------------------------------------------

const missing = new Map();
const attribute = /\s(src|href|srcset|content|poster)="([^"]*)"/gi;
for (const file of htmlFiles(root)) {
  const html = readFileSync(file, "utf8");
  for (const [, name, value] of html.matchAll(attribute)) {
    const candidates =
      name.toLowerCase() === "srcset"
        ? value.split(",").map((entry) => entry.trim().split(/\s+/)[0])
        : [value];
    for (let url of candidates) {
      url = url.replaceAll("&amp;", "&");
      if (url.startsWith(`${SITE}/`)) url = url.slice(SITE.length);
      if (!url.startsWith("/") || url.startsWith("//")) continue;
      let pathname;
      try {
        pathname = decodeURIComponent(url.replace(/[?#].*$/, ""));
      } catch {
        pathname = url;
      }
      let target = path.join(root, pathname);
      if (pathname.endsWith("/")) target = path.join(target, "index.html");
      if (existsSync(target) && statSync(target).isFile()) continue;
      if (existsSync(`${target}.html`)) continue;
      const pages = missing.get(pathname) ?? new Set();
      pages.add(rel(file));
      missing.set(pathname, pages);
    }
  }
}
for (const [url, pages] of missing) {
  fail(`pages reference ${url}, which is not in out/ (in ${[...pages].join(", ")})`);
}

// --- 4. Sitemap ------------------------------------------------------------

const pagePaths = new Set(
  [...htmlFiles(root)]
    .filter((file) => path.basename(file) === "index.html")
    .map((file) => `/${path.relative(root, path.dirname(file)).split(path.sep).join("/")}/`.replace(/^\/\/$/, "/")),
);
const locs = (file) =>
  [...readFileSync(path.join(root, file), "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) =>
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
    `${reactPages} hydrating pages; every referenced local file exists; the sitemap lists the ${pagePaths.size} exported pages.`,
);
