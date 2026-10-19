# PePoDev | Personal Website

An Astro-based static personal website (portfolio, engineering blog, and
digital garden) with two presentation modes: an interactive desktop and a
conventional responsive website. The desktop includes draggable windows,
shortcuts, a command palette, work and project content, Markdown/MDX posts, a
digital garden synced from Obsidian, a resume page with PDF download, music,
tools, and games.

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
| `pnpm garden:sync` | Sync published garden notes from the vault in `GARDEN_VAULT` (or `--vault <path>`) |
| `pnpm test:garden` | Run the garden sync privacy and link checks |
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
| `src/pages/resume.astro` | Standalone HTML resume page with PDF download |
| `src/pages/rss.xml.js` | RSS feed |
| `src/content/blog/` | Markdown/MDX posts; standard and Obsidian frontmatter |
| `scripts/sync-garden.mjs` | Obsidian vault to garden sync; the privacy boundary for vault content |
| `src/content/garden/`, `src/assets/garden/` | Synced garden notes and attachments; gitignored, never edit |
| `src/pages/garden/`, `src/layouts/GardenLayout.astro` | Garden home and note routes |
| `src/components/garden/`, `src/styles/garden.css` | Garden note tree and page styles |
| `docs/superpowers/plans/2026-10-19-garden-obsidian-sync.md` | Garden sync design and one-time setup |
| `src/assets/blog/` | Local post images |
| `src/data/` | Portfolio JSON and build-time music discovery |
| `src/types/`, `src/utils/` | Data types and reusable logic |
| `src/styles/global.css` | Shared desktop and app styles |
| `src/styles/website-mode.css` | Website-mode styles (`ws-*` classes) |
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
- Website mode is dark by default and follows the Settings theme
  (`data-theme="light"` on `<html>`) and accent. Size its text in `rem` and set
  its breakpoints in `em`, so it follows the browser's text size. Rows that
  run edge to edge inside a panel or scroller use inset focus rings, which
  the panel cannot clip.
- Website mode uses IBM Plex Sans, Sans Thai, and Mono from the Fonts API
  Google provider (`astro.config.mjs`). Astro downloads them at build time; if
  Google Fonts is unreachable, the build still passes with fallback fonts, so
  re-run the deploy.

### Content and Apps

- Store portfolio content in `src/data/`; update `src/types/data.ts` for schema
  changes and extract reusable logic to `src/utils/`.
- Years of experience, company count, tenure, and the career-uptime strip are
  computed at build time by `src/utils/experience.ts` from each
  `experiences.json` period (`"May 2020 - June 2022"` or
  `"February 2024 - Present"`); do not hard-code them. Education lives in
  `education.json`. A project's optional `summary` in `projects.json` is the
  website-mode copy; it falls back to `description`.
- Store posts in `src/content/blog/` using `src/content.config.ts`. Reference
  prefixed local images from `src/assets/blog/`; builds optimize them to WebP.
  `cover-picture` and `heroImage` are validated as images, so they must be
  relative paths to existing files.
- Every post needs `title` and `pubDate` frontmatter next to its Obsidian
  fields. List posts through `src/utils/blog.ts`, not `getCollection("blog")`,
  so drafts, sort order, and fallbacks match everywhere. Post ids, URLs, and RSS
  links come from file names; do not change them.
- Markdown renders without smart punctuation (`markdown.processor` in
  `astro.config.mjs`), so `--flags` and straight quotes match Obsidian. Keep
  `@astrojs/markdown-satteri` and `satteri` at the versions Astro depends on.
- `image.layout: "constrained"` in `astro.config.mjs` gives Markdown and
  `<Image>` output a srcset. Every article is also rendered in
  `dist/index.html`, so check its size after adding breakpoints or many images.
- Put audio in `public/music/`; `src/data/music.ts` discovers it at build time.
  Verify playback in a real browser.
- Regenerate `public/og-image.png` with
  `node scripts/generate-og-image.mjs`.
- The digital garden comes only from `pnpm garden:sync`. It publishes vault
  notes with `dg-publish: true` (except `Blog/`), turns links to unpublished
  notes into plain text, drops comments and frontmatter, and copies only
  embedded attachments. Code is found with `satteri`, the parser Astro renders
  with, and every note is re-parsed before writing: a note that would publish
  a comment, a raw wikilink, or a vault path is skipped with a warning. Never commit vault content or log unpublished note
  names; keep `pnpm test:garden` passing when changing the sync. Garden URLs
  are `/garden/<slugified vault path>/`; list notes through
  `src/utils/garden.ts`.
- The desktop Garden app frames `/garden/` instead of inlining notes into
  `dist/index.html`. Inside the frame, `GardenLayout.astro` hides the site
  header and forwards window focus, `Escape`, and `Ctrl`/`Cmd` + `K` to the
  desktop.
- Register new apps in `src/pages/index.astro`, `StartMenu.astro`,
  `CommandPalette.astro`, and `AppIcon.astro`.
- The resume remains a standalone `/resume` page; do not restore
  `ResumeApp.astro`. It renders as HTML from `experiences.json`,
  `skills.json`, `education.json`, and `certifications.json`, and Download PDF
  builds the PDF from the same data. Never auto-download, close the window, or
  navigate away.

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
  `src/data/certifications.json` and `src/utils/certifications.ts`. Expired
  ones read as earned history: "Earned <Month YYYY>" with a muted "Expired
  <Month YYYY>" and no badge. The resume lists "<name>, earned <YYYY>".
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
5. Confirm affected `/`, `/blog/`, `/garden/`, and `/rss.xml` routes build for content
   changes, and blog pages scroll without sideways overflow at phone width.

## Deployment and Git

GitHub Pages deploys `main` through `.github/workflows/deploy.yaml` using
`withastro/action` and `actions/deploy-pages`. It also runs hourly, which keeps
the computed experience values current and picks up newly published garden
notes, and on demand. When the `VAULT_DEPLOY_KEY` secret (a read-only deploy key
on `PePoDev/obsidian-vault`) is set, a separate `garden` job checks out only the
vault's Markdown and attachments, runs the sync, and passes the published notes
to the build job as an artifact. That job installs packages with
`--ignore-scripts` and runs nothing but the sync; keep the key out of any job
that builds or runs package scripts.

Preserve existing worktree changes, avoid destructive Git commands unless
explicitly requested, and do not commit generated artifacts unless tracked.
