# PePoDev | Desktop Portfolio

An Astro-based static portfolio and engineering blog with two presentation
modes: an interactive desktop and a conventional responsive website. The
desktop includes draggable windows, shortcuts, a command palette, work and
project content, Markdown/MDX posts, a resume generator, music, tools, and
games.

Keep it **static-first**: render content at build time and use small client
scripts only for desktop, window, media, and app interactions.

## Setup

Requires Node `>=22.12.0` and `pnpm`.

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
| `tests/e2e/desktop.spec.ts` | Desktop and app Playwright coverage |
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
- `Window.astro` manages app windows. Prefer bundled `<script>` tags; use
  `is:inline` only for global coordination, `define:vars`, or immediate setup.
- Preserve keyboard access, stable `global.css` selectors, command-palette
  stacking, and case-insensitive `Ctrl`/`Cmd` + `K`.
- Explicit `display` rules on hidden panels require a `[hidden]` override.

### Content and Apps

- Store portfolio content in `src/data/`; update `src/types/data.ts` for schema
  changes and extract reusable logic to `src/utils/`.
- Store posts in `src/content/blog/` using `src/content.config.ts`. Reference
  prefixed local images from `src/assets/blog/`; builds optimize them to WebP.
- Put audio in `public/music/`; `src/data/music.ts` discovers it at build time.
  Verify playback in a real browser.
- Regenerate `public/og-image.png` with
  `node scripts/generate-og-image.mjs`.
- Register new apps in `src/pages/index.astro`, `StartMenu.astro`,
  `CommandPalette.astro`, and `AppIcon.astro`.
- The resume remains a standalone `/resume` page; do not restore
  `ResumeApp.astro`.

### Interaction Invariants

- Persisted icons snap to the grid and swap across app and external shortcut
  icons when a cell is occupied.
- `Escape` closes the focused window after overlays handle it.
- Storage keys are `pepodev.desktopPrefs`, `pepodev.music`, and
  `pepodev.systemAudio`.
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
   changes.

## Deployment and Git

GitHub Pages deploys `main` through `.github/workflows/deploy.yaml` using
`withastro/action` and `actions/deploy-pages`.

Preserve existing worktree changes, avoid destructive Git commands unless
explicitly requested, and do not commit generated artifacts unless tracked.
