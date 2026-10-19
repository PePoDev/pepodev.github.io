import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import {
  BLOG_DESCRIPTION,
  BLOG_TITLE,
  SITE_DESCRIPTION,
} from "../../src/consts";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const postPath = "/blog/aws-local-zone-bangkok-launch/";

// Newest first, as published on blog.pepo.dev. Ids come from the file names
// in src/content/blog/.
const posts = [
  {
    id: "aws-graviton-ทักครับ",
    title: "AWS Graviton ทักครับ 👋",
    date: "Jan 14, 2024",
    pubDate: "2024-01-14T13:14:03.000Z",
    lang: "th",
  },
  {
    id: "ผิดไหมถ้าใจอยากจะใช้-arch-linux-บน-wsl",
    title: "ผิดไหมถ้าใจอยากจะใช้ Arch Linux บน WSL",
    date: "Dec 22, 2023",
    pubDate: "2023-12-22T17:40:22.000Z",
    lang: "th",
  },
  {
    id: "obsidian-กับเรื่อง-multiple-devices",
    title: "Obsidian กับเรื่อง Multiple-Devices",
    date: "Dec 22, 2023",
    pubDate: "2023-12-22T10:07:41.000Z",
    lang: "th",
  },
  {
    id: "do-the-fun-chaos-engineering-with-gamification",
    title: "Do the Fun Chaos Engineering with Gamification!",
    date: "Mar 13, 2023",
    pubDate: "2023-03-13T14:24:06.000Z",
    lang: "en",
  },
  {
    id: "aws-local-zone-bangkok-launch",
    title: "AWS Local Zone Bangkok Launch",
    date: "Mar 13, 2023",
    pubDate: "2023-03-13T14:22:51.000Z",
    lang: "th",
  },
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

async function axeViolations(page: Page, rules: string[]) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (values) => {
    const axe = (window as unknown as { axe: any }).axe;
    const results = await axe.run(document, {
      resultTypes: ["violations"],
      runOnly: { type: "rule", values },
    });
    return results.violations.map(
      (v: any) =>
        `${v.id}: ${v.nodes.map((n: any) => n.target.join(" ")).join(", ")}`,
    );
  }, rules);
}

async function expectSiteHeader(page: Page) {
  const nav = page.getByRole("navigation", { name: "Site", exact: true });
  await expect(
    page.getByRole("link", { name: "PePoDev", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    nav.getByRole("link", { name: "Blog", exact: true }),
  ).toHaveAttribute("href", "/blog/");
  await expect(
    nav.getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/rss.xml");
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

    test("post pages link home, to the blog, and to the feed", async ({
      page,
    }) => {
      await page.goto(postPath);

      await expectSiteHeader(page);
      const footer = page.getByRole("navigation", {
        name: "Blog",
        exact: true,
      });
      await expect(
        footer.getByRole("link", { name: "All posts" }),
      ).toHaveAttribute("href", "/blog/");
      await expect(
        footer.getByRole("link", { name: "Subscribe via RSS" }),
      ).toHaveAttribute("href", "/rss.xml");
      await expectNoHorizontalOverflow(page);

      await page.getByRole("link", { name: "PePoDev", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
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

test("the blog index has its own title, an h1, post descriptions, and a site header", async ({
  page,
}) => {
  await page.goto("/blog/");

  await expect(page).toHaveTitle(BLOG_TITLE);
  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveAttribute("content", BLOG_DESCRIPTION);
  await expect(description).not.toHaveAttribute("content", SITE_DESCRIPTION);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Engineering Blog",
  );
  await expectSiteHeader(page);
  await expect(
    page
      .getByRole("navigation", { name: "Site", exact: true })
      .getByRole("link", { name: "Blog" }),
  ).toHaveAttribute("aria-current", "page");

  const cards = page.locator("main li");
  await expect(cards.locator("h2.title")).toHaveCount(posts.length);
  await expect(cards.locator(".description")).toHaveCount(posts.length);
  await expect(cards.first().locator(".description")).toHaveText(
    "ภาพรวมของ AWS Graviton ที่ให้ประสิทธิภาพแรงขึ้นแต่ราคาถูกลง บ้าไปแล้ววววว",
  );
  expect(
    await cards
      .locator(".title")
      .evaluateAll((titles) => titles.map((t) => t.getAttribute("lang"))),
  ).toEqual(posts.map((p) => p.lang));
  // The card image is decorative; the title names the link.
  await expect(cards.first().locator("img")).toHaveAttribute("alt", "");
  expect(
    await axeViolations(page, [
      "page-has-heading-one",
      "link-name",
      "heading-order",
    ]),
  ).toEqual([]);
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

test("post pages declare their language, share metadata, and structured data", async ({
  page,
  request,
}) => {
  for (const post of posts) {
    await page.goto(`/blog/${post.id}/`);

    await expect(page.locator("html")).toHaveAttribute("lang", post.lang);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      post.lang === "th" ? "th_TH" : "en_US",
    );
    // English page chrome stays marked as English inside Thai posts.
    await expect(page.locator(".site-header")).toHaveAttribute("lang", "en");

    // The cover is decorative on the page (the h1 follows it); share cards
    // describe it instead of reusing the site default.
    await expect(page.locator(".hero-image img")).toHaveAttribute("alt", "");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      `Cover image for ${post.title}`,
    );
    await expect(
      page.locator('meta[property="article:published_time"]'),
    ).toHaveAttribute("content", post.pubDate);

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    );
    expect(jsonLd).toMatchObject({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.pubDate,
      inLanguage: post.lang,
      author: { "@type": "Person" },
    });

    // A resized JPEG, never the original upload.
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImage).toMatch(/(\.jpg$|[?&]f=jpg)/);
    expect(
      Number(
        await page
          .locator('meta[property="og:image:width"]')
          .getAttribute("content"),
      ),
    ).toBeLessThanOrEqual(1200);
    const { pathname, search } = new URL(ogImage!);
    const image = await request.get(pathname + search);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/jpeg");
    expect((await image.body()).length).toBeLessThan(200_000);
  }
});

test("post content images have alt text and image links have names", async ({
  page,
}) => {
  for (const post of posts) {
    await page.goto(`/blog/${post.id}/`);
    const missingAlt = await page
      .locator(".prose img")
      .evaluateAll((images) =>
        images
          .filter((img) => !img.getAttribute("alt")?.trim())
          .map((img) => img.getAttribute("src")),
      );
    expect(missingAlt, post.id).toEqual([]);
    expect(
      await axeViolations(page, [
        "image-alt",
        "link-name",
        "empty-table-header",
        "html-lang-valid",
        "valid-lang",
      ]),
      post.id,
    ).toEqual([]);
  }
});

test("the desktop Blog reader gets the same alt text and image link names", async ({
  page,
}) => {
  await page.goto("/");
  const problems = await page
    .locator(".blog-reader-body")
    .evaluateAll((bodies) =>
      bodies.flatMap((body) => [
        ...[...body.querySelectorAll("img")]
          .filter((img) => !img.getAttribute("alt")?.trim())
          .map((img) => `no alt: ${img.getAttribute("src")}`),
        ...[...body.querySelectorAll("a")]
          .filter(
            (a) =>
              !a.textContent?.trim() &&
              ![...a.querySelectorAll("img")].some((img) => img.alt.trim()),
          )
          .map((a) => `no name: ${a.getAttribute("href")}`),
      ]),
    );
  expect(problems).toEqual([]);
  await expect(page.locator(".blog-reader-body img")).not.toHaveCount(0);
});

test("redirected Graviton citations point at Wayback snapshots of the originals", async ({
  page,
}) => {
  await page.goto("/blog/aws-graviton-ทักครับ/");
  const hrefs = await page
    .locator(".prose a")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  for (const original of [
    "https://www.anandtech.com/show/15578/cloud-clash-amazon-graviton2-arm-against-intel-and-amd/9",
    "https://www.nginx.com/resources/datasheets/nginx-plus-arm-based-aws-graviton2-amis/",
    "https://docs.aws.amazon.com/whitepapers/latest/ec2-networking-for-telecom/overview-of-performance-optimization-options.html",
    "https://docs.aws.amazon.com/whitepapers/latest/aws-graviton2-for-isv/transitioning-your-service-or-application.html",
  ]) {
    expect(hrefs, original).not.toContain(original);
    expect(
      hrefs.some((href) =>
        new RegExp(
          `^https://web\\.archive\\.org/web/\\d{14}/${original}$`,
        ).test(href),
      ),
      original,
    ).toBe(true);
  }
});

test("the Kube Chaos video link reads as a label and keeps its URL", async ({
  page,
}) => {
  await page.goto("/blog/do-the-fun-chaos-engineering-with-gamification/");
  await expect(
    page
      .locator(".prose")
      .getByRole("link", { name: "Kube Chaos demo video (MP4)" }),
  ).toHaveAttribute(
    "href",
    "https://user-images.githubusercontent.com/814180/119267327-07a41c80-bbe6-11eb-87ec-25ee0f96e669.mp4",
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
  await expect(page.locator("#website .ws-post-title")).toHaveText(
    posts.slice(0, 5).map((p) => p.title),
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

  // README: post ids, URLs, and RSS links come from file names; keep them.
  const links = [
    ...feed.matchAll(
      /<item>.*?<link>(.*?)<\/link><guid isPermaLink="true">(.*?)<\/guid>/g,
    ),
  ];
  expect(links.map(([, link]) => link)).toEqual(
    posts.map(({ id }) => `https://pepo.dev/?blog=${encodeURIComponent(id)}`),
  );
  for (const [, link, guid] of links) expect(guid).toBe(link);
});

test("the RSS channel has one Blog in its title, a language, and a self link", async ({
  request,
}) => {
  const feed = await (await request.get("/rss.xml")).text();
  const channel = feed.slice(0, feed.indexOf("<item>"));
  // The channel takes the language most posts are written in.
  const thai = posts.filter((p) => p.lang === "th").length;
  const language = thai > posts.length / 2 ? "th" : "en";

  expect(channel).toContain(`<title>${BLOG_TITLE}</title>`);
  expect(feed).not.toContain("Blog Blog");
  expect(channel).toContain(`<language>${language}</language>`);
  expect(feed).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  expect(channel).toContain(
    '<atom:link href="https://pepo.dev/rss.xml" rel="self" type="application/rss+xml"/>',
  );
});
