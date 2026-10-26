// Desktop experiences: the macOS, Windows and Linux looks Settings offers
// (src/styles/experiences.css), their variants, and the insets that keep
// windows and icons clear of each look's bars.
import { expect, test, type Page } from "@playwright/test";
import { holdChunks, openApp, prefsStorage, resetPage, waitForWindowManager } from "./helpers";

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} has no box`);
  return rect;
}

function experienceOf(page: Page) {
  return page.evaluate(() => [
    document.documentElement.dataset.experience,
    document.documentElement.dataset.experienceVariant,
  ]);
}

test("the experience applies before the desktop boots, and unknown values fall back", async ({
  page,
}) => {
  await resetPage(page, prefsStorage({ experience: "macos", variant: "sequoia" }));
  const chunks = await holdChunks(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  expect(await experienceOf(page)).toEqual(["macos", "sequoia"]);
  chunks.release();
  await waitForWindowManager(page);

  // An unknown variant is the experience's first; an unknown experience is
  // the site's own look.
  for (const [saved, expected] of [
    [{ experience: "windows", variant: "95" }, ["windows", "11"]],
    [{ experience: "beos", variant: "r5" }, ["pepodev", "default"]],
    [{}, ["pepodev", "default"]],
  ] as const) {
    await resetPage(page, prefsStorage(saved));
    expect(await experienceOf(page)).toEqual(expected);
  }
});

test("Settings switches the experience and its style, and shows only the controls that apply", async ({
  page,
}) => {
  await resetPage(page);
  const settings = await openApp(page, "Settings", "settings");
  const experience = settings.locator('[data-setting="experience"]');
  const variant = settings.locator('[data-setting="variant"]');
  const radius = settings.locator('[data-setting="radius"]');
  const glass = settings.locator('[data-setting="glass"]');
  const windowGlass = settings.locator('[data-setting="windowGlass"]');

  // The site's own look has no styles to pick, and keeps its radius slider.
  await expect(experience).toHaveValue("pepodev");
  await expect(variant).toHaveCount(0);
  await expect(radius).toBeVisible();

  await experience.selectOption("windows");
  expect(await experienceOf(page)).toEqual(["windows", "11"]);
  await expect(variant.locator("option")).toHaveText(["Windows 11", "Windows 10"]);
  await expect(radius).toHaveCount(0);
  await expect(glass).toBeVisible();

  // Windows 10 is opaque: no glass preferences.
  await variant.selectOption("10");
  expect(await experienceOf(page)).toEqual(["windows", "10"]);
  await expect(glass).toHaveCount(0);
  await expect(windowGlass).toHaveCount(0);

  // A new experience starts on its default style.
  await experience.selectOption("linux");
  expect(await experienceOf(page)).toEqual(["linux", "gnome"]);
  await expect(variant.locator("option")).toHaveText(["GNOME", "KDE Plasma"]);

  // Saved, so a reload keeps it.
  await page.reload();
  await waitForWindowManager(page);
  expect(await experienceOf(page)).toEqual(["linux", "gnome"]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}")),
  ).toMatchObject({ experience: "linux", variant: "gnome" });
});

test("macOS: traffic lights on the left, a menu bar on top and a centred dock", async ({ page }) => {
  await resetPage(page, prefsStorage({ experience: "macos", variant: "tahoe" }));
  const window = await openApp(page, "About Me", "me");
  const close = await box(page, "#window-me .close-btn");
  const minimize = await box(page, "#window-me .min-btn");
  const zoom = await box(page, "#window-me .max-btn");
  const title = await box(page, "#window-me .window-title");
  const frame = (await window.boundingBox())!;
  expect(close.x).toBeLessThan(minimize.x);
  expect(minimize.x).toBeLessThan(zoom.x);
  expect(zoom.x + zoom.width).toBeLessThan(frame.x + frame.width / 3);
  // The title centres on the window.
  expect(Math.abs(title.x + title.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(2);
  // Each light keeps a target of at least 22px.
  expect(close.width).toBeGreaterThanOrEqual(22);
  expect(close.height).toBeGreaterThanOrEqual(22);

  const viewport = page.viewportSize()!;
  const dock = await box(page, "#taskbar");
  expect(Math.abs(dock.x - (viewport.width - dock.x - dock.width))).toBeLessThan(2);
  expect(viewport.height - (dock.y + dock.height)).toBeGreaterThan(4);
  const clock = await box(page, "#taskbar-clock-button");
  expect(clock.y).toBeLessThan(28);
});

test("a maximized window and the icons keep clear of the menu bar and the dock", async ({ page }) => {
  await resetPage(page, prefsStorage({ experience: "macos", variant: "sequoia" }));
  const viewport = page.viewportSize()!;
  const icons = await page.locator("#desktop-icons .desktop-icon").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().top),
  );
  expect(Math.min(...icons)).toBeGreaterThanOrEqual(28);

  const window = await openApp(page, "Blog", "blog");
  await window.locator(".max-btn").click();
  await expect(window).toHaveClass(/maximized/);
  const frame = (await window.boundingBox())!;
  expect(frame.y).toBe(28);
  expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height - 84 + 1);

  // Back to the site's own look: the window fills the space above its taskbar.
  const settings = await openApp(page, "Settings", "settings");
  await settings.locator('[data-setting="experience"]').selectOption("pepodev");
  await expect.poll(async () => (await window.boundingBox())?.y).toBe(0);
  const taskbar = await box(page, "#taskbar");
  expect(Math.round((await window.boundingBox())!.height)).toBe(Math.round(taskbar.y));
});

test("Windows: controls on the right; 11 centres the taskbar, 10 lines it up on the left", async ({
  page,
}) => {
  await resetPage(page, prefsStorage({ experience: "windows", variant: "11" }));
  await openApp(page, "About Me", "me");
  const frame = await box(page, "#window-me");
  const close = await box(page, "#window-me .close-btn");
  expect(close.x + close.width).toBeGreaterThan(frame.x + frame.width - 2);
  expect(close.width).toBe(46);

  const viewport = page.viewportSize()!;
  const start = await box(page, "#taskbar-start");
  const app = await box(page, '#taskbar-apps [data-app-id="me"]');
  const groupCentre = (start.x + app.x + app.width) / 2;
  expect(Math.abs(groupCentre - viewport.width / 2)).toBeLessThan(viewport.width * 0.05);
  expect((await box(page, "#taskbar")).height).toBe(48);

  await resetPage(page, prefsStorage({ experience: "windows", variant: "10" }));
  await openApp(page, "About Me", "me");
  expect((await box(page, "#taskbar-start")).x).toBeLessThan(4);
  expect((await box(page, "#taskbar")).height).toBe(40);
  await expect(page.locator("#window-me")).toHaveCSS("border-top-left-radius", "0px");
});

test("GNOME: Activities and the clock in a black top bar, the dash at the bottom", async ({ page }) => {
  await resetPage(page, prefsStorage({ experience: "linux", variant: "gnome", theme: "light" }));
  const viewport = page.viewportSize()!;
  const start = await box(page, "#taskbar-start");
  expect(start.y).toBeLessThan(32);
  expect(start.x).toBeLessThan(16);
  const clock = await box(page, "#taskbar-clock-button");
  expect(Math.abs(clock.x + clock.width / 2 - viewport.width / 2)).toBeLessThan(2);
  await expect(page.locator("#taskbar-clock")).toHaveCSS("color", "rgb(255, 255, 255)");

  await openApp(page, "About Me", "me");
  const dash = await box(page, "#taskbar");
  expect(dash.y).toBeGreaterThan(viewport.height - 90);
  // The window's title bar starts below the top bar.
  expect((await box(page, "#window-me")).y).toBeGreaterThanOrEqual(32);
});

test("phones keep the bottom taskbar in every experience", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [experience, variant] of [
    ["macos", "tahoe"],
    ["windows", "11"],
    ["linux", "gnome"],
    ["linux", "kde"],
  ]) {
    await resetPage(page, prefsStorage({ experience, variant }));
    const taskbar = await box(page, "#taskbar");
    expect(taskbar.x, experience).toBe(0);
    expect(taskbar.width, experience).toBe(390);
    expect(taskbar.y + taskbar.height, experience).toBe(844);
    expect((await box(page, "#taskbar-clock-button")).y, experience).toBeGreaterThan(780);
  }
});
