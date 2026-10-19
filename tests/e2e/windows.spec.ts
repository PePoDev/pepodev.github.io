import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// Returning visitors: no Welcome window or palette tip toast to get in the way.
async function resetPage(page: Page, storage: Record<string, string> = {}) {
  await page.goto("/");
  await page.evaluate((items) => {
    localStorage.clear();
    localStorage.setItem("pepodev.hasVisited", "true");
    localStorage.setItem("pepodev.commandPaletteHintShown", String(Date.now()));
    for (const [key, value] of Object.entries(items))
      localStorage.setItem(key, value);
  }, storage);
  await page.reload();
}

async function openApp(page: Page, label: string, appId: string) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).not.toHaveClass(/opening/);
  return window;
}

async function dragBy(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

// Pixels across the title bar row that grab the title bar itself, not its
// window controls or the resize handle.
async function countTitlebarGrabPixels(page: Page, y: number) {
  return page.evaluate((row) => {
    let count = 0;
    for (let x = 0; x < window.innerWidth; x++) {
      const element = document.elementFromPoint(x, row);
      if (
        element?.closest(".window-titlebar") &&
        !element.closest(".window-controls, .window-resize-handle")
      )
        count++;
    }
    return count;
  }, y);
}

async function countDrawFrames(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __drawFrames?: number }).__drawFrames ?? 0,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetPage(page);
});

test("windows are non-modal dialogs named by their title", async ({ page }) => {
  await openApp(page, "About Me", "me");
  const dialog = page.getByRole("dialog", { name: "About Me" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await expect(
    page.getByRole("dialog", { name: "Blog - Articles" }),
  ).toHaveCount(0);
});

test("a minimized window is inert and hidden from assistive tech until restored", async ({
  page,
}) => {
  const window = await openApp(page, "About Me", "me");
  await window.getByRole("button", { name: "Minimize About Me" }).click();
  await expect(window).toHaveClass(/minimized/);
  await expect(window).toHaveAttribute("aria-hidden", "true");
  expect(
    await window.evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);

  // Tab from the last desktop shortcut no longer lands in the invisible window.
  await page.locator("#link-webring").focus();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("#window-me")),
      ),
    ).toBe(false);
  }

  await page
    .locator("#taskbar-apps")
    .getByRole("button", { name: "About Me" })
    .click();
  await expect(window).not.toHaveClass(/minimized/);
  await expect(window).toHaveAttribute("aria-hidden", "false");
  expect(
    await window.evaluate((element) => (element as HTMLElement).inert),
  ).toBe(false);
});

test("dragging keeps a window's title bar above the taskbar and on screen", async ({
  page,
}) => {
  const window = await openApp(page, "Blog", "blog");
  const titlebar = window.locator(".window-titlebar");
  const taskbar = (await page.locator("#taskbar").boundingBox())!;

  let box = (await titlebar.boundingBox())!;
  await dragBy(
    page,
    { x: box.x + 120, y: box.y + 20 },
    { x: box.x + 120, y: 895 },
  );
  box = (await titlebar.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(taskbar.y);
  expect(
    await page.evaluate(
      ([x, y]) =>
        Boolean(document.elementFromPoint(x, y)?.closest("#window-blog")),
      [box.x + 60, box.y + box.height / 2],
    ),
  ).toBe(true);

  // Far off either side, part of the title bar stays to grab: off the left
  // edge, that is beside the window controls, not under them.
  await dragBy(page, { x: box.x + 100, y: box.y + 20 }, { x: -800, y: 300 });
  box = (await titlebar.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThanOrEqual(100);
  expect(
    await countTitlebarGrabPixels(page, box.y + box.height / 2),
  ).toBeGreaterThanOrEqual(100);

  await dragBy(page, { x: 10, y: box.y + 20 }, { x: 2400, y: 300 });
  box = (await titlebar.boundingBox())!;
  expect(1440 - box.x).toBeGreaterThanOrEqual(100);
  expect(
    await countTitlebarGrabPixels(page, box.y + box.height / 2),
  ).toBeGreaterThanOrEqual(100);

  // A smaller viewport pulls it back too.
  await page.setViewportSize({ width: 1000, height: 600 });
  await expect
    .poll(async () => {
      const bar = (await titlebar.boundingBox())!;
      const dock = (await page.locator("#taskbar").boundingBox())!;
      return bar.y + bar.height <= dock.y && 1000 - bar.x >= 100;
    })
    .toBe(true);
});

test("a maximized window stops at the taskbar and its Maximize button reads Restore", async ({
  page,
}) => {
  const window = await openApp(page, "Blog", "blog");
  await window
    .getByRole("button", { name: "Maximize Blog - Articles" })
    .click();
  await expect(window).toHaveClass(/maximized/);

  const box = (await window.boundingBox())!;
  const taskbar = (await page.locator("#taskbar").boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(Math.round(taskbar.y));

  const restore = window.getByRole("button", {
    name: "Restore Blog - Articles",
  });
  await expect(restore).toHaveAttribute("title", "Restore");
  await restore.click();
  await expect(window).not.toHaveClass(/maximized/);
  await expect(
    window.getByRole("button", { name: "Maximize Blog - Articles" }),
  ).toHaveAttribute("title", "Maximize");
});

test("opening an app from the keyboard focuses its window, and closing returns focus to the launcher", async ({
  page,
}) => {
  const icon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  await icon.focus();
  await page.keyboard.press("Enter");
  const window = page.locator("#window-me");
  await expect(window).toBeFocused();
  await expect(window).toHaveClass(/focused/);

  // The next Tab reaches the window's own controls, and the window itself
  // leaves the Tab order again.
  await page.keyboard.press("Tab");
  await expect(
    window.getByRole("button", { name: "Minimize About Me" }),
  ).toBeFocused();
  await expect(window).not.toHaveAttribute("tabindex");

  await page.keyboard.press("Escape");
  await expect(window).toBeHidden();
  await expect(icon).toBeFocused();
});

test("pointer opens leave keyboard focus where it was", async ({ page }) => {
  const icon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  await icon.click();
  await expect(page.locator("#window-me")).toHaveClass(/focused/);
  await expect(page.locator("#window-me")).not.toBeFocused();
});

test("a click inside a window leaves keyboard scrolling to its content", async ({
  page,
}) => {
  const blog = await openApp(page, "Blog", "blog");
  const content = blog.locator(".window-content");
  const prompt = blog.locator("[data-blog-terminal] .prompt");
  await prompt.click();
  await expect(blog).not.toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  // After a keyboard open focuses the window, a click still hands keyboard
  // scrolling to the content.
  await page.keyboard.press("Escape");
  await expect(blog).toBeHidden();
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Blog" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(blog).toBeFocused();
  await expect(blog).not.toHaveClass(/opening/);
  await content.evaluate((element) => (element.scrollTop = 0));
  await prompt.click();
  await expect(blog).not.toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});

test("closing a window with the pointer hands the keys to the next app", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");

  const about = await openApp(page, "About Me", "me");
  await about.getByRole("button", { name: "Close About Me" }).click();
  await expect(about).toBeHidden();
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("7");
  await expect(value).toHaveText("7");

  // Escape on a window opened with the pointer does the same.
  await openApp(page, "About Me", "me");
  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("9");
  await expect(value).toHaveText("79");
});

test("Escape on a window's own taskbar button returns focus to its icon", async ({
  page,
}) => {
  const about = await openApp(page, "About Me", "me");
  await page
    .locator("#taskbar-apps")
    .getByRole("button", { name: "About Me" })
    .focus();
  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await expect(
    page.locator("#desktop-icons").getByRole("button", { name: "About Me" }),
  ).toBeFocused();
});

test("closing a window whose launcher is gone hands focus to the next window", async ({
  page,
}) => {
  const work = await openApp(page, "Work", "work");

  // Start menu items close with the menu.
  await page.locator("#taskbar-start").focus();
  await page.keyboard.press("Enter");
  await page.locator('#start-menu [data-open-app="me"]').focus();
  await page.keyboard.press("Enter");
  const about = page.locator("#window-me");
  await expect(about).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await expect(work).toBeFocused();
  await expect(work).toHaveClass(/focused/);

  // Work's launcher, the desktop icon, is still there.
  await page.keyboard.press("Escape");
  await expect(work).toBeHidden();
  await expect(
    page.locator("#desktop-icons").getByRole("button", { name: "Work" }),
  ).toBeFocused();
});

test("taskbar buttons keep keyboard focus and restore windows into focus", async ({
  page,
}) => {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" })
    .focus();
  await page.keyboard.press("Enter");
  const window = page.locator("#window-me");
  await expect(window).toBeFocused();

  // Minimizing the only window leaves focus on the button that restores it.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(window).toHaveClass(/minimized/);
  const taskbarButton = page
    .locator("#taskbar-apps")
    .getByRole("button", { name: "About Me" });
  await expect(taskbarButton).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(window).not.toHaveClass(/minimized/);
  await expect(window).toBeFocused();
});

test("phone-width taskbar window buttons have accessible names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, "Work", "work");
  await page.getByRole("button", { name: "Open start menu" }).click();
  await page.locator('#start-menu [data-open-app="settings"]').click();
  await expect(page.locator("#window-settings")).toBeVisible();

  const taskbarApps = page.locator("#taskbar-apps");
  await expect(taskbarApps.locator(".taskbar-app span").first()).toBeHidden();
  await expect(taskbarApps.getByRole("button", { name: "Work" })).toBeVisible();
  await expect(
    taskbarApps.getByRole("button", { name: "Settings" }),
  ).toBeVisible();

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (
            context: string,
            options: object,
          ) => Promise<{ violations: { id: string }[] }>;
        };
      }
    ).axe;
    const result = await axe.run("#taskbar-apps", { runOnly: ["button-name"] });
    return result.violations.map((violation) => violation.id);
  });
  expect(violations).toEqual([]);
});

test("a scrolling window body with nothing focusable is a labelled tab stop", async ({
  page,
}) => {
  const about = await openApp(page, "About Me", "me");
  const content = about.locator(".window-content");
  await expect(content).toHaveAttribute("tabindex", "0");
  await expect(
    page.getByRole("group", { name: "About Me content" }),
  ).toBeVisible();

  await about.getByRole("button", { name: "Close About Me" }).focus();
  await page.keyboard.press("Tab");
  await expect(content).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  // Content with its own controls is reached through them.
  const blog = await openApp(page, "Blog", "blog");
  await expect(blog.locator(".window-content")).not.toHaveAttribute("tabindex");

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (
            context: string,
            options: object,
          ) => Promise<{ violations: { id: string }[] }>;
        };
      }
    ).axe;
    const result = await axe.run("#window-me", {
      runOnly: [
        "scrollable-region-focusable",
        "aria-prohibited-attr",
        "aria-allowed-attr",
      ],
    });
    return result.violations.map((violation) => violation.id);
  });
  expect(violations).toEqual([]);
});

test("the mode switch is an action button with no pressed state", async ({
  page,
}) => {
  const taskbarSwitch = page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" });
  await expect(taskbarSwitch).not.toHaveAttribute("aria-pressed");
  await taskbarSwitch.click();

  const websiteSwitch = page
    .locator("#website header")
    .getByRole("button", { name: "Switch to desktop mode" });
  await expect(websiteSwitch).toBeVisible();
  await expect(websiteSwitch).not.toHaveAttribute("aria-pressed");
});

test("without scripts, mode switches are named right and shortcuts show", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/");

  const websiteSwitch = page.locator("#website header [data-site-mode-toggle]");
  await expect(websiteSwitch).toHaveAttribute(
    "aria-label",
    "Switch to desktop mode",
  );
  await expect(websiteSwitch.locator("[data-site-mode-label]")).toHaveText(
    "Desktop mode",
  );
  await expect(page.locator("#taskbar-site-mode")).toHaveAttribute(
    "aria-label",
    "Switch to website mode",
  );

  // The shortcut links work without scripts, so they are not hidden.
  await expect(page.locator("#link-webring")).toBeVisible();
  await context.close();
});

test("two-way mode switches hand focus to the other panel's switch", async ({
  page,
}) => {
  const taskbarSwitch = page.locator("#taskbar-site-mode");
  const websiteSwitch = page.locator("#website header [data-site-mode-toggle]");

  await taskbarSwitch.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#website")).toBeVisible();
  await expect(websiteSwitch).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(taskbarSwitch).toBeFocused();
});

test("switching to desktop and back keeps the website scroll position", async ({
  page,
}) => {
  await resetPage(page, { "pepodev.viewMode": "website" });
  await page.evaluate(() =>
    window.scrollTo({ top: 2000, behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(2000);

  // Keyboard presses, so nothing scrolls the header into view first.
  await page.evaluate(() =>
    document
      .querySelector<HTMLElement>("#website header [data-site-mode-toggle]")
      ?.focus({ preventScroll: true }),
  );
  await page.keyboard.press("Enter");
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#taskbar-site-mode")).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("#website")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(2000);
});

test("after a ?blog= deep link, choosing website mode survives a reload", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("pepodev.viewMode", "website"),
  );
  await page.goto("/?blog=aws-local-zone-bangkok-launch");
  const blogWindow = page.locator("#window-blog");
  await expect(
    blogWindow.locator(
      '[data-blog-post][data-blog-slug="aws-local-zone-bangkok-launch"]',
    ),
  ).toBeVisible();
  // The deep link alone does not overwrite the saved preference.
  expect(
    await page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
  ).toBe("website");

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(page.locator("#website")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "website",
  );
  await expect(page.locator("#website")).toBeVisible();
});

test("desktop icons stay hidden until placed, so the first layout does not shift", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe = window as typeof window & { __iconShift?: number };
    probe.__iconShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources: { node?: Node }[];
      })[]) {
        if (entry.hadRecentInput) continue;
        if (
          entry.sources.some((source) =>
            (source.node as Element | undefined)?.closest?.(".desktop-icon"),
          )
        )
          probe.__iconShift! += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.reload();
  await expect(
    page.locator(".desktop-icon:not([data-desktop-icon-ready])"),
  ).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __iconShift?: number }).__iconShift,
    ),
  ).toBeLessThan(0.1);

  // An icon the grid has not placed yet is not painted.
  const visibility = await page.locator("#link-webring").evaluate((icon) => {
    icon.removeAttribute("data-desktop-icon-ready");
    return getComputedStyle(icon).visibility;
  });
  expect(visibility).toBe("hidden");
});

test("reduced motion keeps the desktop background still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const probe = window as typeof window & { __drawFrames?: number };
    probe.__drawFrames = 0;
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      if (callback.name === "draw") probe.__drawFrames! += 1;
      return requestFrame(callback);
    };
  });
  await page.reload();
  await page.waitForTimeout(400);
  expect(await countDrawFrames(page)).toBe(0);

  // One still frame is painted instead.
  const alpha = await page.locator("#bg-canvas").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d")!;
    return context.getImageData(10, 10, 1, 1).data[3];
  });
  expect(alpha).toBe(255);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => countDrawFrames(page)).toBeGreaterThan(2);
});

test("scripts that must run while the page parses opt out of Rocket Loader", async ({
  page,
}) => {
  const markers = [
    'storageKey = "pepodev.viewMode"',
    "Apply the saved theme before first paint",
    "initParticleNetwork",
    "window.__pepodevWindowManagerReady = true",
    "window.__pepodevDesktopIconsReady = true",
    "window.__pepodevExternalLinkIconsReady = true",
  ];
  const attributes = await page.evaluate(
    (texts) =>
      texts.map((text) => {
        const script = Array.from(document.scripts).find(
          (element) => !element.src && element.text.includes(text),
        );
        return script?.getAttribute("data-cfasync") ?? "missing";
      }),
    markers,
  );
  expect(attributes).toEqual(markers.map(() => "false"));
});

test("the desktop shortcut container is a labelled group", async ({ page }) => {
  await expect(
    page.getByRole("group", { name: "External shortcuts" }),
  ).toHaveCount(1);
});
