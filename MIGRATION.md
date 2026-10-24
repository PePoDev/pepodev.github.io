# Astro to Next.js migration

pepo.dev moves from Astro 7 to **Next.js 16 (App Router) with static export**
(`output: "export"`): same pages, same URLs, same look and behaviour, still a
static site on GitHub Pages behind Cloudflare. The Playwright suite in
`tests/e2e/` proves parity.

This file holds the decisions and conventions for the port and the list of
what is still Astro. README.md stays the single source of truth for the
site's invariants (URLs, storage keys, post ids, Rocket Loader, fonts, a11y);
it still describes the Astro tooling and is rewritten for Next.js once the
port is complete. Where README says "Astro component", "is:inline",
"define:vars", "Fonts API" or "astro.config.mjs", read the Next.js equivalent
below.

## Status

Done (the foundation):

- Astro, its integrations, `astro.config.mjs` and `src/content.config.ts` are
  gone. Next 16.4.3, React 19.3, TypeScript 6 (not 7), Turbopack for `dev`
  and `build`.
- Shared document shell, metadata helper (port of BaseHead), self-hosted
  fonts, global CSS, parse-time `<head>` scripts of `/`.
- Page runtime: static pages ship no React or Next.js JavaScript (see
  [Page runtime](#page-runtime-static-pages-and-hydrating-pages)).
- Content layer (`astro:content` replacement), Markdown/MDX pipeline,
  build-time image pipeline.
- Pages: `/blog/`, `/blog/<id>/`, the 404 (`out/404.html`), `/rss.xml`,
  `/sitemap-index.xml`, `/sitemap-0.xml`; `robots.txt` and
  `manifest.webmanifest` stay in `public/`.
- Placeholders that say they are being ported: `/resume/`, `/garden/` and
  every synced garden note (`/garden/<id>/`), so the export already has
  every URL the sitemap lists.
- Static preview server, Playwright config, CI workflow.

Done (the desktop core, see [The React desktop](#the-react-desktop)):

- `/` is the real home page: a React desktop (`runtime="react"`), with
  windows, taskbar, Start menu, command palette, icons, background, toasts,
  site mode, preferences, system audio, the first-visit Welcome window, the
  palette tip and `?blog=` deep links driven by React state.
- The app registry and the app contract; About, Work and Projects are
  ported. The other 13 apps are stubs at their final paths, and website mode
  is a placeholder panel, for the parallel tracks to replace.
- The Blog app's article files (`/blog/<id>/article.json`, loaded on
  demand), `BrandMark.tsx` for website mode and the garden, and the
  [ownership rules](#parallel-tracks-who-edits-what) for the parallel tracks.

Still to port: see the [checklist](#checklist-still-to-port) at the end.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | `next dev` (Turbopack) on port 3000 |
| `pnpm build` | `scripts/prebuild.mjs` (clears `public/_img/`), `next build` (export to `out/`), `scripts/postbuild.mjs` (see below) |
| `pnpm preview` | `scripts/serve-static.mjs`: serves `out/` like GitHub Pages (`/dir` 301 to `/dir/`, `index.html`, `/page` from `page.html` but not `/page/`, `404.html` with status 404, byte ranges for audio) |
| `pnpm check` | `next typegen && tsc --noEmit`, over `src/`, `tests/` and the configs; must stay at 0 errors |
| `pnpm test:e2e` | Playwright against `next dev`; with `PLAYWRIGHT_SERVER=preview` against `out/` (build first) |
| `pnpm garden:sync`, `pnpm test:garden` | unchanged |

`scripts/postbuild.mjs` finishes the export and fails the build when it is
not deployable:

1. removes `out/404/` and `out/_not-found/` (copies of `404.html` that would
   answer with status 200);
2. applies each page's runtime (strips Next.js's scripts from static pages,
   adds `data-cfasync="false"` to them on hydrating pages, see Page runtime),
   and fails when a static page renders a client component;
3. fails when a page references a local file that is not in `out/` (images,
   assets, share images);
4. fails unless `sitemap-0.xml` lists exactly the exported pages (every
   `out/**/index.html`) and `sitemap-index.xml` points to it.

The build needs no network: fonts are committed (see Fonts). Set
`NEXT_TELEMETRY_DISABLED=1` in scripts and CI. `next.config.ts` sets
`agentRules: false`, so `next dev` no longer writes its own block into
AGENTS.md; keep it that way (README.md is the single source of truth).

## Directory layout

| Path | Purpose |
| --- | --- |
| `src/app/(home)/` | Root layout and page of `/` (desktop and website mode, `runtime="react"`). |
| `src/components/desktop/` | The React desktop: state, window manager, overlays, icons, shell components, parse-time scripts, app registry and app API (see [The React desktop](#the-react-desktop)). |
| `src/components/apps/` | One app per `<Name>App.tsx` (client body, loaded on demand) and `<Name>App.data.ts` (its build-time data); `app-data.ts` lists the loaders. Stubs say they are placeholders. |
| `src/components/WebsiteMode.tsx` | Website mode (the `#website` panel). Placeholder for now. |
| `src/app/(blog)/blog/` | Blog index; `blog-index.css` is its scoped stylesheet. |
| `src/app/(post)/blog/[slug]/` | Post pages. The root layout sits in the dynamic segment so `<html lang>` is the post's language. `post-data.ts` is shared by the layout, the page and `article.json/route.ts` (the post's body for the desktop Blog app, `out/blog/<id>/article.json`). |
| `src/app/(resume)/resume/` | Resume. Placeholder page for now. |
| `src/app/(garden)/garden/[[...slug]]/` | Garden home (`/garden/`) and notes (`/garden/<id>/`) in one optional catch-all route. Placeholder page for now; see Dynamic routes. |
| `src/app/global-not-found.tsx`, `src/app/not-found/` | The branded 404, exported as `out/404.html`. |
| `src/app/rss.xml/`, `src/app/sitemap-index.xml/`, `src/app/sitemap-0.xml/` | Static route handlers (`dynamic = "force-static"`), written to `out/` as files. |
| `src/lib/` | Framework plumbing: `content.ts`, `markdown.ts`, `images.ts`, `head.ts`, `static-params.ts`, `sitemap.ts`, `xml.ts`. Alias `@lib/*`. |
| `src/components/` | React components (`.tsx`), plus the `.astro` files still to port (`WebsiteMode.astro`, `garden/`, the 13 app sources and `ContactIcon.astro` in `apps/`). `Document.tsx`, `InlineScript.tsx`, `JsonLd.tsx`, `ResponsiveImage.tsx`, `FormattedDate.tsx`, `SiteHeader.tsx`, `Prefetch.tsx`, `BrandMark.tsx` (port of `BrandMark.astro`, same `size` prop), `home/HomeHeadScripts.tsx`, `desktop/` are done. |
| `src/styles/fonts-desktop.css`, `src/styles/fonts-website.css` | `@font-face` rules and `--font-*` variables; `src/assets/fonts/` holds the 11 committed woff2 files. |
| `src/astro-legacy/pages/` | The Astro routes not ported yet (`resume.astro`, `garden/`). They were moved out of `src/pages/`, which Next.js treats as the Pages Router. Delete each file once ported (`index.astro` is gone). |
| `src/layouts/GardenLayout.astro` | Still to port. |
| `src/utils/`, `src/data/`, `src/types/`, `src/styles/`, `src/consts.ts`, `src/content/`, `src/assets/`, `public/` | Unchanged, apart from `src/utils/blog.ts` and `garden.ts`, which now read `@lib/content`. |
| `public/_img/` | Images resized at build time; generated, gitignored. |
| `out/` | The export; generated, gitignored (was `dist/`). |

TypeScript aliases are unchanged (`@/*`, `@components/*`, `@data/*`,
`@utils/*`, `@app-types/*`, `@layouts/*`, `@styles/*`) plus `@lib/*`. Never
`@types/*`. `tsconfig.json` excludes `src/astro-legacy` and `**/*.astro`.

## Route groups and root layouts

Pages differ in their `<html>`: `lang` (Thai posts), `data-site-mode` (`/`
and the garden), `class="resume-document"`, and the parse-time `<head>`
scripts of `/`. A Next.js layout cannot see which page it wraps, so every
page family is a **route group with its own root layout**, and each root
layout renders `<Document>`:

```tsx
// src/app/(blog)/layout.tsx
export const viewport = siteViewport;
export default async function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <Document runtime="none" jsonLd={await siteJsonLd()}>
      {children}
    </Document>
  );
}
```

- Never add `src/app/layout.tsx`: it would become the root of every page.
- A new page goes into the group whose `<html>` it shares, or gets a new
  group with its own `layout.tsx`. Groups must not resolve to the same URL.
- Moving between root layouts is a full page load. Internal links are plain
  `<a href>` (never `next/link`): every page runs its own parse-time scripts,
  and `<Prefetch>` warms the next page instead.
- A root layout inside a dynamic segment (like `(post)/blog/[slug]/`) gets
  `params` and can derive `lang` and JSON-LD from the entry; keep the lookup
  in a module both the layout and the page import (`post-data.ts`).

### `<Document>` (src/components/Document.tsx)

Props: `runtime` (**required**, `"none"` or `"react"`, see Page runtime),
`lang` (default `en`), `className` (extra `<html>` classes), `htmlData`
(`data-*` on `<html>`), `suppressHydrationWarning`, `head` (parse-time
scripts), `jsonLd`, `bodyClassName`. It always imports
`src/styles/global.css` and `src/styles/fonts-desktop.css`, and renders
`<Prefetch />` as the last element of `<body>`.

## Page runtime: static pages and hydrating pages

Next.js normally ships React and its runtime to every page and hydrates it,
even when the page has no client component: about 132 KB of gzipped
JavaScript (447 KB raw, five async chunks, plus a 39 KB polyfill for
browsers without module support) and an inline RSC payload
(`self.__next_f.push(...)`) that repeats the page's markup, so the HTML
roughly doubles. Astro shipped 1.1 KB on the blog pages, and README asks for
a static-first site. So every root layout declares its runtime:

- **`runtime="none"`** (static page): `scripts/postbuild.mjs` removes from
  the exported HTML Next.js's `<script>`s (chunks, Turbopack bootstrap, RSC
  payload, nomodule polyfill), the script preloads, React's empty
  `<div hidden=""><!--$--><!--/$--></div>`, and two tags Turbopack adds
  without next/font (`<link rel="preconnect" href="/" crossorigin>`,
  `<meta name="next-size-adjust">`), plus the page's `.txt` RSC payload
  files. Only `<InlineScript>`s and JSON-LD remain. The build fails if such
  a page renders a client component (postbuild reads the RSC payload's client
  references against the client reference manifests in `.next/`), or if
  anything that needs the runtime (streamed Suspense content) is left.
- **`runtime="react"`** (hydrating page): needed as soon as a page renders a
  client component (`"use client"`). Next.js's scripts stay, and postbuild
  gives each `data-cfasync="false"` so Cloudflare Rocket Loader does not
  hold hydration back (the timing the tests exercise is the timing visitors
  get).
- Document renders `<meta name="pepodev-runtime" content="none">` on static
  pages; postbuild reads it and removes it.
- `next dev` hydrates every page whatever its runtime; the difference exists
  only in `out/`. So parse-time scripts on static pages still follow the
  hydration rules below (see the 404 path), and CI, which tests `out/`, is
  what proves a static page works without React.

Current state: `/` is `runtime="react"` (the desktop); every other page is
`runtime="none"` (blog index, posts, 404, and the placeholders for
`/resume/` and `/garden/`).

Measured (blog index, Next.js 16.4.3): static, 9.9 KB of HTML and no
external JavaScript; the same page as `runtime="react"` with one small
client component, about 30 KB of HTML plus about 132 KB gzipped of
JavaScript.

**Decided: a React desktop.** The owner chose option A, and went further
than "start the old controllers from React": the desktop is a React app
whose windows, taskbar, menus, icons and apps render from React state
([The React desktop](#the-react-desktop)). The alternative (B, a static
desktop with the controllers bundled by a second build step) is not used.
What it costs, measured on the export (desktop core after its correction
round, website mode still a placeholder, 13 apps still stubs; KB = 1024
bytes, gzip -9):

| `/` | Astro (98f1fd8) | Next.js desktop core |
| --- | --- | --- |
| `index.html` | 404.1 KB raw / 86.5 KB gzip (every article inlined in the Blog app, every app body, website mode) | 132.6 KB raw / 24.8 KB gzip: about 79 KB the desktop markup (mostly the SVG icons, as before), 37.4 KB raw / 11.3 KB gzip the RSC payload (app data, the inline scripts and Server Component markup repeated for hydration), 15.3 KB the inline scripts (2.4 KB of it the early-input script) |
| JavaScript before the desktop takes input | 8.4 KB gzip (6 module scripts) | 523.6 KB raw / 155.7 KB gzip (7 chunks): about 134 KB gzip React and Next.js, 71.2 KB raw / 21.6 KB gzip the desktop |
| JavaScript and data later | none | each app body on its first launch (About, Work and Projects: 4.8 KB raw / 2.0 KB gzip together); the two `mount: "idle"` bodies (1.8 KB raw / 1.0 KB gzip as stubs) once the desktop is idle; a Blog article's `article.json` when it opens (5.0 to 29.8 KB raw, 1.8 to 8.4 KB gzip) |
| Website mode | same page | the same 155.7 KB gzip (the desktop hydrates while hidden), no app bodies |
| CSS | 23.2 KB gzip | 23.1 KB gzip |

The 112 KB nomodule polyfill chunk is listed in the HTML but only
browsers without module support fetch it. Website mode will add its markup
twice (HTML and RSC payload) when it is ported, and the Blog app loads
articles on demand instead of inlining them.

## Metadata (port of BaseHead.astro)

Each page describes itself with a `PageHead` (`src/lib/head.ts`): `title`,
`description`, `path` (with its trailing slash), optional `image` (an
`ImageAsset` or a `public/` path), `imageAlt`, `type` (`website` or
`article`), `lang`, `publishedTime`, `modifiedTime`, `noindex`.

```tsx
// page.tsx
export const generateMetadata = () =>
  buildMetadata({ title: BLOG_TITLE, description: BLOG_DESCRIPTION, path: "/blog/" });
// root layout
<Document runtime="none" jsonLd={await buildJsonLd(head)}>   // or siteJsonLd() for the Person
```

- `buildMetadata` returns the complete Metadata object (title, description,
  canonical, Open Graph incl. `og:image:secure_url` and `article:*`, Twitter
  incl. `twitter:url`, `<meta name="title">`, icons, manifest,
  `rel="sitemap"`, RSS alternate, robots, author, generator). Pages own their
  metadata; layouts export only `viewport = siteViewport` (theme colour).
  Next.js merges metadata shallowly, so a partial layout `metadata` would be
  overwritten anyway.
- Share images are JPEGs at most 1200px wide (`getSocialImage`).
- `noindex` drops canonical, `og:url` and `twitter:url`. The 404 also drops
  `robots` from the object because Next.js adds `noindex` to not-found pages
  itself.
- JSON-LD is not part of the Metadata API: root layouts render it in
  `<head>` through `<Document jsonLd>`. BlogPosting for articles, the
  site's Person otherwise.

### Differences from the Astro markup

Measured against the Astro build on every exported page: the same
`<title>`, meta, link and JSON-LD tags, asset URLs aside. Differences:

- `<head>`: the viewport is written `width=device-width, initial-scale=1`
  (with a space), the generator is `Next.js 16.4.3`, and Next.js orders the
  tags its own way. Post pages get React's
  `<link rel="preload" as="image" fetchpriority="high" imagesrcset=…
  imagesizes=…>` for the cover, because its `<img>` has
  `fetchPriority="high"`.
- Hydrating pages only (`/`): Next.js's scripts and RSC payload, the
  `preconnect`/`next-size-adjust` tags above, and `<body>` starting with
  `<div hidden=""><!--$--><!--/$--></div>`. Keep that in mind for
  `body > :first-child` or `body > *` selectors and tests; static pages do
  not have the div.
- Markup: code blocks carry Shiki's class `shiki github-dark` (Astro renamed
  it `astro-code`); `main` has a class where the scoped Astro styles used a
  `data-astro-cid` (`blog-index`, `blog-post`); React writes some attribute
  names in camelCase in the source (`srcSet`, `dateTime`, `charSet`), which
  HTML treats the same; SVG images have no (redundant) srcset; the 404's
  path script is a classic inline script instead of a module.

## Fonts

All type is self-hosted from committed files: `src/assets/fonts/` holds the
11 woff2 files the Astro Fonts API downloaded from Google Fonts for 98f1fd8,
and two stylesheets carry Astro's `@font-face` rules (same weights, subsets,
`unicode-range`, `font-display: swap`), with plain family names instead of
Astro's hashed ones. Turbopack serves the files from `/_next/static/media/`
under hashed names. next/font is not used: next/font/google fails the build
whenever Google Fonts cannot be reached (an hourly CI build would go red on
a short outage), and next/font/local cannot give one family several
`unicode-range` subsets.

- `src/styles/fonts-desktop.css`: Inter (400-700) and JetBrains Mono (400,
  500, 700), latin and latin-ext, as `--font-inter` and
  `--font-jetbrains-mono` on `:root` (`variables.css` builds `--font-sans`
  and `--font-mono` from them). `<Document>` imports it on every page.
- `src/styles/fonts-website.css`: IBM Plex Sans (latin), IBM Plex Sans Thai
  (thai) and IBM Plex Mono (latin, with Astro's metric-adjusted Courier New
  fallback face), 400-600, as `--font-plex-sans`, `--font-plex-thai`,
  `--font-plex-mono`. Only the root layouts that render website-mode type
  import it (`(home)` and `(garden)`); Turbopack keeps it in their own CSS
  chunk, so other pages carry neither the rules nor the files (verified:
  `/blog/`, posts, the 404 and `/resume/` have no Plex rules).
- No preload anywhere, so browsers download a face only when text uses it:
  website mode never downloads Inter or JetBrains Mono, and a blog page
  fetches exactly the two files the Astro build fetched.
- Builds need no network. To update a font, download the subsets from the
  Google Fonts css2 API (woff2), replace the files and the `unicode-range`
  values, and keep the file names.

## CSS

- `global.css` (which imports the shared files) comes through
  `<Document>`. A feature stylesheet is imported by the component that needs
  it, e.g. `import "@styles/website-mode.css"` in the website-mode component
  and `website-mode.css` plus `garden.css` in the garden layout.
- Astro scoped `<style>` blocks become a plain CSS file next to the
  component, imported by it, with **every selector starting at the
  component's root class** (`.site-header .site-header-nav a`,
  `main.blog-index`, `.blog-post .prose > .title`). That keeps the class
  names the tests and global CSS rely on, and gives about the same
  specificity as Astro's `[data-astro-cid]` attributes. Do not use CSS
  Modules for classes that tests or other stylesheets reference (they rename
  classes).
- **A root-class prefix matches more than Astro's scoping did.** Astro gave
  its `data-astro-cid` only to elements in the component's own template
  (and to child components that spread their attributes onto an element,
  like `<Image>`), never to elements a child component renders itself or to
  rendered Markdown. So a universal, tag or descendant selector from a
  scoped block must name the template's own elements: Astro's
  `ul li *` became `.blog-index ul li :is(a, img, h2, p)`, because it never
  reached the `<time>` that FormattedDate renders. Check the Astro build's
  markup for which elements carried the cid.
- A rule on `body` or `<html>` from a page's `<style>` becomes a class
  through `bodyClassName` (see `body.not-found-page`).
- `browserslist` in package.json is the old `vite.build.cssTarget`. Lightning
  CSS still minifies, so the README rule stands: a `-webkit-` declaration goes
  before its standard property. Verified: `-webkit-backdrop-filter` survives.
- Verified with a computed-style and layout diff of every element against
  the Astro build at 1440 and 390px: no difference on `/blog/`, all five
  posts and the 404. Repeat that comparison for each page you port.

## Parse-time scripts and Cloudflare Rocket Loader

Code that must run while the HTML parses (on `/`: the mode, theme,
preferences and early-input scripts in `<head>` and the icon placement
script; see
[The React desktop](#parse-time-scripts-of-the-desktop)), and the small
behaviours of static pages, is an `<InlineScript code={...} />`
(src/components/InlineScript.tsx):

- It emits `<script data-cfasync="false">` with `code` as written, so
  Cloudflare Rocket Loader leaves it alone. Guard DOMContentLoaded handlers
  with a `window.__pepodev…Ready` flag, as before.
- Write the code as a template string in a `.ts`/`.tsx` module and inject
  build-time values with **`scriptValue(value)`** (exported next to
  `InlineScript`), the replacement for Astro's `define:vars`. Like Astro's
  `stringifyForScript` it escapes `<`, so a `</script>` or `<!--` in a value
  (resume data, Terminal commands, Music titles) cannot end or corrupt the
  script; never inline a bare `JSON.stringify`. See
  `src/components/home/HomeHeadScripts.tsx`, which holds the two `<head>`
  scripts of `/`, ported verbatim.
- Render it from a Server Component only, once per page (React never runs a
  script it renders on the client). `<head>` scripts go through
  `<Document head={...}>`; body scripts sit where the old `is:inline` script
  sat.
- A script that changes `<html>` attributes needs
  `<Document suppressHydrationWarning>` (the `(home)` layout sets it).
  Verified in dev and in the export: with website mode, the light theme and
  a purple accent stored, the attributes are set before `<body>` parses and
  hydration keeps them, with no warning.
- `next/script` is not a replacement: in the App Router even
  `beforeInteractive` runs after the HTML has parsed.
- To share code with client modules instead of copying it, an inline script
  may embed a self-contained function with `${fn.toString()}` (as
  next-themes does): `src/components/desktop/icon-grid.ts` and
  `prefs-core.ts` do. The server bundle is minified and may rename
  module-level names, so such a function may use only its parameters and
  globals, never imports or other module-level names.
- On a hydrating page the RSC payload repeats every Server Component's
  output, inline scripts included (as text that never runs): a test or
  script that searches `document.scripts` for a script's text must skip
  `self.__next_f.push(...)` scripts.

Rocket Loader and Next.js's own scripts: static pages have none. On
hydrating pages postbuild adds `data-cfasync="false"` to every Next.js
`<script>` (all are async or tiny inline pushes), so Rocket Loader cannot
defer hydration past the parse-time scripts, which would widen the window in
which hydration rule 1 below bites. Still to verify once on the deployed
site after the desktop port (see the checklist).

## Client behaviour and hydration

Markup is React Server Components rendered at build time; interactive
behaviour lives in inline scripts (static pages) or client modules
(hydrating pages). React hydrates the whole document under `next dev` and on
`runtime="react"` pages, so the rules below matter for every script that
touches server-rendered DOM. They were measured with a throwaway page in
`next dev` and in the export (React 19.3):

1. **Before hydration** (parse-time `<InlineScript>`): a script may change
   *attributes* of React-rendered elements (`class`, `style`, `hidden`,
   `inert`, `aria-*`, `data-*`) and add event listeners. React keeps them;
   dev logs "attributes of the server rendered HTML didn't match ... This
   won't be patched up" (put `suppressHydrationWarning` on that element to
   silence it). It must **not change text or add, remove or move nodes**
   inside React-rendered elements: React then throws the server DOM away and
   renders the tree again on the client, silently in production, losing
   every change and listener the scripts made. Exception: an element with
   `suppressHydrationWarning` keeps changed text of its own (one level
   deep); the 404 uses that for the requested path
   (`src/app/not-found/NotFoundPath.tsx`).
2. When a parse-time script must change a subtree's *content* (build a
   grid, fill a list), render that subtree as a static island:
   `<div dangerouslySetInnerHTML={{ __html: html }} />` with the HTML made at
   build time. React neither hydrates nor compares inside it, and script
   changes there survive (verified).
3. **After hydration**, client code may change server-rendered DOM freely:
   React re-renders only client components whose state or props change,
   never Server Component output (there is no client-side navigation or
   `router.refresh()` on this site). Never let a client component render DOM
   that a controller mutates.
4. Adding nodes to `<head>` is fine at any time: React 19 skips unexpected
   `<head>` children (`<Prefetch>` adds `<link rel="prefetch">` there).

On a static page these rules matter only under `next dev`, but they must
hold there too, or the page behaves differently in dev and in `out/`.

Client modules on a hydrating page (the desktop works this way; see
[The React desktop](#the-react-desktop)):

- React Strict Mode is on in development: effects run, clean up and run
  again. Effects that start listeners or timers return a cleanup.
- Effects run after hydration, which needs the async Next.js chunks: later
  than Astro's module scripts, possibly after DOMContentLoaded and `load`.
  Never wait for DOMContentLoaded in a client module. Anything a visitor
  must see before that is a parse-time `<InlineScript>`.
- Event names (`desktop:window-open`, `desktop:preferences`, ...), the
  `window.__pepodev…` globals tests read and every storage key stay the
  same.
- A page that renders any client component must be `runtime="react"`;
  postbuild fails the build otherwise. Small behaviours of static pages are
  `<InlineScript>`s (see `Prefetch.tsx` and `NotFoundPath.tsx`), never client
  components.

## The React desktop

`/` renders `src/app/(home)/page.tsx`: a Server Component that loads every
app's build-time data (`loadAppData()`), then renders `<Desktop appData>`
(the `#desktop` panel, a client component tree), the icon placement script,
and `<WebsiteMode />` (the `#website` panel). The `(home)` layout is
`runtime="react"` and renders the four `<head>` scripts (mode, theme,
preferences, early input). Windows, taskbar,
menus, icons and apps are React components rendered from React state; the
old DOM controllers are gone. The Playwright suite drives the same DOM as
before, and a computed-style, layout, attribute and text diff of `#desktop`
against the Astro build (1440 and 390 wide; at load, light theme, Start
menu, tray, palette, About, Work and Projects open) finds no difference.

### Files (src/components/desktop/)

| File | What it is |
| --- | --- |
| `store.ts` | `createStore` (a tiny external store), `useStore(store, selector)` (useSyncExternalStore; server snapshot = initial state, so hydration matches the HTML) and `commit(fn)` (runs state changes inside `flushSync`, so the DOM is current when the caller moves focus or dispatches events). |
| `apps.ts` | The app registry (see below). Plain data, shared by server and client. |
| `window-manager.ts` | Windows: open, minimize, maximize, restore, close, focus, z-order, bounds, drag and resize clamping, phone layout, focus hand-off, Escape, `desktop:open-app`, `desktop:close-all-windows`, the first-visit Welcome window. Port of WindowController. |
| `overlay-state.ts`, `palette.ts` | The Start menu, tray panel and command palette: one open at a time, focus return, inert when closed, palette ranking, Reset Desktop confirmation, Ctrl/Cmd + K. |
| `site-mode.ts` | Site mode: `pepodev.viewMode`, `?blog=` rules, `site:mode-change`, the mode switches (by delegation), focus handover, website scroll restore. |
| `prefs-core.ts`, `prefs.ts` | Desktop preferences: defaults, applying them to `<html>`, saving them, `desktop:preferences`, `desktop:toggle-theme`. |
| `system-audio.ts` | `pepodev.systemAudio` and `desktop:audio-settings` (dispatched on every change, and followed when other scripts dispatch it). |
| `toasts.ts`, `Toasts.tsx` | Toasts and `desktop:show-toast`. |
| `icon-grid.ts`, `icon-layout.ts` | The shared icon grid (pure, also inlined in the placement script) and the icon state after hydration: drag, drop, swap, saved positions. |
| `deep-link.ts` | `?blog=<slug>`: opens and maximizes Blog, keeps the slug pending until the Blog app registers its handler, then asks it to open the slug; "Article not found" toast. |
| `runtime.tsx` | Boots every slice after hydration, replays the input made before the boot, generic `[data-open-app]` launchers, the palette tip, "idle" app mounts; sets `window.__pepodevWindowManagerReady`. |
| `app-keys.ts` | Keys for apps that own the keyboard: the capture-phase listeners behind `useAppKeyboard`, and the keys typed while an app's body loads (replayed once it has rendered). |
| `blog-article.ts` | `loadBlogArticle(id)` / `blogArticleUrl(id)`: the Blog app's article files, `/blog/<id>/article.json`. |
| `Desktop.tsx`, `Window.tsx`, `Taskbar.tsx`, `StartMenu.tsx`, `CommandPalette.tsx` (+ `.css`), `DesktopIcon.tsx` (+ `ExternalLinkIcon.css`), `ParticleBackground.tsx` + `particles.ts`, `AppIcon.tsx`, `ModeSwitch.tsx`, `MonitorIcon.tsx`, `SiteModePanel.tsx` | The components. `ModeSwitch`, `MonitorIcon` and `SiteModePanel` are for website mode too. |
| `app-bodies.tsx`, `app-api.ts`, `AppPlaceholder.tsx` | Lazy app bodies (loading, error and retry states), the API apps use, the stub body. |
| `DesktopScripts.tsx` | The desktop's parse-time scripts (Server Components): preferences, early input, icon placement. |

### State and how it changes

- Each slice is one store with plain action functions next to it (no state
  library). Components read slices with hooks (`useWindow(appId)`,
  `useOpenOverlay()`, `useSiteMode()`, `useDesktopPrefs()`,
  `useSystemAudio()`, `useToasts()`, `useIconState(id)`); DOM event
  listeners, timers and components change them through the actions, which
  `commit()` synchronously when focus or events follow. So the old rules
  carry over line by line ("opening a window from the keyboard focuses it
  before `desktop:window-open`", "closing hands focus to ...").
- Never call `commit()` (or an action that commits) while React renders or
  synchronously from an effect: React cannot flush there. In an effect, use
  `queueMicrotask`. Event handlers and timers are fine; nested calls join
  the outer commit. The app API's `openApp` and `mountApp` defer themselves
  to a microtask, so apps may call them anywhere.
- Components select the smallest slice they render, as primitives where
  they can: a `Window` re-renders on its own `WindowState` (every drag step
  changes its `style`) and on `focused === id`, never on other windows; the
  app body inside it is memoized (`WindowBody`), so drags, resizes and
  raises never re-render apps; a taskbar button reads only `open` and
  "focused"; `useAppWindow()` reads primitives. Measured with a render
  counter on the export: a 20-step drag renders the dragged window 21 times
  and nothing else (it rendered 148 components before), a focus click
  renders the two windows concerned and their taskbar buttons.
- Boot: the stores start in their server state (all windows closed, site
  mode unknown, no preferences), which is what hydration sees. After
  hydration `useDesktopRuntime` (in `Desktop`) boots in a microtask:
  preferences (applied and saved with their defaults, as Settings did on
  load), toasts, overlays, palette, site mode (which dispatches the boot
  `site:mode-change`), icon layout, window manager, launchers, palette tip,
  idle mounts, app keys, system audio, the `?blog=` deep link, then the
  input made before the boot (replayed in order); then it sets
  `window.__pepodevWindowManagerReady = true` (tests and the early-input
  script wait for it).
- DOM-only details stay imperative where React state would only add
  re-renders: a window's transient `tabindex` (keyboard launches),
  `document.body.style.userSelect` during drags, `<html>` attributes and
  variables (preferences, `data-viewport-mode`, `--mobile-taskbar-height`).

### Parse-time scripts of the desktop

`DesktopScripts.tsx`. Before hydration they only set attributes and
styles (hydration rule 1), besides reading storage and adding listeners;
the stores take over with the same code:

- `<head>`: `HomeHeadScripts` (site mode; theme and accent) and
  `DesktopPrefsScript` ("Initialize theme immediately": background, glass,
  radius, effects, by `loadDesktopPrefs` and `applyDesktopPrefs` from
  `prefs-core.ts`). The defaults are Settings' (radius 6, glass 55), so the
  first paint already matches what boot applies (the Astro end-of-body
  script painted 12 and 72 until Settings replaced them).
- `<head>`: `DesktopEarlyInputScript` (`window.__pepodevEarlyInput`). The
  desktop boots after hydration, which needs Next.js's chunks: on a slow
  device (slow 4G, 4x CPU) about 1.8 s after first paint, where the Astro
  desktop took input about 0.8 s after it. Until the boot this script
  takes, in order, clicks on `[data-open-app]` launchers and on the
  taskbar's Start, palette, clock and audio buttons, and Ctrl/Cmd + K
  (calling `preventDefault()` and `stopImmediatePropagation()`, so nothing
  else handles them twice); the boot replays them through the same actions
  (`replayEarlyInput` in `runtime.tsx`), and they count as interaction, so
  the first-visit Welcome window stays closed. A mode switch
  (`[data-site-mode-toggle]`, `[data-site-mode-target]`) applies at once,
  as `chooseSiteMode` would: `<html data-site-mode>`, `pepodev.viewMode`,
  `?blog=` dropped, focus to the other panel's switch, earlier input
  dropped. What is still lost before the boot: other keys (Escape, Tab moves
  focus natively), icon drags (the icon stays where the grid put it), and
  clicks on anything else (nothing else is interactive then; external link
  shortcuts are real links and work). The background canvas also starts at
  hydration, so until then the desktop shows its plain background colour
  (no layout shift; painting a frame earlier would mean inlining the
  particle code).
- After `#desktop`: `DesktopIconScript`, the icon grid from `icon-grid.ts`
  above 768px in desktop mode: removes stale saved positions, places every
  icon (`position: fixed`, `left`, `top`, `right`, `bottom`) and sets
  `data-desktop-icon-ready`, so the icons never show stacked (the "hidden
  until placed" no-CLS rule). It sets `window.__pepodevDesktopIconsReady`.
  Until the boot it also places them again on a resize, and when the
  early-input script switches to the desktop (it dispatches a `resize`),
  so a rotated tablet or a quick mode switch does not leave them misplaced
  or hidden. The icon components carry `suppressHydrationWarning` for these
  attributes, and the icon layer renders the same values after boot.

### Public contract (kept from the Astro desktop)

Tests, apps and the garden frame rely on all of this; change it only with
the tests.

- Markup: `#desktop` / `#website` with `data-site-mode-panel` (neither
  `aria-hidden` in the HTML; after boot the inactive one is `hidden`,
  `inert` and `aria-hidden="true"`), `#bg-canvas`, `#desktop-icons` (app
  icons: `button.desktop-icon[data-open-app][data-default-col]...`),
  `#desktop-links` (`role="group"`, "External shortcuts"; real
  `a.desktop-link-icon#link-<icon>[data-shortcut-index]`),
  `data-desktop-icon-ready`, `#windows-container`, windows
  `section#window-<appId>.window[data-window][data-app-id][data-title]` with
  `role="dialog"`, `aria-labelledby`, `aria-hidden`, `hidden`, `inert`,
  classes `focused`, `minimized`, `maximized`, `opening` (300 ms),
  `closing` (200 ms), `mobile-window`, `.window-titlebar`,
  `.window-title`, `.window-controls` `.min-btn` / `.max-btn` (Maximize ⇄
  Restore in `title` and `aria-label`) / `.close-btn`, `.window-content`
  (`tabindex="0"`, `role="group"`, "<title> content" when it scrolls with
  nothing focusable), `.window-resize-handle[data-resize-direction]`;
  `#taskbar`, `#taskbar-start` (`aria-expanded`, `aria-controls`),
  `#taskbar-command-palette`, `#taskbar-apps` with
  `button.taskbar-app.active(.focused)[data-app-id][title]` (named by its
  label span), `#taskbar-site-mode`, `#taskbar-audio-status` ("Audio
  settings", `title` Muted / Audio on, `.muted`), `#taskbar-clock-button`,
  `#tray-panel(.visible)` with `#calendar-*`, `#audio-mute`,
  `#audio-volume`, `#audio-volume-value`; `#start-menu(.visible)`
  (`role="dialog"`, `tabindex="-1"`), `#start-menu-search`,
  `.start-menu-app[data-open-app]` (hidden ones `display: none`),
  `#start-menu-empty` (`role="status"`); `#command-palette`
  (`data-visible`, `aria-modal`), `#command-palette-input`,
  `.command-palette-item[data-type][data-id]` (`.selected`, `.confirming`;
  hidden ones `display: none`), `#command-palette-matches`,
  `.command-palette-section(-title)`, `#command-palette-status`
  (`data-tone`); `#toast-container` (`aria-live`) with
  `.toast(.toast-show|.toast-hide) .toast-icon .toast-message .toast-close`.
- Events on `document` (in = the desktop listens, out = it dispatches):
  `desktop:open-app` `{ appId }` (in; every launcher dispatches it),
  `desktop:close-all-windows` (in), `desktop:open-command-palette` (in),
  `desktop:toggle-theme` (in), `desktop:show-toast` `{ message, duration }`
  (in; plain text now, not HTML), `desktop:overlay-open` `{ id }` (in and
  out), `desktop:preferences` (out, `detail` = the preferences),
  `desktop:audio-settings` `{ volume, muted }` (out on every change; in:
  one another script dispatches updates the store and the tray, without
  being saved or dispatched again; tests dispatch it), `site:mode-change`
  `{ mode }` (out). On the window element (out): `desktop:window-open`
  `{ appId, firstOpen }`, `desktop:window-focus` `{ appId, keyboard }`,
  `desktop:window-close` `{ appId }` (before it closes). The Music app's
  `desktop:music-settings` / `desktop:music-audio-frame` are the apps'.
- Globals: `window.__pepodevWindowManagerReady` (boot done),
  `window.__pepodevDesktopIconsReady` (placement script ran),
  `window.__pepodevEarlyInput` (input made before the boot, replayed by
  it), `window.__pepoMusicController.requestAudioFrame()` (the Music app
  provides it; the background calls it every frame).
  `__pepodevBlogOpenSlug` (use `useDeepLinkHandler`),
  `__pepodevDesktopIconGrid`, `__pepodevParticlesReady` and
  `__pepodevExternalLinkIconsReady` are gone (nothing reads them).
- Storage keys and timings as in README: Welcome after 1.5 s on a first
  visit (`pepodev.hasVisited`), the palette tip 3 s after load in desktop
  mode above 768px at most every 7 days (`pepodev.commandPaletteHintShown`),
  closing itself after 8 s; other toasts 5 s; Reset Desktop reloads after
  500 ms.
- Keyboard: Ctrl/Cmd + K (any case) toggles the palette in desktop mode;
  Escape goes to the open overlay first, then closes the active window.
  Order of the key listeners: app handlers (`useAppKeyboard`, capture phase
  on `document`, so an overlay closing on this key still counts as open and
  the app ignores it), then React's handlers and the overlays and palette
  (`document`, bubble phase), then the window manager's Escape on `window`,
  which skips a key someone called `preventDefault()` on. The garden frame
  forwards Escape and Ctrl/Cmd + K by dispatching a `keydown` on the parent
  `document`, which reaches all of them.
- After a click or tap on a taskbar window button, the button gives up DOM
  focus (the Astro taskbar rebuilt its buttons, which dropped it), so the
  focused window gets the keys and Enter does not press the button again;
  from the keyboard, focus stays on it or follows into the window.

### The app registry (src/components/desktop/apps.ts)

`APPS` lists the 16 apps in window order (the taskbar order): `id`,
`title` (dialog name; the taskbar label is the part before "-"), `label`
(icon, Start menu and palette name), default `width` / `height`,
`startDescription`, `paletteDescription`, `icon` (default grid cell:
`col`, `row`, optional `group` / `index`) and `mount`. `DESKTOP_ICON_ORDER`
is the icon order. Each app's body is `src/components/apps/<Name>App.tsx`,
loaded with `React.lazy` from `app-bodies.tsx` into its own chunk, with a
small "Loading…" state and an error state. A failed download (Turbopack
already retries a chunk once) shows "This app could not load" with a "Try
again" button; the window's next launch also tries again (each try is a
new `lazy()`, since React keeps a rejected import). A body mounts on its
window's first launch and stays mounted when the window closes; `mount:
"idle"` bodies (Music, SRE Game) mount hidden once the desktop is idle in
desktop mode, because Settings drives Music, the background asks Music for
levels, and tests read the SRE game's text before opening it. An app track
may change the `mount` field of its own entry, and nothing else in
`apps.ts`.

| id | Body | id | Body |
| --- | --- | --- | --- |
| `welcome` | `WelcomeApp` | `music` | `MusicPlayerApp` |
| `blog` | `BlogApp` | `whitenoise` | `WhiteNoiseApp` |
| `garden` | `GardenApp` | `calculator` | `CalculatorApp` |
| `project` | `ProjectsApp` (ported) | `settings` | `SettingsApp` |
| `work` | `WorkApp` (ported) | `terminal` | `TerminalApp` |
| `me` | `AboutApp` (ported) | `certs` | `CertificationsWalletApp` |
| `sregame` | `SreGameApp` | `gallery` | `GalleryApp` |
| `snake` | `SnakeApp` | `trash` | `TrashBinApp` |

### App contract

An app track replaces `src/components/apps/<Name>App.tsx` and
`<Name>App.data.ts` (both stubs today) and adds the app's own CSS file if
it has scoped styles; it does not edit the desktop core (see
[who edits what](#parallel-tracks-who-edits-what)). If an app needs
something the contract lacks, change the core in one reviewed place and
document it here.

- **Body**: `"use client"`, `export default function <Name>App({ appId,
  data }: AppProps<"<id>">)`. It renders inside `.window-content`; its root
  is what the Astro component's root was (usually
  `<div class="app-content ...">`). Keep the Astro markup, classes and
  `data-*` attributes the tests and global CSS use. Never import other apps'
  bodies or anything large into it statically. The body is memoized on
  `(appId, data)`: it re-renders only from its own state and the hooks
  below, never because its window moved, resized or was raised.
- **Data**: `<Name>App.data.ts` default-exports an async loader that runs on
  the server at build time and returns JSON-serializable data (no Dates,
  functions or React elements); its return type becomes `data`'s type
  (`AppDataMap`). Compute build-time values there (experience years, music
  discovery, post lists). Keep it compact: it is inlined in the page for
  every visitor. Small static JSON (social links, skills) may be imported
  in the body instead.
- **Blog articles**: never in `data`. `BlogApp.data.ts` returns list
  metadata only (id, title, date, tags, language, description). Each
  post's body is a static file next to its page,
  `/blog/<id>/article.json` = `{ id, html }`, written at build time by
  `src/app/(post)/blog/[slug]/article.json/route.ts` with the post page's
  pipeline (`renderHtml` in `src/lib/content.ts`: Shiki, heading ids,
  build-time WebP srcsets; MDX too). `html` is what the post page renders
  in `.prose` after its title block, and what `BlogApp.astro` rendered in
  `.blog-reader-body`. In the app, `loadBlogArticle(id)` (app API) fetches
  it once per page (a failed fetch is retried on the next call) and the
  reader renders it with `dangerouslySetInnerHTML` (trusted, build-time
  HTML); show a loading line while it arrives. `blog.spec.ts` checks every
  file against its post page, and postbuild fails the build when a post has
  no file or the file references a missing image. Works the same under
  `next dev` (the route handler answers there). The Blog track adds no
  route.
- **Window state**: `useAppWindow()` gives `open`, `minimized`,
  `maximized`, `focused` (it has `.focused`: it gets app keys), `visible`
  (open, not minimized, desktop mode) and `focusRequest`, as one object
  that keeps its identity while they do not change (safe as an effect
  dependency). It does not change on drags, resizes or z-order. Do not
  listen for `desktop:window-*` events.
- **Focus on open and relaunch**: `focusRequest` (`{ seq, keyboard }`) is
  bumped on every launch (new window, restore, launch of an open one, from
  any launcher) and every hand-off of focus into the window, after the
  window manager moved focus. `useFocusOnLaunch(ref)` implements the README
  rule (Terminal, Gallery): focus `ref` on each launch, on touch screens only
  when `keyboard` is true. Every first launch is a late mount (the chunk
  loads after the window opened): the body then takes focus only if nothing
  took it since the launch, that is if focus is still on `<body>`, on the
  window, or where the launch left it (the icon that was clicked, which
  Chromium focuses and Safari does not); the window manager records that
  element (`getLaunchFocus`). A body mounted before its first launch
  (`mount: "idle"`) treats that launch as a normal one. Verified with a
  throwaway Terminal: the first click on its icon, a second click, a Start
  menu launch and an Enter on the icon all focus the input (with or without
  a 600 ms chunk delay); a first tap at 390px touch does not.
- **Stopping on close and in website mode**: react to state, e.g.
  `const { open } = useAppWindow(); const mode = useSiteMode();
  useEffect(() => { if (!open || mode !== "desktop") stop(); }, [open, mode]);`.
  Reset per-visit state the same way (the Blog list on close).
- **Preferences and audio**: `useDesktopPrefs()` (null before boot),
  `updateDesktopPrefs(change)` (a new theme gets its default background
  unless the change names one), `toggleTheme()`; `useSystemAudio()`,
  `setSystemAudio(change)`. `useSystemAudio()` is the one source of truth:
  it also follows `desktop:audio-settings` events other scripts dispatch
  (desktop.spec's White Noise test mutes that way), so Music, White Noise,
  Snake and the SRE game read it instead of listening for the event.
  Settings renders from `useDesktopPrefs()` and calls these; it no longer
  owns `desktop:toggle-theme`. `resetDesktop(ms)` clears every `pepodev.*`
  key and reloads (Settings uses 200 ms).
- **Keyboard ownership** (Calculator, Snake): `useAppKeyboard(handler)`
  calls `handler` only for keys that belong to the app
  (`isAppKeyboardEvent` in `src/utils/app-keyboard.ts`: window focused in
  desktop mode, no overlay open, no Ctrl, Meta or Alt (AltGr allowed), not
  aimed at a form field or at a focused button's own Enter/Space; the
  app's own launcher, which keeps focus after a pointer open, hands its
  keys over). It listens in the capture phase on `document`, before every
  desktop listener (see Public contract), as the Astro apps' listeners ran
  before the overlays': the Escape or Enter that closes the palette or the
  Start menu never reaches the app (so Calculator does not clear its
  expression when the visitor only closes the palette). Call
  `preventDefault()` on the keys the app uses; the window manager then
  leaves an Escape alone, so to reset on Escape while the window closes,
  react to `open`. Keys typed after the window opened but before the body
  rendered (its chunk loading) are kept and replayed to the handler once
  it has (`app-keys.ts`), so typing right after a click is not lost;
  register the handler on the body's first render. Use the hook rather
  than your own `keydown` listener. Snake can poll `hasAppKeyboard(appId)`
  / `isAppKeyboardOwner(element)` to pause. `useAppWindowElement()`
  returns the window element for app-keyboard.ts and DOM queries.
- **Other desktop actions**: `openApp(appId)` (like any launcher; Terminal's
  `projects`, Welcome's buttons), `showToast(message, { duration, icon })`,
  `mountApp(appId)` (mount another app's body without opening its window:
  Settings can make sure Music's controller exists before it drives the
  music, since the idle mount may not have happened yet when a visitor is
  quick). `openApp` and `mountApp` run in a microtask, so they are safe in
  effects and ref callbacks (the window or body appears before the current
  task ends); dispatching `desktop:open-app` yourself from an effect is
  not. `[data-open-app]` elements anywhere outside the desktop icons
  launch their app on click.
- **Deep links** (Blog): `useDeepLinkHandler((slug) => boolean)`. For
  `?blog=<slug>` the desktop opens and maximizes Blog at the boot and keeps
  the slug pending until the handler registers (when the Blog chunk has
  loaded and the body mounted, however long that takes; there is no time
  limit), then calls it in a microtask; `false` shows "Article not found".
  The handler opens the article with focus on Back (load its file then), or
  focuses the first list item when the slug is unknown. Choosing website
  mode or closing the Blog window first drops the pending link.
- **Garden**: the frame forwards `mousedown`, `click` and `focusin` to its
  `<iframe>` element, which bubble to the window (React handlers included),
  and keys as above. To let drags pass over the frame, listen for
  `mousedown` on the window's title bar and handles through
  `useAppWindowElement()`.
- **Gotchas**: a frame loop that tests count by name (Music's
  `tickVisualizer`, the background's `draw`) must keep its name through
  minification: `Object.defineProperty(fn, "name", { value: "draw" })`
  (`particles.ts`). Range inputs that tests fill (`fill()` sets `value` and
  dispatches `input`) may bypass React's change detection; listen with a
  native `input` listener (`AudioControls` in `Taskbar.tsx`). Inline
  `style={{ display: "none" }}` serializes as `display:none` on the server
  and `display: none;` after an update; compare `element.style.display`.
  Text that mixes literals and values should be one template string, so it
  is one text node and lays out exactly as the Astro text did.

### Website mode contract

`src/components/WebsiteMode.tsx` is a Server Component placeholder. The
website track replaces its content and keeps: the `SiteModePanel` wrapper
(`#website`, `.website-shell`, `data-site-mode-panel="website"`), a
`<header>` with `<ModeSwitch variant="website" />`, any one-way
`button[data-site-mode-target="desktop"]`, and the
`import "@styles/website-mode.css"` (which also hides the inactive panel
before hydration). Mode switching, focus handover, `?blog=` removal and
scroll restore are site-mode's (and the early-input script's before the
boot); the panel needs no client code for them. `BrandMark` (the "P" mark,
`<BrandMark size={26} />` and `size={44}`) is ported in
`src/components/BrandMark.tsx`; the placeholder already uses it in its
brand link. Interactive bits (the Bangkok clock, copy e-mail) are small
client components or delegated listeners. Its markup is repeated in the
RSC payload, so keep it lean.

### Adding an app

Add it to `APP_IDS`, `APPS` and `DESKTOP_ICON_ORDER` (apps.ts), a line in
`app-bodies.tsx` and in `apps/app-data.ts`, its icon in `AppIcon.tsx`, and
the two files in `src/components/apps/`.

### Parallel tracks: who edits what

The apps, website-mode and resume/garden tracks work at the same time.
Each edits only its own files; anything else is a core change, made in one
reviewed place and documented here.

| Track | Edits | Must not edit |
| --- | --- | --- |
| Apps | `src/components/apps/<Name>App.tsx` and `<Name>App.data.ts` of its apps, a new `<Name>App.css` next to them, the `mount` field of its own entries in `desktop/apps.ts`; deletes the ported `.astro` sources, `ContactIcon.astro` when unused, and `desktop/AppPlaceholder.tsx` with the last stub | the rest of `src/components/desktop/`, `src/app/`, `src/lib/`, `website-mode.css`, `garden.css` |
| Website mode | `src/components/WebsiteMode.tsx` (and new `src/components/website/*` files it needs), `src/styles/website-mode.css` (it owns this file); deletes `WebsiteMode.astro` | `desktop/`, `BrandMark.tsx` (shared; change it only through the core), `garden.css` |
| Resume and garden | `src/app/(resume)/`, `src/app/(garden)/`, `src/components/garden/`, `src/styles/garden.css`, `src/layouts/GardenLayout.astro` (to delete); deletes `src/astro-legacy/` files it ports | `website-mode.css` (the garden imports it as is; garden-only rules go in `garden.css`), `BrandMark.tsx`, `desktop/` |

Shared tests: each track edits only the tests listed for it in the
[checklist](#checklist-still-to-port); `helpers.ts` is the core's.

## Content layer (replacing astro:content)

`src/lib/content.ts`:

```ts
getCollection("blog" | "garden", filter?)  // entries in file-path order
getEntry(collection, id)
render(entry)  // { Content, headings }
renderHtml(entry)  // the same body as an HTML string (Blog article files)
type CollectionEntry<"blog">               // { id, collection, filePath, body, data }
```

- Collections: `src/content/blog/**/*.{md,mdx}` and
  `src/content/garden/**/*.md`; dotfiles are skipped, a missing folder is an
  empty collection (the garden is gitignored until `pnpm garden:sync`).
- Ids are exactly the Astro glob loader's: each path segment through
  github-slugger, extension dropped, a trailing `/index` removed, or a
  frontmatter `slug`. "AWS Graviton ทักครับ.md" is `aws-graviton-ทักครับ`.
  Two entries with one id fail the build.
- Frontmatter: YAML parsed with the same `yaml` options as Astro (timestamps
  become dates), validated with zod schemas equal to the old
  `content.config.ts`. A garden note without `dg-publish: true` fails the
  build. `heroImage` and `cover-picture` resolve to an `ImageAsset` (the
  counterpart of `ImageMetadata`); a missing file fails the build.
- Use `src/utils/blog.ts` (`getPublishedPosts`, `getPostDescription`,
  `getPostHeroImage`, `getPostLanguage`) and `src/utils/garden.ts` (same
  exports as before) instead of `getCollection`.
- `<Content />` is a Server Component. For Markdown it returns the
  document's elements without a wrapper (`.prose > p` matches, as with
  Astro). For MDX it accepts a `components` map. `headings` lists
  `{ depth, slug, text }`.
- `renderHtml(entry)` gives the same body as an HTML string, for files
  written at build time (route handlers cannot render React: `react-dom/
  server` is not available to them). Markdown keeps Sätteri's HTML (the
  string `<Content />` is made from); MDX is evaluated with a JSX runtime
  that builds hast, serialized with Shiki's `hastToHtml`
  (hast-util-to-html), with React-style props and style objects mapped as
  React writes them. `data.spec.ts` checks that an MDX document (export,
  JSX with a style object, expression, code block) renders to the same
  markup both ways. Components passed to MDX are not supported there.
- `next dev` reloads entries whose files changed on the next request.

### Markdown and MDX (src/lib/markdown.ts)

Sätteri (`satteri@0.10.5`, the parser `pnpm garden:sync` uses) renders both
with the pipeline Astro ran: GFM, `smartPunctuation: false` (so `--flags`
and straight quotes match Obsidian), Shiki `github-dark` code blocks,
github-slugger heading ids, and local images swapped for build-time WebP
srcsets. Markdown goes through `markdownToHtml` and becomes React elements
(`htmlToHast` + `hast-util-to-jsx-runtime`); MDX goes through Sätteri's
`evaluate`. MDX `import` statements are not supported (no module
resolution); pass components through `<Content components={...} />`.
Verified with a throwaway `.mdx` post (JSX, expressions, exports, image,
code block, RSS and sitemap entries) and by the `data.spec.ts` test "the
content layer loads and renders MDX posts".

## Images (src/lib/images.ts)

- `loadImage(path)` / `resolveImage(fromFile, src)` give an `ImageAsset`
  and fail the build when the file is missing or unreadable.
- `getResponsiveImage(asset, { width?, height?, sizes? })` and the
  `<ResponsiveImage image width height sizes alt loading fetchPriority />`
  Server Component follow Astro's `layout: "constrained"`: `src` at the
  display width, a srcset of 1x, 2x and the breakpoints 640/960/1280/1920 up
  to the source width (never upscaled), `sizes` defaulting to
  `(min-width: Wpx) Wpx, 100vw`, `loading="lazy"`, `decoding="async"`.
  `width` with `height` crops to that ratio (cover, centred), like
  `<Image width height>`. `fetchPriority="high"` also makes React add an
  image preload to `<head>`.
- `getSocialImage(asset)`: one JPEG at most 1200px wide.
- Markdown images (`![alt](../../assets/blog/x.png)`, and garden
  attachments in `src/assets/garden/`) go through the same code. Alt text,
  title and classes are kept. Remote and `/`-rooted URLs are left alone.
- Files are written by sharp (the same calls as Astro, so most variants are
  byte-identical to the Astro build) into `public/_img/` as
  `<name>.<w>x<h>.<hash>.webp`, at render time, once per build; `next build`
  exports them to `out/_img/` and `scripts/postbuild.mjs` checks that every
  referenced file exists. URLs are `/_img/...` instead of `/_astro/...`.
- SVGs are copied once and get no srcset.

## Dynamic routes

- **Non-ASCII params.** `next dev` with `output: "export"` compares the
  request's percent-encoded path with the raw values from
  `generateStaticParams` and rejects Thai ids. Wrap static params in
  `staticParams()` and read them with `decodeParam()`
  (`src/lib/static-params.ts`): the build writes raw directory names
  (`out/blog/aws-graviton-ทักครับ/index.html`, as before) and dev also accepts
  the encoded form. Set `dynamicParams = false` on these routes. Under
  `next dev`, an unknown id answers 404 and the terminal logs "missing param
  ... in generateStaticParams()"; that log is expected.
- **A dynamic route must never be empty.** With `output: "export"`, Next.js
  fails the build when `generateStaticParams` returns `[]`. The garden is
  empty in every checkout and CI run without synced notes, so the garden is
  one optional catch-all route, `src/app/(garden)/garden/[[...slug]]/`,
  whose list always starts with the home (`{ slug: [] }`, `/garden/`),
  followed by each note (`{ slug: note.id.split("/") }`). No sentinel pages,
  nothing for postbuild to delete. Keep that shape when porting: render the
  home or the note from the same `page.tsx` (two components are fine), and
  move the `(garden)` root layout into `garden/[[...slug]]/layout.tsx` if
  notes need their own JSON-LD in `<head>` (a layout there gets `params`,
  like the post layout). Verified: with no `src/content/garden` the build
  exports `/garden/` only; with notes (including Thai paths) it exports each
  note, `next dev` serves them (encoded or not) and 404s unknown ones.

## Sitemap, RSS, 404, prefetch

- `src/lib/sitemap.ts` lists every page for `sitemap-0.xml` (sorted, as
  `@astrojs/sitemap` listed them, garden notes included). Add new routes
  there; postbuild fails the build when the sitemap and the exported pages
  differ in either direction. `robots.txt` still points to
  `sitemap-index.xml`.
- `rss.xml/route.ts` writes what `@astrojs/rss` wrote; item links and guids
  stay `https://pepo.dev/?blog=<encoded id>`.
- The 404 is `src/app/global-not-found.tsx` (experimental `globalNotFound`,
  needed because there is no single root layout). It renders `<Document>`
  itself, so import any styles it needs there. It is a static page; the
  requested path is written by an inline script after `</main>`, as on the
  Astro site.
- `<Prefetch>` (an `<InlineScript>`, so static pages keep it) ports Astro's
  `prefetchAll` + viewport strategy: a same-origin link in view for 300ms
  gets `<link rel="prefetch">`; only taps prefetch on slow or data-saving
  connections; `data-prefetch="false"` opts a link out.

## Tests

- `playwright.config.ts`: dev server `pnpm dev --hostname 127.0.0.1 --port
  4323`; `PLAYWRIGHT_SERVER=preview` runs `pnpm preview` with the same flags.
  `PLAYWRIGHT_CHANNEL`, `forbidOnly`, retries and the reporters are
  unchanged. `global-setup.ts` now loads one page of each kind so `next dev`
  compiles them before the first test.
- Changed tests: `data.spec.ts` replaces "Astro config registers the MDX
  integration" with "the content layer loads and renders MDX posts" (loads a
  temporary `.mdx` file through `getCollection("blog")`, checks the id,
  frontmatter, an export, a JSX element, an expression and heading ids).
  `desktop.spec.ts` and `media.spec.ts` got type-only fixes so `pnpm check`
  (which now type-checks the tests) passes. No assertion was weakened.
- Changed with the desktop core (the intent of each test kept):
  - `helpers.ts`: `holdScripts` (held module scripts, as Rocket Loader
    did) is replaced by `holdChunks(page)`, which holds the Next.js chunks
    requested from then on (`held()`, `hold()`, `release()`): before a
    reload it holds hydration, so only parse-time scripts run; after the
    boot it holds an app body's chunk.
  - `windows.spec.ts` "scripts that must run while the page parses opt out
    of Rocket Loader": the markers are now the parse-time scripts that exist
    (mode, theme, "Initialize theme immediately", the early-input script,
    the icon placement); the window manager and the background are part of
    the hydrated desktop, so with `PLAYWRIGHT_SERVER=preview` it also checks
    that every `<script>` in the served HTML (Next.js's included) carries
    `data-cfasync="false"`.
  - `windows.spec.ts` "website mode reaches assistive tech before the
    desktop hydrates" (was "... before its deferred scripts run"): it holds
    hydration (`holdChunks`), checks the panel the `<head>` script picked is
    shown and reachable, then releases it.
  - `website.spec.ts` "the saved theme and accent apply before the
    end-of-body scripts": it drops the preferences script and holds
    hydration, so the theme and accent it checks can only come from the
    `<head>` theme script (the preferences store applies the same values
    after the boot, which the old check could not tell apart); its check
    that the preferences script was removed skips the RSC payload, which
    repeats the script's text without running it.
  - `desktop.spec.ts` "a first visit from a ?blog= link opens only the
    article, even when the Blog app loads late" (was "... the link script
    runs late"): it holds the Blog app's chunk (the one with its markup)
    past the Welcome timer instead of the old deep-link script.
  - `apps.spec.ts` "apps opened before their code has loaded still start"
    (was "... before their scripts run ..."): it holds the app chunks after
    the boot (`holdChunks`) instead of two module scripts, opens the SRE
    game and, from the keyboard, Gallery (which shows "Loading…"), then
    expects Gallery's password focused and the SRE boot log once released.
    Final form; it fails until Gallery and the SRE game are ported.
  - `blog.spec.ts` "the desktop Blog reader gets the same alt text and
    image link names": the reader's content is now each post's
    `article.json`, so it checks the files' alt text and link names instead
    of inlined `.blog-reader-body` markup. New: "every post's article file
    has the body its page renders" (tags, ids, text, image `src`, `srcset`,
    `alt` and links of every element, against the post page's `.prose`).
  - `data.spec.ts` "the content layer loads and renders MDX posts" also
    renders the document with `renderHtml` (the article files) and expects
    the same markup as React's (a style object and a Shiki code block were
    added to the sample).
  - `keyboard.spec.ts` "an open command palette keeps keys from the app
    behind it" now types into Calculator before opening the palette and
    expects the expression to survive the Escape that closes it, then to
    take more digits (typed right after the window opened, so it also
    covers keys typed while the body loads). New: "an app restored or
    raised from the taskbar with the pointer gets the keys" (Calculator).
    Both fail until Calculator is ported; they passed with a throwaway
    Calculator.
  - New in `windows.spec.ts`: "clicks and keys made before the desktop
    hydrates are not lost" (holds hydration: an icon click and Ctrl+K are
    replayed in order, the Start button too, and the mode switch applies at
    once both ways, moves focus and persists; switching to the desktop and
    resizing before the boot leave its icons placed above the taskbar) and "a taskbar button pressed with the
    pointer leaves the keys to the windows" (raise, minimize and restore by
    pointer leave the button unfocused and Enter alone; from the keyboard,
    focus follows into the window).
- Fast local run against the export: build, then
  `PLAYWRIGHT_SERVER=preview npx playwright test -c <config>` with a config
  that serves `out/` with `scripts/serve-static.mjs` (the CI setup).
- Status after the desktop core's correction round (export, bundled
  Chromium, 233 tests): 106 passed, 120 failed, 7 skipped (garden, without
  synced notes). Every test that does not need a stubbed app, website mode,
  the resume or the garden passes: `desktop` 16 of 29, `windows` 22 of 27,
  `overlays` 13 of 15, `icons` 16 of 17, `keyboard` 1 of 17; `blog` 18 of
  20, `pages` 6 of 6, `data` 2 of 7 (as after the foundation, plus the
  website-mode half of the fonts test); `website` 8 of 23, `apps` 3 of 38,
  `media` 1 of 19, `resume` 0 of 8. Under `next dev` the desktop, windows,
  overlays, icons, keyboard, blog, pages and data specs fail the same 44
  tests as the export. (Two dev runs showed more: `icons` "a desktop
  resize re-clamps icons without saving positions" resized before the
  slower dev boot, which the placement script now handles; `pages` "pages
  self-host Inter and JetBrains Mono ..." sometimes sees Inter loaded by
  Next's dev overlay in website mode, also on the code before this round,
  never in the export.) The two Music tests also fail in this container
  because its Chromium has no AAC codec. The failing tests and the track that makes
  each pass are in the [checklist](#checklist-still-to-port).
- Contract checks with throwaway apps (Calculator, Snake status, Terminal
  with `useFocusOnLaunch` and a key log, an idle-mounted SRE game with
  `useFocusOnLaunch`, Blog with `useDeepLinkHandler` and
  `loadBlogArticle`), put back to stubs afterwards: the four shell specs
  pass every test those apps cover (the palette and Calculator keyboard
  tests, AltGr, Enter on a Calculator key, pointer close, the taskbar
  test, the `?blog=` tests); the first pointer launch focuses Terminal's
  input with or without a 600 ms chunk delay; the Escape or Enter that
  closes an overlay never reaches the app; a 20-step drag renders the app
  0 times; keys typed during an 800 ms chunk delay reach Calculator
  ("12+3" Enter gives 15); a `?blog=` link whose Blog chunk takes 6.5 s
  still opens the article (from its `article.json`) with focus on Back;
  a chunk that fails twice shows the error state, and both "Try again" and
  a relaunch load the app.

## CI (.github/workflows/deploy.yaml)

`build` now runs explicit steps (checkout, pnpm/action-setup, setup-node 24
with the pnpm cache, `pnpm install --frozen-lockfile`, garden notes
download, `pnpm build`, `actions/upload-pages-artifact@v5` with `out/`)
instead of `withastro/action`. The garden job (vault key only there,
`--ignore-scripts`, sync only), the test job (now unpacks the artifact into
`out/`), the deploy job, the concurrency group and the hourly schedule are
unchanged. The build contacts no font host, so a Google Fonts outage cannot
fail it.

## Measured against the Astro build (98f1fd8)

- Routes: the same 15 (all pages, 404, RSS, both sitemaps, robots.txt,
  manifest). `rss.xml`, `sitemap-0.xml`, `sitemap-index.xml`, `robots.txt`,
  `manifest.webmanifest` and the icons are byte-identical.
- Post directories keep their raw Thai names.
- Head tags: identical apart from the differences listed under Metadata.
- Computed styles and layout of every element: identical on the blog index,
  every post and the 404 at 1440 and 390px.
- Fonts: the same 11 files; a blog page downloads the same two.
- Weight, HTML raw / gzipped KB, Astro vs Next.js (static pages, no external
  JavaScript; Astro loaded 1.1 KB gzipped of module script on each, Next.js
  inlines the 2.3 KB prefetch script): `/blog/` 17.9 / 3.8 vs 9.9 / 3.2;
  `aws-graviton-ทักครับ` 43.5 / 10.9 vs 37.1 / 10.6; `aws-local-zone-bangkok-launch`
  29.1 / 7.4 vs 23.1 / 7.0; 404 12.7 / 2.9 vs 6.2 / 2.2 (Astro inlined its
  scoped CSS and `@font-face` rules in every page; Next.js keeps them in
  cached stylesheets). Stylesheets gzipped per post: 13.6 vs 14.9 KB.
- Extra files: Next.js's runtime chunks in `out/_next/static/chunks/`
  (`/` loads them). The `_img` images total 5.8 MB against 7.2 MB of
  `_astro` images (Astro wrote duplicate copies).
- `/` (desktop core): see the table under Page runtime. Head tags as listed
  under Metadata (plus the `preconnect` and `next-size-adjust` tags of
  hydrating pages). The `#desktop` shell's computed styles, layout,
  attributes, classes and text match the Astro build at 1440 and 390px in
  every state checked (The React desktop).

## Checklist (still to port)

Each open item names the track that owns it and the tests that pass once
it is done (`spec:line` in the current files; 120 fail today, all listed).
A test listed under two tracks needs both.

- [x] Decide the desktop runtime: a React desktop (Page runtime).
- [x] **Desktop core** (`src/app/(home)/page.tsx`, `src/components/desktop/`):
  windows, taskbar, Start menu, command palette, icons and link shortcuts,
  background, toasts, site mode (the bundled half of SiteModeController),
  preferences, system audio, Welcome timer, palette tip, `?blog=` handling,
  input before the boot, the app registry and contract, the About, Work and
  Projects apps, the Blog article files and `BrandMark.tsx`. The replaced
  `.astro` files (desktop/*, SiteModeController, ModeSwitch, MonitorIcon,
  BrandMark, About/Work/Projects, `astro-legacy/pages/index.astro`) are
  deleted.
- [ ] **Apps** (apps track): replace the 13 stubs in `src/components/apps/`
  (Blog, Certs wallet, Garden, Welcome, SRE game, Snake, Gallery, Music,
  White Noise, Calculator, Trash, Terminal, Settings) with ports of their
  `.astro` sources, per the [app contract](#app-contract), each with its
  `.data.ts`; delete each `.astro` source once ported, `ContactIcon.astro`
  if nothing needs it, and `desktop/AppPlaceholder.tsx` with the last stub.
  The Blog app lists metadata from its `.data.ts`, loads each article with
  `loadBlogArticle` into `.blog-reader-body`, opens links in a new tab, and
  handles `?blog=` with `useDeepLinkHandler`. Tests that pass once the apps
  are ported:
  - `apps.spec.ts`: 134 (Snake on phones, x4), 195, 233, 250, 281 (Snake),
    215, 705, 757, 814 (SRE game), 300, 329, 384, 405 (Calculator), 432
    (Gallery), 461, 477, 525 (Terminal and Gallery focus), 554 (SRE game
    boot log), 566 (Gallery and SRE game opened before their code loaded),
    585 (Terminal), 596 (Trash), 623, 646 x2 (Welcome), 835 (Certs), 867
    (the SRE half; the About half passes), 885 x2 (Calculator, Snake, SRE
    game, Trash contrast), 967 x2 (Certs, Gallery contrast), 1006 x2 (Blog,
    Welcome and Terminal; About, Work and Projects pass it when checked
    alone).
  - `keyboard.spec.ts`: all 16 failing (22, 47, 63, 89, 137, 171, 198,
    234, 258, 285, 305, 335, 349, 368, 395, 405: Calculator, Snake,
    Terminal, Gallery); 305 also needs website mode (its page must be tall
    enough to scroll).
  - `media.spec.ts`: 143, 166, 214, 237, 259, 287, 299 (Music), 335, 364,
    380 (White Noise), 421, 455,
    478, 514 (Blog reader), 529 (Settings), 686 x3 (Music, White Noise and
    Settings contrast).
  - `desktop.spec.ts`: 346 and 426 (Blog), 641 (Calculator), 659 (Snake),
    680 (Settings), 738 and 796 (Music; they also fail locally without
    AAC), 840 (Terminal), 865 (Gallery), 887 (Certs), 932 (White Noise).
  - `windows.spec.ts`: 211 and 715 (Blog), 244 (Calculator), 423
    (Gallery); `overlays.spec.ts`: 346 (Terminal), 589 (Blog list; its
    toast and maximize parts are the core's and passed with a throwaway
    Blog); `icons.spec.ts`: 334 (Settings' Reset all settings; the palette
    half passes); `resume.spec.ts`: 153 and 190 (the desktop Certs wallet);
    `website.spec.ts`: 273 (Settings, with website mode); `blog.spec.ts`:
    479 (with website mode).
- [ ] **Website mode** (website track): `WebsiteMode.astro` into
  `src/components/WebsiteMode.tsx` per the
  [website mode contract](#website-mode-contract), using `BrandMark`.
  Tests that pass once it is ported: `desktop.spec.ts` 119;
  `windows.spec.ts` 691 (needs the panel taller than 2000px; the scroll
  restore itself was checked with stand-in content); `blog.spec.ts` 451,
  479 (with the Blog app); `data.spec.ts` 38 (with the resume), 64, 101,
  159, 191; `website.spec.ts` 273 (with Settings), 312, 404 (reads website
  mode's `data-as-of`; the Work app half is ported), 420, 464 x3, 484,
  492, 514, 538, 591, 626, 636, 652; `keyboard.spec.ts` 305 (with Snake).
- [ ] **Resume** (resume/garden track; `src/astro-legacy/pages/resume.astro`
  to `src/app/(resume)/resume/page.tsx`): page markup, scoped styles, the
  PDF download script (`resumePdfData` through `scriptValue()`); set the
  `(resume)` runtime to match (an `<InlineScript>` keeps it static). The
  layout already sets `class="resume-document"`. Tests that pass once it
  is ported: `resume.spec.ts` 41, 95, 106, 117, 231, 263;
  `desktop.spec.ts` 633 (the PDF download); `data.spec.ts` 38 (with
  website mode).
- [ ] **Garden** (resume/garden track; `src/astro-legacy/pages/garden/`,
  `src/layouts/GardenLayout.astro`, `components/garden/GardenTree.astro`):
  replace the placeholder in `garden/[[...slug]]/page.tsx` (keep the home
  entry in `generateStaticParams`), the theme/embed `<head>` script as
  `<InlineScript>` in the garden layout (add `suppressHydrationWarning`),
  article JSON-LD for notes (layout in the catch-all segment, see Dynamic
  routes), `website-mode.css` (imported as is) and `garden.css`,
  `BrandMark`, the iframe embedding behaviour (it forwards events to the
  desktop as described under the app contract). Build once with an empty
  `src/content/garden` and once with synced notes. No test fails today
  (`garden.spec.ts` skips itself without synced notes); run it with synced
  notes.
- [ ] Run the computed-style diff and the full suite for each ported page
  (the desktop shell's diff is done; repeat it with each app open, and for
  website mode).
- [ ] Delete `src/astro-legacy/`, the remaining `.astro` files, and
  `src/layouts/` (and the `@layouts/*` alias) if nothing uses them.
- [ ] Verify on pepo.dev with Rocket Loader on: parse-time scripts run
  before first paint, hydration is not deferred.
- [ ] Rewrite README.md for Next.js: Setup table (`pnpm astro`, `dist/`,
  background dev servers), Project Map, Development Rules (`is:inline` to
  `<InlineScript>`, `define:vars` to `scriptValue()`, scoped styles to
  root-class CSS files, the Fonts API to the committed fonts (the "Google
  Fonts unreachable" note no longer applies), `vite.build.cssTarget` to
  `browserslist`, the markdown-satteri version pin, the page runtime rule,
  the controller and `is:inline` rules to the React desktop and the app
  contract, overlay rules to `overlay-state.ts`), Deployment
  (`withastro/action`). Fold the durable parts of this file into it, then
  delete MIGRATION.md.
