# Agents Guide

This repository is an Astro site for an interactive SRE desktop portfolio. Treat it as a static site first: content should be rendered at build time where possible, with small client scripts only for desktop/window interactions.

## Project Basics

- Runtime: Node `>=22.12.0`.
- Package manager: `pnpm` is expected because `pnpm-lock.yaml` is present.
- Main app entry: `src/pages/index.astro`.
- Production build output: `dist/`. Do not edit generated files in `dist/`.
- Deployment: GitHub Pages via `.github/workflows/deploy.yaml` using `withastro/action`.

## Commands

Run commands from the repository root.

```bash
pnpm dev
pnpm build
pnpm test:e2e
pnpm test:e2e:ui
pnpm preview
pnpm astro --help
```

Use `pnpm build` as the default verification step after code changes. Use
`pnpm test:e2e` for desktop/window/app interaction changes.

## Current Structure

- `src/components/desktop/` contains desktop shell primitives:
  `DesktopIcon.astro`, `ExternalLinkIcon.astro`, `Taskbar.astro`,
  `StartMenu.astro`, `CommandPalette.astro`, `Window.astro`, and
  `AppIcon.astro`.
- `src/components/apps/` contains the pre-rendered desktop app bodies and small
  app-local helpers:
  welcome, blog, work, projects, about, SRE game, snake, calculator, white noise,
  music, settings, terminal, certifications wallet, gallery, and trash.
  Note: `ResumeApp.astro` is no longer used as a desktop app.
- `src/pages/resume.astro` is a standalone page (not a desktop app) that
  auto-generates and downloads a PDF resume when visited at `/resume`.
  Resume functionality is available via this standalone page and external links.
- `src/pages/blog/` contains standalone blog index and static blog post routes.
- `src/pages/rss.xml.js` generates the RSS feed from the Astro blog collection.
- `src/content/blog/` contains Markdown/MDX blog posts managed by Astro content
  collections. Supports both standard Astro and Obsidian frontmatter formats
  (all fields optional).
- `src/assets/blog/` contains local blog post images, named with blog post
  prefixes for organization (e.g., `aws-graviton-01.png`,
  `obsidian-multi-devices-cover.png`).
- `src/data/` contains structured data files such as `experiences.json`,
  `projects.json`, `skills.json`, `social-links.json`, `work-metrics.json`, and
  `certifications.json`. `src/data/music.ts` discovers local tracks from
  `public/music/` at build time.
- `src/types/` contains TypeScript type definitions for all data structures
  (Project, Experience, Skill, Certification, etc.). Import via `@app-types/*`
  path alias (not `@types/*` which conflicts with npm DefinitelyTyped packages).
- `src/utils/` contains utility functions like certification status sorting.
- `src/styles/global.css` imports split CSS modules for the shared desktop visual
  system and app styling.
- `public/music/` contains local media files used by the music player. Browser
  playback can differ between VS Code previews and real browsers; verify audio
  behavior in a browser when changing the player.
- `scripts/generate-og-image.mjs` regenerates the default social preview image at
  `public/og-image.png`.
- `tests/e2e/desktop.spec.ts` contains Playwright coverage for the desktop shell,
  app launchers, windows, and major app interactions.
- `.deployment-config.md` contains security headers configuration for various
  hosting platforms (GitHub Pages, Cloudflare, Netlify, Vercel) and caching
  strategies.

## Implementation Rules

- Prefer Astro components and server-rendered HTML over generating markup with JavaScript strings.
- Keep client JavaScript scoped to interaction behavior: opening windows, focus, drag/resize, taskbar state, start menu, game state, and blog reader toggles.
- Add portfolio content to the relevant JSON file in `src/data/` unless it is a
  blog article.
  - Update TypeScript type definitions in `src/types/data.ts` when modifying data structures.
  - Extract reusable logic to utility functions in `src/utils/`.
- Add blog articles to `src/content/blog/` and keep frontmatter compatible with `src/content.config.ts`.
- Use TypeScript path aliases (`@components/*`, `@data/*`, `@utils/*`, `@app-types/*`, etc.) for imports.
- Define site metadata in `src/consts.ts` instead of `.env` files.
- Reuse existing desktop classes and CSS variables before adding new styling patterns.
- Avoid broad refactors in shared components unless the requested change requires them.
- Do not reintroduce a hardcoded app content module under `src/content/apps.ts`.
- When adding a new desktop app, register it in all required places:
  `src/pages/index.astro` imports/window/icon, `StartMenu.astro`,
  `CommandPalette.astro`, and `AppIcon.astro`.
- App windows are managed by `Window.astro`. Keep app bodies server-rendered and
  use regular `<script>` tags when the script can stay scoped and bundled by
  Astro/Vite. Use `is:inline` for scripts that coordinate global desktop state,
  depend on `define:vars`, or need immediate execution.
- Desktop icon and external shortcut positions are persisted in `localStorage`
  and snap to the desktop grid. If editing drag/drop behavior, preserve
  swap-on-occupied-cell behavior across app icons and external shortcut icons.
- `Escape` closes the focused window. Overlays such as the command palette, start
  menu, and tray panel should continue to handle their own Escape behavior first.
- The settings app persists desktop preferences under `pepodev.desktopPrefs` and
  music state under `pepodev.music`. The taskbar and SRE game use
  `pepodev.systemAudio`.
- The music player should treat the real media element state as authoritative;
  persisted `pepodev.music.playing` can be stale after reloads or embedded
  previews.
- The gallery app is intentionally password-gated with the literal password
  `password`.
- The certifications wallet displays credentials sorted by status at build time:
  Active (≥90 days until expiry) → Expiring Soon (<90 days) → Expired. Status
  badges update dynamically on the client every hour.
  - Certification data lives in `src/data/certifications.json`.
  - Sorting logic is in `src/utils/certifications.ts` for reusability and testability.
- Blog posts reference local images from `src/assets/blog/` using relative paths.
  Images are automatically optimized and converted to WebP during the build.
- The White Noise app provides ambient rain sounds with a minimal UI (clouds and
  city background only; rain animation was removed).
- The command palette tutorial notification (toast) is hidden on mobile devices
  (viewport width ≤ 768px) to improve mobile UX. Desktop users see the tip about
  Ctrl/Cmd+K on first visit or every 7 days.

## Styling Notes

- The desktop UI uses a dark glassmorphism style with terminal/SRE accents.
- Window and app layouts depend on stable class names in `global.css`; check existing selectors before renaming markup.
- Use scoped component scripts where practical, but shared desktop styling currently lives in `global.css`.
- Keep interactive controls keyboard-accessible when adding new launchers or buttons.
- The command palette must stay above windows and support `Ctrl/Cmd+K`
  case-insensitively.
- Hidden panels that also have explicit `display` styles need `[hidden]` CSS
  overrides, otherwise Playwright and browsers may still treat them as visible.

## Verification Checklist

Before finishing a substantial change:

1. Run `pnpm build`.
2. Run `pnpm test:e2e` for desktop interaction, app behavior, window manager,
   command palette, settings, calculator, gallery, or drag/drop changes.
3. Confirm `dist/index.html` contains the expected pre-rendered content if changing app content or page composition.
4. For desktop interaction changes, run `pnpm dev` and manually check opening, minimizing, maximizing, closing, dragging, and taskbar behavior when needed.
5. For content changes, confirm affected routes under `/blog/`, `/rss.xml`, or `/` build successfully.

## Git Hygiene

- Preserve user changes already present in the working tree.
- Do not use destructive git commands unless explicitly requested.
- Keep generated artifacts out of commits unless the repository explicitly tracks them.
