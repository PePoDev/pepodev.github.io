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
- Placeholders that say they are being ported: `/`, `/resume/`, `/garden/`
  and every synced garden note (`/garden/<id>/`), so the export already has
  every URL the sitemap lists.
- Static preview server, Playwright config, CI workflow.

Still Astro: see the [checklist](#checklist-still-to-port) at the end.

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
| `src/app/(home)/` | Root layout and page of `/` (desktop and website mode). Placeholder page for now. |
| `src/app/(blog)/blog/` | Blog index; `blog-index.css` is its scoped stylesheet. |
| `src/app/(post)/blog/[slug]/` | Post pages. The root layout sits in the dynamic segment so `<html lang>` is the post's language. `post-data.ts` is shared by the layout and the page. |
| `src/app/(resume)/resume/` | Resume. Placeholder page for now. |
| `src/app/(garden)/garden/[[...slug]]/` | Garden home (`/garden/`) and notes (`/garden/<id>/`) in one optional catch-all route. Placeholder page for now; see Dynamic routes. |
| `src/app/global-not-found.tsx`, `src/app/not-found/` | The branded 404, exported as `out/404.html`. |
| `src/app/rss.xml/`, `src/app/sitemap-index.xml/`, `src/app/sitemap-0.xml/` | Static route handlers (`dynamic = "force-static"`), written to `out/` as files. |
| `src/lib/` | Framework plumbing: `content.ts`, `markdown.ts`, `images.ts`, `head.ts`, `static-params.ts`, `sitemap.ts`, `xml.ts`. Alias `@lib/*`. |
| `src/components/` | React components (`.tsx`), plus the `.astro` files still to port. `Document.tsx`, `InlineScript.tsx`, `JsonLd.tsx`, `ResponsiveImage.tsx`, `FormattedDate.tsx`, `SiteHeader.tsx`, `Prefetch.tsx`, `home/HomeHeadScripts.tsx` are done. |
| `src/styles/fonts-desktop.css`, `src/styles/fonts-website.css` | `@font-face` rules and `--font-*` variables; `src/assets/fonts/` holds the 11 committed woff2 files. |
| `src/astro-legacy/pages/` | The Astro routes not ported yet (`index.astro`, `resume.astro`, `garden/`). They were moved out of `src/pages/`, which Next.js treats as the Pages Router. Delete each file once ported. |
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

Current state: every page is `runtime="none"` (blog index, posts, 404, and
the placeholders for `/`, `/resume/` and `/garden/`).

Measured (blog index, Next.js 16.4.3): static, 9.9 KB of HTML and no
external JavaScript; the same page as `runtime="react"` with one small
client component, about 30 KB of HTML plus about 132 KB gzipped of
JavaScript.

**Decision for the owner before porting the desktop.** The desktop's
`index.html` is 404 KB raw (86.6 KB gzipped) in the Astro build, mostly
every blog article inlined in the Blog app, and Astro loaded 8.4 KB gzipped
of JavaScript for it.

- *A. Hydrating desktop* (the plan below, and the one the computed task
  describes): `(home)` becomes `runtime="react"`, the bundled controllers are
  client modules started from one `<DesktopRuntime />` client component.
  Expect roughly 800 KB raw HTML (the RSC payload repeats the markup, about
  doubling the gzipped size too) and about 132 KB gzipped of framework
  JavaScript on top of the controllers.
- *B. Static desktop*: `(home)` stays `runtime="none"`; React renders the
  markup at build time only, and the controllers (today Astro-bundled
  TypeScript) are bundled by a small extra build step (for example esbuild
  into `public/` with hashed names) and loaded as module scripts. Weight
  stays at the Astro level; costs a second bundler and a convention for
  loading those scripts.

Pick one before the desktop port starts; the rest of this file assumes A
where it matters, and the foundation supports both.

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
- Hydrating pages only (none yet): Next.js's scripts and RSC payload, the
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

Code that must run while the HTML parses (README: the mode and theme scripts
in `<head>`, the preferences/particle script, the window, icon and link
controllers), and the small behaviours of static pages, is an
`<InlineScript code={...} />` (src/components/InlineScript.tsx):

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

Porting the desktop's bundled `<script>` controllers (WindowController and
friends), option A above: turn each into a client-side TypeScript module
that exports a start function, and start them all from **one** client
component (e.g. `<DesktopRuntime />`, `"use client"`) rendered once in the
`(home)` page, in a `useEffect`, and set the `(home)` layout to
`runtime="react"`. Keep the DOM-controller style; do not rewrite the desktop
into React state. Notes:

- React Strict Mode is on in development: effects run, clean up and run
  again. Make start functions idempotent (a module-level flag) or return a
  cleanup.
- Effects run after hydration, which needs the async Next.js chunks: later
  than Astro's module scripts, possibly after DOMContentLoaded and `load`.
  Code that waited for DOMContentLoaded must also handle
  `document.readyState === "complete"`. The parse-time controllers stay
  parse-time (`<InlineScript>`).
- Event names (`desktop:window-open`, `desktop:preferences`, ...), the
  `window.__pepodev…` globals and every storage key stay the same.
- A page that renders any client component must be `runtime="react"`;
  postbuild fails the build otherwise. Small behaviours of static pages are
  `<InlineScript>`s (see `Prefetch.tsx` and `NotFoundPath.tsx`), never client
  components.

## Content layer (replacing astro:content)

`src/lib/content.ts`:

```ts
getCollection("blog" | "garden", filter?)  // entries in file-path order
getEntry(collection, id)
render(entry)  // { Content, headings }
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
- Status after the foundation: `blog.spec.ts`, `pages.spec.ts` and
  `data.spec.ts` give 23 passed, 9 failed, both against `next dev` and
  against the export. The full suite against the export: 24 passed, 198
  failed, 7 skipped.
  - Pass: `blog.spec.ts` 16 of 19 (every standalone blog, post and RSS
    test), `pages.spec.ts` 5 of 6 (404, its layout, robots, manifest,
    favicons), `data.spec.ts` 2 of 7 (MDX, project copy), and the
    `website.spec.ts` test that the saved theme and accent apply before the
    end-of-body scripts (the ported `<head>` scripts).
  - Fail until `/` is ported: all of `apps`, `desktop`, `icons`,
    `keyboard`, `media`, `overlays`, `windows`, the rest of `website`, the
    three desktop/website tests in `blog.spec.ts`, five in `data.spec.ts`,
    and the website-mode half of the fonts test in `pages.spec.ts` (its
    desktop half passes).
  - Fail until `/resume/` is ported: all 8 of `resume.spec.ts`.
  - `garden.spec.ts` skips itself without synced notes (7 tests).
  - The two music tests also fail in Playwright's bundled Chromium (no
    AAC), as before.

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
- Extra files: Next.js's runtime chunks stay in `out/_next/static/chunks/`
  (about 570 KB) although no page loads them yet. The `_img` images total
  5.8 MB against 7.2 MB of `_astro` images (Astro wrote duplicate copies).

## Checklist (still to port)

- [ ] **Decide the desktop runtime** (A or B under Page runtime) before
  porting it.
- [ ] **Desktop** (`src/astro-legacy/pages/index.astro` to
  `src/app/(home)/page.tsx`): `components/desktop/*.astro` (Window,
  WindowController, DesktopIcon and DesktopIconController, ExternalLinkIcon
  and ExternalLinkIconController, Taskbar, StartMenu, CommandPalette,
  AppIcon); the 16 apps in `components/apps/*.astro` (About, Blog, Work,
  Projects, Certs wallet, Garden, Welcome, SRE game, Snake, Gallery, Music,
  White Noise, Calculator, Trash, Terminal, Settings, plus ContactIcon); the
  end-of-body preferences/particle script and the controllers as
  `<InlineScript>`s with `scriptValue()` for every `define:vars` value; the
  bundled scripts per the chosen runtime (option A: client modules started
  from one client component, and `runtime="react"` on `(home)`).
- [ ] **SiteModeController**: its `<head>` script is ported
  (`HomeHeadScripts.tsx`); port the bundled part (panels, switches,
  `site:mode-change`, `?blog=` handling).
- [ ] **Website mode**: `WebsiteMode.astro`, `ModeSwitch.astro`,
  `MonitorIcon.astro`, `BrandMark.astro`; import `website-mode.css` there.
- [ ] **Blog app**: render each post with `render(post)` / `<Content />` in
  `.blog-reader-body`; links open in a new tab; `?blog=` deep links.
- [ ] **Resume** (`src/astro-legacy/pages/resume.astro` to
  `src/app/(resume)/resume/page.tsx`): page markup, scoped styles, the PDF
  download script (`resumePdfData` through `scriptValue()`); set the
  `(resume)` runtime to match (an `<InlineScript>` keeps it static). The
  layout already sets `class="resume-document"`.
- [ ] **Garden** (`src/astro-legacy/pages/garden/`,
  `src/layouts/GardenLayout.astro`, `components/garden/GardenTree.astro`):
  replace the placeholder in `garden/[[...slug]]/page.tsx` (keep the home
  entry in `generateStaticParams`), the theme/embed `<head>` script as
  `<InlineScript>` in the garden layout (add `suppressHydrationWarning`),
  article JSON-LD for notes (layout in the catch-all segment, see Dynamic
  routes), `website-mode.css` and `garden.css`, the iframe embedding
  behaviour. Build once with an empty `src/content/garden` and once with
  synced notes.
- [ ] Run the computed-style diff and the full suite for each ported page.
- [ ] Delete `src/astro-legacy/`, the remaining `.astro` files, and
  `src/layouts/` (and the `@layouts/*` alias) if nothing uses them.
- [ ] Verify on pepo.dev with Rocket Loader on, after the desktop port:
  parse-time scripts run before first paint, hydration (if any) is not
  deferred.
- [ ] Rewrite README.md for Next.js: Setup table (`pnpm astro`, `dist/`,
  background dev servers), Project Map, Development Rules (`is:inline` to
  `<InlineScript>`, `define:vars` to `scriptValue()`, scoped styles to
  root-class CSS files, the Fonts API to the committed fonts (the "Google
  Fonts unreachable" note no longer applies), `vite.build.cssTarget` to
  `browserslist`, the markdown-satteri version pin, the page runtime rule),
  Deployment (`withastro/action`). Fold the durable parts of this file into
  it, then delete MIGRATION.md.
