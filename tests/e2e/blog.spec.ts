import { expect, test, type Page } from "@playwright/test";

const postPath = "/blog/aws-local-zone-bangkok-launch/";

// Newest first, as published on blog.pepo.dev.
const posts = [
  { title: "AWS Graviton ทักครับ 👋", date: "Jan 14, 2024" },
  { title: "ผิดไหมถ้าใจอยากจะใช้ Arch Linux บน WSL", date: "Dec 22, 2023" },
  { title: "Obsidian กับเรื่อง Multiple-Devices", date: "Dec 22, 2023" },
  {
    title: "Do the Fun Chaos Engineering with Gamification!",
    date: "Mar 13, 2023",
  },
  { title: "AWS Local Zone Bangkok Launch", date: "Mar 13, 2023" },
];

async function resetPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function wheelScroll(page: Page) {
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, 1200);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("standalone posts scroll and fit the viewport", async ({ page }) => {
      await page.goto(postPath);
      await wheelScroll(page);

      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expectNoHorizontalOverflow(page);

      const prose = page.locator(".prose");
      const proseWidth = (await prose.boundingBox())!.width;
      for (const image of await prose.locator("img").all()) {
        expect((await image.boundingBox())!.width).toBeLessThanOrEqual(
          proseWidth,
        );
      }
    });

    test("the blog index scrolls and fits the viewport", async ({ page }) => {
      await page.goto("/blog/");
      await wheelScroll(page);

      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expectNoHorizontalOverflow(page);
    });
  });
}

test("the blog index lists real titles and dates, newest first", async ({
  page,
}) => {
  await page.goto("/blog/");

  const cards = page.locator("main li");
  await expect(cards.locator(".title")).toHaveText(posts.map((p) => p.title));
  await expect(cards.locator(".date")).toHaveText(posts.map((p) => p.date));
});

test("post pages use the post title and publish date", async ({ page }) => {
  await page.goto(postPath);

  await expect(page).toHaveTitle("AWS Local Zone Bangkok Launch");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AWS Local Zone Bangkok Launch",
  );
  await expect(page.locator(".title time")).toHaveAttribute(
    "datetime",
    "2023-03-13T14:22:51.000Z",
  );
  await expect(page.locator(".title time")).toHaveText("Mar 13, 2023");
});

test("article Markdown gets the reading styles and responsive images", async ({
  page,
}) => {
  await page.goto(postPath);

  const prose = page.locator(".prose");
  await expect(prose.locator("p a").first()).toHaveCSS(
    "color",
    "rgb(100, 210, 255)",
  );
  await expect(prose.locator(":scope > p").first()).not.toHaveCSS(
    "margin-bottom",
    "0px",
  );
  await expect(prose.locator("img").first()).toHaveAttribute(
    "srcset",
    /\s\d+w,/,
  );
});

test("the desktop stays locked to one screen while website mode scrolls", async ({
  page,
}) => {
  await resetPage(page);

  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "desktop",
  );
  await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
  await wheelScroll(page);
  await page.keyboard.press("End");
  // The document is one screen tall, so even a script can't scroll it.
  await page.evaluate(() => window.scrollTo(0, 1000));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(page.locator("#website")).toBeVisible();
  await wheelScroll(page);

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
});

test("the Blog app and website mode list real titles and dates", async ({
  page,
}) => {
  await resetPage(page);

  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Blog" })
    .click();
  const blogWindow = page.locator("#window-blog");
  await expect(blogWindow.locator(".blog-item-title")).toHaveText(
    posts.map((p) => p.title),
  );
  await expect(blogWindow.locator(".blog-item-meta")).toHaveText(
    posts.map((p) => p.date),
  );

  await page.keyboard.press("Escape");
  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(page.locator(".website-writing-card h3")).toHaveText(
    posts.slice(0, 3).map((p) => p.title),
  );
});

test("the RSS feed dates every post and keeps its links", async ({
  request,
}) => {
  const feed = await (await request.get("/rss.xml")).text();

  expect(feed.match(/<pubDate>/g)).toHaveLength(posts.length);
  expect(feed).toContain(
    "<title>AWS Local Zone Bangkok Launch</title><link>https://pepo.dev/?blog=aws-local-zone-bangkok-launch</link>",
  );
});
