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

Requires Node `>=22.22.0` and pnpm 10.33 (pinned by `packageManager` in
`package.json`; `corepack enable` selects it).

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
foreground. Playwright starts its own server with `--ignore-lock`.

`pnpm test:e2e` tests the dev server in Playwright's bundled Chromium, which
cannot play the AAC music, so the two music tests fail locally. CI sets
`PLAYWRIGHT_SERVER=preview` (serve the built `dist/`; run `pnpm build` first)
and `PLAYWRIGHT_CHANNEL=chrome` (installed Google Chrome); set both to
reproduce CI. In CI, `test.only` fails the run and tests get two retries, so
check the report for flaky tests.

## Project Map

| Path | Purpose |
| --- | --- |
| `src/pages/index.astro` | Main desktop entry |
| `src/components/WebsiteMode.astro` | Normal responsive portfolio shell |
| `src/components/SiteModeController.astro` | Persisted desktop/website mode coordination |
| `src/components/desktop/` | Windows, icons, taskbar, menus, and command palette |
| `src/components/apps/` | Server-rendered desktop app bodies |
| `src/components/SiteHeader.astro` | Header (home, Blog, RSS) for the blog index, posts, and 404 |
| `src/pages/blog/` | Static blog index and post routes |
| `src/pages/resume.astro` | Standalone HTML resume page with PDF download |
| `src/pages/404.astro` | Branded 404; GitHub Pages serves `dist/404.html` for unknown paths, so its URLs must be root-relative |
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
| `public/robots.txt`, `public/manifest.webmanifest` | Sitemap pointer and web app manifest (icons: `favicon.svg`, `icon-192.png`, `icon-512.png`) |
| `tests/e2e/*.spec.ts` | Playwright coverage, one spec per area; `data.spec.ts` checks rules the portfolio JSON must keep, not its current values |
| `scripts/generate-og-image.mjs` | Default Open Graph image generator |
| `.github/workflows/deploy.yaml` | Build, Playwright test gate, and GitHub Pages deploy |
| `dist/` | Generated build output; never edit directly |

## Development Rules

- Prefer Astro components and server-rendered HTML over JavaScript-generated
  markup. Keep client code scoped to interactions.
- Use existing desktop classes, CSS variables, and TypeScript aliases:
  `@/*`, `@components/*`, `@data/*`, `@utils/*`, `@app-types/*`,
  `@layouts/*`, and `@styles/*`. Never use `@types/*`.
- Define site metadata in `src/consts.ts`, not `.env`.
  `public/manifest.webmanifest` repeats `SITE_TITLE` and `SITE_DESCRIPTION`,
  and `public/robots.txt` repeats `SITE_URL`; update them together
  (`pages.spec.ts` checks this).
- Avoid broad shared-component refactors and do not recreate
  `src/content/apps.ts`.
- `Window.astro` renders app windows; `WindowController.astro` manages them.
  Prefer bundled `<script>` tags; use `is:inline` only for global coordination,
  `define:vars`, or immediate setup.
- Astro emits an `is:inline` script once per component instance. Keep scripts
  for repeated components (windows, desktop icons, link shortcuts) in a
  `*Controller.astro` rendered once in `src/pages/index.astro`.
- Cloudflare Rocket Loader defers scripts on pepo.dev. `is:inline` scripts that
  must run while the page parses carry `data-cfasync="false"`: the mode and
  theme scripts in `<head>`, the preferences/particle script, and the window,
  icon, and link controllers. Give new parse-time scripts the same attribute,
  and guard their DOMContentLoaded handlers with a `window.__pepodev…Ready`
  flag, since Rocket Loader can replay the event.
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
  (`src/utils/app-keyboard.ts`), and close it on
  `desktop:command-palette-open`.
- Put a `-webkit-` declaration before its standard property. CSS minification
  drops a standard property followed by its prefixed twin, and keeps prefixes
  only for browsers in `vite.build.cssTarget` (`astro.config.mjs`).
- Keep text at WCAG AA in both themes and focus rings at 3:1. `--accent-cyan`
  is pale in both themes, so light-theme app text uses `--text-primary` or
  `--text-secondary` (Music, White Noise, and Settings use `--app-accent-text`)
  and keeps the accent for borders and tints. Surfaces that stay dark in both
  themes (the Snake board, the SRE game) redefine the `--text-*` variables
  locally.
- Honor `prefers-reduced-motion`: the desktop background paints one still
  frame, and window, icon, app, and website-mode animations stop.
- Website mode is dark by default and follows the Settings theme
  (`data-theme="light"` on `<html>`) and accent. Size its text in `rem` and set
  its breakpoints in `em`, so it follows the browser's text size. Rows that
  run edge to edge inside a panel or scroller use inset focus rings, which
  the panel cannot clip.
- All type comes from the Fonts API Google provider (`astro.config.mjs`):
  Inter and JetBrains Mono (`--font-sans`, `--font-mono`) for the desktop,
  blog, and resume, without preload so website mode never downloads them;
  IBM Plex Sans, Sans Thai, and Mono for website mode. Never load fonts from
  Google at runtime (no CSS `@import`). Astro downloads them at build time; if
  Google Fonts is unreachable, the build still passes with fallback fonts, so
  re-run the deploy.
- pnpm `overrides` in `pnpm-workspace.yaml` pin patched versions of vulnerable
  build-time packages; keep `pnpm audit` clean and drop an override once
  Astro's own ranges exclude the bad versions.

### Content and Apps

- Store portfolio content in `src/data/`; update `src/types/data.ts` for schema
  changes and extract reusable logic to `src/utils/`.
- Years of experience, company count, tenure, and the career-uptime strip are
  computed at build time by `src/utils/experience.ts` from each
  `experiences.json` period (`"May 2020 - June 2022"` or
  `"February 2024 - Present"`); do not hard-code them. The About role and bio
  and the SRE game's hire screen use `experiences.json[0].role`, the Terminal
  `skills` command prints `skills.json`, and the Projects heading counts
  `projects.json`. Education lives in `education.json`.
- In `projects.json`, `name` and `github` follow the repository's current name,
  every `link` is https, and `archived` and `stars` mirror GitHub; a repo
  archived on GitHub is not shown as Active. A project's optional `summary` is
  the website-mode copy; it falls back to `description`.
- Store posts in `src/content/blog/` using `src/content.config.ts`. Reference
  prefixed local images from `src/assets/blog/`; builds optimize them to WebP.
  `cover-picture` and `heroImage` are validated as images, so they must be
  relative paths to existing files.
- Every post needs `title` and `pubDate` frontmatter next to its Obsidian
  fields. List posts through `src/utils/blog.ts`, not `getCollection("blog")`,
  so drafts, sort order, and fallbacks match everywhere. Post ids, URLs, and RSS
  links come from file names; do not change them.
- Give every content image alt text that says what it shows, in the post's
  language; a linked image's alt names the link target. Leave alt empty only
  for decorative images.
- Post pages and the desktop reader take `lang` (and post pages `og:locale`)
  from `getPostLanguage()`. Post pages also get `article:published_time` and
  BlogPosting JSON-LD through BaseHead, and an `og:image` JPEG at most 1200px
  wide. The blog index and RSS channel use `BLOG_TITLE` and
  `BLOG_DESCRIPTION`. Pages with BaseHead's `noindex` (the 404) get no
  canonical or `og:url`.
- Markdown renders without smart punctuation (`markdown.processor` in
  `astro.config.mjs`), so `--flags` and straight quotes match Obsidian. Keep
  `@astrojs/markdown-satteri` and `satteri` at the versions Astro depends on.
- `image.layout: "constrained"` in `astro.config.mjs` gives Markdown and
  `<Image>` output a srcset. Every article is also rendered in
  `dist/index.html`, so check its size after adding breakpoints or many images.
- Put audio in `public/music/`; `src/data/music.ts` discovers it at build time.
  Verify playback in a real browser.
- Regenerate `public/og-image.png` with
  `node scripts/generate-og-image.mjs`. `favicon.ico` holds only 16, 32, and
  48 px and is declared with `sizes="32x32"` before `favicon.svg`, so Chromium
  uses the SVG; regenerate `icon-192.png` and `icon-512.png` from `favicon.svg`
  when the mark changes.
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
- The resume remains a standalone `/resume/` page (GitHub Pages redirects
  `/resume`, so link with the slash); do not restore `ResumeApp.astro`. It
  renders as HTML from `experiences.json`, `skills.json`, `education.json`, and
  `certifications.json`, and Download PDF builds the PDF from the same data,
  measuring text with Helvetica AFM widths and adding `/Info` metadata and
  link annotations. Never auto-download, close the window, or navigate away.

### Interaction Invariants

- App and external shortcut icons share one grid in
  `DesktopIconController.astro`: saved positions first, then app defaults,
  then links down the right edge (Webring first), each taking the nearest free
  cell. Dropping an icon on an occupied cell swaps the two icons. Above 768px,
  when scripts run, icons stay hidden until placed (`data-desktop-icon-ready`),
  so the first layout does not shift.
- Only a drag saves an icon position. Resizes re-clamp in memory, and layout
  waits while the desktop is hidden.
- Windows are non-modal dialogs (`role="dialog"`) labelled by their title.
  `Escape` closes the focused window after overlays handle it. Opening a
  window from the keyboard focuses it before `desktop:window-open`, so an app
  can move focus on to its own control. Closing or minimizing the focused
  window hands `.focused` to the topmost remaining one; after a pointer close,
  DOM focus is dropped so the next app gets the keys, and from the keyboard
  focus returns to the window's launcher if still shown, else into the topmost
  window, else to the app's icon. Tabbing into a window focuses it. Minimized
  and closed windows are `inert` and `aria-hidden`.
- Dragging keeps a window's title bar above the taskbar with at least 120px of
  it on screen. Maximized windows end at the taskbar (`getTaskbarHeight()`),
  and Maximize reads Restore while maximized. An overflowing `.window-content`
  with nothing focusable inside is a labelled tab stop.
- The Start menu, tray panel, and command palette are `inert` while closed,
  and only one is open at a time. The open palette is modal. Escape, a toggle
  button, `Ctrl`/`Cmd` + `K`, or a backdrop click returns focus to the opener;
  launching an app does not.
- Palette and Start search rank names that start with the query first, then
  other name matches, then description matches. Enter runs the top match, or
  the focused palette item. Reset Desktop runs only on a second Enter, click,
  or tap.
- Calculator and Snake take keys only while their window is focused in desktop
  mode with no overlay open and no Ctrl, Meta, or Alt (AltGr is allowed). Form
  fields and controls outside the window keep their keys, and Snake pauses
  whenever it loses the keyboard. The shared guard is
  `src/utils/app-keyboard.ts`.
- Storage keys are `pepodev.desktopPrefs`, `pepodev.music`,
  `pepodev.systemAudio`, `pepodev.snake.best.v2`,
  `pepodev.desktopIcon.v3.<appId>`, and `pepodev.linkIcon.v4.<link id>`. Older
  icon key versions are removed on load; bump the version to discard saved
  layouts. The old `pepodev.snake.best` is removed on load.
- `pepodev.viewMode` stores `desktop` or `website`; first visits default to
  desktop, while a non-empty `?blog=` deep link temporarily opens desktop mode
  without overwriting the saved preference, and an unknown slug shows an
  "Article not found" toast. Picking a mode removes `?blog=` from the URL, so a
  reload keeps the choice. Mode switches are action buttons with fixed names
  and no `aria-pressed`; switching hands focus to the other panel's switch,
  and the website scroll position survives a round trip to desktop.
- The media element, not persisted `pepodev.music.playing`, is authoritative.
  Music and White Noise stop when their window closes and when the site
  switches to website mode, which has no audio controls. Music fetches no media
  on page load, and playback never waits for `AudioContext.resume()`. The
  visualizer animates only while music plays in its visible window; the
  desktop background asks for levels through
  `window.__pepoMusicController.requestAudioFrame()`.
- The desktop Blog reader opens every article at the top with focus on Back;
  Back restores the list position. Links in articles open in a new tab, so
  the desktop never navigates away.
- Anything that changes desktop preferences dispatches `desktop:preferences`;
  Settings re-renders from storage on it.
- Snake's board shrinks with the window and never covers its controls; a new
  visitor's best score is 0. Calculator keeps the newest digits in view and
  reports errors without clearing the input. Terminal and Gallery focus their
  input when opened. The SRE game freezes while minimized or hidden.
- Gallery password is intentionally the literal `password`.
- Certifications sort as Active (at least 90 days remaining), Expiring Soon,
  then Expired; badges refresh hourly. Data and sorting live in
  `src/data/certifications.json` and `src/utils/certifications.ts`. Expired
  ones read as earned history: "Earned <Month YYYY>" with a muted "Expired
  <Month YYYY>" and no badge. The resume lists "<name>, earned <YYYY>".
  `credlyUrl` is the public badge link
  `https://www.credly.com/badges/<uuid>/public_url`, and the dates follow
  Credly's public record (`https://www.credly.com/users/pepodev/badges.json`).
- White Noise intentionally has no rain animation.
- Hide the command-palette tutorial toast at widths `<=768px`; otherwise show
  it on first visit or every seven days. It closes itself after eight seconds.

## Verification

For substantial changes:

1. Run `pnpm build`.
2. Run `pnpm test:e2e` for desktop/app interactions.
3. Check `dist/index.html` after page composition or app content changes.
4. Manually test window opening, minimizing, maximizing, closing, dragging, and
   taskbar behavior when interaction code changes.
5. Confirm affected `/`, `/blog/`, `/garden/`, `/rss.xml`, and `/404.html`
   routes build for content changes, and blog pages scroll without sideways
   overflow at phone width.

## Deployment and Git

GitHub Pages deploys `main` through `.github/workflows/deploy.yaml`: `build`
builds and uploads the site with `withastro/action`, `test` runs the Playwright
suite against that artifact in Google Chrome, and `deploy` publishes it with
`actions/deploy-pages` only after both pass. It also runs hourly, which keeps
the computed experience values current and picks up newly published garden
notes, and on demand. GitHub disables a schedule after 60 days without
repository activity, so re-enable it in the Actions tab if the values go
stale. When the `VAULT_DEPLOY_KEY` secret (a read-only deploy key on
`PePoDev/obsidian-vault`) is set, a separate `garden` job checks out only the
vault's Markdown and attachments, runs the sync, and passes the published notes
to the build and test jobs as an artifact. That job installs packages with
`--ignore-scripts` and runs nothing but the sync; keep the key out of any job
that builds or runs package scripts.

Preserve existing worktree changes, avoid destructive Git commands unless
explicitly requested, and do not commit generated artifacts unless tracked.
