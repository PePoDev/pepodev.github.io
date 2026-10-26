// Desktop experiences: the macOS, Windows and Linux looks Settings offers
// (src/styles/experiences.css), their variants, the insets that keep
// windows, icons, Quick Access and toasts clear of each look's bars, and
// each look's window controls, contrast and forced colors.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { holdChunks, openApp, prefsStorage, resetPage, waitForWindowManager } from "./helpers";

type Box = { x: number; y: number; width: number; height: number };

// Every look but the site's own: [experience, variant].
const LOOKS = [
  ["macos", "tahoe"],
  ["macos", "sequoia"],
  ["windows", "11"],
  ["windows", "10"],
  ["linux", "gnome"],
  ["linux", "kde"],
] as const;

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

function intersects(a: Box, b: Box, tolerance = 0) {
  return (
    a.x < b.x + b.width - tolerance &&
    b.x < a.x + a.width - tolerance &&
    a.y < b.y + b.height - tolerance &&
    b.y < a.y + a.height - tolerance
  );
}

// What the look's bars cover.
function insetsOf(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      top: Number.parseFloat(style.getPropertyValue("--desktop-inset-top")),
      bottom: Number.parseFloat(style.getPropertyValue("--desktop-inset-bottom")),
    };
  });
}

// WCAG contrast of two opaque sRGB colours.
function contrast(a: number[], b: number[]) {
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// The median colour painted in a screen area, from a screenshot.
async function paintedColor(page: Page, clip: Box) {
  const shot = await page.screenshot({ clip, animations: "disabled" });
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const channels: number[][] = [[], [], []];
    for (let i = 0; i < data.length; i += 4) {
      channels.forEach((channel, c) => channel.push(data[i + c]));
    }
    return channels.map((channel) => channel.sort((a, b) => a - b)[channel.length >> 1]);
  }, shot.toString("base64"));
}

// What a CSS colour paints over an opaque one, through a canvas, so alpha,
// color-mix() and color() values need no parsing here.
function paintOver(page: Page, color: string, under: number[]) {
  return page.evaluate(
    ({ color, under }) => {
      const context = document.createElement("canvas").getContext("2d")!;
      context.fillStyle = `rgb(${under.join(", ")})`;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    },
    { color, under },
  );
}

// The pixels of an element's box that stand out at 3:1 from its most common
// colour: the ink it draws.
async function inkOf(page: Page, locator: Locator) {
  const clip = await locator.boundingBox();
  if (!clip) throw new Error("element is not rendered");
  const shot = await page.screenshot({ clip, animations: "disabled" });
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = (i: number) => {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]].map((value) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const counts = new Map<string, { count: number; index: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      const entry = counts.get(key) ?? { count: 0, index: i };
      entry.count += 1;
      counts.set(key, entry);
    }
    const background = luminance([...counts.values()].sort((a, b) => b.count - a.count)[0].index);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [high, low] = [luminance(i), background].sort((x, y) => y - x);
      if ((high + 0.05) / (low + 0.05) >= 3) ink += 1;
    }
    return ink;
  }, shot.toString("base64"));
}

// The extent, through its centre, of the area that takes a press on a
// control: its box, more with a pseudo-element, less where the window clips.
function hitArea(control: Locator) {
  return control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const reach = (dx: number, dy: number) => {
      let steps = 0;
      while (
        steps < 40 &&
        document.elementFromPoint(x + dx * (steps + 1), y + dy * (steps + 1))?.closest("button") === element
      ) {
        steps += 1;
      }
      return steps;
    };
    return { width: reach(-1, 0) + reach(1, 0) + 1, height: reach(0, -1) + reach(0, 1) + 1 };
  });
}

// Opens every app window, as a visitor with a crowded taskbar would.
async function openEveryApp(page: Page) {
  const ids = await page
    .locator("#desktop-icons [data-open-app]")
    .evaluateAll((icons) => icons.map((icon) => (icon as HTMLElement).dataset.openApp!));
  ids.push("settings");
  await page.evaluate((ids) => {
    for (const appId of ids) {
      document.dispatchEvent(new CustomEvent("desktop:open-app", { detail: { appId } }));
    }
  }, ids);
  await expect(page.locator("#taskbar-apps .taskbar-app")).toHaveCount(ids.length);
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
  const clock = page.locator("#taskbar-clock-button");
  const clockBox = await box(page, "#taskbar-clock-button");
  expect(Math.abs(clockBox.x + clockBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
  // The bar is black in the light theme too, under the white clock.
  await expect(page.locator("#taskbar-clock")).toHaveCSS("color", "rgb(255, 255, 255)");
  await clock.evaluate((element) => (element.style.visibility = "hidden"));
  const bar = await paintedColor(page, clockBox);
  await clock.evaluate((element) => (element.style.visibility = ""));
  expect(Math.max(...bar), `rgb(${bar.join(", ")})`).toBeLessThan(16);

  await openApp(page, "About Me", "me");
  const dash = await box(page, "#taskbar");
  expect(dash.y).toBeGreaterThan(viewport.height - 90);
  // The window's title bar starts below the top bar.
  expect((await box(page, "#window-me")).y).toBeGreaterThanOrEqual(32);
});

test("KDE: a floating panel with the launcher on the left and the tray and clock on the right", async ({
  page,
}) => {
  await resetPage(page, prefsStorage({ experience: "linux", variant: "kde" }));
  const viewport = page.viewportSize()!;
  const panel = await box(page, "#taskbar");
  expect(panel.x).toBe(8);
  expect(viewport.width - (panel.x + panel.width)).toBe(8);
  expect(viewport.height - (panel.y + panel.height)).toBe(8);
  expect((await box(page, "#taskbar-start")).x - panel.x).toBeLessThan(16);
  const clock = await box(page, "#taskbar-clock-button");
  expect(panel.x + panel.width - (clock.x + clock.width)).toBeLessThan(16);

  const window = await openApp(page, "About Me", "me");
  const app = await box(page, '#taskbar-apps [data-app-id="me"]');
  expect(app.x).toBeLessThan(viewport.width / 4);
  const frame = (await window.boundingBox())!;
  const close = await box(page, "#window-me .close-btn");
  expect(close.x + close.width).toBeGreaterThan(frame.x + frame.width - 12);
  // A maximized window ends above the panel.
  await window.locator(".max-btn").click();
  await expect(window).toHaveClass(/maximized/);
  const maximized = (await window.boundingBox())!;
  expect(maximized.y).toBe(0);
  expect(maximized.y + maximized.height).toBeLessThanOrEqual(viewport.height - 58 + 1);
});

for (const [experience, variant] of LOOKS) {
  test(`${experience} ${variant}: window controls are 24px targets, tabbed in the order drawn`, async ({
    page,
  }) => {
    await resetPage(page, prefsStorage({ experience, variant }));
    // Opened from the keyboard, so focus is in the window.
    await page.locator("#desktop-icons").getByRole("button", { name: "About Me" }).focus();
    await page.keyboard.press("Enter");
    const window = page.locator("#window-me");
    await expect(window).toBeFocused();
    await expect(window).not.toHaveClass(/opening/);

    // WCAG 2.5.8: each control is at least 24x24 and none overlaps the next,
    // so 24px circles centred on round ones do not overlap either.
    const drawn: (Box & { name: string | null })[] = [];
    for (const control of await window.locator(".window-controls button").all()) {
      const rect = (await control.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(24);
      expect(rect.height).toBeGreaterThanOrEqual(24);
      drawn.push({ name: await control.getAttribute("class"), ...rect });
    }
    drawn.sort((a, b) => a.x - b.x);
    for (let i = 1; i < drawn.length; i += 1) {
      expect(drawn[i].x).toBeGreaterThanOrEqual(drawn[i - 1].x + drawn[i - 1].width - 0.5);
    }

    const tabbed: (string | null)[] = [];
    for (let i = 0; i < drawn.length; i += 1) {
      await page.keyboard.press("Tab");
      tabbed.push(await page.evaluate(() => document.activeElement?.getAttribute("class") ?? null));
    }
    expect(tabbed).toEqual(drawn.map((control) => control.name));
  });

  test(`${experience} ${variant}: toasts keep clear of a maximized window's title bar and the tray panel`, async ({
    page,
  }) => {
    await resetPage(page, prefsStorage({ experience, variant }));
    const window = await openApp(page, "About Me", "me");
    await window.locator(".max-btn").click();
    await expect(window).toHaveClass(/maximized/);
    await page.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent("desktop:show-toast", { detail: { message: "Saved", duration: 0 } }),
      ),
    );
    const toast = page.locator("#toast-container .toast");
    await expect(toast).toHaveClass(/toast-show/);
    await expect(toast).toHaveCSS("opacity", "1");
    const titlebar = await box(page, "#window-me .window-titlebar");
    expect((await toast.boundingBox())!.y).toBeGreaterThanOrEqual(titlebar.y + titlebar.height);

    // macOS and GNOME drop the tray panel from the top bar, beside the toasts.
    await page.locator("#taskbar-clock-button").click();
    const panel = page.locator("#tray-panel");
    await expect(panel).toHaveClass(/visible/);
    await expect(panel).toHaveCSS("opacity", "1");
    expect(intersects((await toast.boundingBox())!, (await panel.boundingBox())!)).toBe(false);
  });

  test(`${experience} ${variant}: Quick Access opens in the free area, clear of the bars`, async ({
    page,
  }) => {
    await resetPage(page, prefsStorage({ experience, variant }));
    await page.locator("#taskbar-start").click();
    const menu = page.locator("#start-menu");
    await expect(menu).toHaveClass(/visible/);
    await menu.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const viewport = page.viewportSize()!;
    const insets = await insetsOf(page);
    const rect = (await menu.boundingBox())!;
    expect(rect.y).toBeGreaterThanOrEqual(insets.top);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - insets.bottom + 0.5);
    expect(intersects(rect, await box(page, "#taskbar"))).toBe(false);
    // Windows 10's Start menu and KDE's Kickoff sit over their launcher, at
    // the left; the others centre.
    if (variant === "10" || variant === "kde") {
      expect(rect.x).toBeLessThan(16);
    } else {
      expect(Math.abs(rect.x + rect.width / 2 - viewport.width / 2)).toBeLessThan(2);
    }
  });
}

test("a crowded Windows or KDE taskbar keeps every button on screen and clear of the tray", async ({
  page,
}) => {
  // Three looks with sixteen windows each.
  test.setTimeout(90_000);
  for (const [experience, variant] of [
    ["windows", "11"],
    ["windows", "10"],
    ["linux", "kde"],
  ]) {
    await page.setViewportSize({ width: 1024, height: 768 });
    await resetPage(page, prefsStorage({ experience, variant }));
    await openEveryApp(page);
    for (const width of [1024, 800]) {
      await page.setViewportSize({ width, height: 768 });
      const label = `${experience} ${variant} at ${width}px`;
      const buttons = await page
        .locator("#taskbar-start, #taskbar-apps .taskbar-app, #taskbar-tray > *")
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { name: element.id || element.getAttribute("data-app-id"), x, y, width, height };
            }),
        );
      for (const [i, button] of buttons.entries()) {
        expect(button.x, `${label}: ${button.name}`).toBeGreaterThanOrEqual(-0.5);
        expect(button.x + button.width, `${label}: ${button.name}`).toBeLessThanOrEqual(width + 0.5);
        expect(button.width, `${label}: ${button.name}`).toBeGreaterThanOrEqual(24);
        for (const other of buttons.slice(i + 1)) {
          expect(intersects(button, other, 0.5), `${label}: ${button.name} and ${other.name}`).toBe(false);
        }
      }
    }
  }
});

test("phones keep the bottom taskbar, a large close target and whole titles in every experience", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [experience, variant] of LOOKS) {
    const label = `${experience} ${variant}`;
    await resetPage(page, prefsStorage({ experience, variant }));
    const taskbar = await box(page, "#taskbar");
    expect(taskbar.x, label).toBe(0);
    expect(taskbar.width, label).toBe(390);
    expect(taskbar.y + taskbar.height, label).toBe(844);
    expect((await box(page, "#taskbar-clock-button")).y, label).toBeGreaterThan(780);

    // Only the close button shows. It keeps a target near the shared 42x36
    // (Windows 10's caption button is 46x30), and the longest title fits
    // beside it.
    const window = await openApp(page, "SRE Game", "sregame");
    const target = await hitArea(window.locator(".close-btn"));
    expect(target.width, label).toBeGreaterThanOrEqual(30);
    expect(target.height, label).toBeGreaterThanOrEqual(30);
    expect(
      await window.locator(".window-title").evaluate((title) => title.scrollWidth <= title.clientWidth),
      label,
    ).toBe(true);
  }
});

for (const [experience, variant] of [
  ["windows", "11"],
  ["linux", "kde"],
] as const) {
  test(`${experience} ${variant}: the Start glyph keeps 3:1 on the light theme's bar in every accent`, async ({
    page,
  }) => {
    for (const accent of ["green", "cyan", "amber", "purple"]) {
      await resetPage(page, prefsStorage({ experience, variant, theme: "light", accent }));
      const glyph = page.locator("#taskbar-start svg");
      const color = await glyph.evaluate((element) => getComputedStyle(element).color);
      const clip = (await glyph.boundingBox())!;
      await glyph.evaluate((element) => (element.style.visibility = "hidden"));
      const bar = await paintedColor(page, clip);
      const ratio = contrast(await paintOver(page, color, bar), bar);
      expect(ratio, `${accent}: ${color} on rgb(${bar.join(", ")})`).toBeGreaterThanOrEqual(3);
    }
  });
}

for (const theme of ["light", "dark"]) {
  test(`macOS: focused and unfocused traffic lights keep 3:1 against the ${theme} title bar`, async ({
    page,
  }) => {
    for (const variant of ["sequoia", "tahoe"]) {
      await resetPage(page, prefsStorage({ experience: "macos", variant, theme }));
      const about = await openApp(page, "About Me", "me");
      const calculator = await openApp(page, "Calculator", "calculator");
      // The focused window moves off About Me's title bar.
      const titlebar = (await calculator.locator(".window-titlebar").boundingBox())!;
      const grab = { x: titlebar.x + titlebar.width - 30, y: titlebar.y + titlebar.height / 2 };
      await page.mouse.move(grab.x, grab.y);
      await page.mouse.down();
      await page.mouse.move(grab.x + 260, grab.y + 160, { steps: 4 });
      await page.mouse.up();
      await expect(about).not.toHaveClass(/focused/);
      await expect(calculator).toHaveClass(/focused/);

      for (const window of [about, calculator]) {
        const name = `${variant} ${await window.getAttribute("id")}`;
        const zoom = (await window.locator(".max-btn").boundingBox())!;
        // The title bar just right of the lights.
        const bar = await paintedColor(page, {
          x: zoom.x + zoom.width + 2,
          y: zoom.y + zoom.height / 2 - 2,
          width: 4,
          height: 4,
        });
        for (const light of await window.locator(".window-controls button").all()) {
          const { fill, rim } = await light.evaluate((element) => {
            const style = getComputedStyle(element, "::before");
            return {
              fill: style.backgroundColor,
              rim: /^(.*?\))\s/.exec(style.boxShadow)?.[1] ?? "transparent",
            };
          });
          const filled = await paintOver(page, fill, bar);
          const rimmed = await paintOver(page, rim, filled);
          const ratio = Math.max(contrast(filled, bar), contrast(rimmed, bar));
          expect(
            ratio,
            `${name} ${await light.getAttribute("class")}: ${fill}, rim ${rim}, on rgb(${bar.join(", ")})`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`in ${colorScheme} forced colors, the traffic lights, Launchpad and Activities still draw`, async ({
    page,
  }) => {
    // Forced colors drop the background colours and gradients that draw
    // them otherwise, and turn GNOME's black top bar into Canvas. The site's
    // theme is the other one, so its wallpaper would show through a
    // translucent bar at the wrong lightness.
    await page.emulateMedia({ forcedColors: "active", colorScheme });
    const theme = colorScheme === "light" ? "dark" : "light";
    for (const [experience, variant] of [
      ["macos", "tahoe"],
      ["macos", "sequoia"],
      ["linux", "gnome"],
    ]) {
      await resetPage(page, prefsStorage({ experience, variant, theme }));
      const window = await openApp(page, "About Me", "me");
      if (experience === "macos") {
        for (const light of await window.locator(".window-controls button").all()) {
          const name = `${variant} ${await light.getAttribute("class")}`;
          expect(await inkOf(page, light), name).toBeGreaterThan(20);
        }
      }
      for (const selector of ["#taskbar-start", "#taskbar-settings"]) {
        expect(await inkOf(page, page.locator(selector)), `${variant} ${selector}`).toBeGreaterThan(20);
      }
    }
  });
}
