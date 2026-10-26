import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import {
  openApp,
  prefsStorage,
  resetPage,
  waitForWindowManager,
} from "./helpers";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const savedPrefs = {
  theme: "light",
  background: "mint",
  accent: "purple",
  radius: 14,
  glass: 72,
  backgroundEffect: true,
  windowGlass: true,
};

const RESET_CONFIRM =
  "Press Enter or click Reset Desktop again to clear all settings and reload.";
const RESET_CONFIRM_TOUCH =
  "Tap Reset Desktop again to clear all settings and reload.";

/** Opens Quick Access with Ctrl/Cmd + K, which focuses its search box. */
async function openQuickAccess(page: Page) {
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expect(page.locator("#start-menu-search")).toBeFocused();
}

async function expectClosed(page: Page) {
  await expect(page.locator("#start-menu")).not.toHaveClass(/visible/);
  expect(
    await page
      .locator("#start-menu")
      .evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);
}

/** The ids of the items shown, in order (hidden ones are display: none). */
function visibleItemIds(page: Page) {
  return page
    .locator("#start-menu-results .start-menu-item")
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

test("Quick Access ranks apps, commands and links together", async ({
  page,
}) => {
  await resetPage(page, {
    "pepodev.desktopPrefs": JSON.stringify(savedPrefs),
  });
  await markPage(page);

  // A name (or a word in it) that starts with the query beats the rest of a
  // name, which beats a description, across sections: "reset" contains
  // "set", Reset Desktop's description contains "all", and so do Gallery's
  // name and Certs' description; ties keep the section order.
  const rankings: Record<string, string[]> = {
    set: ["settings", "reset-desktop"],
    sett: ["settings", "reset-desktop"],
    settings: ["settings", "reset-desktop"],
    all: ["close-all-windows", "gallery", "certs", "reset-desktop"],
    git: ["link-github", "link-issue"],
  };
  for (const [query, ids] of Object.entries(rankings)) {
    await openQuickAccess(page);
    await page.keyboard.type(query);
    expect(await visibleItemIds(page), query).toEqual(ids);
    await expect(page.locator(`[data-id="${ids[0]}"]`)).toHaveClass(
      /selected/,
    );
    await expect(page.locator("#start-menu-results .selected")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expectClosed(page);
  }

  // An empty query shows the sections, in order; searching shows one flat
  // list without them, and clearing the query puts them back.
  await openQuickAccess(page);
  const titles = page.locator(".start-menu-section-title");
  await expect(titles).toHaveText(["Apps", "Commands", "Links"]);
  await page.keyboard.type("all");
  await expect(
    page.locator(".start-menu-section-title:visible"),
  ).toHaveCount(0);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Backspace");
  await expect(titles).toHaveText(["Apps", "Commands", "Links"]);
  await expect(titles.first()).toBeVisible();
  const ids = await visibleItemIds(page);
  expect(ids).toHaveLength(16 + 3 + 8);
  expect(ids[0]).toBe("welcome");
  expect(ids.slice(16, 20)).toEqual([
    "toggle-theme",
    "close-all-windows",
    "reset-desktop",
    "link-github",
  ]);
  await expect(page.locator('[data-id="welcome"]')).toHaveClass(/selected/);
  await page.keyboard.press("Escape");

  await openQuickAccess(page);
  await page.keyboard.type("set");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-settings")).toBeVisible();
  await expectClosed(page);
  await expectNoReload(page);
  expect(await savedTheme(page)).toBe("light");
});

test("Reset Desktop runs only on a second Enter or click", async ({ page }) => {
  await resetPage(page, {
    "pepodev.desktopPrefs": JSON.stringify(savedPrefs),
  });
  await markPage(page);
  const status = page.locator("#start-menu-status");
  const reset = page.locator('[data-id="reset-desktop"]');

  // The first Enter only arms Reset Desktop; typing disarms it.
  await openQuickAccess(page);
  await page.keyboard.type("reset");
  await page.keyboard.press("Enter");
  await expect(reset).toHaveClass(/confirming/);
  await expect(status).toHaveText(RESET_CONFIRM);
  await expect(status).toHaveAttribute("data-tone", "warning");
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await page.keyboard.type(" desk");
  await expect(reset).not.toHaveClass(/confirming/);
  await expect(status).toBeEmpty();
  await page.keyboard.press("Enter");
  await expect(reset).toHaveClass(/confirming/);

  // Closing it disarms it too.
  await page.keyboard.press("Escape");
  await expectClosed(page);
  await expect(reset).not.toHaveClass(/confirming/);
  await expect(status).toBeEmpty();

  // So does choosing another item: a click arms it, ArrowUp moves on.
  await openQuickAccess(page);
  await reset.click();
  await expect(reset).toHaveClass(/confirming/);
  await expect(reset).toHaveClass(/selected/);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator('[data-id="close-all-windows"]')).toHaveClass(
    /selected/,
  );
  await expect(reset).not.toHaveClass(/confirming/);
  await expect(status).toBeEmpty();
  await expectNoReload(page);
  expect(await savedTheme(page)).toBe("light");

  // A second click (or Enter) runs it.
  await reset.click();
  await expect(reset).toHaveClass(/confirming/);
  const reloaded = page.waitForEvent("load");
  await reset.click();
  await reloaded;
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await savedTheme(page)).not.toBe("light");
});

test("typing straight after Ctrl+K searches and Enter opens the match", async ({
  page,
}) => {
  await resetPage(page);
  await markPage(page);
  // No waits between keys: the search box must already have focus when
  // Quick Access opens, or "calc" is lost and Enter opens Welcome.
  await page.keyboard.press("ControlOrMeta+K");
  await page.keyboard.type("calc");
  await page.keyboard.press("Enter");

  const calculator = page.locator("#window-calculator");
  await expect(calculator).toBeVisible();
  // Launching from the keyboard moves focus into the window.
  await expect(calculator).toBeFocused();
  await expectClosed(page);
  await expect(page.locator("#start-menu-status")).toHaveText("");
  await expect(page.locator("#window-welcome")).toBeHidden();
  await expectNoReload(page);

  // Any case: Ctrl+Shift+K reports "K".
  await page.keyboard.press("ControlOrMeta+Shift+K");
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expect(page.locator("#start-menu-search")).toBeFocused();
});

test("Quick Access Enter runs the focused item and the highlight follows focus", async ({
  page,
}) => {
  await resetPage(page, {
    "pepodev.desktopPrefs": JSON.stringify(savedPrefs),
  });
  await markPage(page);
  const selected = page.locator("#start-menu-results .selected");

  // Tab moves from the search box to the first item, and the highlight
  // follows; ArrowDown moves both.
  await openQuickAccess(page);
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-id="welcome"]')).toBeFocused();
  await expect(page.locator('[data-id="welcome"]')).toHaveClass(/selected/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-id="blog"]')).toBeFocused();
  await expect(selected).toHaveCount(1);
  await expect(page.locator('[data-id="blog"]')).toHaveClass(/selected/);

  // From the search box, the arrow keys move only the highlight.
  await page.locator("#start-menu-search").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-id="garden"]')).toHaveClass(/selected/);
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator('[data-id="welcome"]')).toHaveClass(/selected/);

  // Across sections: the highlight follows Tab and Shift+Tab.
  const toggleTheme = page.locator('[data-id="toggle-theme"]');
  await toggleTheme.focus();
  await expect(toggleTheme).toHaveClass(/selected/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-id="close-all-windows"]')).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(toggleTheme).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator('[data-id="trash"]')).toBeFocused();
  await expect(page.locator('[data-id="trash"]')).toHaveClass(/selected/);
  await page.keyboard.press("Tab");
  await expect(toggleTheme).toBeFocused();
  await expect(selected).toHaveCount(1);
  await expect(toggleTheme).toHaveClass(/selected/);

  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectClosed(page);
  await expectNoReload(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}"),
    ),
  ).toMatchObject({ theme: "dark", accent: "purple", radius: 14 });
});

test("the Quick Access search box is a combobox whose active option is the highlight", async ({
  page,
}) => {
  await resetPage(page);
  await openQuickAccess(page);
  const search = page.getByRole("combobox", {
    name: "Search apps, commands and links",
  });
  const listbox = page.getByRole("listbox", {
    name: "Apps, commands and links",
  });
  const active = listbox.getByRole("option", { selected: true });
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await expect(search).toHaveAttribute("aria-controls", "start-menu-results");
  await expect(
    listbox.getByRole("group", { name: "Commands" }).getByRole("option"),
  ).toHaveText([/Toggle Theme/, /Close All Windows/, /Reset Desktop/]);

  // Opening, ArrowDown and typing move the active option with the highlight,
  // which is what Enter runs.
  const expectActive = async (id: string) => {
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("data-id", id);
    await expect(active).toHaveClass(/selected/);
    await expect(search).toHaveAttribute(
      "aria-activedescendant",
      `start-menu-item-${id}`,
    );
  };
  await expectActive("welcome");
  await page.keyboard.press("ArrowDown");
  await expectActive("blog");
  await page.keyboard.type("set");
  await expectActive("settings");
  await page.keyboard.press("ArrowDown");
  await expectActive("reset-desktop");
  await search.fill("zzzz");
  await expect(active).toHaveCount(0);
  await expect(search).not.toHaveAttribute("aria-activedescendant");

  // Valid roles, states and names throughout, searching or not.
  await page.addScriptTag({ content: axeSource });
  for (const query of ["", "set"]) {
    await search.fill(query);
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
      const result = await axe.run("#start-menu", {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        // axe cannot judge text on the translucent glass.
        rules: { "color-contrast": { enabled: false } },
      });
      return result.violations.map((violation) => violation.id);
    });
    expect(violations, `query "${query}"`).toEqual([]);
  }
});

test("Quick Access reopens scrolled to the top, where its highlight is", async ({
  page,
}) => {
  await resetPage(page);
  const results = page.locator("#start-menu-results");
  const items = results.locator(".start-menu-item");
  const welcome = page.locator('[data-id="welcome"]');
  const scrollTop = () => results.evaluate((element) => element.scrollTop);
  const expectAtTop = async () => {
    await expect(welcome).toHaveClass(/selected/);
    expect(await scrollTop()).toBe(0);
    await expect(welcome).toBeInViewport();
    await expect(page.locator("#start-menu-section-apps")).toBeInViewport();
  };

  // Ctrl+K after the highlight went down to the last link.
  await openQuickAccess(page);
  for (let i = await items.count(); i > 0; i--) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(items.last()).toHaveClass(/selected/);
  expect(await scrollTop()).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expectClosed(page);
  await openQuickAccess(page);
  await expectAtTop();

  // The Start button after a scroll with the wheel.
  await results.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await page.locator("#taskbar-start").click();
  await expectClosed(page);
  await page.locator("#taskbar-start").click();
  await expect(page.locator("#start-menu")).toHaveClass(/visible/);
  await expectAtTop();
});

/** Opens the Garden and returns its filter, once the frame's script has run. */
async function openGardenFilter(page: Page) {
  await openApp(page, "Garden", "garden");
  const filter = page
    .frameLocator("#window-garden iframe")
    .getByRole("searchbox", { name: "Filter notes" });
  // The garden's own script, which forwards Ctrl/Cmd + K, ends its page.
  await expect
    .poll(() => filter.evaluate(() => document.readyState))
    .toBe("complete");
  return filter;
}

test("Quick Access closes when Shift+Tab leaves it for the Garden's frame", async ({
  page,
}) => {
  await resetPage(page);
  await openGardenFilter(page);
  // With the Garden the last window before Quick Access, Shift+Tab from the
  // search box moves focus into its frame, which has no relatedTarget.
  await openQuickAccess(page);
  await page.keyboard.press("Shift+Tab");
  await expectClosed(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    "IFRAME",
  );
});

test("Escape and Ctrl+K hand focus back to the field inside the Garden's frame", async ({
  page,
}) => {
  await resetPage(page);
  const filter = await openGardenFilter(page);
  // Escape, or Ctrl+K again, returns focus to the field inside the frame,
  // not only to the frame, so typing goes on there.
  await filter.click();
  await page.keyboard.type("ab");
  for (const close of ["Escape", "ControlOrMeta+K"]) {
    await openQuickAccess(page);
    await page.keyboard.press(close);
    await expectClosed(page);
    await expect(filter).toBeFocused();
  }
  await page.keyboard.type("c");
  await expect(filter).toHaveValue("abc");
});

test("the tray closes when focus moves from it into the Garden's frame", async ({
  page,
}) => {
  await resetPage(page);
  const filter = await openGardenFilter(page);
  const tray = page.locator("#tray-panel");
  const mute = page.locator("#audio-mute");

  // A click: the frame forwards it, and focus leaves the tray for the frame.
  await page.locator("#taskbar-clock-button").click();
  await expect(tray).toHaveClass(/visible/);
  await mute.focus();
  await filter.click();
  await expect(tray).not.toHaveClass(/visible/);
  await expect(filter).toBeFocused();

  // Focus alone, with no click to forward (as a screen reader can move it).
  await page.locator("#taskbar-clock-button").click();
  await expect(tray).toHaveClass(/visible/);
  await mute.focus();
  await filter.focus();
  await expect(tray).not.toHaveClass(/visible/);
  await expect(filter).toBeFocused();
});

test("closed overlays leave the tab order and return focus to their opener", async ({
  page,
}) => {
  await resetPage(page);
  const overlays = ["#start-menu", "#tray-panel"];
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
  await expect(page.locator("#command-palette")).toHaveCount(0);
  await expect(page.locator("#taskbar-command-palette")).toHaveCount(0);

  // One full Tab cycle never lands inside a closed overlay.
  const start = await page.evaluate(() => document.activeElement?.tagName);
  expect(start).toBe("BODY");
  for (let stop = 0; stop < 60; stop++) {
    await page.keyboard.press("Tab");
    expect(await isInClosedOverlay()).toBe(false);
  }

  // Start button: Enter opens Quick Access with focus in its search;
  // Escape returns focus.
  const startButton = page.locator("#taskbar-start");
  await startButton.focus();
  await page.keyboard.press("Enter");
  await expect(startButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Start menu" })).toBeVisible();
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  await expect(startButton).toBeFocused();
  await expectClosed(page);

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

  // Ctrl+K toggles Quick Access closed and hands focus back the same way,
  // and so does the Start button.
  const aboutIcon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  await aboutIcon.focus();
  await openQuickAccess(page);
  await expect(startButton).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ControlOrMeta+K");
  await expectClosed(page);
  await expect(aboutIcon).toBeFocused();
  await openQuickAccess(page);
  await startButton.click();
  await expectClosed(page);
  await expect(aboutIcon).toBeFocused();
});

test("Quick Access closes the tray, stays non-modal and closes when Tab leaves it", async ({
  page,
}) => {
  await resetPage(page);
  const menu = page.locator("#start-menu");
  const search = page.locator("#start-menu-search");
  const tray = page.locator("#tray-panel");
  const clockButton = page.locator("#taskbar-clock-button");

  // Ctrl+K closes the open tray, which hands focus back to its button, and
  // one Escape returns focus there.
  await clockButton.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.locator("#calendar-prev")).toBeFocused();
  await openQuickAccess(page);
  await expect(tray).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Escape");
  await expectClosed(page);
  await expect(clockButton).toBeFocused();

  // Opening the tray closes Quick Access.
  await openQuickAccess(page);
  await clockButton.click();
  await expect(tray).toHaveClass(/visible/);
  await expectClosed(page);
  await page.keyboard.press("Escape");

  // No modal focus trap and no backdrop: Tab moves through the search box
  // and the visible items, and tabbing past them closes Quick Access.
  await openQuickAccess(page);
  expect(await menu.getAttribute("aria-modal")).toBeNull();
  await page.keyboard.type("theme");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-id="toggle-theme"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expectClosed(page);

  // Shift+Tab out of the search box closes it too, and so does a click
  // outside, which leaves focus where it went.
  await openQuickAccess(page);
  await page.keyboard.press("Shift+Tab");
  await expectClosed(page);
  await openQuickAccess(page);
  await page.locator("#desktop").click({ position: { x: 1000, y: 400 } });
  await expectClosed(page);
  await expect(search).not.toBeFocused();
});

test("closing Quick Access returns focus to a window that had it", async ({
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

  // The window loses its tabindex while Quick Access has focus, so each way
  // of closing it has to make it focusable again.
  await focusWindowFromIcon();
  await openQuickAccess(page);
  await page.keyboard.press("Escape");
  await expect(calculator).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(calculator.locator(".min-btn")).toBeFocused();

  await focusWindowFromIcon();
  await openQuickAccess(page);
  await page.keyboard.press("ControlOrMeta+K");
  await expect(calculator).toBeFocused();

  // The Start button, which takes focus as it is pressed, too.
  await openQuickAccess(page);
  await page.locator("#taskbar-start").click();
  await expectClosed(page);
  await expect(calculator).toBeFocused();

  // A control inside the window gets it back as well.
  const seven = calculator.getByRole("button", { name: "7", exact: true });
  await seven.focus();
  await openQuickAccess(page);
  await page.keyboard.press("Escape");
  await expect(seven).toBeFocused();
});

test("Close All Windows from inside a window moves focus to the Start button", async ({
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
  await openQuickAccess(page);
  await page.keyboard.type("close all");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-terminal")).toBeHidden();
  await expectClosed(page);
  await expect(page.locator("#taskbar-start")).toBeFocused();
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
  await page.locator("#start-menu-results .start-menu-item").last().focus();
  await page.keyboard.press("Tab");
  await expect(startMenu).not.toHaveClass(/visible/);
});

test("Close All Windows hands focus to the Start button that opened Quick Access", async ({
  page,
}) => {
  await resetPage(page);
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("desktop:open-app", { detail: { appId: "calculator" } }),
    ),
  );
  await expect(page.locator("#window-calculator")).toBeVisible();

  const startButton = page.locator("#taskbar-start");
  await startButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#start-menu-search")).toBeFocused();
  await page.keyboard.type("close all");
  await page.keyboard.press("Enter");
  await expect(page.locator("#window-calculator")).toBeHidden();
  await expect(startButton).toBeFocused();
});

test("desktop:open-quick-access, and the older desktop:open-command-palette, open Quick Access", async ({
  page,
}) => {
  await resetPage(page);
  for (const name of [
    "desktop:open-quick-access",
    "desktop:open-command-palette",
  ]) {
    await page.evaluate(
      (type) => document.dispatchEvent(new CustomEvent(type)),
      name,
    );
    await expect(page.locator("#start-menu")).toHaveClass(/visible/);
    await expect(page.locator("#start-menu-search")).toBeFocused();
    await page.keyboard.press("Escape");
    await expectClosed(page);
  }
});

test("Quick Access links open in a new tab and hand focus back", async ({
  page,
}) => {
  await resetPage(page);
  await page.evaluate(() => {
    const calls: unknown[][] = [];
    (window as typeof window & { __opened?: unknown[][] }).__opened = calls;
    window.open = (...args: unknown[]) => {
      calls.push(args);
      return null;
    };
  });
  const opened = () =>
    page.evaluate(
      () => (window as typeof window & { __opened?: unknown[][] }).__opened,
    );
  const github = page.locator('[data-id="link-github"]');
  await expect(github).toHaveAttribute("href", "https://github.com/pepodev");
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github).toHaveText(/GitHub\s*Open GitHub - @pepodev/);
  // An option is not announced as a link, so its name says where it opens.
  await expect(github).toHaveRole("option");
  await expect(github).toHaveAccessibleName(
    /^GitHub\s*Open GitHub - @pepodev\s*\(opens in a new tab\)$/,
  );

  const aboutIcon = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "About Me" });
  await aboutIcon.focus();
  await openQuickAccess(page);
  await page.keyboard.type("github");
  await page.keyboard.press("Enter");
  expect(await opened()).toEqual([
    ["https://github.com/pepodev", "_blank", "noopener,noreferrer"],
  ]);
  await expectClosed(page);
  await expect(aboutIcon).toBeFocused();

  // A click on a link does the same, without following it in this tab.
  await openQuickAccess(page);
  await page.locator('[data-id="link-resume"]').click();
  expect((await opened())?.[1]).toEqual([
    "/resume/",
    "_blank",
    "noopener,noreferrer",
  ]);
  await expectClosed(page);
  await expect(page).toHaveURL(/\/$/);
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

  // Ctrl+K (an external keyboard) focuses the search box even here.
  await openQuickAccess(page);
  await page.keyboard.press("Escape");
  await expect(clockButton).toBeFocused();
});

test.describe("phones", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("the Reset Desktop confirmation shows inside Quick Access and a second tap runs it", async ({
    page,
  }) => {
    await resetPage(page, { "pepodev.someTransientState": "remove-me" });
    await page.locator("#taskbar-start").tap();
    await expect(page.locator("#start-menu")).toBeFocused();
    const reset = page.locator('[data-id="reset-desktop"]');
    const status = page.locator("#start-menu-status");
    await reset.tap();
    await expect(reset).toHaveClass(/confirming/);
    await expect(status).toHaveText(RESET_CONFIRM_TOUCH);
    const statusBox = (await status.boundingBox())!;
    const menuBox = (await page.locator("#start-menu").boundingBox())!;
    expect(statusBox.height).toBeGreaterThan(20);
    expect(statusBox.y).toBeGreaterThanOrEqual(menuBox.y);
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(
      menuBox.y + menuBox.height + 1,
    );
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);

    // Typing disarms it.
    await page.locator("#start-menu-search").tap();
    await page.locator("#start-menu-search").fill("reset");
    await expect(reset).not.toHaveClass(/confirming/);
    await expect(status).toBeEmpty();

    await reset.tap();
    await expect(status).toHaveText(RESET_CONFIRM_TOUCH);
    const reloaded = page.waitForEvent("load");
    await reset.tap();
    await reloaded;
    expect(
      await page.evaluate(() =>
        localStorage.getItem("pepodev.someTransientState"),
      ),
    ).toBeNull();
  });
});

test.describe("touch tablets", () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test("open the Start menu without its search box and ask for a second tap", async ({
    page,
  }) => {
    await resetPage(page, { "pepodev.someTransientState": "remove-me" });
    await markPage(page);
    const menu = page.locator("#start-menu");
    const reset = page.locator('[data-id="reset-desktop"]');
    const status = page.locator("#start-menu-status");
    await page.locator("#taskbar-start").tap();
    await expect(menu).toHaveClass(/visible/);
    await expect(menu).toBeFocused();

    // Choosing another item disarms it (and runs that one).
    await reset.tap();
    await expect(status).toHaveText(RESET_CONFIRM_TOUCH);
    await page.locator('[data-id="toggle-theme"]').tap();
    await expectClosed(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expectNoReload(page);

    // Ctrl+K (a keyboard case) focuses the search box even on a touch
    // screen; nothing is armed any more.
    await page.keyboard.press("ControlOrMeta+K");
    await expect(page.locator("#start-menu-search")).toBeFocused();
    await expect(reset).not.toHaveClass(/confirming/);
    await page.locator("#start-menu-search").fill("reset");
    await reset.tap();
    await expect(status).toHaveText(RESET_CONFIRM_TOUCH);
    const reloaded = page.waitForEvent("load");
    await reset.tap();
    await reloaded;
    expect(
      await page.evaluate(() =>
        localStorage.getItem("pepodev.someTransientState"),
      ),
    ).toBeNull();
  });
});

test("Start search opens the first match on Enter and says when nothing matches", async ({
  page,
}) => {
  await resetPage(page);
  const startButton = page.locator("#taskbar-start");
  const search = page.locator("#start-menu-search");
  const status = page.locator("#start-menu-status");
  const visibleItems = page.locator(
    "#start-menu-results .start-menu-item:visible",
  );

  await expect(startButton).toHaveAttribute("aria-controls", "start-menu");
  await expect(startButton).toHaveAttribute("aria-expanded", "false");
  await expect(search).toHaveAttribute(
    "aria-label",
    "Search apps, commands and links",
  );

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
  await expect(visibleItems).toHaveText([/SRE Game/, /Snake/]);
  await expect(status).toBeEmpty();

  await search.fill("zzzz");
  await expect(visibleItems).toHaveCount(0);
  expect(await visibleItemIds(page)).toEqual([]);
  await expect(status).toHaveText("No matching apps, commands or links");
  await expect(status).toHaveAttribute("role", "status");
  // Secondary, not muted, text keeps the message readable.
  expect(
    await status.evaluate((el) => {
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
});

test("Welcome opens from Quick Access", async ({ page }) => {
  await resetPage(page);
  const welcome = page.locator("#window-welcome");
  await expect(welcome).toBeHidden();

  await openQuickAccess(page);
  await page.keyboard.type("welcome");
  expect(await visibleItemIds(page)).toEqual(["welcome"]);
  await page.keyboard.press("Enter");
  await expect(welcome).toBeVisible();
  await expect(welcome).toHaveAttribute("aria-hidden", "false");
});

test("the Quick Access tip dismisses itself", async ({ page }) => {
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
  await expect(tip.locator(".toast-message")).toHaveText(
    "Quick tip: Press Ctrl + K (Cmd on Mac) to open Quick Access",
  );
  // The key keeps the name it had for the command palette.
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pepodev.commandPaletteHintShown"),
    ),
  ).not.toBeNull();
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

test("with reduced motion, Quick Access fades without zooming or sliding", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetPage(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 720 });
    // Read in the same task as each change, before a frame can pass.
    const result = await page.evaluate(async () => {
      const menu = document.querySelector<HTMLElement>("#start-menu")!;
      const transitions = () =>
        menu.getAnimations().map((animation) => {
          const timing = animation.effect!.getTiming();
          return `${(animation as CSSTransition).transitionProperty} ${timing.duration} ${timing.delay}`;
        });
      const settle = () =>
        Promise.all(menu.getAnimations().map((animation) => animation.finished));
      document.dispatchEvent(new CustomEvent("desktop:open-quick-access"));
      const opening = {
        transform: getComputedStyle(menu).transform,
        transitions: transitions(),
      };
      await settle();
      const open = getComputedStyle(menu).transform;
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      const closing = transitions();
      await settle();
      return { opening, open, closing };
    });
    // It opens in place while still transparent, and moves back only once
    // it has faded out.
    expect(result.opening.transform, `${width}px`).toBe(result.open);
    expect(result.opening.transitions, `${width}px`).toEqual([
      "opacity 200 0",
    ]);
    expect(result.closing.sort(), `${width}px`).toEqual([
      "opacity 200 0",
      "transform 0 200",
    ]);
  }
});

test("in forced colors, Quick Access rings its search box and shows the highlight as selected", async ({
  page,
}) => {
  // The highlight's tint and border are colours, which forced colors drop.
  await page.emulateMedia({ forcedColors: "active" });
  await resetPage(page);
  await openQuickAccess(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const search = page.locator("#start-menu-search");
  const items = page.locator("#start-menu-results .start-menu-item");
  const selected = items.and(page.locator(".selected"));
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveAttribute("data-id", "garden");
  await expect(search).toBeFocused();
  const [highlight, highlightText] = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "Highlight";
    probe.style.color = "HighlightText";
    document.querySelector("#start-menu")!.append(probe);
    const style = getComputedStyle(probe);
    const colors = [style.backgroundColor, style.color];
    probe.remove();
    return colors;
  });

  // Focus: a ring on the search box. The highlight takes the selection
  // colours instead, so it does not look focused.
  await expect(search).toHaveCSS("outline-style", "solid");
  await expect(search).toHaveCSS("outline-width", "2px");
  await expect(search).toHaveCSS("outline-color", highlight);
  await expect(selected).toHaveCSS("background-color", highlight);
  await expect(selected).toHaveCSS("color", highlightText);
  await expect(selected.locator("small")).toHaveCSS("color", highlightText);
  await expect(selected).toHaveCSS("outline-style", "none");
  await expect(items.first()).not.toHaveCSS("background-color", highlight);

  // An armed Reset Desktop adds a dashed ring.
  await search.fill("reset desktop");
  await page.keyboard.press("Enter");
  const armed = page.locator('[data-id="reset-desktop"]');
  await expect(armed).toHaveClass(/confirming/);
  await expect(armed).toHaveCSS("background-color", highlight);
  await expect(armed).toHaveCSS("outline-style", "dashed");
  await page.keyboard.press("Escape");
});

// Composites the menu in a screenshot and measures each stroke against the
// colours on both sides of it: the search box's focus ring (beyond its
// border) and the highlight's border.
async function strokeContrast(page: Page) {
  const boxes = await page.evaluate(() =>
    ["#start-menu-search", "#start-menu-results .selected"].map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { left: rect.left, y: Math.round(rect.top + rect.height / 2) };
    }),
  );
  const screenshot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ screenshot, boxes }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${screenshot}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      const pixel = (x: number, y: number) =>
        Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = ([r, g, b]: number[]) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const ratio = (a: number[], b: number[]) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
      };
      // The ring is 2px left of the search box's edge, the highlight's
      // border the 1px at its edge; then the menu outside, the fill inside.
      const [ring, highlight] = boxes.map(({ left, y }, index) => {
        const edge = Math.round(left);
        const stroke = index === 0 ? [edge - 2, edge - 1] : [edge];
        const outside = pixel(edge - 6, y);
        const inside = pixel(edge + 4, y);
        return Math.min(
          ...stroke.flatMap((x) => [
            ratio(pixel(x, y), outside),
            ratio(pixel(x, y), inside),
          ]),
        );
      });
      return { ring, highlight };
    },
    { screenshot, boxes },
  );
}

// The defaults, and a phone with the most opaque glass, where the dark
// theme's highlight comes closest to 3:1 (purple, against its own tint).
const STROKE_SETUPS = [
  { width: 1280, glass: 72 },
  { width: 390, glass: 90 },
];

/** Waits for Quick Access's open transition and its items' to end. */
function settleQuickAccess(page: Page) {
  return page
    .locator("#start-menu")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations({ subtree: true }).map((a) => a.finished),
      ),
    );
}

for (const theme of ["dark", "light"] as const) {
  test(`Quick Access's focus ring, highlight and armed Reset Desktop reach 3:1 for every accent in the ${theme} theme`, async ({
    page,
  }) => {
    for (const { width, glass } of STROKE_SETUPS) {
      await page.setViewportSize({ width, height: 800 });
      for (const accent of ["green", "cyan", "purple", "amber"]) {
        // A still background, so the glass over it is one colour.
        await resetPage(
          page,
          prefsStorage({ theme, accent, glass, backgroundEffect: false }),
        );
        await openQuickAccess(page);
        await settleQuickAccess(page);
        const contrast = await strokeContrast(page);
        const where = `${accent}, ${width}px, glass ${glass}`;
        expect(contrast.ring, `focus ring, ${where}`).toBeGreaterThanOrEqual(
          3,
        );
        expect(
          contrast.highlight,
          `highlight border, ${where}`,
        ).toBeGreaterThanOrEqual(3);
      }

      // Armed, the highlighted Reset Desktop's border turns red.
      await page.keyboard.type("reset desktop");
      await page.keyboard.press("Enter");
      await expect(page.locator("#start-menu-results .selected")).toHaveClass(
        /confirming/,
      );
      await settleQuickAccess(page);
      const armed = await strokeContrast(page);
      expect(
        armed.highlight,
        `armed Reset Desktop border, ${width}px, glass ${glass}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
}

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
