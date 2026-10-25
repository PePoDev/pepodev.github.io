import type { NextConfig } from "next";

// A fully static site: `next build` prerenders every route into out/, which
// GitHub Pages serves as is (README, Pages and Runtime; scripts/serve-static.mjs).
const nextConfig: NextConfig = {
  output: "export",
  // /blog/<id>/index.html, like the Astro build: GitHub Pages redirects
  // /blog/<id> to /blog/<id>/ and serves the directory's index.html.
  trailingSlash: true,
  // There is no image server on GitHub Pages. src/lib/images.ts resizes
  // images with sharp at build time instead (WebP srcsets, JPEG share cards).
  images: { unoptimized: true },
  // The Markdown parser is a native (napi) module; load it from node_modules
  // at build time instead of bundling it. sharp and shiki are on Next's own
  // list of external packages.
  serverExternalPackages: ["satteri"],
  experimental: {
    // One branded 404 for every unmatched URL, although the site has several
    // root layouts (src/app/(group)/layout.tsx). Exported as out/404.html.
    globalNotFound: true,
  },
  // The Astro site had its dev toolbar off; keep dev pages looking like the
  // built ones.
  devIndicators: false,
  // `next dev` otherwise writes its own instructions into AGENTS.md when it
  // detects a coding agent. README.md is this repository's single source of
  // truth (AGENTS.md and CLAUDE.md only point to it).
  agentRules: false,
};

export default nextConfig;
