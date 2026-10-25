// Site-wide pages and files that no other area owns: the 404 page,
// robots.txt, the web manifest, favicons, self-hosted fonts, and the
// security headers.
import { expect, test } from "@playwright/test";
import { SECURITY_HEADERS } from "../../scripts/security-headers.mjs";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../../src/consts";
import { resetPage } from "./helpers";

// Cloudflare adds the security headers on pepo.dev and serve-static.mjs adds
// the same ones, so only the export (PLAYWRIGHT_SERVER=preview) has them.
const servesSecurityHeaders = process.env.PLAYWRIGHT_SERVER === "preview";

test("unknown URLs get the branded 404 page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist/");
  expect(response?.status()).toBe(404);

  await expect(page).toHaveTitle("Page not found - PePoDev");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  // The 404 has no URL of its own to advertise.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  await expect(page.locator('meta[name="twitter:url"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Page not found",
  );
  await expect(page.locator("[data-not-found-path]")).toHaveText(
    "/this-page-does-not-exist/",
  );

  const site = page.getByRole("navigation", { name: "Site", exact: true });
  await expect(
    page.getByRole("link", { name: "PePoDev", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(site.getByRole("link", { name: "Blog" })).toHaveAttribute(
    "href",
    "/blog/",
  );
  await expect(site.getByRole("link", { name: "RSS" })).toHaveAttribute(
    "href",
    "/rss.xml",
  );
  const links = page.getByRole("navigation", { name: "Pages on this site" });
  await expect(
    links.getByRole("link", { name: "Go to the home page" }),
  ).toHaveAttribute("href", "/");
  await expect(
    links.getByRole("link", { name: "Read the blog" }),
  ).toHaveAttribute("href", "/blog/");
  await expect(
    links.getByRole("link", { name: "View the resume" }),
  ).toHaveAttribute("href", "/resume/");
});

test("the 404 page fills the viewport without scrolling, whatever the header height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/this-page-does-not-exist/");
  const fit = () =>
    page.evaluate(() => ({
      overflow: document.documentElement.scrollHeight - window.innerHeight,
      gap:
        window.innerHeight -
        document.querySelector("main")!.getBoundingClientRect().bottom,
    }));

  expect(await fit()).toEqual({ overflow: 0, gap: 0 });
  // A taller header, as when it wraps at large text sizes.
  await page.addStyleTag({ content: ".site-header { padding-block: 40px; }" });
  expect(await fit()).toEqual({ overflow: 0, gap: 0 });
});

test("robots.txt advertises the sitemap", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  // public/robots.txt repeats SITE_URL; this keeps the two in sync.
  expect(await robots.text()).toContain(
    `Sitemap: ${new URL("sitemap-index.xml", SITE_URL)}`,
  );
});

test("the web manifest is linked and its icons exist", async ({
  page,
  request,
}) => {
  await page.goto("/blog/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();

  // public/manifest.webmanifest repeats the site metadata in src/consts.ts.
  expect(manifest).toMatchObject({
    name: SITE_TITLE,
    short_name: "PePoDev",
    description: SITE_DESCRIPTION,
    start_url: "/",
    theme_color: "#1a1a1a",
  });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    "any",
    "192x192",
    "512x512",
  ]);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("Chromium uses the SVG favicon and the ICO holds only 16, 32, and 48 px", async ({
  page,
  request,
}) => {
  // Chromium fetches only the icon it picks. An ICO fetch never reaches
  // Playwright's request events, so assert that the SVG is fetched instead.
  const svgRequest = page.waitForRequest(/\/favicon\.svg$/, {
    timeout: 15_000,
  });
  await page.goto("/blog/");
  await expect(
    page.locator('link[rel="icon"][href="/favicon.ico"]'),
  ).toHaveAttribute("sizes", "32x32");
  await expect(
    page.locator('link[rel="icon"][href="/favicon.svg"]'),
  ).toHaveAttribute("type", "image/svg+xml");
  await svgRequest;

  const ico = await (await request.get("/favicon.ico")).body();
  expect(ico.length).toBeLessThan(10_000);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16]);
  expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
});

test("pages self-host Inter and JetBrains Mono, and website mode does not download them", async ({
  page,
}) => {
  const fontHosts: string[] = [];
  page.on("request", (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url()))
      fontHosts.push(r.url());
  });
  const unquote = (family: string) => family.replace(/^["']|["']$/g, "");
  const loadedFamilies = () =>
    page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family);
    });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0);
  const fonts = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) =>
      style.getPropertyValue(name).replace(/\s+/g, " ").trim();
    return {
      inter: read("--font-inter"),
      mono: read("--font-jetbrains-mono"),
      sansStack: read("--font-sans"),
      monoStack: read("--font-mono"),
    };
  });
  // fonts-desktop.css names the families; the stacks are the same as before,
  // with the self-hosted family first.
  expect(fonts.inter).not.toBe("");
  expect(fonts.mono).not.toBe("");
  expect(fonts.sansStack).toBe(
    `${fonts.inter}, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`,
  );
  expect(fonts.monoStack).toBe(
    `${fonts.mono}, "Fira Code", "SF Mono", monospace`,
  );
  const selfHosted = [unquote(fonts.inter), unquote(fonts.mono)];
  await expect
    .poll(async () => (await loadedFamilies()).map(unquote))
    .toContain(selfHosted[0]);

  await page.evaluate(() =>
    localStorage.setItem("pepodev.viewMode", "website"),
  );
  await page.reload();
  await expect(page.locator("#website")).toBeVisible();
  const websiteFamilies = (await loadedFamilies()).map(unquote);
  expect(websiteFamilies.filter((f) => selfHosted.includes(f))).toEqual([]);

  for (const path of ["/blog/", "/resume/"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0);
  }
  expect(fontHosts).toEqual([]);
});

test("every response carries the security headers Cloudflare adds", async ({
  request,
}) => {
  test.skip(!servesSecurityHeaders, "next dev sends no security headers");
  for (const path of ["/", "/blog/", "/this-page-does-not-exist/", "/rss.xml"]) {
    const headers = (await request.get(path)).headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers[name.toLowerCase()], `${name} on ${path}`).toBe(value);
    }
  }
});

test("the security headers allow everything the site does, Cloudflare Web Analytics included", async ({
  page,
}) => {
  test.skip(!servesSecurityHeaders, "next dev sends no security headers");
  test.setTimeout(120_000);
  // Every document reports the policy violations it sees, frames included.
  const violations: string[] = [];
  await page.exposeFunction("reportViolation", (text: string) =>
    violations.push(text),
  );
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as typeof window & { reportViolation: (text: string) => void }
      ).reportViolation(
        `${location.pathname}: ${event.effectiveDirective} ${event.blockedURI}`,
      );
    });
  });
  // Cloudflare injects its beacon into every HTML page, and the beacon
  // reports to cloudflareinsights.com.
  const reports: string[] = [];
  await page.route("https://cloudflareinsights.com/**", (route) => {
    reports.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  await page.route("https://static.cloudflareinsights.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum", "{}");',
    }),
  );
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</body>",
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v1" data-cf-beacon='{"token":"test"}'></script></body>`,
    );
    await route.fulfill({ response, body });
  });

  // The desktop with every app open, a Blog article, and the Garden frame.
  await resetPage(page);
  await expect.poll(() => reports.length).toBeGreaterThan(0);
  const appIds = await page
    .locator("#desktop-icons [data-open-app]")
    .evaluateAll((icons) =>
      icons.map((icon) => (icon as HTMLElement).dataset.openApp),
    );
  for (const appId of appIds) {
    await page.evaluate(
      (appId) =>
        document.dispatchEvent(
          new CustomEvent("desktop:open-app", { detail: { appId } }),
        ),
      appId,
    );
    await expect(
      page
        .locator(`#window-${appId} .window-content > :not(.app-loading)`)
        .first(),
    ).toBeAttached();
  }
  // Opening Blog again brings it to the front.
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("desktop:open-app", { detail: { appId: "blog" } }),
    ),
  );
  await page.locator("#window-blog .blog-item-title").first().click();
  await expect(
    page.locator("#window-blog article:not([hidden]) .blog-reader-body"),
  ).not.toBeEmpty();
  await expect(
    page.frameLocator("#window-garden iframe").locator("body"),
  ).toBeVisible();

  // Website mode, then every kind of static page.
  await page.evaluate(() =>
    localStorage.setItem("pepodev.viewMode", "website"),
  );
  await page.reload();
  await expect(page.locator("#website")).toBeVisible();
  for (const path of [
    "/blog/",
    "/blog/aws-local-zone-bangkok-launch/",
    "/garden/",
    "/this-page-does-not-exist/",
    "/resume/",
  ]) {
    await page.goto(path);
  }
  // The resume builds its PDF in the browser.
  const download = page.waitForEvent("download");
  await page.locator("[data-resume-download]").click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  expect(violations).toEqual([]);
});
