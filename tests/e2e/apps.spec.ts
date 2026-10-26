import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  emulateSaveData,
  holdAppChunks,
  holdChunks,
  openApp,
  prefsStorage,
  resetPage,
} from "./helpers";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};
import projects from "../../src/data/projects.json" with { type: "json" };
import skills from "../../src/data/skills.json" with { type: "json" };

const currentRole = experiences[0].role;
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function openWithKeyboard(page: Page, label: string, appId: string) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .focus();
  await page.keyboard.press("Enter");
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  return window;
}

// The median colour painted in a screen area, from a screenshot.
async function paintedColor(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
) {
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
    return channels.map(
      (channel) => channel.sort((a, b) => a - b)[channel.length >> 1],
    );
  }, shot.toString("base64"));
}

// WCAG contrast of a CSS colour (alpha blended) over a painted colour.
function contrastRatio(color: string, background: number[]) {
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  const foreground = [r, g, b].map(
    (value, c) => value * a + background[c] * (1 - a),
  );
  const luminance = (rgb: number[]) => {
    const [lr, lg, lb] = rgb.map((value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };
  const [high, low] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x,
  );
  return (high + 0.05) / (low + 0.05);
}

// WCAG contrast of an element's text against what is painted behind it,
// sampled from a screenshot with the text hidden. Glass windows blur the
// wallpaper, so computed background colours alone cannot answer this.
async function contrastOf(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element is not rendered");
  const { color, large } = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number(style.fontWeight);
    return {
      color: style.color,
      large: size >= 24 || (size >= 18.66 && weight >= 700),
    };
  });
  await locator.evaluate((element: HTMLElement) => {
    element.style.setProperty("color", "transparent", "important");
    element.style.setProperty("text-shadow", "none", "important");
  });
  const background = await paintedColor(page, box);
  await locator.evaluate((element: HTMLElement) => {
    element.style.removeProperty("color");
    element.style.removeProperty("text-shadow");
  });

  return {
    ratio: contrastRatio(color, background),
    required: large ? 3 : 4.5,
    color,
    background: `rgb(${background.join(", ")})`,
  };
}

async function expectReadable(page: Page, locator: Locator, label: string) {
  await expect(locator.first(), `${label} is rendered`).toBeAttached();
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const result = await contrastOf(page, locator.nth(i));
    expect(
      result.ratio,
      `${label} #${i}: ${result.color} on ${result.background}`,
    ).toBeGreaterThanOrEqual(result.required);
  }
}

test.describe("Snake on phones", () => {
  const phones = [
    { name: "iPhone SE", width: 320, height: 568 },
    { name: "iPhone 13", width: 390, height: 664 },
    { name: "iPhone 15", width: 393, height: 659 },
    { name: "iPhone 14 Pro Max", width: 430, height: 740 },
  ];

  for (const phone of phones) {
    test.describe(phone.name, () => {
      test.use({
        viewport: { width: phone.width, height: phone.height },
        hasTouch: true,
      });

      test(`the board never covers the Snake controls at ${phone.width}x${phone.height}`, async ({
        page,
      }) => {
        await resetPage(page);
        const window = await openApp(page, "Snake", "snake");
        await expect(window).toHaveClass(/mobile-window/);

        const controls = window.locator(
          "[data-snake-action], [data-snake-dir]",
        );
        await expect(controls).toHaveCount(7);
        const hits = await controls.evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
            return {
              control: button.textContent?.trim(),
              onScreen: rect.bottom <= document.documentElement.clientHeight,
              hitsItself: Boolean(hit && button.contains(hit)),
            };
          }),
        );
        for (const hit of hits) {
          expect(hit, `${hit.control} is tappable`).toEqual({
            control: hit.control,
            onScreen: true,
            hitsItself: true,
          });
        }

        // The board stays square and sits above the controls.
        const stage = await window.locator(".snake-stage").boundingBox();
        const start = await window
          .getByRole("button", { name: "Start" })
          .boundingBox();
        expect(stage && start).toBeTruthy();
        expect(Math.abs(stage!.width - stage!.height)).toBeLessThanOrEqual(1);
        expect(stage!.height).toBeGreaterThanOrEqual(160);
        expect(stage!.y + stage!.height).toBeLessThanOrEqual(start!.y);

        await window.getByRole("button", { name: "Start" }).tap();
        await expect(window.locator("[data-snake-status]")).toHaveText(
          "Running",
        );
        await window.getByRole("button", { name: "Move down" }).tap();
        await window.getByRole("button", { name: "Pause" }).tap();
        await expect(window.locator("[data-snake-status]")).toHaveText(
          "Paused",
        );
        await window.getByRole("button", { name: "Reset" }).tap();
        await expect(window.locator("[data-snake-status]")).toHaveText(
          "Ready",
        );
      });
    });
  }
});

test("the Snake jumpscare holds still with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetPage(page);
  const window = await openApp(page, "Snake", "snake");
  const jumpscare = window.locator("[data-snake-jumpscare]");
  await jumpscare.evaluate((element: HTMLElement) => {
    element.hidden = false;
    element.classList.add("visible");
  });

  await expect(jumpscare).toHaveCSS("animation-name", "none");
  await expect(jumpscare).toHaveCSS("opacity", "1");
  await expect(jumpscare.locator(".snake-ghost")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("the SRE game stops blinking and glitching with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");
  const probe = await game.evaluate((element) => {
    const span = document.createElement("span");
    span.className = "sre-status-crit";
    element.querySelector(".sre-game-container")?.append(span);
    const style = getComputedStyle(span);
    const result = style.animationIterationCount;
    span.remove();
    return result;
  });
  expect(probe).toBe("1");
});

test("the Snake jumpscare still animates without a reduced-motion preference", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Snake", "snake");
  const jumpscare = window.locator("[data-snake-jumpscare]");
  await jumpscare.evaluate((element: HTMLElement) => {
    element.hidden = false;
    element.classList.add("visible");
  });
  await expect(jumpscare).toHaveCSS("animation-name", "snakeJumpScare");
  await expect(jumpscare.locator(".snake-ghost")).toHaveCSS(
    "animation-name",
    "snakeGhostLunge",
  );
});

test("Snake drops the old made-up best of 170 and keeps real bests", async ({
  page,
}) => {
  const storedBests = () =>
    page.evaluate(() => [
      localStorage.getItem("pepodev.snake.best"),
      localStorage.getItem("pepodev.snake.best.v2"),
    ]);

  // The old key held max(170, score), so 170 says nothing about the player.
  await resetPage(page, { "pepodev.snake.best": "170" });
  let window = await openApp(page, "Snake", "snake");
  await expect(window.locator("[data-snake-best]")).toHaveText("0");
  expect(await storedBests()).toEqual([null, null]);

  await window.getByRole("button", { name: "Start" }).click();
  await expect
    .poll(() => window.locator("[data-snake-score]").textContent())
    .toBe("10");
  expect(await storedBests()).toEqual([null, "10"]);
  await page.reload();
  window = await openApp(page, "Snake", "snake");
  await expect(window.locator("[data-snake-best]")).toHaveText("10");

  // A best above the seed was really scored, so it carries over.
  await resetPage(page, { "pepodev.snake.best": "250" });
  window = await openApp(page, "Snake", "snake");
  await expect(window.locator("[data-snake-best]")).toHaveText("250");
  expect(await storedBests()).toEqual([null, "250"]);
});

test("Snake's accent controls show hover in the light theme", async ({
  page,
}) => {
  await resetPage(
    page,
    prefsStorage({ theme: "light", background: "cloud" }),
  );
  const window = await openApp(page, "Snake", "snake");
  for (const name of ["Start", "Move up"]) {
    const button = window.getByRole("button", { name });
    const border = () =>
      button.evaluate((element) => getComputedStyle(element).borderTopColor);
    const resting = await border();
    await button.hover();
    await expect.poll(border, `${name} hover border`).not.toBe(resting);
    await page.mouse.move(0, 0);
  }
});

test("Calculator keeps the newest digits in view on long input", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Calculator", "calculator");
  const value = window.locator(".calculator-value");

  for (let i = 1; i <= 30; i += 1) await page.keyboard.press(String(i % 10));
  await expect(value).toHaveText("123456789012345678901234567890");

  const scroll = await value.evaluate((element) => ({
    left: element.scrollLeft,
    width: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(scroll.width).toBeGreaterThan(scroll.client);
  expect(scroll.left + scroll.client).toBeGreaterThanOrEqual(scroll.width - 1);
  // The digits scrolled out on the left fade out; nothing is cut on the right.
  await expect(value).toHaveClass(/is-cut-start/);
  await expect(value).not.toHaveClass(/is-cut-end/);

  // The scrolling display is not an extra, unnamed tab stop.
  await window.getByRole("button", { name: "AC", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    window.getByRole("button", { name: "Close Calculator" }),
  ).toBeFocused();
});

test("Calculator results read from the first digit and stay usable", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Calculator", "calculator");
  const value = window.locator(".calculator-value");
  const history = window.locator(".calculator-history");

  await page.keyboard.type("1234567891234567891234567891234567891234+1");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("1.2345678912345679e+39");
  await expect(value).toHaveJSProperty("scrollLeft", 0);
  await expect(value).toHaveClass(/is-cut-end/);
  await expect(history).toHaveText(/\+1 =$/);

  // The history line stays on one line inside the display, showing its end.
  const fit = await history.evaluate((element) => {
    const display = element.parentElement!.getBoundingClientRect();
    const line = element.getBoundingClientRect();
    return {
      inside: line.left >= display.left && line.right <= display.right,
      oneLine:
        line.height < 2 * Number.parseFloat(getComputedStyle(element).fontSize),
      atEnd:
        element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    };
  });
  expect(fit).toEqual({ inside: true, oneLine: true, atEnd: true });

  // An exponent result can be calculated with.
  await page.keyboard.type("+1");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("1.2345678912345679e+39");
  await expect(history).toHaveText("1.2345678912345679e+39+1 =");

  // Errors are never silent and keep the input.
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("1.2345678912345679e");
  await expect(history).toHaveText("Invalid expression");

  await window.getByRole("button", { name: "AC", exact: true }).click();
  await page.keyboard.type("9".repeat(400));
  await page.keyboard.press("Enter");
  await expect(history).toHaveText("Number too large");
  await expect(value).toHaveText("9".repeat(400));

  // A digit replaces a lone leading 0 instead of making "05".
  await window.getByRole("button", { name: "AC", exact: true }).click();
  await page.keyboard.type("05+07");
  await expect(value).toHaveText("5+7");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("12");

  // * before +, a percentage, and a negative result.
  await window.getByRole("button", { name: "AC", exact: true }).click();
  await page.keyboard.type("2+3*4-10%");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("13.9");
  await page.keyboard.type("-20");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("-6.1");
});

test("Calculator allows one decimal point per number", async ({ page }) => {
  await resetPage(page);
  const window = await openApp(page, "Calculator", "calculator");
  const value = window.locator(".calculator-value");
  const press = (name: string) =>
    window.getByRole("button", { name, exact: true }).click();

  for (const key of ["1", ".", "2", ".", "3"]) await press(key);
  await expect(value).toHaveText("1.23");

  await press("+");
  for (const key of ["2", ".", "5", "."]) await press(key);
  await expect(value).toHaveText("1.23+2.5");

  await press("=");
  await expect(value).toHaveText("3.73");
  await expect(window.locator(".calculator-history")).toHaveText(
    "1.23+2.5 =",
  );
});

test("Calculator errors keep the expression so it can be fixed", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Calculator", "calculator");
  const value = window.locator(".calculator-value");
  const history = window.locator(".calculator-history");

  for (const key of ["8", "/", "0", "Enter"]) await page.keyboard.press(key);
  await expect(value).toHaveText("8/0");
  await expect(history).toHaveText("Cannot divide by 0");

  await page.keyboard.press("Backspace");
  for (const key of ["4", "Enter"]) await page.keyboard.press(key);
  await expect(value).toHaveText("2");

  await window.getByRole("button", { name: "AC" }).click();
  for (const key of ["9", "/", "3", "+", "Enter"]) {
    await page.keyboard.press(key);
  }
  await expect(value).toHaveText("9/3+");
  await expect(history).toHaveText("Incomplete expression");

  for (const key of ["1", "Enter"]) await page.keyboard.press(key);
  await expect(value).toHaveText("4");
});

test("Gallery explains a wrong password and moves focus after unlocking", async ({
  page,
}) => {
  await resetPage(page);
  const gallery = await openApp(page, "Gallery", "gallery");
  const input = gallery.locator("#gallery-password");
  const error = gallery.locator("[data-gallery-error]");
  await expect(input).toBeFocused();

  await page.keyboard.type("hunter2");
  await page.keyboard.press("Enter");
  await expect(error).not.toBeEmpty();
  await expect(error).not.toHaveText(
    (await gallery.locator("label[for='gallery-password']").textContent()) ??
      "",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", "gallery-error");
  await expect(input).toBeFocused();

  await page.keyboard.type("password");
  await page.keyboard.press("Enter");
  const unlocked = gallery.locator("[data-gallery-unlocked]");
  await expect(unlocked).toBeVisible();
  await expect(unlocked).toBeFocused();
  await expect(unlocked).toHaveAccessibleName("Private gallery");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
});

test("Terminal and Gallery focus their input when opened from the keyboard", async ({
  page,
}) => {
  await resetPage(page);
  const terminal = await openWithKeyboard(page, "Terminal", "terminal");
  const terminalInput = terminal.locator("[data-terminal-input]");
  await expect(terminalInput).toBeFocused();
  await page.keyboard.type("help");
  await expect(terminalInput).toHaveValue("help");
  await page.keyboard.press("Escape");
  await expect(terminal).toBeHidden();

  const gallery = await openWithKeyboard(page, "Gallery", "gallery");
  await expect(gallery.locator("#gallery-password")).toBeFocused();
});

test("re-launching or restoring Terminal and Gallery focuses their input", async ({
  page,
}) => {
  await resetPage(page);
  const terminal = await openWithKeyboard(page, "Terminal", "terminal");
  const terminalInput = terminal.locator("[data-terminal-input]");
  await openWithKeyboard(page, "Calculator", "calculator");

  // Already open: launching it again from the palette types into it.
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.type("terminal");
  await page.keyboard.press("Enter");
  await expect(terminalInput).toBeFocused();
  await page.keyboard.type("whoami");
  await page.keyboard.press("Enter");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "pepo@desktop:~$ whoami",
  );

  // Minimized: the Start menu and the taskbar restore it into the input.
  await terminal.getByRole("button", { name: "Minimize Terminal" }).click();
  await expect(terminal).toHaveClass(/minimized/);
  await page.locator("#taskbar-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.type("terminal");
  await page.keyboard.press("Enter");
  await expect(terminalInput).toBeFocused();
  await terminal.getByRole("button", { name: "Minimize Terminal" }).click();
  await page.locator("#taskbar-apps").getByRole("button", { name: "Terminal" }).focus();
  await page.keyboard.press("Enter");
  await expect(terminalInput).toBeFocused();

  const gallery = await openWithKeyboard(page, "Gallery", "gallery");
  await expect(gallery.locator("#gallery-password")).toBeFocused();
  await openWithKeyboard(page, "Calculator", "calculator");
  await openWithKeyboard(page, "Gallery", "gallery");
  await expect(gallery.locator("#gallery-password")).toBeFocused();
});

test.describe("on a touch phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("tapping Terminal or Gallery does not raise the on-screen keyboard", async ({
    page,
  }) => {
    await resetPage(page);
    const startButton = page.locator("#taskbar-start");
    await startButton.tap();
    await page.locator('#start-menu [data-open-app="terminal"]').tap();
    const terminal = page.locator("#window-terminal");
    await expect(terminal).toHaveClass(/focused/);
    await expect(terminal.locator("[data-terminal-input]")).not.toBeFocused();
    // A tap in the window still focuses the input.
    await terminal.locator("[data-terminal-output]").tap();
    await expect(terminal.locator("[data-terminal-input]")).toBeFocused();

    await startButton.tap();
    await page.locator('#start-menu [data-open-app="gallery"]').tap();
    const gallery = page.locator("#window-gallery");
    await expect(gallery).toHaveClass(/focused/);
    await expect(gallery.locator("#gallery-password")).not.toBeFocused();

    // A keyboard launch (an external keyboard) still focuses the input.
    await gallery.getByRole("button", { name: "Close Gallery" }).tap();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(page.locator("#command-palette-input")).toBeFocused();
    await page.keyboard.type("gallery");
    await page.keyboard.press("Enter");
    await expect(gallery.locator("#gallery-password")).toBeFocused();
  });

  test("the SRE game boot log is a labelled tab stop", async ({ page }) => {
    await resetPage(page);
    await page.locator("#taskbar-start").tap();
    await page.locator('#start-menu [data-open-app="sregame"]').tap();
    const log = page.getByRole("log", { name: "Boot log" });
    await expect(log).toHaveAttribute("tabindex", "0");
    await expect(log).toContainText("ssh", { timeout: 5_000 });
    await log.focus();
    await expect(log).toBeFocused();
  });
});

test("apps opened before their code has loaded still start", async ({ page }) => {
  // Each app's body is its own chunk, loaded on the window's first launch
  // (or once the desktop is idle), so on a slow network a visitor can open
  // an app before its code has arrived.
  await resetPage(page);
  const chunks = await holdChunks(page);

  const game = await openApp(page, "SRE Game", "sregame", { body: false });
  const gallery = await openWithKeyboard(page, "Gallery", "gallery");
  await expect(gallery).toBeFocused();
  await expect(gallery.getByRole("status")).toHaveText("Loading…");
  chunks.release();

  await expect(gallery.locator("#gallery-password")).toBeFocused();
  await expect(game.locator(".sre-boot-output")).toContainText("ssh", {
    timeout: 5_000,
  });
});

// Text only that app's code has, to tell its chunk apart (holdAppChunks).
const CALCULATOR_CODE = "Incomplete expression";
const TERMINAL_CODE = "Available commands: ";
const GALLERY_CODE = "Please enter the password";

async function openFromStartMenu(page: Page, appId: string) {
  await page.getByRole("button", { name: "Open start menu" }).click();
  await page.locator(`#start-menu [data-open-app="${appId}"]`).click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toHaveClass(/focused/);
  return window;
}

test("apps whose code arrives after their window opened still take focus", async ({
  page,
}) => {
  // The first launch from an icon or the Start menu with the pointer: the
  // body takes focus when it renders, since nothing else took it meanwhile.
  const chunks = await holdAppChunks(page, [TERMINAL_CODE, GALLERY_CODE]);
  await resetPage(page);
  const terminal = await openApp(page, "Terminal", "terminal", { body: false });
  await expect(terminal.getByRole("status")).toHaveText("Loading…");
  chunks.release(TERMINAL_CODE);
  await expect(terminal.locator("[data-terminal-input]")).toBeFocused();

  const gallery = await openFromStartMenu(page, "gallery");
  await expect(gallery.getByRole("status")).toHaveText("Loading…");
  chunks.release(GALLERY_CODE);
  await expect(gallery.locator("#gallery-password")).toBeFocused();
});

test("text typed while an app's code loads goes into its input", async ({
  page,
}) => {
  // A body renders only once its app's code has loaded. The keys typed before
  // it renders are kept, and typed into the input it focuses.
  const chunks = await holdAppChunks(page, [TERMINAL_CODE, GALLERY_CODE]);
  await resetPage(page);
  const terminal = await openApp(page, "Terminal", "terminal", { body: false });
  await expect(terminal.getByRole("status")).toHaveText("Loading…");
  await page.keyboard.type("hepl");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("lp");
  await page.keyboard.press("Enter");
  await page.keyboard.type("who");
  chunks.release(TERMINAL_CODE);
  const input = terminal.locator("[data-terminal-input]");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("who");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "pepo@desktop:~$ help",
  );
  await page.keyboard.type("ami");
  await expect(input).toHaveValue("whoami");

  // From the keyboard, through the Start menu.
  await page.locator("#taskbar-start").focus();
  await page.keyboard.press("Enter");
  await page.locator('#start-menu [data-open-app="gallery"]').focus();
  await page.keyboard.press("Enter");
  const gallery = page.locator("#window-gallery");
  await expect(gallery.getByRole("status")).toHaveText("Loading…");
  await page.keyboard.type("letmein");
  chunks.release(GALLERY_CODE);
  await expect(gallery.locator("#gallery-password")).toBeFocused();
  await expect(gallery.locator("#gallery-password")).toHaveValue("letmein");
  await expect(input).toHaveValue("whoami");
});

test("an app whose code arrives late leaves focus where the visitor moved it", async ({
  page,
}) => {
  const chunks = await holdAppChunks(page, [GALLERY_CODE]);
  await resetPage(page);
  const terminal = await openApp(page, "Terminal", "terminal");
  const input = terminal.locator("[data-terminal-input]");
  const gallery = await openFromStartMenu(page, "gallery");
  await expect(gallery.getByRole("status")).toHaveText("Loading…");
  // Back to the Terminal before the Gallery has loaded.
  await input.focus();
  await expect(terminal).toHaveClass(/focused/);
  chunks.release();

  await expect(gallery.locator("#gallery-password")).toBeAttached();
  await expect(input).toBeFocused();
  await expect(gallery).not.toHaveClass(/focused/);
});

test("a launcher's hover fetches its app, which then opens with its body at once", async ({
  page,
}) => {
  // Only intent fetches app code here: a visitor who saves data gets no
  // idle prefetching.
  await emulateSaveData(page);
  const chunks = await holdAppChunks(page, [CALCULATOR_CODE]);
  chunks.release();
  await resetPage(page);
  // The page's own code holds no app body: Calculator's arrives on demand,
  // even once the desktop has been idle (the "idle" Welcome has mounted).
  await expect(page.locator("#window-welcome .welcome-app")).toBeAttached();
  expect(chunks.requested(CALCULATOR_CODE)).toBeUndefined();

  const icon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Calculator" });
  await icon.hover();
  await expect.poll(() => chunks.requested(CALCULATOR_CODE)).toBeTruthy();
  // Let the chunk arrive and run.
  await page.waitForFunction(
    (url) => performance.getEntriesByName(url).length > 0,
    chunks.requested(CALCULATOR_CODE)!,
  );
  await page.waitForTimeout(300);

  // Shown with its body in the same commit, never "Loading…" or empty.
  await page.evaluate(() => {
    const win = document.getElementById("window-calculator")!;
    const seen = { empty: false };
    new MutationObserver(() => {
      if (!win.hidden && !win.querySelector(".calculator-app")) seen.empty = true;
    }).observe(win, { attributes: true, childList: true, subtree: true });
    (window as typeof window & { __calculatorSeen?: typeof seen }).__calculatorSeen = seen;
  });
  await icon.click();
  const calculator = page.locator("#window-calculator");
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("7*6");
  await page.keyboard.press("Enter");
  await expect(calculator.locator(".calculator-value")).toHaveText("42");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __calculatorSeen?: { empty: boolean } })
          .__calculatorSeen?.empty,
    ),
  ).toBe(false);
});

test("the desktop fetches app code in idle time once it has settled", async ({
  page,
}) => {
  const chunks = await holdAppChunks(page, [CALCULATOR_CODE, TERMINAL_CODE]);
  chunks.release();
  await resetPage(page);
  // No launcher touched.
  await expect
    .poll(
      () =>
        Boolean(
          chunks.requested(CALCULATOR_CODE) && chunks.requested(TERMINAL_CODE),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
  expect(await page.locator("#window-calculator").isHidden()).toBe(true);
});

test("an app whose code fails to download can be tried again", async ({
  page,
}) => {
  // The chunk fails (Turbopack tries it twice), then the network is back.
  let failing = true;
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (failing && (body.includes(CALCULATOR_CODE) || body.includes(TERMINAL_CODE))) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ response, body });
  });
  await resetPage(page);
  const calculator = await openApp(page, "Calculator", "calculator", {
    body: false,
  });
  const error = calculator.getByRole("alert");
  await expect(error).toContainText("This app could not load");
  const terminal = await openFromStartMenu(page, "terminal");
  await expect(terminal.getByRole("alert")).toContainText(
    "This app could not load",
  );
  failing = false;

  // "Try again" loads it (pressed from the keyboard: the Terminal window
  // may cover it), and so does the window's next launch. Focus moves into
  // the window as the button goes, instead of dropping to <body>.
  await error.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await expect(calculator.locator(".calculator-value")).toHaveText("0");
  await expect(calculator).toHaveClass(/focused/);
  expect(
    await calculator.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await openFromStartMenu(page, "terminal");
  await expect(terminal.locator("[data-terminal-input]")).toBeVisible();
  await expect(terminal.getByRole("alert")).toHaveCount(0);
});

test("Terminal skills lists skills.json", async ({ page }) => {
  await resetPage(page);
  const terminal = await openApp(page, "Terminal", "terminal");
  const input = terminal.locator("[data-terminal-input]");
  await input.fill("skills");
  await input.press("Enter");
  await expect(
    terminal.locator("[data-terminal-output] > div").last(),
  ).toHaveText(skills.map((skill) => skill.name).join(", ") + ".");
});

test("Trash Restore keeps the keyboard in the window", async ({ page }) => {
  await resetPage(page);
  const trash = await openApp(page, "Trash", "trash");
  const items = trash.locator("[data-trash-item]");
  const total = await items.count();
  expect(total).toBeGreaterThan(1);

  await trash.locator("[data-restore-trash]").first().focus();
  for (let restored = 1; restored <= total; restored += 1) {
    await page.keyboard.press("Enter");
    await expect(items).toHaveCount(total - restored);
    const focused = page.locator(":focus");
    await expect(focused).toHaveCount(1);
    expect(
      await focused.evaluate((element) =>
        Boolean(element.closest("#window-trash")),
      ),
    ).toBe(true);
    if (restored < total) {
      await expect(focused).toHaveAttribute("data-restore-trash", "");
    } else {
      await expect(focused).toHaveAttribute("data-empty-trash", "");
    }
  }
  await expect(trash.locator("[data-trash-empty]")).toBeVisible();
});

test("the Welcome quote rotator works from the keyboard", async ({ page }) => {
  await resetPage(page);
  const welcome = await openApp(page, "Welcome", "welcome");
  const quote = welcome.getByRole("button", {
    name: /Any sufficiently advanced technology/,
  });
  await expect(quote).toHaveAccessibleDescription(
    /Click the quote for more wisdom/,
  );

  await welcome.getByRole("button", { name: "Close Welcome - Login" }).focus();
  await page.keyboard.press("Tab");
  await expect(quote).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(welcome.locator("[data-quote-text]")).not.toContainText(
    "Any sufficiently advanced technology",
  );
  await page.keyboard.press("Space");
  await expect(welcome.locator("[data-quote-author]")).toHaveText(/^— /);
});

for (const theme of ["light", "dark"] as const) {
  test(`the Welcome quote's focus ring reaches 3:1 in the ${theme} theme`, async ({
    page,
  }) => {
    await resetPage(
      page,
      prefsStorage({
        theme,
        background: theme === "light" ? "cloud" : "network",
      }),
    );
    const welcome = await openApp(page, "Welcome", "welcome");
    const quote = welcome.locator("[data-quote-box]");
    await welcome
      .getByRole("button", { name: "Close Welcome - Login" })
      .focus();
    await page.keyboard.press("Tab");
    await expect(quote).toBeFocused();
    await expect(quote).toHaveCSS("outline-style", "solid");
    // The body fades in with its window (WelcomeApp.css): measure the quote
    // where it comes to rest, which is what the screenshot below shows (it
    // finishes animations).
    await welcome.evaluate((element) =>
      Promise.allSettled(
        element
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished),
      ),
    );
    // The ring is drawn at once, not faded in.
    expect(
      await quote.evaluate(
        (element) => getComputedStyle(element).transitionProperty,
      ),
    ).not.toMatch(/all|outline/);

    const ring = await quote.evaluate(
      (element) => getComputedStyle(element).outlineColor,
    );
    const box = (await quote.boundingBox())!;
    // The window just outside the ring, inside the quote's 16px margin.
    // (Firefox draws the ring a little further out, around the emoji.)
    const around = await paintedColor(page, {
      x: box.x + 24,
      y: box.y - 16,
      width: 64,
      height: 4,
    });
    expect(
      contrastRatio(ring, around),
      `${ring} on rgb(${around.join(", ")})`,
    ).toBeGreaterThanOrEqual(3);
  });
}

// The game's music comes back after a freeze. Headless Chromium always
// starts audio; Firefox and WebKit need a sound device to.
async function expectMusicBack(
  game: Locator,
  browserName: string,
  oscillators: () => Promise<number>,
  frozenSounds: number,
) {
  const audioOn = game.locator(".sre-audio-toggle[aria-pressed='true']");
  if (browserName === "chromium") await expect(audioOn).toHaveCount(1);
  if (await audioOn.count()) {
    await expect.poll(oscillators).toBeGreaterThan(frozenSounds);
  }
}

// Counts the oscillators the page creates (the SRE game's music and sounds).
// Call before the page loads; returns the counter's reader.
async function countOscillators(page: Page) {
  await page.addInitScript(() => {
    const created = { count: 0 };
    (window as unknown as { __oscillators: typeof created }).__oscillators =
      created;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      created.count += 1;
      return original.apply(this, args);
    };
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { __oscillators: { count: number } })
          .__oscillators.count,
    );
}

// Headless pages are never hidden or in the background, so this makes the
// page report what a browser does for a tab in the background (hidden) or
// for another app in front of the browser (not focused), with the events
// that announce it.
async function emulatePageVisibility(
  page: Page,
  state: { hidden: boolean; focused: boolean },
) {
  await page.evaluate(({ hidden, focused }) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    document.hasFocus = () => focused;
    window.dispatchEvent(new Event(focused ? "focus" : "blur"));
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("the SRE game freezes while minimized and resumes on restore", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  const oscillators = await countOscillators(page);
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");

  await game.getByRole("button", { name: "Enter Production" }).click({
    timeout: 15_000,
  });
  const timer = game.locator(".sre-alert-timer");
  await expect(timer).toBeVisible({ timeout: 10_000 });
  await expect(timer).not.toHaveText("Time remaining: 15s");

  await game.getByRole("button", { name: "Minimize SRE Game" }).click();
  await expect(game).toHaveClass(/minimized/);
  const frozenTimer = await timer.textContent();
  const frozenHealth = await game.locator(".sre-health-pct").textContent();
  const frozenSounds = await oscillators();
  await page.waitForTimeout(3_000);
  expect(await timer.textContent()).toBe(frozenTimer);
  expect(await game.locator(".sre-health-pct").textContent()).toBe(
    frozenHealth,
  );
  expect(await oscillators()).toBe(frozenSounds);

  await page
    .locator("#taskbar-apps")
    .getByRole("button", { name: /SRE Game/ })
    .click();
  await expect(game).not.toHaveClass(/minimized/);
  await expect(timer).not.toHaveText(frozenTimer ?? "", { timeout: 3_000 });
  await expectMusicBack(game, browserName, oscillators, frozenSounds);
});

test("the SRE game freezes in website mode and resumes in desktop mode", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  const oscillators = await countOscillators(page);
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");

  await game.getByRole("button", { name: "Enter Production" }).click({
    timeout: 15_000,
  });
  const timer = game.locator(".sre-alert-timer");
  await expect(timer).toBeVisible({ timeout: 10_000 });
  await expect(timer).not.toHaveText("Time remaining: 15s");

  await page
    .locator('[data-site-mode-panel="desktop"]')
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "website",
  );
  const frozenTimer = await timer.textContent();
  const frozenHealth = await game.locator(".sre-health-pct").textContent();
  const frozenSounds = await oscillators();
  await page.waitForTimeout(3_000);
  expect(await timer.textContent()).toBe(frozenTimer);
  expect(await game.locator(".sre-health-pct").textContent()).toBe(
    frozenHealth,
  );
  expect(await oscillators()).toBe(frozenSounds);

  await page
    .locator('[data-site-mode-panel="website"]')
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();
  await expect(timer).not.toHaveText(frozenTimer ?? "", { timeout: 3_000 });
  await expectMusicBack(game, browserName, oscillators, frozenSounds);
});

test("the SRE game freezes while its tab is hidden and resumes when shown", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  const oscillators = await countOscillators(page);
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");

  await game.getByRole("button", { name: "Enter Production" }).click({
    timeout: 15_000,
  });
  const timer = game.locator(".sre-alert-timer");
  await expect(timer).toBeVisible({ timeout: 10_000 });
  await expect(timer).not.toHaveText("Time remaining: 15s");

  await emulatePageVisibility(page, { hidden: true, focused: false });
  const frozenTimer = await timer.textContent();
  const frozenHealth = await game.locator(".sre-health-pct").textContent();
  const frozenSounds = await oscillators();
  await page.waitForTimeout(3_000);
  expect(await timer.textContent()).toBe(frozenTimer);
  expect(await game.locator(".sre-health-pct").textContent()).toBe(
    frozenHealth,
  );
  expect(await oscillators()).toBe(frozenSounds);

  await emulatePageVisibility(page, { hidden: false, focused: true });
  await expect(timer).not.toHaveText(frozenTimer ?? "", { timeout: 3_000 });
  await expectMusicBack(game, browserName, oscillators, frozenSounds);
});

// A tick after the game can no longer hear its keys, it pauses: a run never
// goes on, or ends, while the visitor is away. Hidden tabs still run timers
// (Chrome about once a second), and from the start a run hits the wall in
// eleven ticks.
test("Snake pauses while its tab is hidden and stays paused when shown", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Snake", "snake");
  const status = window.locator("[data-snake-status]");
  const score = window.locator("[data-snake-score]");

  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
  await emulatePageVisibility(page, { hidden: true, focused: false });
  await expect(status).toHaveText("Paused");
  const pausedScore = (await score.textContent()) ?? "";
  await page.waitForTimeout(1_500);

  await emulatePageVisibility(page, { hidden: false, focused: true });
  await expect(status).toHaveText("Paused");
  await expect(score).toHaveText(pausedScore);
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
});

test("Snake pauses while another app is in front of the browser", async ({
  page,
}) => {
  await resetPage(page);
  const window = await openApp(page, "Snake", "snake");
  const status = window.locator("[data-snake-status]");

  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
  await emulatePageVisibility(page, { hidden: false, focused: false });
  await expect(status).toHaveText("Paused");

  await emulatePageVisibility(page, { hidden: false, focused: true });
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
});

test("the SRE game starts even when the browser cannot start audio", async ({
  page,
}) => {
  // Without a sound device (Firefox, WebKit), resume() never settles.
  await page.addInitScript(() => {
    Object.defineProperty(AudioContext.prototype, "state", {
      get: () => "suspended",
    });
    AudioContext.prototype.resume = () => new Promise(() => {});
  });
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");
  await game.getByRole("button", { name: "Enter Production" }).click({
    timeout: 15_000,
  });
  await expect(game.locator(".sre-alert-timer")).toBeVisible({
    timeout: 10_000,
  });
  await expect(game.locator(".sre-audio-toggle")).toHaveText("Audio Off");
});

test("the Certifications wallet uses the same provider badges as website mode", async ({
  page,
}) => {
  const badges: Record<string, string> = {
    "Amazon Web Services": "AWS",
    "Cloud Native Computing Foundation": "CNCF",
    "Google Cloud": "GCP",
    HashiCorp: "HCP",
  };
  await resetPage(page);
  const certs = await openApp(page, "Certs", "certs");
  const cards = certs.locator(".cert-card");
  await expect(cards).toHaveCount(certifications.length);

  for (let i = 0; i < certifications.length; i += 1) {
    const provider = await cards.nth(i).locator(".cert-provider").textContent();
    expect(provider && badges[provider], `badge for ${provider}`).toBeTruthy();
    await expect(cards.nth(i).locator(".cert-mark")).toHaveText(
      badges[provider!],
    );
  }
});

test("the Projects heading counts the repos it shows", async ({ page }) => {
  await resetPage(page);
  const window = await openApp(page, "Projects", "project");
  await expect(window.locator(".project-card")).toHaveCount(projects.length);
  await expect(window.locator(".terminal-heading")).toHaveText(
    `~/projects $ gh repo list --limit ${projects.length}`,
  );
});

test("About and the SRE game use the current job title", async ({ page }) => {
  await resetPage(page);
  const about = await openApp(page, "About Me", "me");
  await expect(about.locator(".profile-role")).toHaveText(currentRole);
  await expect(about.locator(".profile-location")).toHaveText(
    "Bangkok, Thailand",
  );
  await expect(
    about.locator("p", { hasText: "Experienced and energetic" }),
  ).toContainText(`Experienced and energetic ${currentRole} with over`);
  await expect(about).not.toContainText("DevOps Engineer");

  await expect(page.locator("#window-sregame .sre-hero-subtitle")).toHaveText(
    currentRole,
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`Calculator, Snake, SRE game and Trash text reaches AA contrast in the ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await resetPage(
      page,
      prefsStorage({
        theme,
        background: theme === "light" ? "cloud" : "network",
      }),
    );

    const calculator = await openApp(page, "Calculator", "calculator");
    for (const key of ["7", "+", "1", "Enter"]) await page.keyboard.press(key);
    await expectReadable(
      page,
      calculator.locator(".calculator-history"),
      "history",
    );
    await expectReadable(
      page,
      calculator.locator(".calculator-op, .calculator-equals"),
      "operator keys",
    );
    await page.keyboard.press("Escape");

    const snake = await openApp(page, "Snake", "snake");
    await expectReadable(
      page,
      snake.locator(".snake-stats span"),
      "stat labels",
    );
    await expectReadable(page, snake.locator(".snake-overlay span"), "overlay");
    await expectReadable(
      page,
      snake.locator(".snake-controls button, .snake-pad button"),
      "controls",
    );
    await page.keyboard.press("Escape");

    const trash = await openApp(page, "Trash", "trash");
    await expectReadable(page, trash.locator(".trash-toolbar p"), "count");
    await expectReadable(
      page,
      trash.locator(".trash-item-title span").first(),
      "type badge",
    );
    await expectReadable(
      page,
      trash.locator(".trash-item small").first(),
      "date",
    );
    await page.keyboard.press("Escape");

    const game = await openApp(page, "SRE Game", "sregame");
    await expectReadable(
      page,
      game.locator(".sre-audio-toggle"),
      "audio toggle",
    );
    await expect(game.locator(".sre-line.sre-dim").first()).toBeVisible({
      timeout: 5_000,
    });
    await expectReadable(
      page,
      game.locator(".sre-line.sre-dim").first(),
      "dim boot line",
    );
    await game.getByRole("button", { name: "Enter Production" }).click({
      timeout: 15_000,
    });
    await expect(game.locator(".sre-action-btn").first()).toBeVisible({
      timeout: 10_000,
    });
    await expectReadable(page, game.locator(".sre-hud-label"), "HUD labels");
    await expectReadable(page, game.locator(".sre-health-pct"), "health");
    await expectReadable(page, game.locator(".sre-alert-desc"), "alert");
    await expectReadable(page, game.locator(".sre-action-btn"), "actions");
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Certifications and Gallery accent text reaches AA contrast in the ${theme} theme`, async ({
    page,
  }) => {
    await resetPage(
      page,
      prefsStorage({
        theme,
        background: theme === "light" ? "cloud" : "network",
      }),
    );

    const certs = await openApp(page, "Certs", "certs");
    await expectReadable(page, certs.locator(".cert-mark"), "provider badges");
    await page.keyboard.press("Escape");

    const gallery = await openApp(page, "Gallery", "gallery");
    await expectReadable(
      page,
      gallery.getByRole("button", { name: "Unlock" }),
      "Unlock",
    );
    await gallery.getByLabel("Please enter the password").fill("hunter2");
    await page.keyboard.press("Enter");
    await expect(gallery.locator("[data-gallery-error]")).not.toBeEmpty();
    await expectReadable(
      page,
      gallery.locator("[data-gallery-error]"),
      "wrong-password message",
    );
    await gallery.getByLabel("Please enter the password").fill("password");
    await page.keyboard.press("Enter");
    await expect(gallery.locator(".ops-pill")).toBeVisible();
    await expectReadable(page, gallery.locator(".ops-pill"), "gallery pill");
  });
}

// Opaque windows give axe solid backgrounds to measure; with glass it can
// only report the text as incomplete.
for (const theme of ["light", "dark"] as const) {
  test(`About, Blog, Work, Projects, Welcome and Terminal text reaches AA in opaque ${theme} windows`, async ({
    page,
  }) => {
    // axe walks every article the Blog window renders.
    test.setTimeout(90_000);
    await resetPage(
      page,
      prefsStorage({
        theme,
        background: theme === "light" ? "cloud" : "network",
        windowGlass: false,
      }),
    );
    await page.addScriptTag({ content: axeSource });
    for (const [label, appId] of [
      ["About Me", "me"],
      ["Blog", "blog"],
      ["Work", "work"],
      ["Projects", "project"],
      ["Welcome", "welcome"],
      ["Terminal", "terminal"],
    ]) {
      const window = await openApp(page, label, appId);
      // Let fade-ins (Welcome's messages) finish before measuring.
      await window.evaluate((element) =>
        Promise.all(
          element
            .getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished),
        ),
      );
      if (appId === "blog") {
        await window.locator("[data-blog-index]").nth(1).click();
        await expect(window.locator("[data-blog-back]:visible")).toBeFocused();
      }
      const failures = await page.evaluate(async (selector) => {
        const axe = (
          window as typeof window & {
            axe: {
              run: (
                context: string,
                options: object,
              ) => Promise<{
                violations: {
                  nodes: { target: string[]; any: { data?: unknown }[] }[];
                }[];
              }>;
            };
          }
        ).axe;
        const result = await axe.run(selector, {
          runOnly: ["color-contrast"],
        });
        return result.violations.flatMap((violation) =>
          violation.nodes.map(
            (node) =>
              `${node.target.join(" ")} ${JSON.stringify(node.any[0]?.data)}`,
          ),
        );
      }, `#window-${appId}`);
      expect(failures, `${appId} (${theme})`).toEqual([]);
      await window.getByRole("button", { name: /^Close / }).click();
      await expect(window).toBeHidden();
    }
  });

  test(`the tray panel text reaches AA in the ${theme} theme`, async ({
    page,
  }) => {
    await resetPage(
      page,
      prefsStorage({
        theme,
        background: theme === "light" ? "cloud" : "network",
      }),
    );
    await page.locator("#taskbar-clock-button").click();
    const tray = page.locator("#tray-panel");
    await expect(tray).toHaveClass(/visible/);
    await page.waitForTimeout(250);
    await expectReadable(page, tray.locator(".tray-status"), "status");
    await expectReadable(page, tray.locator("#tray-date"), "date");
    await expectReadable(
      page,
      tray.locator(".tray-section-title"),
      "section titles",
    );
    await expectReadable(
      page,
      tray.locator(".tray-calendar-days span").first(),
      "weekday",
    );
    await expectReadable(
      page,
      tray.locator(".calendar-day.today"),
      "today",
    );
    await expectReadable(page, page.locator("#taskbar-date"), "taskbar date");
  });
}
