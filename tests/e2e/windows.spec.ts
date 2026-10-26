import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { holdChunks, openApp, resetPage, waitForWindowManager } from "./helpers";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

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

test("a screen-reader click opens a desktop app", async ({ page }) => {
  // Assistive tech activates with a click whose detail is 0 and sends no
  // pointer or key events, which the drag-aware icons otherwise rely on.
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" })
    .evaluate((icon: HTMLElement) => icon.click());
  await expect(page.locator("#window-me")).toBeVisible();
  await expect(page.locator("#taskbar-apps button")).toHaveCount(1);
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

  // The label is hidden only visually, so it still names the button, and
  // the icon (with its text, such as "CK") is aria-hidden.
  const taskbarApps = page.locator("#taskbar-apps");
  const label = taskbarApps.locator(".taskbar-app span").first();
  expect((await label.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await expect(taskbarApps.locator(".taskbar-app[aria-label]")).toHaveCount(0);
  await expect(taskbarApps.getByRole("button", { name: "Work" })).toBeVisible();
  await expect(
    taskbarApps.getByRole("button", { name: "Settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open start menu" }).click();
  await page.locator('#start-menu [data-open-app="certs"]').click();
  await expect(
    taskbarApps.getByRole("button", { name: "Certifications", exact: true }),
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
    const result = await axe.run("#taskbar-apps", {
      runOnly: ["button-name", "label-content-name-mismatch"],
    });
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

test("controls hidden in a scrolling window body do not count as its tab stop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const gallery = await openApp(page, "Gallery", "gallery");
  const content = gallery.locator(".window-content");
  await gallery.getByLabel("Please enter the password").fill("password");
  await page.keyboard.press("Enter");
  await expect(gallery.locator("[data-gallery-unlocked]")).toBeVisible();

  // The password form is hidden but still in the DOM.
  await expect
    .poll(() =>
      content.evaluate(
        (element) => element.scrollHeight > element.clientHeight + 1,
      ),
    )
    .toBe(true);
  await expect(content).toHaveAttribute("tabindex", "0");
  await expect(
    page.getByRole("group", { name: "Gallery content" }),
  ).toBeVisible();
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

test("website mode reaches assistive tech before the desktop hydrates", async ({
  page,
  request,
}) => {
  // Neither panel is aria-hidden in the markup; CSS hides the other one.
  const html = await (await request.get("/")).text();
  for (const id of ["desktop", "website"]) {
    const tag = html.match(new RegExp(`<div[^>]*id="${id}"[^>]*>`))?.[0];
    expect(tag, id).toBeTruthy();
    expect(tag, id).not.toContain("aria-hidden");
  }

  // The site-mode state is set when the desktop boots, which needs the
  // desktop bundle (Next.js's chunks under next dev); hold it back (a slow
  // network) and the panel the <head> script picked is shown and reachable
  // first.
  await resetPage(page, { "pepodev.viewMode": "website" });
  const chunks = await holdChunks(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __pepodevWindowManagerReady?: boolean })
          .__pepodevWindowManagerReady ?? false,
    ),
  ).toBe(false);
  await expect(page.locator("#website")).toBeVisible();
  await expect(page.locator("#desktop")).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeAttached();
  await expect(page.getByRole("banner")).toBeVisible();

  chunks.release();
  await waitForWindowManager(page);
  await expect(page.locator("#website")).not.toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator("#desktop")).toHaveAttribute("aria-hidden", "true");
});

test("clicks and keys made before the desktop hydrates are not lost", async ({
  page,
}) => {
  // The desktop takes input once React has hydrated it, after the page has
  // loaded; hold the desktop bundle (Next.js's chunks under next dev) back,
  // as a slow network would, and act first.
  await resetPage(page);
  const chunks = await holdChunks(page);
  const holdHydration = async () => {
    chunks.hold();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(chunks.held).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __pepodevWindowManagerReady?: boolean })
            .__pepodevWindowManagerReady ?? false,
      ),
    ).toBe(false);
  };
  const hydrate = async () => {
    chunks.release();
    await waitForWindowManager(page);
  };

  // A launch and Ctrl+K are replayed, in order, once the desktop boots:
  // Ctrl+K opens Quick Access with focus in its search box, also when it
  // was pressed twice while nothing showed.
  await holdHydration();
  await page.locator('#desktop-icons [data-open-app="me"]').click();
  await page.keyboard.press("ControlOrMeta+K");
  await page.keyboard.press("ControlOrMeta+K");
  await hydrate();
  await expect(page.locator("#window-me")).toHaveClass(/focused/);
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expect(page.locator("#start-menu-search")).toBeFocused();

  // The Start button too.
  await holdHydration();
  await page.locator("#taskbar-start").click();
  await hydrate();
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expect(page.locator("#taskbar-start")).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // A mode switch applies at once, hands focus over, and sticks.
  await holdHydration();
  await page.locator("#taskbar-site-mode").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "website",
  );
  await expect(page.locator("#website")).toBeVisible();
  await expect(page.locator("#desktop")).toBeHidden();
  await expect(
    page.locator("#website header [data-site-mode-toggle]"),
  ).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
  ).toBe("website");
  await hydrate();
  await expect(page.locator("#desktop")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#website")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "website",
  );

  // And back: the desktop shows with its icons placed, and a resize before
  // the boot places them again.
  await holdHydration();
  await page.locator("#website header [data-site-mode-toggle]").click();
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#taskbar-site-mode")).toBeFocused();
  await expect(
    page.locator(".desktop-icon:not([data-desktop-icon-ready])"),
  ).toHaveCount(0);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: 560 });
  const taskbarTop = (await page.locator("#taskbar").boundingBox())!.y;
  const lowest = await page
    .locator(".desktop-icon")
    .evaluateAll((icons) =>
      Math.max(...icons.map((icon) => icon.getBoundingClientRect().bottom)),
    );
  expect(lowest).toBeLessThanOrEqual(taskbarTop);
  await page.setViewportSize(viewport);
  await hydrate();
  await expect(page.locator("#desktop")).toHaveAttribute("aria-hidden", "false");
  expect(
    await page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
  ).toBe("desktop");
});

test("Enter or Space on an icon hydrated before the boot is kept for the boot", async ({
  page,
}) => {
  // React attaches the icons' key handlers when it hydrates; the desktop
  // boots a little later (a few hundred ms on a slow device). A key pressed
  // in between must not be swallowed: the icon leaves it its native click,
  // which the parse-time input script keeps for the boot to replay. The
  // flag is what the icon and that script read, so lowering it again puts
  // the page back in that gap. (The boot replaces __pepodevEarlyInput, so
  // keep the script's own queue.)
  await page.addInitScript(() => {
    const queues: unknown[][] = [];
    let current: unknown[] | undefined;
    Object.defineProperty(window, "__pepodevEarlyInput", {
      configurable: true,
      get: () => current,
      set: (queue: unknown[]) => {
        current = queue;
        queues.push(queue);
      },
    });
    (window as typeof window & { __earlyQueues?: unknown[][] }).__earlyQueues =
      queues;
  });
  await page.reload();
  await waitForWindowManager(page);
  const setReady = (ready: boolean) =>
    page.evaluate((value) => {
      (
        window as typeof window & { __pepodevWindowManagerReady?: boolean }
      ).__pepodevWindowManagerReady = value;
    }, ready);
  const early = () =>
    page.evaluate(
      () =>
        (window as typeof window & { __earlyQueues?: unknown[][] })
          .__earlyQueues?.[0],
    );
  await setReady(false);
  await page.locator('#desktop-icons [data-open-app="me"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('#desktop-icons [data-open-app="work"]').focus();
  await page.keyboard.press("Space");
  expect(await early()).toEqual([
    { type: "launch", appId: "me", keyboard: true },
    { type: "launch", appId: "work", keyboard: true },
  ]);
  await expect(page.locator("#window-me")).toBeHidden();

  // Once booted, the icon opens its app itself.
  await setReady(true);
  await page.locator('#desktop-icons [data-open-app="me"]').press("Enter");
  await expect(page.locator("#window-me")).toHaveClass(/focused/);
});

test("an app opened from the keyboard before the boot takes the focus", async ({
  page,
}) => {
  // The boot replays the launch after the key press is long gone; the
  // window still takes keyboard focus, as it does from the keyboard later.
  await resetPage(page);
  const chunks = await holdChunks(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  const icon = page.locator('#desktop-icons [data-open-app="me"]');
  await icon.focus();
  await page.keyboard.press("Enter");
  chunks.release();
  await waitForWindowManager(page);
  const about = page.locator("#window-me");
  await expect(about).toHaveClass(/focused/);
  await expect
    .poll(() =>
      page.evaluate(() => !!document.activeElement?.closest("#window-me")),
    )
    .toBe(true);

  // Closed from the keyboard, it hands focus back to its icon.
  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await expect(icon).toBeFocused();
});

test("a mode switch before the boot keeps a first visit's Welcome window closed", async ({
  page,
}) => {
  // Switching modes is acting first, like any input the boot replays.
  await page.goto("/robots.txt");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("pepodev.commandPaletteHintShown", String(Date.now()));
  });
  const chunks = await holdChunks(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  const html = page.locator("html");
  await page.locator("#taskbar-site-mode").click();
  await expect(html).toHaveAttribute("data-site-mode", "website");
  await page.locator("#website header [data-site-mode-toggle]").click();
  await expect(html).toHaveAttribute("data-site-mode", "desktop");
  chunks.release();
  await waitForWindowManager(page);

  // The Welcome timer marks the visit once it has decided.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("pepodev.hasVisited")))
    .toBe("true");
  await expect(page.locator("#window-welcome")).toBeHidden();
});

test("the taskbar clock tells the time before the desktop hydrates", async ({
  page,
}) => {
  // The server cannot know the visitor's time, and the taskbar's own clock
  // starts with hydration: a parse-time script fills it in meanwhile, so the
  // button is never empty and nameless.
  const chunks = await holdChunks(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  const button = page.locator("#taskbar-clock-button");
  const time = page.locator("#taskbar-clock");
  const date = page.locator("#taskbar-date");
  await expect(time).toHaveText(/^\d{2}:\d{2}$/);
  await expect(date).toHaveText(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
  await expect(button).toHaveAccessibleName(/^\d{2}:\d{2} [A-Z]/);

  chunks.release();
  await waitForWindowManager(page);
  await expect(time).toHaveText(/^\d{2}:\d{2}$/);
  expect(await date.textContent()).toBe(
    await page.evaluate(() =>
      new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    ),
  );
});

test("a taskbar button pressed with the pointer leaves the keys to the windows", async ({
  page,
}) => {
  const work = await openApp(page, "Work", "work");
  const about = await openApp(page, "About Me", "me");
  const aboutButton = page.locator('#taskbar-apps [data-app-id="me"]');
  const workButton = page.locator('#taskbar-apps [data-app-id="work"]');

  // Raising a window: the keys go to it, not to the button. Enter would
  // otherwise press the button again and minimize the window.
  await workButton.click();
  await expect(work).toHaveClass(/focused/);
  await expect(workButton).not.toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(work).toHaveClass(/focused/);
  await expect(work).not.toHaveClass(/minimized/);

  // Minimizing the focused window hands the keys to the next one.
  await workButton.click();
  await expect(work).toHaveClass(/minimized/);
  await expect(about).toHaveClass(/focused/);
  await expect(workButton).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(work).toHaveClass(/minimized/);
  await expect(about).toHaveClass(/focused/);

  // Restoring it.
  await workButton.click();
  await expect(work).toHaveClass(/focused/);
  await expect(work).not.toHaveClass(/minimized/);
  await expect(workButton).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(work).not.toHaveClass(/minimized/);
  await expect(aboutButton).not.toBeFocused();

  // From the keyboard, focus follows the window, so Enter restores it again.
  await workButton.click();
  await expect(work).toHaveClass(/minimized/);
  await workButton.focus();
  await page.keyboard.press("Enter");
  await expect(work).toHaveClass(/focused/);
  await expect(work).toBeFocused();
});

test("after a pointer press on a taskbar button, Tab starts at the window buttons", async ({
  page,
}) => {
  // Tab reaches the first window button and Shift+Tab the Start button,
  // whichever button was pressed, never the mode switch that follows the last
  // one (Tab and Enter would then switch the site to website mode).
  const work = await openApp(page, "Work", "work");
  const about = await openApp(page, "About Me", "me");
  const workButton = page.locator('#taskbar-apps [data-app-id="work"]');
  const aboutButton = page.locator('#taskbar-apps [data-app-id="me"]');

  await workButton.click();
  await expect(work).toHaveClass(/focused/);
  await page.keyboard.press("Tab");
  await expect(workButton).toBeFocused();

  await aboutButton.click();
  await expect(about).toHaveClass(/focused/);
  await page.keyboard.press("Tab");
  await expect(workButton).toBeFocused();

  await workButton.click();
  await expect(work).toHaveClass(/focused/);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#taskbar-start")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-site-mode", "desktop");
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

test("a round trip to desktop before the boot keeps the website scroll position", async ({
  page,
}) => {
  // The parse-time input script switches modes until the desktop boots
  // (held back here, as on a slow network).
  await resetPage(page, { "pepodev.viewMode": "website" });
  const chunks = await holdChunks(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(chunks.held).toBeGreaterThan(0);
  const taskbarSwitch = page.locator("#taskbar-site-mode");
  const websiteSwitch = page.locator("#website header [data-site-mode-toggle]");
  // Once the fonts are in, so the page above no longer changes height (and
  // the browser no longer moves the scroll position to make up for it).
  await page.evaluate(() => document.fonts.ready);
  const scrollTo = async (top: number) => {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      top,
    );
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(top);
  };
  // Keyboard presses, so nothing scrolls the header into view first.
  const pressWebsiteSwitch = async () => {
    await websiteSwitch.evaluate((button: HTMLElement) =>
      button.focus({ preventScroll: true }),
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("#desktop")).toBeVisible();
    await expect(taskbarSwitch).toBeFocused();
  };

  await scrollTo(2000);
  await pressWebsiteSwitch();
  await page.keyboard.press("Enter");
  await expect(page.locator("#website")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(2000);

  // To desktop before the boot, back after it.
  await scrollTo(1500);
  await pressWebsiteSwitch();
  chunks.release();
  await waitForWindowManager(page);
  await taskbarSwitch.press("Enter");
  await expect(page.locator("#website")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
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
  request,
}) => {
  // The parse-time scripts: mode, theme, the other preferences, the input
  // made before the desktop boots, the icon placement and the taskbar
  // clock. The window manager and the background are part of the React
  // desktop, which hydrates through the desktop bundle (checked below).
  const markers = [
    'storageKey = "pepodev.viewMode"',
    "Apply the saved theme and accent before first paint",
    "Initialize theme immediately",
    "window.__pepodevEarlyInput = []",
    "window.__pepodevDesktopIconsReady = true",
    "Writes the taskbar clock before first paint",
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

  // In the export, every script in the HTML that runs has
  // data-cfasync="false", the desktop bundle's module script included, so
  // Rocket Loader cannot hold the desktop back (JSON-LD and the JSON data
  // never run). `next dev` leaves Next.js's scripts unmarked.
  if (process.env.PLAYWRIGHT_SERVER === "preview") {
    const html = await (await request.get("/")).text();
    const unmarked = [...html.matchAll(/<script\b([^>]*)>/g)]
      .map(([tag, attributes]) => ({ tag, attributes }))
      .filter(
        ({ attributes }) =>
          !/data-cfasync="false"/.test(attributes) &&
          !/type="application\/(ld\+)?json"/.test(attributes),
      )
      .map(({ tag }) => tag);
    expect(unmarked).toEqual([]);
  }
});

test("the desktop shortcut container is a labelled group", async ({ page }) => {
  await expect(
    page.getByRole("group", { name: "External shortcuts" }),
  ).toHaveCount(1);
});
