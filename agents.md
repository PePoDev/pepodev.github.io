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
pnpm preview
pnpm astro --help
```

Use `pnpm build` as the default verification step after code changes.

## Current Structure

- `src/components/desktop/` contains desktop shell primitives:
  `DesktopIcon.astro`, `Taskbar.astro`, `StartMenu.astro`, `Window.astro`, and `AppIcon.astro`.
- `src/components/apps/` contains the pre-rendered desktop app bodies:
  blog, resume, work, projects, about, connect, and SRE game.
- `src/content/blog/` contains Markdown/MDX blog posts managed by Astro content collections.
- `src/data/portfolio.json` contains structured portfolio data for projects, experience, skills, metrics, and social links.
- `src/styles/global.css` contains the shared desktop visual system and app styling.
- `sre-game/` is a standalone static copy of the SRE game and is separate from the Astro desktop app.

## Implementation Rules

- Prefer Astro components and server-rendered HTML over generating markup with JavaScript strings.
- Keep client JavaScript scoped to interaction behavior: opening windows, focus, drag/resize, taskbar state, start menu, game state, and blog reader toggles.
- Add portfolio content to `src/data/portfolio.json` unless it is a blog article.
- Add blog articles to `src/content/blog/` and keep frontmatter compatible with `src/content.config.ts`.
- Reuse existing desktop classes and CSS variables before adding new styling patterns.
- Avoid broad refactors in shared components unless the requested change requires them.
- Do not reintroduce a hardcoded app content module under `src/content/apps.ts`.

## Styling Notes

- The desktop UI uses a dark glassmorphism style with terminal/SRE accents.
- Window and app layouts depend on stable class names in `global.css`; check existing selectors before renaming markup.
- Use scoped component scripts where practical, but shared desktop styling currently lives in `global.css`.
- Keep interactive controls keyboard-accessible when adding new launchers or buttons.

## Verification Checklist

Before finishing a substantial change:

1. Run `pnpm build`.
2. Confirm `dist/index.html` contains the expected pre-rendered content if changing app content or page composition.
3. For desktop interaction changes, run `pnpm dev` and manually check opening, minimizing, maximizing, closing, dragging, and taskbar behavior.
4. For content changes, confirm affected routes under `/blog/`, `/rss.xml`, or `/` build successfully.

## Git Hygiene

- Preserve user changes already present in the working tree.
- Do not use destructive git commands unless explicitly requested.
- Keep generated artifacts out of commits unless the repository explicitly tracks them.
