import { existsSync } from "node:fs";
import { expect, type Locator, test, type Page } from "@playwright/test";

// Garden notes are synced from the private vault and gitignored.
test.skip(
  !existsSync("src/content/garden/index.md"),
  "Run `pnpm garden:sync` to sync garden notes first",
);

const notePath = "/garden/knowledge/technical/cloud/google-cloud/google-cloud/";

async function resetPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

// The filter script loads after the page; retype until it has taken effect.
async function filterTree(sidebar: Locator, query: string, expected: Locator) {
  await expect(async () => {
    await sidebar.getByRole("searchbox", { name: "Filter notes" }).fill("");
    await sidebar.getByRole("searchbox", { name: "Filter notes" }).fill(query);
    await expect(expected).toBeVisible({ timeout: 1000 });
  }).toPass();
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
  test(`garden pages fit ${viewport.width}px and scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // CKS has a wide table, which must scroll inside the column.
    for (const path of [notePath, "/garden/knowledge/technical/kubernetes/cks/"]) {
      await page.goto(path);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 1200);

      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("note URLs are slugified vault paths", async ({ page }) => {
  for (const path of [
    "/garden/knowledge/technical/cloud/google-cloud/io-t/",
    "/garden/knowledge/technical/others/bash-and-shell/",
    "/garden/knowledge/business/intellectual-property-ip/",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
});

test("a note renders its title, links, callouts, images, and backlinks", async ({
  page,
}) => {
  await page.goto(notePath);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Google Cloud");
  await expect(page.locator(".garden-breadcrumbs")).toContainText("Garden");
  await expect(page.locator(".garden-meta time")).toBeVisible();

  const prose = page.locator(".prose");
  await expect(prose.locator('details.callout[data-callout="tip"]')).toHaveAttribute(
    "open",
    "",
  );
  await expect(prose.locator("img").first()).toHaveAttribute("srcset", /\s\d+w,/);
  await expect(prose).not.toContainText("[[");
  await expect(prose).not.toContainText("%%");

  await prose.getByRole("link", { name: "IAM", exact: true }).click();
  await expect(page).toHaveURL(/\/garden\/knowledge\/technical\/cloud\/google-cloud\/iam\/$/);
  await expect(page.locator(".garden-backlinks")).toContainText("Google Cloud");
});

test("the sidebar filter narrows the note tree", async ({ page }) => {
  await page.goto("/garden/");

  const sidebar = page.locator(".garden-sidebar");
  await filterTree(sidebar, "kafka", sidebar.getByRole("link", { name: "Kafka" }));
  await expect(sidebar.getByRole("link", { name: "Agile" })).toBeHidden();

  await filterTree(sidebar, "no such note", sidebar.getByText("No notes match."));
});

test("the desktop Garden window browses notes and keeps desktop keys", async ({
  page,
}) => {
  await resetPage(page);
  await page.locator("#desktop-icons").getByRole("button", { name: "Garden" }).click();

  const window = page.locator("#window-garden");
  await expect(window).toBeVisible();
  const frame = page.frameLocator("#window-garden iframe");
  await expect(frame.locator(".garden-title")).toBeVisible();
  // The window titlebar replaces the site header inside the frame.
  await expect(frame.locator(".garden-header")).toBeHidden();
  // External links leave the window instead of loading inside it.
  await expect(frame.locator('.prose a[href^="http"]').first()).toHaveAttribute(
    "target",
    "_blank",
  );

  const sidebar = frame.locator(".garden-sidebar");
  await filterTree(sidebar, "kafka", sidebar.getByRole("link", { name: "Kafka" }));
  await sidebar.getByRole("link", { name: "Kafka" }).click();
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Kafka");

  // Keys pressed inside the frame reach the desktop once the page script runs.
  const quickAccess = page.locator("#start-menu");
  await expect(async () => {
    await frame.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(quickAccess).toHaveClass(/visible/, { timeout: 1000 });
  }).toPass();
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(quickAccess).not.toHaveClass(/visible/);

  await frame.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Escape");
  await expect(window).toBeHidden();
});

test("website mode links recently tended notes into the garden", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("pepodev.viewMode", "website"));
  await page.reload();

  const section = page.locator("#website-garden");
  const nav = page.getByRole("navigation", { name: "Portfolio sections" });
  await expect(nav.getByRole("link", { name: "Garden" })).toBeVisible();
  // Garden is numbered between Writing and Contact.
  await expect(nav.locator("a span")).toContainText(["01", "02", "03", "04", "05", "06"]);
  await expect(section.locator(".ws-post")).toHaveCount(5);
  await expect(page.locator(".ws-channels a[href='/garden/']")).toBeAttached();
  await section.getByRole("link", { name: "Explore the garden" }).click();
  await expect(page).toHaveURL(/\/garden\/$/);
});
