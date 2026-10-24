import { defineConfig, devices } from "@playwright/test";

// CI (.github/workflows/deploy.yaml) sets both variables: it serves the
// exported out/ that gets deployed (scripts/serve-static.mjs, which behaves
// like GitHub Pages; run `pnpm build` first), in Google Chrome, which plays
// the AAC music that Playwright's bundled Chromium cannot. Without them,
// tests run against `next dev` in the bundled Chromium.
const server = process.env.PLAYWRIGHT_SERVER === "preview" ? "preview" : "dev";
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  // In CI a stray test.only fails the run, and a test gets two retries
  // before it blocks the deploy.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4323",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm ${server} --hostname 127.0.0.1 --port 4323`,
    url: "http://127.0.0.1:4323",
    reuseExistingServer: true,
    // `next dev` compiles each route on its first request.
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) },
    },
  ],
});
