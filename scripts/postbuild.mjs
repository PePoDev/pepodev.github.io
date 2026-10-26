#!/usr/bin/env node
// Runs after `next build` (pnpm build). Finishes the export in out/ and fails
// the build when it is not what GitHub Pages should serve.
//
// 1. Removes out/404/ and out/_not-found/: copies of out/404.html that would
//    answer /404/ and /_not-found/ with status 200. GitHub Pages serves
//    out/404.html, with status 404, for every unknown path.
// 2. Page runtime (PageRuntime in src/components/Document.tsx): every page
//    loses Next.js's scripts, script preloads, inline RSC payload,
//    hydration-only markup and its .txt payload files, so it ships only its
//    own inline scripts (and any script a post or note writes as raw HTML).
//    The page marked <meta name="pepodev-runtime" content="desktop"> (/)
//    gets the desktop bundle instead (scripts/desktop-bundle.mjs): its
//    shared chunks and entry as module scripts (with module preloads), and
//    the app bodies' URLs as JSON (#desktop-apps). The runtime must match
//    the page: a client component other than the desktop would never
//    hydrate, and fails the build. A page that fails is left as it was, so
//    a rerun reports it again; a page without the marker (stripped by an
//    earlier run, or not rendered through <Document>) must hold nothing of
//    the runtime. Then Next.js's client files, which no page loads, are
//    deleted, and a stylesheet no page links fails the build: without
//    Next.js's runtime, CSS that only a lazily loaded module imports never
//    loads (import it in Desktop.tsx).
// 3. Checks every root-relative src, srcset, href and content URL (and
//    https://pepo.dev/... share-image URLs) in out/**/*.html, and the asset
//    URLs a page's JSON data names (the desktop's app data, such as the
//    Music tracks, and the app bodies' files), so a missing build-time image
//    (src/lib/images.ts) or asset breaks the build instead of the page.
// 4. Checks that sitemap-0.xml lists exactly the exported pages (every
//    out/**/index.html), and that sitemap-index.xml points to it.
// 5. Checks that every post (out/blog/<id>/index.html) has its Blog app
//    article file, out/blog/<id>/article.json ({ id, html }), and that the
//    files the article references exist (step 3's check, on its html).
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_DIR, buildDesktopBundle } from "./desktop-bundle.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "out");
const SITE = "https://pepo.dev";
// Document's marker (RUNTIME_META in src/components/Document.tsx).
const RUNTIME = /<meta name="pepodev-runtime" content="(none|desktop)"\s*\/?>/;
// The one client component that runtime "desktop" hydrates (browser-entry.tsx).
export const DESKTOP_COMPONENT = "src/components/desktop/Desktop.tsx";

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
 * A page without Next.js: returns the HTML without its runtime, and what
 * keeps the page from working without it (client components other than
 * `hydrated`, streamed Suspense content, leftovers of the runtime).
 */
export function stripRuntime(html, clientModules, hydrated = []) {
  const problems = [];
  const components = ownClientComponents(html, clientModules).filter((component) => !hydrated.includes(component));
  if (components.length > 0) {
    problems.push(
      `renders client components, which would never hydrate: ${components.join(", ")}. ` +
        "Make them Server Components and InlineScripts (only the desktop hydrates).",
    );
  }
  const stripped = html
    .replace(RUNTIME, "")
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

  problems.push(...runtimeLeftovers(stripped));
  return { html: stripped, problems };
}

/**
 * What a page without Next.js's runtime must not hold: without it, nothing
 * would load Next.js's chunks, reveal streamed Suspense content or run a
 * client component.
 */
export function runtimeLeftovers(html) {
  const problems = [];
  for (const [pattern, what] of [
    [/\/_next\/static\/chunks\/[^"']+\.js/, "a reference to a Next.js script chunk"],
    [/self\.__next_[fs]\b|globalThis\["TURBOPACK"\]/, "RSC payload or runtime code"],
    [/<template\b|<div hidden id="S:|\$R[CSX]\(/, "streamed Suspense content"],
  ]) {
    if (pattern.test(html)) problems.push(`still contains ${what}`);
  }
  return problems;
}

/** Data for a script element: JSON that cannot close the script (`<` is escaped). */
const scriptJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * The home page's desktop bundle (buildDesktopBundle's result). Every
 * script is an async module script, so DOMContentLoaded never waits for it
 * (a deferred one would hold the event until the bundle has downloaded),
 * with data-cfasync="false" before src, where Cloudflare Rocket Loader
 * looks for it. At the end of <head>: a module preload for every file,
 * a script for each shared chunk (so browsers without modulepreload,
 * Firefox 114 and Safari 16, fetch them alongside the entry, not after it;
 * each loads once) and the app bodies' URLs. At the end of <body>: the
 * entry, which therefore runs only once the page has parsed and hydrates
 * at once (browser-entry.tsx), with no need for readyState or
 * DOMContentLoaded, which Rocket Loader fakes.
 */
export function addDesktopBundle(html, bundle) {
  if (!html.includes("</head>") || !html.includes("</body>")) {
    throw new Error("The page has no </head> or </body> for the desktop bundle.");
  }
  const moduleScript = (url) => `<script data-cfasync="false" type="module" async="" src="${url}"></script>`;
  const head =
    [...bundle.preload, bundle.entry].map((url) => `<link rel="modulepreload" href="${url}"/>`).join("") +
    bundle.preload.map(moduleScript).join("") +
    `<script type="application/json" id="desktop-apps">${scriptJson(bundle.apps)}</script>`;
  const end = html.lastIndexOf("</body>");
  return (
    html.slice(0, end).replace("</head>", `${head}</head>`) + moduleScript(bundle.entry) + html.slice(end)
  );
}

/**
 * Scripts on the desktop page that Rocket Loader would take over: every
 * script that runs must carry data-cfasync="false" before any other
 * attribute (Cloudflare reads it only before src). Taking over one script
 * puts Rocket Loader's activator on the page, which fakes readyState and
 * holds DOMContentLoaded until window load.
 */
export function rocketLoaderProblems(html) {
  const problems = [];
  for (const [tag, attributes] of html.matchAll(/<script\b([^>]*)>/g)) {
    if (/\stype="application\/(?:ld\+)?json"/.test(attributes)) continue;
    if (!/^\s+data-cfasync="false"/.test(attributes)) problems.push(`Rocket Loader would take over ${tag}`);
  }
  return problems;
}

const ASSET_URL = /"(\/[^"\\\s]+\.(?:avif|gif|ico|jpe?g|png|svg|webp|m4a|mp3|mp4|ogg|wav|webm|pdf|json|js|woff2?))"/gi;

/** Root-relative asset URLs named in a page's JSON data scripts (app data, the app bodies' files). */
export function dataAssetUrls(html) {
  const urls = new Set();
  for (const [, json] of html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const [, url] of json.matchAll(ASSET_URL)) urls.add(url);
  }
  return [...urls];
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

async function main() {
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
  let desktopPages = 0;
  let bundle = null;
  for (const file of htmlFiles(ROOT)) {
    const html = readFileSync(file, "utf8");
    const runtime = html.match(RUNTIME)?.[1];
    if (!runtime) {
      // Stripped by an earlier run, or not rendered through <Document>.
      const leftovers = runtimeLeftovers(html);
      for (const problem of leftovers) fail(`${rel(file)} has no runtime marker but ${problem}`);
      if (html.includes('id="desktop-apps"')) desktopPages += 1;
      else staticPages += 1;
      continue;
    }
    const desktop = runtime === "desktop";
    let { html: stripped, problems } = stripRuntime(html, clientModules, desktop ? [DESKTOP_COMPONENT] : []);
    if (
      desktop &&
      (!ownClientComponents(html, clientModules).includes(DESKTOP_COMPONENT) || !html.includes('id="desktop-data"'))
    ) {
      problems.push("renders no desktop (Desktop.tsx and #desktop-data).");
    }
    for (const problem of problems) fail(`${rel(file)} has runtime "${runtime}" but ${problem}`);
    // Left as it was, marker and runtime included, so a rerun reports it again.
    if (problems.length > 0) continue;
    if (desktop) {
      bundle ??= await buildDesktopBundle(path.join(ROOT, ".."));
      stripped = addDesktopBundle(stripped, bundle);
      const rocketLoader = rocketLoaderProblems(stripped);
      for (const problem of rocketLoader) fail(`${rel(file)}: ${problem}`);
      if (rocketLoader.length > 0) continue;
      desktopPages += 1;
    } else {
      staticPages += 1;
    }
    writeFileSync(file, stripped);
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
  }

  // Next.js's client files (its chunks, manifests, the desktop's Turbopack
  // build): no page loads them now. Stylesheets and media stay.
  const loaded = new Set();
  for (const file of htmlFiles(ROOT)) {
    for (const [, url] of readFileSync(file, "utf8").matchAll(/\s(?:src|href)="(\/_next\/[^"]+)"/g)) loaded.add(url);
  }
  let removedScripts = 0;
  const removeUnloaded = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full === path.join(ROOT, BUNDLE_DIR)) continue;
        removeUnloaded(full);
        if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
      } else if (entry.name.endsWith(".js") && !loaded.has(`/${path.relative(ROOT, full).split(path.sep).join("/")}`)) {
        rmSync(full);
        removedScripts += 1;
      }
    }
  };
  removeUnloaded(path.join(ROOT, "_next"));

  // Stylesheets: Next.js links the ones the server render imports. One that
  // no page links was imported only by lazily loaded code (an app body, an
  // import()), which only Next.js's runtime would have loaded.
  const linked = new Set();
  for (const file of htmlFiles(ROOT)) {
    for (const [tag] of readFileSync(file, "utf8").matchAll(/<link\b[^>]*>/g)) {
      const href = tag.match(/\shref="([^"]+)"/)?.[1];
      if (/\srel="stylesheet"/.test(tag) && href) linked.add(href);
    }
  }
  const checkStylesheets = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) checkStylesheets(full);
      else if (entry.name.endsWith(".css") && !linked.has(`/${path.relative(ROOT, full).split(path.sep).join("/")}`)) {
        fail(
          `${rel(full)} is a stylesheet no page links: CSS imported only by an app body or behind import() never loads ` +
            "without Next.js's runtime. Import it in src/components/desktop/Desktop.tsx.",
        );
      }
    }
  };
  checkStylesheets(path.join(ROOT, "_next"));

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
    for (const url of dataAssetUrls(html)) checkUrl(url, file);
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
    `postbuild: out/ is complete. ${staticPages} static pages (runtime "none") and ${desktopPages} desktop page, ` +
      `without Next.js's runtime (${removedScripts} of its client files removed); every referenced local file exists; ` +
      `the sitemap lists the ${pagePaths.size} exported pages; ` +
      `${articles} Blog app article files.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
