import { expect, test, type Page } from "@playwright/test";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};
import projects from "../../src/data/projects.json" with { type: "json" };

// These tests check rules the portfolio data must keep, not its current
// values, so renewing a certification or archiving a repo needs no test edit.

// The earner-only /earner/earned/badge/<id> form shows visitors a sign-in
// page; the public badge page needs no account.
const publicBadge =
  /^https:\/\/www\.credly\.com\/badges\/[0-9a-f-]{36}\/public_url$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

async function openWebsite(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("data-spec-ready")) return;
    sessionStorage.setItem("data-spec-ready", "1");
    localStorage.clear();
    localStorage.setItem("pepodev.viewMode", "website");
  });
  await page.goto("/");
  const website = page.locator("#website");
  await expect(website).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return website;
}

test("certifications link to public Credly badges", async ({
  page,
  request,
}) => {
  const credlyUrls = certifications.map(({ credlyUrl }) => credlyUrl);
  for (const { name, credlyUrl, issueDate, expirationDate } of certifications) {
    expect(credlyUrl, name).toMatch(publicBadge);
    expect(issueDate, name).toMatch(isoDate);
    expect(expirationDate, name).toMatch(isoDate);
    expect(issueDate < expirationDate, name).toBe(true);
  }

  // The desktop wallet, website mode and the resume all use these links.
  for (const path of ["/", "/resume"]) {
    expect(await (await request.get(path)).text(), path).not.toContain(
      "/earner/earned/",
    );
    await page.goto(path);
    const hrefs = await page
      .locator('a[href*="credly.com"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.length, path).toBeGreaterThanOrEqual(certifications.length);
    expect(new Set(hrefs), path).toEqual(new Set(credlyUrls));
  }
});

test("project links use https and the repository's current name", async ({
  page,
  request,
}) => {
  for (const project of projects) {
    expect(project.link, project.name).toMatch(/^https:\/\//);
    expect(project.github, project.name).toBe(
      `https://github.com/PePoDev/${project.name}`,
    );
  }
  // The repo renamed to guessle left its old host without DNS.
  expect(await (await request.get("/")).text()).not.toContain("number-guesser");

  const website = await openWebsite(page);
  for (const project of projects.filter(({ archived }) => !archived)) {
    const card = website.locator(".ws-svc", {
      has: page.getByRole("heading", { name: project.name, exact: true }),
    });
    await expect(
      card.getByRole("link", { name: /^Source/ }),
      project.name,
    ).toHaveAttribute("href", project.github);
    if (project.link !== project.github) {
      await expect(
        card.locator(".ws-svc-links a").first(),
        project.name,
      ).toHaveAttribute("href", project.link);
    }
  }
  // The desktop Projects cards open the same links.
  expect(
    await page
      .locator("#window-project .project-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href"))),
  ).toEqual(projects.map(({ link }) => link));
});

test("only unarchived repositories are shown as active", async ({ page }) => {
  const active = projects.filter(({ archived }) => !archived);

  const website = await openWebsite(page);
  await expect(website.locator(".ws-svc h3")).toHaveText(
    active.map(({ name }) => name),
  );
  await expect(website.locator(".ws-svc .ws-state")).toHaveCount(active.length);
  await expect(website.locator("#website-projects .ws-sec-meta")).toHaveText(
    `${active.length} active · ${projects.length - active.length} archived`,
  );

  // However many are active, the first row of up to four cards spans the
  // whole grid instead of leaving empty columns.
  await page.setViewportSize({ width: 1440, height: 900 });
  const row = await website.locator(".ws-svc-grid").evaluate((grid) => {
    const box = grid.getBoundingClientRect();
    const cards = [...grid.children].map((card) =>
      card.getBoundingClientRect(),
    );
    const firstRow = cards.filter(({ top }) => top === cards[0]?.top);
    return {
      cards: firstRow.length,
      left: firstRow.length ? firstRow[0].left - box.left : 0,
      right: firstRow.length ? box.right - firstRow.at(-1)!.right : 0,
    };
  });
  expect(row.cards).toBe(Math.min(active.length, 4));
  expect(Math.abs(row.left)).toBeLessThan(1);
  expect(Math.abs(row.right)).toBeLessThan(1);

  const cards = page.locator("#window-project .project-card");
  await expect(cards).toHaveCount(projects.length);
  for (const [index, project] of projects.entries()) {
    await expect(
      cards.nth(index).locator(".project-archived-badge"),
      project.name,
    ).toHaveCount(project.archived ? 1 : 0);
  }
});

test("project copy has no typos", () => {
  const copy = projects
    .flatMap(({ description, summary }) => [description, summary ?? ""])
    .join("\n");
  for (const typo of [
    /never easy than/i,
    /intergrate/i,
    /by destroy\b/i,
    /for collect\b/i,
    /make report/i,
    /will found/i,
    /every grow\b/i,
  ]) {
    expect(copy).not.toMatch(typo);
  }
});

test("experience bullets use product names and never repeat their verb", async ({
  page,
}) => {
  const details = experiences.flatMap((experience) => experience.details);
  for (const wrong of [
    /Argo-Rollout/,
    /\bArgoCD\b/,
    /AWS Athena/,
    /Kafka Strimzi/,
    /\bGolang\b/,
  ]) {
    expect(details.join("\n")).not.toMatch(wrong);
  }

  const website = await openWebsite(page);
  await website.locator("details.ws-more").evaluateAll((elements) => {
    for (const details of elements) (details as HTMLDetailsElement).open = true;
  });
  const lines = await website.locator(".ws-changes li").evaluateAll((items) =>
    items.map((item) => ({
      verb: item.querySelector(".ws-tag")?.textContent ?? "",
      text: item.querySelector(".ws-tag + span")?.textContent ?? "",
    })),
  );
  expect(lines).toHaveLength(details.length);
  for (const { verb, text } of lines) {
    expect(text.split(" ")[0].toLowerCase(), `${verb} ${text}`).not.toBe(
      verb.toLowerCase(),
    );
  }
});

test("website mode spells resume one way", async ({ page }) => {
  const website = await openWebsite(page);
  await expect(website).not.toContainText(/résumé/i);
  await expect(
    website.getByRole("link", { name: /^Full resume/ }),
  ).toHaveAttribute("href", /resume/);
});

// A config guard: without the integration, .mdx posts are left out of the
// build with only a glob-loader warning.
test("Astro config registers the MDX integration", async () => {
  const { default: config } = await import("../../astro.config.mjs");
  expect(
    config.integrations.map((integration: { name: string }) => integration.name),
  ).toContain("@astrojs/mdx");
});
