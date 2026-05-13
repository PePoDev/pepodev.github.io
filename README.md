# PePoDev | SRE Desktop Portfolio

An interactive desktop-style portfolio for a Site Reliability Engineer, built
with Astro as a static site. The main page renders an OS-like desktop with
launchable app windows, persisted preferences, a command palette, a local music
player, and an SRE chaos game.

## Features

- Interactive desktop shell with draggable, resizable, minimizable windows.
- Desktop icons, external shortcuts, start menu, taskbar, tray controls, and
  `Ctrl`/`Cmd` + `K` command palette.
- Server-rendered portfolio apps for About, Blog, Resume, Work, Projects,
  Certifications, Gallery, Terminal, Calculator, Settings, Trash, Music, and
  the SRE game.
- Local music library loaded at build time from `public/music`.
- Markdown/MDX blog content with RSS and sitemap output.
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
│   ├── assets/                # Local fonts and static source assets
│   ├── components/
│   │   ├── apps/              # Server-rendered desktop app bodies
│   │   └── desktop/           # Window manager, icons, taskbar, start menu
│   ├── content/
│   │   └── blog/              # Markdown/MDX blog posts
│   ├── data/                  # Portfolio data JSON and music discovery helper
│   ├── layouts/
│   ├── pages/
│   │   └── index.astro        # Main desktop entry point
│   └── styles/                # Split CSS modules imported by global.css
├── tests/e2e/                 # Playwright desktop coverage
├── sre-game/                  # Standalone static copy of the SRE game
└── dist/                      # Generated production build output
```

Do not edit generated files in `dist/`.

## Content Updates

- Add portfolio content to the relevant JSON file in `src/data/`.
- Add blog articles to `src/content/blog/` and keep frontmatter compatible with
  `src/content.config.ts`.
- Add local music files to `public/music/`; supported files are discovered by
  `src/data/music.ts` during the Astro build.
- When adding a new desktop app, register it in `src/pages/index.astro`,
  `src/components/desktop/StartMenu.astro`,
  `src/components/desktop/CommandPalette.astro`, and
  `src/components/desktop/AppIcon.astro`.

## Deployment

The site deploys to GitHub Pages from `main` via
`.github/workflows/deploy.yaml`, using `withastro/action` followed by
`actions/deploy-pages`.
