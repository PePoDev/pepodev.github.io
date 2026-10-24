import { chromium, type FullConfig } from "@playwright/test";

// `next dev` compiles each route, and its client chunks, on the first
// request. Load every kind of page once here, so the first test of each
// spec does not spend its timeout waiting for the compiler. Against the
// exported site (PLAYWRIGHT_SERVER=preview) this takes a moment.
const routes = [
  "/",
  "/blog/",
  "/blog/aws-local-zone-bangkok-launch/",
  "/resume/",
  "/garden/",
  "/this-page-does-not-exist/",
  "/rss.xml",
];

export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel, launchOptions } = config.projects[0].use;
  const browser = await chromium.launch({ ...launchOptions, channel });
  const page = await browser.newPage({ baseURL });

  for (const route of routes) {
    await page.goto(route, { waitUntil: "load", timeout: 120_000 });
  }

  await browser.close();
}
