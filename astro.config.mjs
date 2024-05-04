import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import partytown from "@astrojs/partytown";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://pepo.dev",
  base: "/",
  trailingSlash: "ignore",
  redirects: {},
  output: "static",
  integrations: [svelte(), partytown(), tailwind(), sitemap(), mdx(), icon()],
});
