import { expect, test, type Page } from "@playwright/test";
import { resetPage, waitForWindowManager } from "./helpers";

const savedPrefs = {
  theme: "light",
  background: "mint",
  accent: "purple",
  radius: 14,
  glass: 72,
  backgroundEffect: true,
  windowGlass: true,
};

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await expect(page.locator("#command-palette-input")).toBeFocused();
}

function visibleItemIds(page: Page) {
  return page
    .locator("#command-palette-results .command-palette-item")
    .evaluateAll((items) =>
      items
        .filter((item) => (item as HTMLElement).style.display !== "none")
        .map((item) => (item as HTMLElement).dataset.id),
    );
}

function savedTheme(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}").theme ??
      null,
  );
}

// Reset Desktop reloads 500ms after it runs; a marker on window survives only
// when no reload happened.
async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as typeof window & { __noReload?: boolean }).__noReload = true;
  });
}

async function expectNoReload(page: Page) {
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __noReload?: boolean }).__noReload,
    ),
  ).toBe(true);
}

test("command palette ranks name matches first and confirms Reset Desktop", async ({
  page,
}) => {
  await resetPage(page, {
    "pepodev.desktopPrefs": JSON.stringify(savedPrefs),
  });
  await markPage(page);
  const status = page.locator("#command-palette-status");
  const reset = page.locator('[data-id="reset-desktop"]');

  // A name (or a word in it) that starts with the query beats the rest of a
  // name, which beats a description, across sections: "reset" contains
  // "set", and Reset Desktop's description contains "settings" and "all".
  const rankings: Record<string, string[]> = {
    set: ["settings", "reset-desktop"],
    sett: ["settings", "reset-desktop"],
    settings: ["settings", "reset-desktop"],
    all: ["close-all-windows", "gallery", "reset-desktop", "certs"],
  };
  for (const [query, ids] of Object.entries(rankings)) {
    await openPalette(page);
    await page.keyboard.type(query);
    expect(await visibleItemIds(page), query).toEqual(ids);
    await expect(page.locator(`[data-id="${ids[0]}"]`)).toHaveClass(
      /selected/,
    );
    await page.keyboard.press("Escape");
  }

  // Clearing the query puts every item back under its section title.
  await openPalette(page);
  await page.keyboard.type("all");
  await expect(
    page.locator(".command-palette-section-title:visible"),
  ).toHaveCount(0);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(page.locator(".command-palette-section-title")).toHaveText([
    "Commands",
    "Apps",
    "External Links",
  ]);
  expect((await visibleItemIds(page)).slice(0, 4)).toEqual([
    "reset-desktop",
    "toggle-theme",
    "close-all-windows",
    "welcome",
  ]);
  await page.keyboard.press("Escape");

  await openPalette(page);
  await page.keyboard.type("set");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-settings")).toBeVisible();
  await expectNoReload(page);
  expect(await savedTheme(page)).toBe("light");

  // The first Enter only arms Reset Desktop; typing disarms it.
  await openPalette(page);
  await page.keyboard.type("reset");
  await page.keyboard.press("Enter");
  await expect(reset).toHaveClass(/confirming/);
  await expect(status).toHaveText(
    "Press Enter or click Reset Desktop again to clear all settings and reload.",
  );
  await page.keyboard.type(" desk");
  await expect(reset).not.toHaveClass(/confirming/);
  await expect(status).toBeEmpty();
  await page.keyboard.press("Enter");
  await expect(reset).toHaveClass(/confirming/);

  // Closing the palette disarms it too.
  await page.keyboard.press("Escape");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "false",
  );
  await expect(reset).not.toHaveClass(/confirming/);
  await openPalette(page);
  await page.keyboard.type("reset");
  await reset.click();
  await expect(reset).toHaveClass(/confirming/);
  await expectNoReload(page);
  expect(await savedTheme(page)).toBe("light");

  // A second click (or Enter) runs it.
  const reloaded = page.waitForEvent("load");
  await reset.click();
  await reloaded;
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await savedTheme(page)).not.toBe("light");
});

test("command palette Enter runs the focused item and the highlight follows focus", async ({
  page,
}) => {
  await resetPage(page, {
    "pepodev.desktopPrefs": JSON.stringify(savedPrefs),
  });
  await markPage(page);

  await openPalette(page);
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-id="reset-desktop"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const toggleTheme = page.locator('[data-id="toggle-theme"]');
  await expect(toggleTheme).toBeFocused();
  await expect(toggleTheme).toHaveClass(/selected/);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator('[data-id="reset-desktop"]')).toHaveClass(
    /selected/,
  );
  await page.keyboard.press("Tab");
  await expect(toggleTheme).toBeFocused();
  await expect(page.locator(".command-palette-item.selected")).toHaveCount(1);
  await expect(toggleTheme).toHaveClass(/selected/);

  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoReload(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}"),
    ),
  ).toMatchObject({ theme: "dark", accent: "purple", radius: 14 });
});

test("closed overlays leave the tab order and return focus to their opener", async ({
  page,
}) => {
  await resetPage(page);
  const overlays = ["#start-menu", "#tray-panel", "#command-palette"];
  const isInClosedOverlay = () =>
    page.evaluate(
      (selectors) =>
        selectors.some((selector) =>
          document.querySelector(selector)?.contains(document.activeElement),
        ),
      overlays,
    );

  for (const selector of overlays) {
    expect(
      await page.locator(selector).evaluate((el) => (el as HTMLElement).inert),
    ).toBe(true);
  }

  // One full Tab cycle never lands inside a closed overlay.
  const start = await page.evaluate(() => document.activeElement?.tagName);
  expect(start).toBe("BODY");
  for (let stop = 0; stop < 60; stop++) {
    await page.keyboard.press("Tab");
    expect(await isInClosedOverlay()).toBe(false);
  }

  // Start menu: Enter opens it with focus in its search; Escape returns focus.
  const startButton = page.locator("#taskbar-start");
  await startButton.focus();
  await page.keyboard.press("Enter");
  await expect(startButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Start menu" })).toBeVisible();
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  await expect(startButton).toBeFocused();
  expect(
    await page.locator("#start-menu").evaluate((el) => (el as HTMLElement).inert),
  ).toBe(true);

  // Tray: Tab reaches its controls while open; Escape returns focus.
  const clockButton = page.locator("#taskbar-clock-button");
  await clockButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tray-panel")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.keyboard.press("Tab");
  await expect(page.locator("#calendar-prev")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#tray-panel")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(clockButton).toBeFocused();
  expect(await isInClosedOverlay()).toBe(false);

  // Command palette: Escape returns focus to the taskbar button.
  const paletteButton = page.locator("#taskbar-command-palette");
  await paletteButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(paletteButton).toBeFocused();

  // Ctrl+K toggles it closed and hands focus back the same way.
  const aboutIcon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  await aboutIcon.focus();
  await openPalette(page);
  await page.keyboard.press("ControlOrMeta+K");
  await expect(aboutIcon).toBeFocused();
});

test("the command palette closes the Start menu and tray and keeps Tab inside", async ({
  page,
}) => {
  await resetPage(page);
  const palette = page.locator("#command-palette");
  const startButton = page.locator("#taskbar-start");

  // One Escape closes the palette opened from the Start menu, and focus goes
  // back to the Start button, not to the closed menu.
  await startButton.click();
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await openPalette(page);
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(palette).toHaveAttribute("data-visible", "false");
  await expect(startButton).toBeFocused();

  // The tray closes the same way, and a backdrop click returns focus too.
  const clockButton = page.locator("#taskbar-clock-button");
  await clockButton.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.locator("#calendar-prev")).toBeFocused();
  await openPalette(page);
  await expect(page.locator("#tray-panel")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await page.mouse.click(10, 10);
  await expect(palette).toHaveAttribute("data-visible", "false");
  await expect(clockButton).toBeFocused();

  // The open palette is modal: Tab and Shift+Tab wrap around inside it.
  await openPalette(page);
  await expect(palette).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.locator("#command-palette-results .command-palette-item").last(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.type("theme");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-id="toggle-theme"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#command-palette-input")).toBeFocused();
});

test("closing the palette returns focus to a window that had it", async ({
  page,
}) => {
  await resetPage(page);
  const calculator = page.locator("#window-calculator");
  // Launching from the keyboard focuses the window itself.
  const focusWindowFromIcon = async () => {
    await page
      .locator("#desktop-icons")
      .getByRole("button", { name: "Calculator" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(calculator).toBeFocused();
  };

  // The window loses its tabindex while the palette has focus, so each way
  // of closing the palette has to make it focusable again.
  await focusWindowFromIcon();
  await openPalette(page);
  await page.keyboard.press("Escape");
  await expect(calculator).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(calculator.locator(".min-btn")).toBeFocused();

  await focusWindowFromIcon();
  await openPalette(page);
  await page.keyboard.press("ControlOrMeta+K");
  await expect(calculator).toBeFocused();

  await openPalette(page);
  await page.mouse.click(10, 10);
  await expect(calculator).toBeFocused();
});

test("Close All Windows from inside a window moves focus to the palette button", async ({
  page,
}) => {
  await resetPage(page);
  const terminalInput = page.locator("#window-terminal [data-terminal-input]");
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Terminal" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(terminalInput).toBeFocused();

  // The opener closes with its window, so focus does not drop to the page.
  await openPalette(page);
  await page.keyboard.type("close all");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-terminal")).toBeHidden();
  await expect(page.locator("#taskbar-command-palette")).toBeFocused();
});

test("the Start menu and tray close each other", async ({ page }) => {
  await resetPage(page);
  const startMenu = page.locator("#start-menu");
  const tray = page.locator("#tray-panel");
  const startButton = page.locator("#taskbar-start");
  const clockButton = page.locator("#taskbar-clock-button");

  await startButton.click();
  await expect(startMenu).toHaveClass(/visible/);
  await clockButton.click();
  await expect(tray).toHaveClass(/visible/);
  await expect(startMenu).not.toHaveClass(/visible/);
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  expect(
    await startMenu.evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);

  await startButton.click();
  await expect(startMenu).toHaveClass(/visible/);
  await expect(tray).not.toHaveClass(/visible/);
  await expect(clockButton).toHaveAttribute("aria-expanded", "false");

  // From the keyboard too, and tabbing out of the Start menu closes it.
  await page.keyboard.press("Escape");
  await expect(startButton).toBeFocused();
  await clockButton.focus();
  await page.keyboard.press("Enter");
  await expect(tray).toHaveClass(/visible/);
  await startButton.focus();
  await page.keyboard.press("Enter");
  await expect(startMenu).toHaveClass(/visible/);
  await expect(tray).not.toHaveClass(/visible/);
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.locator("#start-menu-apps .start-menu-app").last().focus();
  await page.keyboard.press("Tab");
  await expect(startMenu).not.toHaveClass(/visible/);
});

test("Close All Windows hands focus back to the palette button", async ({
  page,
}) => {
  await resetPage(page);
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("desktop:open-app", { detail: { appId: "calculator" } }),
    ),
  );
  await expect(page.locator("#window-calculator")).toBeVisible();

  const paletteButton = page.locator("#taskbar-command-palette");
  await paletteButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.type("close all");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-calculator")).toBeHidden();
  await expect(paletteButton).toBeFocused();
});

test("phones open the Start menu without focusing its search box and return focus to each opener", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetPage(page);
  const startButton = page.locator("#taskbar-start");
  await startButton.click();
  await expect(page.locator("#start-menu")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  await expect(startButton).toBeFocused();

  const clockButton = page.locator("#taskbar-clock-button");
  await clockButton.click();
  await page.keyboard.press("Tab");
  await expect(page.locator("#calendar-prev")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(clockButton).toBeFocused();

  const paletteButton = page.locator("#taskbar-command-palette");
  await paletteButton.click();
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(paletteButton).toBeFocused();
});

test.describe("phones", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("the Reset Desktop confirmation shows inside the palette", async ({
    page,
  }) => {
    await resetPage(page);
    await page.locator("#taskbar-command-palette").tap();
    const reset = page.locator('[data-id="reset-desktop"]');
    await reset.tap();
    await expect(reset).toHaveClass(/confirming/);
    const status = page.locator("#command-palette-status");
    await expect(status).toHaveText(
      "Tap Reset Desktop again to clear all settings and reload.",
    );
    const statusBox = (await status.boundingBox())!;
    const containerBox = (await page
      .locator(".command-palette-container")
      .boundingBox())!;
    expect(statusBox.height).toBeGreaterThan(20);
    expect(statusBox.y).toBeGreaterThanOrEqual(containerBox.y);
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(
      containerBox.y + containerBox.height + 1,
    );
  });
});

test.describe("touch tablets", () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test("open the Start menu without its search box and ask for a second tap", async ({
    page,
  }) => {
    await resetPage(page);
    await page.locator("#taskbar-start").tap();
    await expect(page.locator("#start-menu")).toHaveClass(/visible/);
    await expect(page.locator("#start-menu")).toBeFocused();

    await page.locator("#taskbar-command-palette").tap();
    await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);
    await page.locator("#command-palette-input").fill("reset");
    await page.locator('[data-id="reset-desktop"]').tap();
    await expect(page.locator("#command-palette-status")).toHaveText(
      "Tap Reset Desktop again to clear all settings and reload.",
    );
  });
});

test("Start search opens the first match on Enter and says when nothing matches", async ({
  page,
}) => {
  await resetPage(page);
  const startButton = page.locator("#taskbar-start");
  const search = page.locator("#start-menu-search");
  const empty = page.locator("#start-menu-empty");

  await expect(startButton).toHaveAttribute("aria-controls", "start-menu");
  await expect(startButton).toHaveAttribute("aria-expanded", "false");

  await startButton.click();
  await expect(search).toBeFocused();
  await search.fill("calc");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-calculator")).toBeVisible();
  await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);

  // Label matches rank above description matches ("game" is in Snake's text).
  await startButton.click();
  await expect(search).toHaveValue("");
  await search.fill("game");
  await expect(
    page.locator("#start-menu-apps .start-menu-app:visible"),
  ).toHaveText([/SRE Game/, /Snake/]);
  await expect(empty).toBeEmpty();

  await search.fill("zzzz");
  await expect(
    page.locator("#start-menu-apps .start-menu-app:visible"),
  ).toHaveCount(0);
  await expect(empty).toHaveText("No apps found");
  await expect(empty).toHaveAttribute("role", "status");
  // Secondary, not muted, text keeps the message readable.
  expect(
    await empty.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text-secondary)";
      el.parentElement?.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(el).color === expected;
    }),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await page.keyboard.press("Escape");

  await openPalette(page);
  await page.keyboard.type("nomatchxyz");
  expect(await visibleItemIds(page)).toEqual([]);
  await expect(page.locator("#command-palette-status")).toHaveText(
    "No matching apps or commands",
  );
});

test("Welcome opens from the command palette", async ({ page }) => {
  await resetPage(page);
  const welcome = page.locator("#window-welcome");
  await expect(welcome).toBeHidden();

  await openPalette(page);
  await page.keyboard.type("welcome");
  expect(await visibleItemIds(page)).toEqual(["welcome"]);
  await page.keyboard.press("Enter");
  await expect(welcome).toBeVisible();
  await expect(welcome).toHaveAttribute("aria-hidden", "false");
});

test("the command-palette tip dismisses itself", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("pepodev.hasVisited", "true");
  });
  await page.reload();

  const tip = page.locator("#toast-container .toast", {
    hasText: "Quick tip",
  });
  await expect(tip).toBeVisible({ timeout: 6_000 });
  await expect(tip).toHaveCount(0, { timeout: 12_000 });
});

test("with reduced motion, toasts fade in without sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetPage(page);
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("desktop:show-toast", {
        detail: { message: "Saved", duration: 5000 },
      }),
    ),
  );
  const toast = page.locator("#toast-container .toast", { hasText: "Saved" });
  await expect(toast).toHaveClass(/toast-show/);
  await expect(toast).toHaveCSS("transform", "none");
  await expect(toast).toHaveCSS("transition-property", "opacity");
});

test("in forced colors, the palette outlines the item Enter opens", async ({
  page,
}) => {
  // The selection is a background colour, which forced colors drop.
  await page.emulateMedia({ forcedColors: "active" });
  await resetPage(page);
  await openPalette(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const items = page.locator("#command-palette-results .command-palette-item");
  const selected = items.and(page.locator(".selected"));
  await expect(selected).toHaveCount(1);
  await expect(page.locator("#command-palette-input")).toBeFocused();
  await expect(selected).toHaveCSS("outline-style", "solid");
  await expect(items.first()).toHaveCSS("outline-style", "none");
});

test("an unknown ?blog= slug opens the article list with a toast", async ({
  page,
}) => {
  await resetPage(page);
  await page.goto("/?blog=does-not-exist");
  await waitForWindowManager(page);

  const blogWindow = page.locator("#window-blog");
  const toast = page.locator("#toast-container .toast");
  await expect(blogWindow).toBeVisible();
  await expect(blogWindow.locator("[data-blog-list-view]")).toBeVisible();
  await expect(toast).toContainText("Article not found");
  await expect(toast.locator(".toast-icon")).toHaveText("⚠️");
  // Focus starts on the first article, and the toast stays clear of the
  // maximized window's title-bar buttons.
  await expect(blogWindow.locator("[data-blog-index]").first()).toBeFocused();
  await expect(blogWindow).toHaveClass(/maximized/);
  // Measure after the window's scale-in, which shifts its title bar down.
  await expect(blogWindow).not.toHaveClass(/opening/);
  await expect(toast).toHaveClass(/toast-show/);
  const desktopToast = (await toast.boundingBox())!;
  const desktopClose = (await blogWindow.locator(".close-btn").boundingBox())!;
  expect(desktopToast.y).toBeGreaterThanOrEqual(
    desktopClose.y + desktopClose.height,
  );

  // The slug never reaches the toast markup. On phones the toast sits above
  // the taskbar, clear of the Blog window's close button.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?blog=%3Cimg%20src%3Dx%20id%3Dinjected%3E");
  await waitForWindowManager(page);
  await expect(toast).toContainText("Article not found");
  await expect(page.locator("#injected")).toHaveCount(0);
  const toastBox = await toast.boundingBox();
  const closeBox = await blogWindow.locator(".close-btn").boundingBox();
  const taskbarBox = await page.locator("#taskbar").boundingBox();
  expect(toastBox && closeBox && taskbarBox).toBeTruthy();
  expect(toastBox!.y).toBeGreaterThan(closeBox!.y + closeBox!.height);
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(taskbarBox!.y);
});
