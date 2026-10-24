import { expect, test, type Page } from "@playwright/test";
import { openApp, resetPage } from "./helpers";

// Open windows can cover desktop icons, so later apps launch from the start menu.
async function openFromStartMenu(page: Page, appId: string) {
  await page.getByRole("button", { name: "Open start menu" }).click();
  await page.locator(`#start-menu [data-open-app="${appId}"]`).click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).toHaveClass(/focused/);
  return window;
}

async function focusFromTaskbar(page: Page, name: RegExp) {
  await page.locator("#taskbar-apps").getByRole("button", { name }).click();
}

test.beforeEach(async ({ page }) => {
  await resetPage(page);
});

test("typing in Terminal is not captured by unfocused Calculator and Snake", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const snake = await openFromStartMenu(page, "snake");
  const terminal = await openFromStartMenu(page, "terminal");
  const input = terminal.locator("[data-terminal-input]");

  await input.click();
  await page.keyboard.type("echo 123-4.5 wasd p");
  await expect(input).toHaveValue("echo 123-4.5 wasd p");
  await page.keyboard.press("Backspace");
  await expect(input).toHaveValue("echo 123-4.5 wasd ");

  await input.fill("");
  await page.keyboard.type("help");
  await page.keyboard.press("Enter");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "Available commands:",
  );

  await expect(calculator.locator(".calculator-value")).toHaveText("0");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");
});

test("minimized Calculator and Snake ignore the keyboard", async ({ page }) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  await calculator.getByRole("button", { name: "Minimize Calculator" }).click();
  const snake = await openFromStartMenu(page, "snake");
  await snake.getByRole("button", { name: "Minimize Snake" }).click();
  await expect(calculator).toHaveClass(/minimized/);
  await expect(snake).toHaveClass(/minimized/);

  await page.keyboard.type("42+w");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");

  await expect(calculator.locator(".calculator-value")).toHaveText("0");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");
});

test("Snake leaves the Gallery password and command palette input alone", async ({
  page,
}) => {
  const snake = await openApp(page, "Snake", "snake");
  const gallery = await openFromStartMenu(page, "gallery");

  await gallery.locator("[data-gallery-password]").click();
  await page.keyboard.type("password");
  await page.keyboard.press("Enter");
  await expect(gallery.locator("[data-gallery-unlocked]")).toBeVisible();

  await focusFromTaskbar(page, /Snake/);
  await expect(snake).toHaveClass(/focused/);
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.type("snakeways");
  await expect(page.locator("#command-palette-input")).toHaveValue("snakeways");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");
});

// Headless Chromium has no browser UI to act on these shortcuts, so check that
// no page handler cancels them instead.
test("focused Calculator and Snake leave browser shortcuts such as Ctrl+R alone", async ({
  page,
}) => {
  await page.evaluate(() => {
    const probe = window as typeof window & { __preventedKeys?: string[] };
    probe.__preventedKeys = [];
    // A window listener runs after the apps' document listeners.
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) probe.__preventedKeys?.push(event.key);
    });
  });

  const calculator = await openApp(page, "Calculator", "calculator");
  for (const key of [
    "Control+r",
    "Meta+r",
    "F5",
    "Control+Minus",
    "Control+Equal",
    "Control+0",
    "Alt+1",
  ]) {
    await page.keyboard.press(key);
  }
  await expect(calculator.locator(".calculator-value")).toHaveText("0");

  const snake = await openFromStartMenu(page, "snake");
  for (const key of [
    "Control+r",
    "Control+a",
    "Control+s",
    "Control+d",
    "Meta+w",
    "Alt+ArrowLeft",
  ]) {
    await page.keyboard.press(key);
  }
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");

  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __preventedKeys?: string[] })
          .__preventedKeys,
    ),
  ).toEqual([]);
});

test("focused Calculator and Snake stay keyboard operable", async ({
  page,
}) => {
  // Focus stays on the desktop icon that opened the window.
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");
  await page.keyboard.type("12*3");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("36");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("NumpadAdd");
  await page.keyboard.type("4");
  await expect(value).toHaveText("3+4");
  await page.keyboard.press("=");
  await expect(value).toHaveText("7");

  const snake = await openFromStartMenu(page, "snake");
  const status = snake.locator("[data-snake-status]");
  await page.keyboard.press("ArrowUp");
  await expect(status).toHaveText("Running");
  await page.keyboard.press("p");
  await expect(status).toHaveText("Paused");
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
  await page.keyboard.press("a");
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Paused");

  await page.keyboard.press("w");
  await expect(status).toHaveText("Running");
  await focusFromTaskbar(page, /Calculator/);
  await expect(status).toHaveText("Paused");
});

test("Enter and Space activate taskbar and Start menu controls while an app is focused", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");
  await page.keyboard.type("12+3");

  await page.locator("#taskbar-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  // An open overlay keeps every key, even once focus leaves its search field.
  await page.locator('#start-menu [data-open-app="snake"]').focus();
  await page.keyboard.press("Enter");
  const snake = page.locator("#window-snake");
  await expect(snake).toHaveClass(/focused/);
  await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);
  await expect(value).toHaveText("12+3");

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#website")).toBeVisible();
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");
});

test("an open command palette keeps keys from the app behind it", async ({
  page,
}) => {
  const palette = page.locator("#command-palette");
  const input = page.locator("#command-palette-input");
  const snake = await openApp(page, "Snake", "snake");
  const status = snake.locator("[data-snake-status]");

  await page.keyboard.press("ControlOrMeta+K");
  await expect(input).toBeFocused();
  await input.blur();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Ready");
  await page.keyboard.press("Escape");
  await expect(palette).toHaveAttribute("data-visible", "false");
  await expect(snake).toBeVisible();

  const calculator = await openFromStartMenu(page, "calculator");
  const value = calculator.locator(".calculator-value");
  await page.keyboard.type("12");
  await expect(value).toHaveText("12");
  await page.keyboard.press("ControlOrMeta+K");
  await expect(input).toBeFocused();
  await input.blur();
  await page.keyboard.type("42");
  await expect(value).toHaveText("12");
  // The Escape that closes the palette is not the Calculator's, which
  // clears the expression on Escape.
  await page.keyboard.press("Escape");
  await expect(palette).toHaveAttribute("data-visible", "false");
  await page.keyboard.type("7");
  await expect(value).toHaveText("127");
  await expect(status).toHaveText("Ready");
});

test("an app restored or raised from the taskbar with the pointer gets the keys", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");
  await calculator.getByRole("button", { name: "Minimize Calculator" }).click();
  await expect(calculator).toHaveClass(/minimized/);

  await focusFromTaskbar(page, /Calculator/);
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("1+1");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("2");
  await expect(calculator).not.toHaveClass(/minimized/);

  await openFromStartMenu(page, "snake");
  await focusFromTaskbar(page, /Calculator/);
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("*3");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("6");
  await expect(calculator).toHaveClass(/focused/);
});

test("closing or minimizing the focused window hands the keyboard to the next one", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");

  const terminal = await openFromStartMenu(page, "terminal");
  await terminal.locator("[data-terminal-input]").click();
  await terminal.getByRole("button", { name: "Close Terminal" }).click();
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("7");
  await expect(value).toHaveText("7");

  const snake = await openFromStartMenu(page, "snake");
  await snake.getByRole("button", { name: "Minimize Snake" }).click();
  await expect(snake).toHaveClass(/minimized/);
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("+1");
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("8");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");

  await page.keyboard.press("Escape");
  await expect(calculator).toBeHidden();
});

// Windows reports AltGr as Ctrl+Alt, and some layouts type * or / with it.
test("Calculator accepts operators typed with AltGr", async ({ page }) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  await page.keyboard.type("6");
  await page.evaluate(() => {
    for (const key of ["*", "7"]) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          ctrlKey: true,
          altKey: true,
          modifierAltGraph: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  });
  await expect(calculator.locator(".calculator-value")).toHaveText("6*7");
});

test("website mode keeps Space and arrow keys for scrolling with Snake open", async ({
  page,
}) => {
  await openApp(page, "Calculator", "calculator");
  const snake = await openFromStartMenu(page, "snake");
  await page.keyboard.press("ArrowUp");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Running");

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(page.locator("#website")).toBeVisible();
  await expect(snake.locator("[data-snake-status]")).toHaveText("Paused");

  await page.locator("#website h1").click();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const afterSpace = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(afterSpace);

  await expect(page.locator(".calculator-value")).toHaveText("0");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Paused");
});

test("closing an app opened from its launcher hands the keyboard to the next window", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const snake = await openFromStartMenu(page, "snake");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");

  await expect(snake).toBeHidden();
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("7");
  await expect(calculator.locator(".calculator-value")).toHaveText("7");
});

test("Snake pauses when the Start menu or command palette takes the keyboard", async ({
  page,
}) => {
  const snake = await openApp(page, "Snake", "snake");
  const status = snake.locator("[data-snake-status]");

  await page.keyboard.press("ArrowUp");
  await expect(status).toHaveText("Running");
  await page.getByRole("button", { name: "Open start menu" }).click();
  await expect(status).toHaveText("Paused");

  await page.keyboard.press("Escape");
  await snake.locator(".window-content").click();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
  await page.keyboard.press("Control+k");
  await expect(status).toHaveText("Paused");
});

test("tabbing into an unfocused window gives it the keyboard", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const terminal = await openFromStartMenu(page, "terminal");
  await terminal.locator("[data-terminal-input]").click();

  // Moving DOM focus into the window is what Tab and Shift+Tab do.
  await calculator.locator(".window-content button").first().focus();
  await expect(calculator).toHaveClass(/focused/);
  await page.keyboard.type("5+5");
  await expect(calculator.locator(".calculator-value")).toHaveText("5+5");
});

test("plain keydown events from other scripts do not throw", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openApp(page, "Calculator", "calculator");

  await page.evaluate(() =>
    document.body.dispatchEvent(new Event("keydown", { bubbles: true })),
  );
  expect(errors).toEqual([]);
});

test("Enter on a focused app's title-bar Close button closes the window", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  await calculator.getByRole("button", { name: "Close Calculator" }).focus();
  await page.keyboard.press("Enter");
  await expect(calculator).toBeHidden();
  await expect(calculator.locator(".calculator-value")).toHaveText("0");
});

test("Enter and Space on a focused Calculator key press that key", async ({
  page,
}) => {
  const calculator = await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");
  await page.keyboard.type("12+");

  await calculator.getByRole("button", { name: "7", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("12+7");
  await page.keyboard.press("Space");
  await expect(value).toHaveText("12+77");

  // A clicked key does not keep focus, so Enter afterwards still means "=".
  await calculator.getByRole("button", { name: "AC" }).click();
  await calculator.getByRole("button", { name: "4", exact: true }).click();
  await calculator.getByRole("button", { name: "+" }).click();
  await calculator.getByRole("button", { name: "4", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("8");
});
