import { chromium, type FullConfig } from "@playwright/test";

// Astro's dev server reloads the first page that connects after it rewrites
// the content data store on startup. Absorb that reload here so it cannot
// interrupt the first test.
export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel, launchOptions } = config.projects[0].use;
  const browser = await chromium.launch({ ...launchOptions, channel });
  const page = await browser.newPage();

  await page.goto(baseURL ?? "/");
  await page
    .waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 3_000,
    })
    .catch(() => {});

  await browser.close();
}
