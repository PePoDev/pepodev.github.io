import { expect, test, type Locator, type Page } from "@playwright/test";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};
import projects from "../../src/data/projects.json" with { type: "json" };
import skills from "../../src/data/skills.json" with { type: "json" };

const currentRole = experiences[0].role;

async function resetPage(
  page: Page,
  prefs?: Record<string, string>,
  storage: Record<string, string> = {},
) {
  await page.goto("/");
  await page.evaluate(
    ({ savedPrefs, savedStorage }) => {
      localStorage.clear();
      // Skip the first-visit Welcome window so it cannot take focus mid-test.
      localStorage.setItem("pepodev.hasVisited", "true");
      if (savedPrefs) {
        localStorage.setItem(
          "pepodev.desktopPrefs",
          JSON.stringify(savedPrefs),
        );
      }
      for (const [key, value] of Object.entries(savedStorage)) {
        localStorage.setItem(key, value);
      }
    },
    { savedPrefs: prefs ?? null, savedStorage: storage },
  );
  await page.reload();
}

async function openApp(page: Page, label: string, appId: string) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).toHaveClass(/focused/);
  // Let it finish fading in, so screenshots see the window, not a blend.
  await expect(window).not.toHaveClass(/opening/);
  return window;
}

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
  const count = await locator.count();
  expect(count, `${label} is rendered`).toBeGreaterThan(0);
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
  await resetPage(page, undefined, { "pepodev.snake.best": "170" });
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
  await resetPage(page, undefined, { "pepodev.snake.best": "250" });
  window = await openApp(page, "Snake", "snake");
  await expect(window.locator("[data-snake-best]")).toHaveText("250");
  expect(await storedBests()).toEqual([null, "250"]);
});

test("Snake's accent controls show hover in the light theme", async ({
  page,
}) => {
  await resetPage(page, { theme: "light", background: "cloud" });
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
    await resetPage(page, {
      theme,
      background: theme === "light" ? "cloud" : "network",
    });
    const welcome = await openApp(page, "Welcome", "welcome");
    const quote = welcome.locator("[data-quote-box]");
    await welcome
      .getByRole("button", { name: "Close Welcome - Login" })
      .focus();
    await page.keyboard.press("Tab");
    await expect(quote).toBeFocused();
    await expect(quote).toHaveCSS("outline-style", "solid");
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

test("the SRE game freezes while minimized and resumes on restore", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
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
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");
  const oscillators = () =>
    page.evaluate(
      () =>
        (window as unknown as { __oscillators: { count: number } })
          .__oscillators.count,
    );

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
  await resetPage(page);
  const game = await openApp(page, "SRE Game", "sregame");
  const oscillators = () =>
    page.evaluate(
      () =>
        (window as unknown as { __oscillators: { count: number } })
          .__oscillators.count,
    );

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
    await resetPage(page, {
      theme,
      background: theme === "light" ? "cloud" : "network",
    });

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
    await resetPage(page, {
      theme,
      background: theme === "light" ? "cloud" : "network",
    });

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
