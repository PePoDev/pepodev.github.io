import { expect, test, type Page } from "@playwright/test";
import { resetPage } from "./helpers";

const layoutViewports = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 820, height: 1180 },
];

// Widths where the left-origin grid leaves most of a column spare on the right.
const wideViewports = [
  { width: 1600, height: 900 },
  { width: 1680, height: 1050 },
];

type IconBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Resize events fire before the next animation frame callbacks.
async function resizeViewport(
  page: Page,
  size: { width: number; height: number },
) {
  await page.setViewportSize(size);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
}

async function getIconBoxes(page: Page): Promise<IconBox[]> {
  return page.locator(".desktop-icon").evaluateAll((icons) =>
    icons.map((icon) => {
      const rect = icon.getBoundingClientRect();
      return {
        id: (icon as HTMLElement).dataset.openApp || icon.id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

function findOverlaps(boxes: IconBox[]) {
  const overlaps: string[] = [];
  boxes.forEach((a, index) => {
    boxes.slice(index + 1).forEach((b) => {
      if (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      ) {
        overlaps.push(`${a.id} overlaps ${b.id}`);
      }
    });
  });
  return overlaps;
}

async function expectIconsUnstacked(page: Page) {
  const boxes = await getIconBoxes(page);
  const taskbar = await page.locator("#taskbar").boundingBox();
  expect(taskbar).not.toBeNull();

  for (const box of boxes) {
    expect(box.width, box.id).toBeGreaterThan(0);
    expect(box.y + box.height, box.id).toBeLessThanOrEqual(taskbar!.y);
  }
  expect(findOverlaps(boxes)).toEqual([]);
}

async function getIconBoxMap(page: Page) {
  return new Map((await getIconBoxes(page)).map((box) => [box.id, box]));
}

async function getSavedIconKeys(page: Page) {
  return page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => /^pepodev\.(desktopIcon|linkIcon)\./.test(key))
      .sort(),
  );
}

test.beforeEach(async ({ page }) => {
  await resetPage(page);
});

for (const viewport of layoutViewports) {
  test(`places every desktop icon in its own cell at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.reload();

    await expectIconsUnstacked(page);
    await expect(page.locator("#link-email")).toBeVisible();
    await expect(page.locator("#link-resume")).toBeVisible();
  });
}

for (const viewport of wideViewports) {
  test(`keeps the link column against the right edge at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.reload();

    const webring = await page.locator("#link-webring").boundingBox();
    expect(webring).not.toBeNull();
    expect(webring!.x + webring!.width).toBeGreaterThanOrEqual(
      viewport.width - 24,
    );
    await expectIconsUnstacked(page);
  });
}

test("a saved icon in a link cell moves later links down, not Webring", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const freshBoxes = await getIconBoxMap(page);
  const cellOf = (box: IconBox | undefined) => ({ x: box?.x, y: box?.y });
  const githubCell = cellOf(freshBoxes.get("link-github"));

  // A drag on a wider screen can save About Me into GitHub's default cell.
  await page.evaluate(
    (position) =>
      localStorage.setItem(
        "pepodev.desktopIcon.v3.me",
        JSON.stringify(position),
      ),
    githubCell,
  );
  await page.reload();

  const boxes = await getIconBoxMap(page);
  expect(cellOf(boxes.get("me"))).toEqual(githubCell);
  expect(cellOf(boxes.get("link-webring"))).toEqual(
    cellOf(freshBoxes.get("link-webring")),
  );
  expect(cellOf(boxes.get("link-github"))).toEqual(
    cellOf(freshBoxes.get("link-linkedin")),
  );
  await expectIconsUnstacked(page);
});

test("keeps the mobile launcher grid free of fixed icon positions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  const positions = await page
    .locator(".desktop-icon")
    .evaluateAll((icons) =>
      icons.map((icon) => (icon as HTMLElement).style.position),
    );
  expect(positions.every((position) => position === "")).toBe(true);
});

test("a desktop resize re-clamps icons without saving positions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const initialBoxes = await getIconBoxes(page);

  await resizeViewport(page, { width: 900, height: 600 });
  await expectIconsUnstacked(page);

  await resizeViewport(page, { width: 1440, height: 900 });
  expect(await getIconBoxes(page)).toEqual(initialBoxes);
  expect(await getSavedIconKeys(page)).toEqual([]);

  await page.reload();
  expect(await getIconBoxes(page)).toEqual(initialBoxes);
});

test("a dragged icon keeps its saved cell through a resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const welcome = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Welcome" });
  const welcomeBox = (await welcome.boundingBox())!;
  const issueBox = (await page.locator("#link-issue").boundingBox())!;
  // The empty cell three grid columns (88px each) left of Report Issue. It
  // does not exist at 900x600, so the resize has to re-clamp Welcome.
  const target = { x: issueBox.x - 3 * 88, y: issueBox.y };
  const getSavedWelcome = () =>
    page.evaluate(() => localStorage.getItem("pepodev.desktopIcon.v3.welcome"));

  await page.mouse.move(
    welcomeBox.x + welcomeBox.width / 2,
    welcomeBox.y + welcomeBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + welcomeBox.width / 2,
    target.y + welcomeBox.height / 2,
  );
  await page.mouse.up();

  await expect.poll(() => welcome.boundingBox()).toMatchObject(target);
  const droppedBox = await welcome.boundingBox();
  const savedWelcome = await getSavedWelcome();
  expect(await getSavedIconKeys(page)).toEqual([
    "pepodev.desktopIcon.v3.welcome",
  ]);

  await resizeViewport(page, { width: 900, height: 600 });
  await expectIconsUnstacked(page);
  expect(await welcome.boundingBox()).not.toEqual(droppedBox);
  await resizeViewport(page, { width: 1440, height: 900 });
  expect(await welcome.boundingBox()).toEqual(droppedBox);
  expect(await getSavedWelcome()).toBe(savedWelcome);
  expect(await getSavedIconKeys(page)).toEqual([
    "pepodev.desktopIcon.v3.welcome",
  ]);

  await page.reload();
  expect(await welcome.boundingBox()).toEqual(droppedBox);
});

test("a resize in website mode leaves desktop icons unstacked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.setItem("pepodev.viewMode", "website");
  });
  await page.reload();
  await expect(page.locator("#desktop")).toBeHidden();

  await resizeViewport(page, { width: 900, height: 600 });
  await resizeViewport(page, { width: 1440, height: 900 });
  await page
    .locator("#website header")
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();
  await expect(page.locator("#desktop")).toBeVisible();

  await expectIconsUnstacked(page);
  expect(await getSavedIconKeys(page)).toEqual([]);

  await page.reload();
  await expectIconsUnstacked(page);
});

test("drops icon positions saved by older layout versions", async ({
  page,
}) => {
  const freshBoxes = await getIconBoxes(page);

  // Older versions saved every icon at 20,20 after a website-mode resize.
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>(".desktop-icon[data-open-app]")
      .forEach((icon) => {
        localStorage.setItem(
          `pepodev.desktopIcon.v2.${icon.dataset.openApp}`,
          JSON.stringify({ x: 20, y: 20 }),
        );
      });
    localStorage.setItem(
      "pepodev.linkIcon.v3.link-resume",
      JSON.stringify({ x: 20, y: 20 }),
    );
  });
  await page.reload();

  expect(await getIconBoxes(page)).toEqual(freshBoxes);
  expect(await getSavedIconKeys(page)).toEqual([]);
});

test("swapping an app icon onto a link icon persists both positions", async ({
  page,
}) => {
  const aboutMe = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  const github = page.locator("#link-github");
  const aboutMeBox = await aboutMe.boundingBox();
  const githubBox = await github.boundingBox();

  await aboutMe.dragTo(github);

  await expect.poll(() => aboutMe.boundingBox()).toEqual(githubBox);
  await expect.poll(() => github.boundingBox()).toEqual(aboutMeBox);
  expect(await getSavedIconKeys(page)).toEqual([
    "pepodev.desktopIcon.v3.me",
    "pepodev.linkIcon.v4.link-github",
  ]);

  await page.reload();
  expect(await aboutMe.boundingBox()).toEqual(githubBox);
  expect(await github.boundingBox()).toEqual(aboutMeBox);
  await expectIconsUnstacked(page);
});

test("dragging a link icon closes Quick Access, as an app icon's drag does, and opens nothing", async ({
  page,
  context,
}) => {
  await page.locator("#taskbar-start").click();
  const quickAccess = page.locator("#start-menu");
  await expect(quickAccess).toHaveClass(/visible/);
  // The rightmost shortcut, clear of Quick Access.
  const links = await page
    .locator("#desktop-links a.desktop-link-icon")
    .evaluateAll((icons) =>
      icons
        .map((icon) => ({ id: icon.id, x: icon.getBoundingClientRect().x }))
        .sort((a, b) => b.x - a.x),
    );
  const box = (await page.locator(`#${links[0].id}`).boundingBox())!;
  // A new tab would arrive a moment after the click: wait for one.
  const opened = context
    .waitForEvent("page", { timeout: 1500 })
    .then(() => true, () => false);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 110, box.y + box.height / 2 + 10, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(quickAccess).not.toHaveClass(/visible/);
  expect(await opened).toBe(false);
});

test("swapping a link icon onto an app icon persists both positions", async ({
  page,
}) => {
  const resume = page.locator("#link-resume");
  const blog = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Blog" });
  const resumeBox = await resume.boundingBox();
  const blogBox = await blog.boundingBox();

  await resume.dragTo(blog);

  await expect.poll(() => resume.boundingBox()).toEqual(blogBox);
  await expect.poll(() => blog.boundingBox()).toEqual(resumeBox);

  await page.reload();
  expect(await resume.boundingBox()).toEqual(blogBox);
  expect(await blog.boundingBox()).toEqual(resumeBox);
  await expectIconsUnstacked(page);
});

test("reset desktop and reset all settings clear saved icon positions", async ({
  page,
}) => {
  // Both resets also clear pepodev.hasVisited, so the first-visit Welcome
  // window would open over the icons 1.5s after each reload.
  await page.addInitScript(() => {
    if (!localStorage.getItem("pepodev.hasVisited")) {
      localStorage.setItem("pepodev.hasVisited", "true");
    }
  });
  const welcome = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Welcome" });
  const blog = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Blog" });
  const welcomeBox = await welcome.boundingBox();

  await welcome.dragTo(blog);
  expect(await getSavedIconKeys(page)).toHaveLength(2);

  let reloaded = page.waitForEvent("load");
  await page.keyboard.press("ControlOrMeta+K");
  await page.locator("#start-menu-search").fill("reset desktop");
  // The first Enter only asks for confirmation.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await reloaded;
  expect(await getSavedIconKeys(page)).toEqual([]);
  expect(await welcome.boundingBox()).toEqual(welcomeBox);

  await welcome.dragTo(blog);
  expect(await getSavedIconKeys(page)).toHaveLength(2);

  await page
    .locator("#taskbar-settings")
    .click();
  // Like Reset Desktop, the first click only asks for confirmation, and
  // clicking elsewhere cancels it.
  const settings = page.locator("#window-settings");
  const resetAll = settings.getByRole("button", { name: "Reset all settings" });
  const status = settings.locator("[data-settings-status]");
  await resetAll.click();
  await expect(resetAll).toHaveClass(/confirming/);
  await expect(status).toHaveText(
    "Press Enter or click Reset all settings again to clear all settings and reload.",
  );
  await expect(status).toHaveAttribute("role", "status");
  await settings.locator("h2").first().click();
  await expect(resetAll).not.toHaveClass(/confirming/);
  await expect(status).toBeEmpty();
  expect(await getSavedIconKeys(page)).toHaveLength(2);

  await resetAll.click();
  reloaded = page.waitForEvent("load");
  await resetAll.click();
  await reloaded;
  expect(await getSavedIconKeys(page)).toEqual([]);
  expect(await welcome.boundingBox()).toEqual(welcomeBox);
});

test("a drop keeps its cell when a displaced saved icon maps to it", async ({
  page,
}) => {
  // Welcome and Projects were saved on a taller screen; at 1280x720 both map
  // to the cell Projects is shown in, so Welcome is displaced.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    localStorage.setItem("pepodev.hasVisited", "true");
    localStorage.setItem(
      "pepodev.desktopIcon.v3.welcome",
      JSON.stringify({ x: 900, y: 706 }),
    );
    localStorage.setItem(
      "pepodev.desktopIcon.v3.project",
      JSON.stringify({ x: 900, y: 510 }),
    );
  });
  await page.reload();
  await expectIconsUnstacked(page);

  const icon = (name: string) =>
    page.locator("#desktop-icons").getByRole("button", { name, exact: true });
  const terminal = icon("Terminal");
  const projects = icon("Projects");
  const welcome = icon("Welcome");
  const terminalBox = await terminal.boundingBox();
  const projectsBox = await projects.boundingBox();
  const welcomeBox = await welcome.boundingBox();

  await terminal.dragTo(projects);

  await expect.poll(() => terminal.boundingBox()).toEqual(projectsBox);
  await expect.poll(() => projects.boundingBox()).toEqual(terminalBox);
  expect(await welcome.boundingBox()).toEqual(welcomeBox);

  await page.reload();
  expect(await terminal.boundingBox()).toEqual(projectsBox);
  expect(await projects.boundingBox()).toEqual(terminalBox);
  expect(await welcome.boundingBox()).toEqual(welcomeBox);
  await expectIconsUnstacked(page);
});
