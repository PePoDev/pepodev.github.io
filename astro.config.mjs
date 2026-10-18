// @ts-check
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://pepo.dev",
  integrations: [sitemap()],
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
    {
      provider: fontProviders.local(),
      name: "Atkinson",
      cssVariable: "--font-atkinson",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/atkinson-regular.woff"],
            weight: 400,
            style: "normal",
            display: "swap",
          },
          {
            src: ["./src/assets/fonts/atkinson-bold.woff"],
            weight: 700,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
  ],
});
