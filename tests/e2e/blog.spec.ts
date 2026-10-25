import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import {
  emulateSaveData,
  holdAppChunks,
  resetPage,
  waitForWindowManager,
} from "./helpers";
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

// The desktop Blog app loads each article on demand from the post's
// /blog/<id>/article.json (src/components/desktop/blog-article.ts) and
// renders its html in .blog-reader-body.
async function fetchArticle(page: Page, id: string) {
  const response = await page.request.get(`/blog/${encodeURIComponent(id)}/article.json`);
  expect(response.ok(), id).toBe(true);
  expect(response.headers()["content-type"], id).toContain("application/json");
  return (await response.json()) as { id: string; html: string };
}

test("the desktop Blog reader gets the same alt text and image link names", async ({
  page,
}) => {
  await page.goto("/blog/");
  let images = 0;
  for (const post of posts) {
    const { html } = await fetchArticle(page, post.id);
    const result = await page.evaluate((markup) => {
      const body = new DOMParser().parseFromString(markup, "text/html").body;
      return {
        images: body.querySelectorAll("img").length,
        problems: [
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
        ],
      };
    }, html);
    expect(result.problems, post.id).toEqual([]);
    images += result.images;
  }
  expect(images).toBeGreaterThan(0);
});

test("every post's article file has the body its page renders", async ({ page }) => {
  for (const post of posts) {
    const article = await fetchArticle(page, post.id);
    expect(article.id).toBe(post.id);
    await page.goto(`/blog/${encodeURIComponent(post.id)}/`);
    // The page renders the same document inside .prose, after its title
    // block; compare what each element is, says and shows. (React drops the
    // whitespace between table cells that the HTML string keeps, so text is
    // compared without whitespace.)
    const describe = (elements: Element[]) =>
      elements.map((element) => ({
        tag: element.tagName,
        id: element.id,
        text: element.textContent?.replace(/\s+/g, ""),
        images: [...element.querySelectorAll("img")].map((img) => ({
          src: img.getAttribute("src"),
          srcset: img.getAttribute("srcset"),
          alt: img.getAttribute("alt"),
        })),
        links: [...element.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      }));
    const { fromPage, fromFile } = await page.evaluate(
      ({ html, describeSource }) => {
        const describe = new Function(`return ${describeSource}`)() as (elements: Element[]) => unknown;
        const prose = document.querySelector(".prose")!;
        const body = new DOMParser().parseFromString(html, "text/html").body;
        return {
          fromPage: describe([...prose.children].filter((element) => !element.matches(".title"))),
          fromFile: describe([...body.children]),
        };
      },
      { html: article.html, describeSource: describe.toString() },
    );
    expect(fromFile, post.id).toEqual(fromPage);
  }
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

  // An archived link never shows the original URL, which no longer leads to
  // the cited page, as its text.
  const archivedTexts = await page
    .locator('.prose a[href^="https://web.archive.org/"]')
    .allInnerTexts();
  expect(archivedTexts.length).toBeGreaterThan(0);
  for (const text of archivedTexts) {
    expect(text.trim()).not.toMatch(/^https?:\/\//);
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

// The bodies the desktop mounts once it is idle (registry mount: "idle").
// Waiting for them leaves no app code in flight that the test did not ask
// for, so none is cut off when the test ends.
async function waitForIdleBodies(page: Page) {
  for (const appId of ["welcome", "sregame", "music"]) {
    await expect(
      page.locator(`#window-${appId} .window-content > :not(.app-loading)`),
    ).not.toHaveCount(0);
  }
}

// Loads a ?blog= link with the Blog app's code held back, as a slow network
// would, and waits until its window is open. A returning visitor's storage
// is set on a page without scripts, so no chunk is in flight when the link
// loads; the visitor saves data, so no idle prefetching is either.
async function openLateDeepLink(page: Page, slug: string) {
  await emulateSaveData(page);
  const chunks = await holdAppChunks(page, ["data-blog-list-view"]);
  await page.goto("/robots.txt");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("pepodev.hasVisited", "true");
    localStorage.setItem(
      "pepodev.commandPaletteHintShown",
      String(Date.now()),
    );
  });
  // The held chunk can be asked for before the load event, which then
  // waits for it.
  await page.goto(`/?blog=${slug}`, { waitUntil: "domcontentloaded" });
  await waitForWindowManager(page);
  const blogWindow = page.locator("#window-blog");
  await expect(blogWindow).toHaveClass(/maximized/);
  await expect
    .poll(() => chunks.requested("data-blog-list-view"))
    .toBeTruthy();
  await waitForIdleBodies(page);
  return { chunks, blogWindow };
}

test("a ?blog= article that arrives late leaves the palette its keys", async ({
  page,
}) => {
  // The article still opens, but focus stays where the visitor moved it
  // since the page loaded: the palette keeps its search, and Enter runs
  // the match for all of it.
  const slug = "aws-local-zone-bangkok-launch";
  const { chunks, blogWindow } = await openLateDeepLink(page, slug);
  const input = page.locator("#command-palette-input");
  await page.keyboard.press("ControlOrMeta+K");
  await expect(input).toBeFocused();
  await page.keyboard.type("calc");

  chunks.release();
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    `cat articles/${slug}`,
  );
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("calc");
  await page.keyboard.press("Enter");
  const calculator = page.locator("#window-calculator");
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("7");
  await expect(calculator.locator(".calculator-value")).toHaveText("7");
  await expect(
    blogWindow.locator(`[data-blog-post][data-blog-slug="${slug}"]`),
  ).toBeVisible();
});

test("a ?blog= article that arrives late leaves the Start menu open", async ({
  page,
}) => {
  const slug = "aws-local-zone-bangkok-launch";
  const { chunks, blogWindow } = await openLateDeepLink(page, slug);
  await page.getByRole("button", { name: "Open start menu" }).click();
  const startMenu = page.locator("#start-menu");
  await expect(startMenu).toHaveClass(/visible/);

  chunks.release();
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    `cat articles/${slug}`,
  );
  await expect(startMenu).toHaveClass(/visible/);
  await expect(
    blogWindow.locator(`[data-blog-slug="${slug}"] [data-blog-back]`),
  ).not.toBeFocused();
  await page.keyboard.type("term");
  await page.keyboard.press("Enter");
  const terminal = page.locator("#window-terminal");
  await expect(terminal).toHaveClass(/focused/);
  await expect(terminal.locator("[data-terminal-input]")).toBeFocused();
});

test("a ?blog= article that arrives after Tabs past its title bar still opens", async ({
  page,
}) => {
  // A click on the title bar starts Tab there, and the fourth Tab waits on
  // the window (its app is not there yet) with the Enter after it. The
  // article then takes focus, which drops the held Tab, so the Enter does
  // not press what the list had where the article is now.
  const slug = "aws-local-zone-bangkok-launch";
  const { chunks, blogWindow } = await openLateDeepLink(page, slug);
  await blogWindow.locator(".window-title").click();
  for (let tab = 0; tab < 4; tab += 1) await page.keyboard.press("Tab");
  await expect(blogWindow).toBeFocused();
  await page.keyboard.press("Enter");

  chunks.release();
  const article = blogWindow.locator(
    `[data-blog-post][data-blog-slug="${slug}"]`,
  );
  const command = blogWindow.locator("[data-blog-command]");
  await expect(article.locator("[data-blog-back]")).toBeFocused();
  await expect(command).toHaveText(`cat articles/${slug}`);
  // Still so once the article's text has loaded.
  await expect(article.locator(".blog-reader-body")).not.toBeEmpty();
  await expect(article.locator("[data-blog-back]")).toBeFocused();
  await expect(command).toHaveText(`cat articles/${slug}`);
  await expect(blogWindow.locator("[data-blog-post]:visible")).toHaveCount(1);
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
  // Scoped: the Garden section lists notes with the same row styles.
  await expect(page.locator("#website-writing .ws-post-title")).toHaveText(
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
