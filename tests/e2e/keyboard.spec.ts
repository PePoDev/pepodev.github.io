import { expect, test, type Page } from "@playwright/test";
import {
  emulateSaveData,
  holdAppChunks,
  holdChunks,
  openApp,
  resetPage,
  waitForWindowManager,
} from "./helpers";

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

// The bodies the desktop mounts once it is idle (registry mount: "idle").
// Waiting for them leaves no app code in flight that the test did not ask
// for, so none is cut off when the test ends.
async function waitForIdleBodies(page: Page) {
  for (const appId of ["welcome", "sregame", "music"]) {
    await expect(
      page.locator(`#window-${appId} .window-content > :not(.app-loading)`),
    ).not.toHaveCount(0);
  }
}

// Reloads for a visitor who saves data, where only a launch (or a
// launcher's hover or focus) asks for an app's code, and once the desktop
// has its own code and idle bodies, holds back the code asked for from
// then on, as a slow network would.
async function reloadAndHoldApps(page: Page) {
  await emulateSaveData(page);
  await page.reload();
  await waitForWindowManager(page);
  await waitForIdleBodies(page);
  return holdChunks(page);
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

test("Snake leaves the Gallery password and the Quick Access search alone", async ({
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
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.type("snakeways");
  await expect(page.locator("#start-menu-search")).toHaveValue("snakeways");
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

test("keys typed while an app's code loads reach it, even after another window took over", async ({
  page,
}) => {
  // On a slow network a window opens before its app's code has arrived.
  // The keys typed into it meanwhile are the app's: they are kept and
  // replayed, in order, once its body renders, also when the visitor has
  // moved on to another window by then.
  const chunks = await holdAppChunks(page, ["Incomplete expression"]);
  await resetPage(page);
  const calculator = await openApp(page, "Calculator", "calculator", {
    body: false,
  });
  await expect(calculator.getByRole("status")).toHaveText("Loading…");
  await page.keyboard.type("12*3");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("4");

  await page.locator("#taskbar-start").focus();
  await page.keyboard.press("Enter");
  await page.locator('#start-menu [data-open-app="snake"]').focus();
  await page.keyboard.press("Enter");
  const snake = page.locator("#window-snake");
  await expect(snake).toHaveClass(/focused/);
  await expect(calculator.getByRole("status")).toHaveText("Loading…");

  chunks.release();
  const value = calculator.locator(".calculator-value");
  await expect(value).toHaveText("12*4");
  await expect(snake.locator("[data-snake-status]")).toHaveText("Ready");
  await focusFromTaskbar(page, /Calculator/);
  await page.keyboard.press("Enter");
  await expect(value).toHaveText("48");
});

test("keys typed into a window that closes before its code arrives are dropped", async ({
  page,
}) => {
  const chunks = await holdAppChunks(page, ["Incomplete expression"]);
  await resetPage(page);
  const calculator = await openApp(page, "Calculator", "calculator", {
    body: false,
  });
  await page.keyboard.type("99");
  await calculator.getByRole("button", { name: "Close Calculator" }).click();
  await expect(calculator).toBeHidden();
  chunks.release();

  await openApp(page, "Calculator", "calculator");
  const value = calculator.locator(".calculator-value");
  await expect(value).toHaveText("0");
  await page.keyboard.type("7");
  await expect(value).toHaveText("7");
});

test("Tab typed while an app's code loads stays in its window, then moves into the app", async ({
  page,
}) => {
  // Until the body renders, the window holds only its title-bar controls,
  // so a fourth Tab would reach the taskbar's Start button: Enter would then
  // open Quick Access, and the next Enters run what it highlights. Tab waits
  // in the window instead, and once the body renders it moves on into it,
  // so the Enters press the control those Tabs reached (the first Restore
  // button, after Empty trash).
  await page.evaluate(() =>
    localStorage.setItem("pepodev.snake.best.v2", "42"),
  );
  const chunks = await reloadAndHoldApps(page);
  let loads = 0;
  page.on("load", () => (loads += 1));

  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.type("trash");
  await page.keyboard.press("Enter");
  const trash = page.locator("#window-trash");
  await expect(trash).toBeFocused();
  for (let tab = 0; tab < 5; tab += 1) await page.keyboard.press("Tab");
  for (let enter = 0; enter < 3; enter += 1) await page.keyboard.press("Enter");
  await expect(trash.locator("[data-trash-app]")).toHaveCount(0);
  await expect(trash).toBeFocused();
  await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);

  chunks.release();
  await expect(trash.locator("[data-trash-count]")).toHaveText(
    "2 questionable artifacts quarantined",
  );
  await expect(trash.locator("[data-restore-trash]").first()).toBeFocused();
  expect(loads).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("pepodev.snake.best.v2")),
  ).toBe("42");
});

test("keys typed after Tabs that pass a loading app never press controls outside its window", async ({
  page,
}) => {
  // With the body there, the fourth and fifth Tabs reach its two controls,
  // and the sixth the taskbar's Start button. Focus ends up there once the
  // body renders, but the Enter typed meanwhile was kept for the app, so it
  // does not open Quick Access.
  const chunks = await reloadAndHoldApps(page);
  await page.locator('#desktop-icons [data-open-app="whitenoise"]').focus();
  await page.keyboard.press("Enter");
  const noise = page.locator("#window-whitenoise");
  await expect(noise).toBeFocused();
  for (let tab = 0; tab < 6; tab += 1) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(noise.locator("[data-noise-toggle]")).toHaveCount(0);
  await expect(noise).toBeFocused();

  chunks.release();
  await expect(page.locator("#taskbar-start")).toBeFocused();
  await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);
});

test("Tab still moves through a loading window's title bar", async ({
  page,
}) => {
  const chunks = await reloadAndHoldApps(page);
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Calculator" })
    .focus();
  await page.keyboard.press("Enter");
  const calculator = page.locator("#window-calculator");
  await expect(calculator).toBeFocused();
  for (let tab = 0; tab < 3; tab += 1) await page.keyboard.press("Tab");
  await expect(calculator.locator(".calculator-value")).toHaveCount(0);
  await expect(
    calculator.getByRole("button", { name: "Close Calculator" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(calculator).toBeHidden();
  chunks.release();
  await expect(calculator.locator(".calculator-app")).toBeAttached();
});

test("a window whose app fails to render drops the keys typed meanwhile and lets Tab through", async ({
  page,
}) => {
  // "This app could not load" replaces an app that threw while rendering.
  // That window is not loading, so Tab moves through it to the taskbar and
  // back instead of waiting there, and the Tabs and Enters typed before the
  // error never reach the app that "Try again" then renders.
  await emulateSaveData(page);
  await page.reload();
  await waitForWindowManager(page);
  await waitForIdleBodies(page);
  // Trash's code, held back as a slow network would, and made to throw
  // while it renders until the test says otherwise.
  const count = '"data-trash-count":""';
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/_next\/static\/[^?]+\.js(\?|$)/, async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    if (body.includes(count)) {
      await held;
      body = body.replace(
        count,
        '"data-trash-count":(()=>{if(window.__trashThrows)throw Error("Trash failed");return ""})()',
      );
    }
    await route.fulfill({ response, body });
  });
  await page.evaluate(() => Object.assign(window, { __trashThrows: true }));

  await page.locator('#desktop-icons [data-open-app="trash"]').focus();
  await page.keyboard.press("Enter");
  const trash = page.locator("#window-trash");
  await expect(trash).toBeFocused();
  for (let tab = 0; tab < 5; tab += 1) await page.keyboard.press("Tab");
  for (let enter = 0; enter < 3; enter += 1) await page.keyboard.press("Enter");
  await expect(trash).toBeFocused();

  release();
  const error = trash.getByRole("alert");
  await expect(error).toContainText("This app could not load");
  const retry = error.getByRole("button", { name: "Try again" });
  for (let tab = 0; tab < 4; tab += 1) await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#taskbar-start")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(retry).toBeFocused();

  await page.evaluate(() => Object.assign(window, { __trashThrows: false }));
  await page.keyboard.press("Enter");
  await expect(trash.locator("[data-trash-count]")).toHaveText(
    "5 questionable artifacts quarantined",
  );
  await expect(trash.locator("[data-trash-item]")).toHaveCount(5);
  expect(
    await trash.evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
});

test("an open Quick Access keeps keys from the app behind it", async ({
  page,
}) => {
  const quickAccess = page.locator("#start-menu");
  const input = page.locator("#start-menu-search");
  const snake = await openApp(page, "Snake", "snake");
  const status = snake.locator("[data-snake-status]");

  await page.keyboard.press("ControlOrMeta+K");
  await expect(input).toBeFocused();
  await input.blur();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Ready");
  await page.keyboard.press("Escape");
  await expect(quickAccess).not.toHaveClass(/visible/);
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
  // The Escape that closes Quick Access is not the Calculator's, which
  // clears the expression on Escape.
  await page.keyboard.press("Escape");
  await expect(quickAccess).not.toHaveClass(/visible/);
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

test("Snake pauses when Quick Access, from the Start button or Ctrl+K, takes the keyboard", async ({
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
