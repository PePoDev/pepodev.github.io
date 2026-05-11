# PePoDev | SRE Desktop Portfolio

An interactive, desktop-style portfolio built for a Site Reliability Engineer. The interface mimics a modern OS desktop environment, complete with a window manager, start menu, taskbar, and an interactive chaos simulation game.

## ✨ Features

- 🖥️ **Interactive Desktop UI:** Draggable, resizable, and minimizable windows.
- 🎮 **SRE Game:** A built-in mini-game simulating production chaos, challenging users to mitigate escalating system failures.
- 📝 **Terminal-Themed Content:** Blog, Resume, Work Experience, and Project showcase presented in an OS-like application format.
- 🌌 **Particle Network Background:** An animated, dynamic HTML5 canvas background.

## 🚀 Project Structure

Built with [Astro](https://astro.build/), the project is currently structured as follows:

```text
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── BaseHead.astro
│   ├── content/
│   │   ├── blog/          # Markdown blog posts
│   │   └── apps.ts        # Hardcoded application content data
│   ├── layouts/
│   ├── pages/
│   │   └── index.astro    # Main desktop entry point (SPA)
│   ├── consts.ts
│   └── content.config.ts
└── sre-game/              # Standalone version of the SRE Game
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents. Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema. See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
