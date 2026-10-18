# PePoDev | Desktop Portfolio

An Astro-based static portfolio and engineering blog with two presentation
modes: an interactive desktop and a conventional responsive website. The
desktop includes draggable windows, shortcuts, a command palette, work and
project content, Markdown/MDX posts, a resume generator, music, tools, and
games.

Keep it **static-first**: render content at build time and use small client
scripts only for desktop, window, media, and app interactions.

## Setup

Requires Node `>=22.22.0` and `pnpm`.

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the development server |
| `pnpm build` | Build the static site into `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm test:e2e` | Run Playwright tests |
| `pnpm test:e2e:ui` | Run Playwright in UI mode |
| `pnpm astro --help` | Show Astro CLI help |

Run commands from the repository root. Use `pnpm build` after code changes and
`pnpm test:e2e` after desktop, window, or app interaction changes.

When Astro detects an AI agent (except on Windows), `pnpm dev` and
`pnpm preview` start a background server and return. Manage it with `pnpm astro dev status`, `logs`,
or `stop` (or `pnpm astro preview ...`), or add `--ignore-lock` to run in the
foreground. Playwright starts its own dev server with `--ignore-lock`.

## Project Map

| Path | Purpose |
| --- | --- |
| `src/pages/index.astro` | Main desktop entry |
| `src/components/WebsiteMode.astro` | Normal responsive portfolio shell |
| `src/components/SiteModeController.astro` | Persisted desktop/website mode coordination |
| `src/components/desktop/` | Windows, icons, taskbar, menus, and command palette |
| `src/components/apps/` | Server-rendered desktop app bodies |
| `src/pages/blog/` | Static blog index and post routes |
| `src/pages/resume.astro` | Standalone PDF resume download page |
| `src/pages/rss.xml.js` | RSS feed |
| `src/content/blog/` | Markdown/MDX posts; standard and Obsidian frontmatter |
| `src/assets/blog/` | Local post images |
| `src/data/` | Portfolio JSON and build-time music discovery |
| `src/types/`, `src/utils/` | Data types and reusable logic |
| `src/styles/global.css` | Shared desktop and app styles |
| `public/music/` | Local audio library |
| `tests/e2e/*.spec.ts` | Playwright coverage, one spec per area |
| `scripts/generate-og-image.mjs` | Default Open Graph image generator |
| `.deployment-config.md` | Security headers and caching guidance |
| `dist/` | Generated build output; never edit directly |

## Development Rules

- Prefer Astro components and server-rendered HTML over JavaScript-generated
  markup. Keep client code scoped to interactions.
- Use existing desktop classes, CSS variables, and TypeScript aliases:
  `@/*`, `@components/*`, `@data/*`, `@utils/*`, `@app-types/*`,
  `@layouts/*`, and `@styles/*`. Never use `@types/*`.
- Define site metadata in `src/consts.ts`, not `.env`.
- Avoid broad shared-component refactors and do not recreate
  `src/content/apps.ts`.
- `Window.astro` renders app windows; `WindowController.astro` manages them.
  Prefer bundled `<script>` tags; use `is:inline` only for global coordination,
  `define:vars`, or immediate setup.
- Astro emits an `is:inline` script once per component instance. Keep scripts
  for repeated components (windows, desktop icons, link shortcuts) in a
  `*Controller.astro` rendered once in `src/pages/index.astro`.
- Preserve keyboard access, stable `global.css` selectors, command-palette
  stacking, and case-insensitive `Ctrl`/`Cmd` + `K`.
- Explicit `display` rules on hidden panels require a `[hidden]` override.
- `base.css` locks only `html[data-site-mode="desktop"]` to one screen; every
  other page must scroll.
- Markdown article styles are global in `src/styles/blog.css`: `.prose` on post
  pages, `.blog-reader-body` in the desktop reader. Scoped component styles do
  not reach Markdown rendered through `<slot />` or `<Content />`.
- List a new desktop overlay in both `isEscapeOwnedByOverlay`
  (`WindowController.astro`) and `isDesktopOverlayOpen`
  (`src/utils/app-keyboard.ts`).
- Put a `-webkit-` declaration before its standard property. CSS minification
  drops a standard property followed by its prefixed twin, and keeps prefixes
  only for browsers in `vite.build.cssTarget` (`astro.config.mjs`).

### Content and Apps

- Store portfolio content in `src/data/`; update `src/types/data.ts` for schema
  changes and extract reusable logic to `src/utils/`.
- Store posts in `src/content/blog/` using `src/content.config.ts`. Reference
  prefixed local images from `src/assets/blog/`; builds optimize them to WebP.
  `cover-picture` and `heroImage` are validated as images, so they must be
  relative paths to existing files.
- Every post needs `title` and `pubDate` frontmatter next to its Obsidian
  fields. List posts through `src/utils/blog.ts`, not `getCollection("blog")`,
  so drafts, sort order, and fallbacks match everywhere. Post ids, URLs, and RSS
  links come from file names; do not change them.
- `image.layout: "constrained"` in `astro.config.mjs` gives Markdown and
  `<Image>` output a srcset. Every article is also rendered in
  `dist/index.html`, so check its size after adding breakpoints or many images.
- Put audio in `public/music/`; `src/data/music.ts` discovers it at build time.
  Verify playback in a real browser.
- Regenerate `public/og-image.png` with
  `node scripts/generate-og-image.mjs`.
- Register new apps in `src/pages/index.astro`, `StartMenu.astro`,
  `CommandPalette.astro`, and `AppIcon.astro`.
- The resume remains a standalone `/resume` page; do not restore
  `ResumeApp.astro`.

### Interaction Invariants

- App and external shortcut icons share one grid in
  `DesktopIconController.astro`: saved positions first, then app defaults,
  then links down the right edge (Webring first), each taking the nearest free
  cell. Dropping an icon on an occupied cell swaps the two icons.
- Only a drag saves an icon position. Resizes re-clamp in memory, and layout
  waits while the desktop is hidden.
- `Escape` closes the focused window after overlays handle it. Closing or
  minimizing the focused window hands focus to the topmost remaining one, and
  tabbing into a window focuses it.
- Calculator and Snake take keys only while their window is focused in desktop
  mode with no overlay open and no Ctrl, Meta, or Alt (AltGr is allowed). Form
  fields and controls outside the window keep their keys, and Snake pauses
  whenever it loses the keyboard. The shared guard is
  `src/utils/app-keyboard.ts`.
- Storage keys are `pepodev.desktopPrefs`, `pepodev.music`,
  `pepodev.systemAudio`, `pepodev.desktopIcon.v3.<appId>`, and
  `pepodev.linkIcon.v4.<link id>`. Older icon key versions are removed on
  load; bump the version to discard saved layouts.
- `pepodev.viewMode` stores `desktop` or `website`; first visits default to
  desktop, while a non-empty `?blog=` deep link temporarily opens desktop mode
  without overwriting the saved preference.
- The media element, not persisted `pepodev.music.playing`, is authoritative.
- Gallery password is intentionally the literal `password`.
- Certifications sort as Active (at least 90 days remaining), Expiring Soon,
  then Expired; badges refresh hourly. Data and sorting live in
  `src/data/certifications.json` and `src/utils/certifications.ts`.
- White Noise intentionally has no rain animation.
- Hide the command-palette tutorial toast at widths `<=768px`; otherwise show
  it on first visit or every seven days.

## Verification

For substantial changes:

1. Run `pnpm build`.
2. Run `pnpm test:e2e` for desktop/app interactions.
3. Check `dist/index.html` after page composition or app content changes.
4. Manually test window opening, minimizing, maximizing, closing, dragging, and
   taskbar behavior when interaction code changes.
5. Confirm affected `/`, `/blog/`, and `/rss.xml` routes build for content
   changes, and blog pages scroll without sideways overflow at phone width.

## Deployment and Git

GitHub Pages deploys `main` through `.github/workflows/deploy.yaml` using
`withastro/action` and `actions/deploy-pages`.

Preserve existing worktree changes, avoid destructive Git commands unless
explicitly requested, and do not commit generated artifacts unless tracked.
