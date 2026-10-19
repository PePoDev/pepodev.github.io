// @ts-check
import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://pepo.dev",
  integrations: [mdx(), sitemap()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  build: {
    inlineStylesheets: "auto",
  },
  compressHTML: true,
  devToolbar: {
    enabled: false,
  },
  image: {
    domains: [],
    remotePatterns: [],
    // Give Markdown and <Image> output a srcset, so readers download a
    // screen-sized file instead of the original (up to 4000px wide). Keep the
    // breakpoint list short: every article is also rendered in index.html.
    layout: "constrained",
    breakpoints: [640, 960, 1280, 1920],
  },
  vite: {
    build: {
      // Astro builds with an "esnext" target, so Lightning CSS minification
      // would merge vendor-prefixed declarations away. Use Vite's
      // baseline-widely-available browsers to keep prefixes Safari needs.
      cssTarget: ["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@components": fileURLToPath(
          new URL("./src/components", import.meta.url),
        ),
        "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
        "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
        "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@app-types": fileURLToPath(new URL("./src/types", import.meta.url)),
        "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
      },
    },
  },
  fonts: [
    // Desktop mode, blog, and resume type (--font-sans and --font-mono in
    // src/styles/variables.css). Rendered by BaseHead on every page and not
    // preloaded, so website mode never downloads them.
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      // Bare family names: variables.css keeps the system fallbacks.
      fallbacks: [],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: [400, 500, 700],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      fallbacks: [],
    },
    // Website mode only (src/styles/website-mode.css). Astro downloads these
    // at build time and serves them from /_astro/fonts/; browsers fetch them
    // only when website mode renders text in them.
    {
      provider: fontProviders.google(),
      name: "IBM Plex Sans",
      cssVariable: "--font-plex-sans",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
      // Bare family names, so website-mode.css can put IBM Plex Sans Thai
      // second for Thai glyphs, ahead of the system fallbacks.
      fallbacks: [],
    },
    {
      provider: fontProviders.google(),
      name: "IBM Plex Sans Thai",
      cssVariable: "--font-plex-thai",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["thai"],
      fallbacks: [],
    },
    {
      provider: fontProviders.google(),
      name: "IBM Plex Mono",
      cssVariable: "--font-plex-mono",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["monospace"],
    },
  ],
});
