# PePoDev | Desktop Portfolio

An interactive desktop-style portfolio for a Site Reliability Engineer, built
with Astro as a static site. The main page renders an OS-like desktop with
launchable app windows, persisted preferences, a command palette, a local music
player, and an SRE chaos game.

Treat the project as a static site first: render content at build time where
possible and keep client scripts focused on desktop and window interactions.

## Features

- Interactive desktop shell with draggable, resizable, minimizable windows.
- Desktop icons, external shortcuts, start menu, taskbar, tray controls, and
  `Ctrl`/`Cmd` + `K` command palette.
- Server-rendered desktop apps for Welcome, Blog, Work, Projects, About,
  Certifications, Gallery, Terminal, Calculator, Settings, Trash, White Noise,
  Music, Snake, and the SRE game.
- Standalone resume download page at `/resume` with client-side PDF generation.
- Local music library loaded at build time from `public/music`.
- Markdown/MDX blog content with local images in `src/assets/blog/`,
  standalone `/blog` routes, RSS, and sitemap output.
- GitHub Pages deployment through Astro's GitHub Action.

## Requirements

- Node `>=22.12.0`
- `pnpm`

The repository includes `pnpm-lock.yaml`, so use `pnpm` for installs and
scripts.

## Commands

Run commands from the repository root.

| Command | Action |
| :-- | :-- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the Astro dev server |
| `pnpm build` | Build the static site into `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:e2e:ui` | Run Playwright in UI mode |
| `pnpm astro --help` | Show Astro CLI help |

Use `pnpm build` as the default verification step after code changes. Use
`pnpm test:e2e` for desktop shell, window manager, command palette, settings,
music player, game, calculator, gallery, or other interaction changes.

## Project Structure

```text
├── public/
│   └── music/                 # Local music files discovered at build time
├── src/
│   ├── assets/
│   │   ├── blog/              # Blog post images (prefixed with blog post names)
│   │   └── fonts/             # Local fonts
│   ├── components/
│   │   ├── apps/              # Server-rendered desktop app bodies and helpers
│   │   └── desktop/           # Window manager, icons, command palette, menus
│   ├── content/
│   │   └── blog/              # Markdown/MDX blog posts (supports Obsidian format)
│   ├── data/                  # Portfolio data JSON (projects, skills, certifications, etc.)
│   ├── layouts/
│   ├── pages/
│   │   ├── blog/              # Standalone blog index and static post pages
│   │   ├── index.astro        # Main desktop entry point
│   │   ├── resume.astro       # Standalone resume download page
│   │   └── rss.xml.js         # RSS feed
│   ├── styles/                # Split CSS modules imported by global.css
│   ├── types/                 # TypeScript type definitions for data structures
│   └── utils/                 # Utility functions (certifications sorting, etc.)
├── scripts/
│   └── generate-og-image.mjs  # Regenerates public/og-image.png
├── tests/e2e/                 # Playwright desktop coverage
├── .deployment-config.md      # Security headers and deployment guide
└── dist/                      # Generated production build output
```

Do not edit generated files in `dist/`.

## Content Updates

- Add portfolio content to the relevant JSON file in `src/data/`.
  - Update TypeScript interfaces in `src/types/data.ts` when adding new fields.
  - Extract reusable logic to utility functions in `src/utils/`.
- Add blog articles to `src/content/blog/` and keep frontmatter compatible with
  `src/content.config.ts`. Blog posts support both standard Astro and Obsidian
  frontmatter formats (all fields optional).
- Add blog images to `src/assets/blog/` with filenames prefixed by the blog
  post name (e.g., `aws-graviton-01.png`, `obsidian-multi-devices-cover.png`).
- Add local music files to `public/music/`; supported files are discovered by
  `src/data/music.ts` during the Astro build.
- Run `node scripts/generate-og-image.mjs` when regenerating the default
  Open Graph image at `public/og-image.png`.
- When adding a new desktop app, register it in `src/pages/index.astro`,
  `src/components/desktop/StartMenu.astro`,
  `src/components/desktop/CommandPalette.astro`, and
  `src/components/desktop/AppIcon.astro`.

## Architecture and Key Files

- `src/pages/index.astro` is the main desktop entry point.
- `src/components/desktop/` contains the desktop shell primitives:
  `DesktopIcon.astro`, `ExternalLinkIcon.astro`, `Taskbar.astro`,
  `StartMenu.astro`, `CommandPalette.astro`, `Window.astro`, and
  `AppIcon.astro`.
- `src/components/apps/` contains the pre-rendered app bodies and small
  app-local helpers for Welcome, Blog, Work, Projects, About, SRE Game, Snake,
  Calculator, White Noise, Music, Settings, Terminal, Certifications, Gallery,
  and Trash.
- `src/pages/resume.astro` is a standalone page, not a desktop app. Visiting
  `/resume` generates and downloads the PDF resume. Do not reintroduce
  `ResumeApp.astro`.
- `src/pages/blog/` contains the standalone blog index and static post routes.
  `src/pages/rss.xml.js` generates the RSS feed from the Astro blog collection.
- `src/content/blog/` contains Markdown/MDX posts. Local post images live in
  `src/assets/blog/` and use post-name prefixes for organization.
- `src/data/` contains structured portfolio data, including experiences,
  projects, skills, social links, work metrics, and certifications.
  `src/data/music.ts` discovers tracks in `public/music/` at build time.
- `src/types/` contains the data interfaces. Import them through
  `@app-types/*`; do not use `@types/*`, which conflicts with DefinitelyTyped
  packages.
- `src/utils/` contains reusable logic such as certification status sorting.
- `src/styles/global.css` imports the split CSS modules used by the desktop and
  apps.
- `tests/e2e/desktop.spec.ts` covers the shell, app launchers, windows, and
  major app interactions.
- `.deployment-config.md` documents security headers and caching strategies for
  supported hosting platforms.

## Implementation Rules

- Prefer Astro components and server-rendered HTML over markup generated from
  JavaScript strings.
- Keep client JavaScript scoped to interaction behavior: window opening, focus,
  drag/resize, taskbar state, menus, games, and blog reader toggles.
- Use the existing TypeScript path aliases for imports.
- Define site metadata in `src/consts.ts`, not in `.env` files.
- Reuse existing desktop classes and CSS variables before introducing new
  styling patterns.
- Avoid broad shared-component refactors unless the requested change requires
  them.
- Do not reintroduce a hardcoded app content module at `src/content/apps.ts`.
- Register new desktop apps in `src/pages/index.astro`,
  `StartMenu.astro`, `CommandPalette.astro`, and `AppIcon.astro`.
- `Window.astro` manages app windows. Keep app bodies server-rendered and use
  regular `<script>` tags when Astro/Vite can scope and bundle them. Reserve
  `is:inline` for global desktop coordination, `define:vars`, or immediate
  execution.

## Desktop Behavior and State

- Desktop icons and external shortcuts persist their positions in
  `localStorage`, snap to the grid, and swap when dropped on occupied cells.
  Preserve this behavior across both icon types.
- `Escape` closes the focused window. Overlays such as the command palette,
  start menu, and tray panel handle their own Escape behavior first.
- Desktop preferences use `pepodev.desktopPrefs`; music state uses
  `pepodev.music`; the taskbar and SRE game use `pepodev.systemAudio`.
- Treat the real media element as authoritative for music playback because the
  persisted `pepodev.music.playing` value can be stale after reloads or embedded
  previews.
- Audio playback can differ between VS Code previews and real browsers, so
  verify music changes in a browser.
- The gallery is intentionally gated with the literal password `password`.
- Certifications are sorted at build time as Active (at least 90 days until
  expiry), Expiring Soon (under 90 days), then Expired. Client-side badges
  refresh hourly. Data lives in `src/data/certifications.json`; reusable sorting
  logic lives in `src/utils/certifications.ts`.
- Blog images use relative paths and are optimized and converted to WebP during
  the build.
- White Noise intentionally uses only clouds and a city background; its rain
  animation was removed.
- The command-palette tutorial toast is hidden at viewport widths of 768px or
  less. Desktop users see it on their first visit or every seven days.

## Styling and Accessibility

- The desktop uses dark glassmorphism with terminal accents.
- Window and app layouts depend on stable class names in `global.css`; inspect
  existing selectors before renaming markup.
- Prefer scoped component scripts while keeping shared desktop styling in
  `global.css`.
- Keep interactive controls keyboard-accessible.
- Keep the command palette above windows and support `Ctrl`/`Cmd` + `K`
  case-insensitively.
- Add `[hidden]` CSS overrides to hidden panels that also define an explicit
  `display` value.

## Configuration

### Site Constants

Site metadata is configured in `src/consts.ts`.

### Path Aliases

The project uses TypeScript path aliases for cleaner imports:

- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@data/*` → `src/data/*`
- `@utils/*` → `src/utils/*`
- `@app-types/*` → `src/types/*`
- `@layouts/*` → `src/layouts/*`
- `@styles/*` → `src/styles/*`

Example:

```typescript
import { Project } from '@app-types/data';
import projects from '@data/projects.json';
import { sortCertificationsByStatus } from '@utils/certifications';
```

## Deployment

The site deploys to GitHub Pages from `main` via
`.github/workflows/deploy.yaml`, using `withastro/action` followed by
`actions/deploy-pages`.

## Verification Checklist

Before finishing a substantial change:

1. Run `pnpm build`.
2. Run `pnpm test:e2e` for desktop interactions, app behavior, the window
   manager, command palette, settings, calculator, gallery, or drag/drop.
3. Confirm `dist/index.html` contains the expected pre-rendered content after
   changing app content or page composition.
4. For desktop interaction changes, run `pnpm dev` and manually check opening,
   minimizing, maximizing, closing, dragging, and taskbar behavior when needed.
5. For content changes, confirm the affected `/blog/`, `/rss.xml`, or `/`
   routes build successfully.

## Git Hygiene

- Preserve changes already present in the working tree.
- Do not use destructive Git commands unless explicitly requested.
- Keep generated artifacts out of commits unless the repository tracks them.
