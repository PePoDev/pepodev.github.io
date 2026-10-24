import { expect, type Page } from "@playwright/test";

type ResetOptions = {
  /** Keep the first-visit Welcome window, which opens 1.5s after load. */
  firstVisit?: boolean;
  /** Keep the command-palette tip toast, which shows 3s after load. */
  paletteTip?: boolean;
};

/** pepodev.desktopPrefs for resetPage's storage. */
export function prefsStorage(prefs: Record<string, unknown>) {
  return { "pepodev.desktopPrefs": JSON.stringify(prefs) };
}

export function waitForWindowManager(page: Page) {
  return page.waitForFunction(
    () =>
      (window as typeof window & { __pepodevWindowManagerReady?: boolean })
        .__pepodevWindowManagerReady,
  );
}

/**
 * Loads the desktop with only `storage` saved. The visitor is a returning
 * one unless the options say otherwise, so neither the Welcome window nor
 * the palette tip can open over the test.
 */
export async function resetPage(
  page: Page,
  storage: Record<string, string> = {},
  { firstVisit = false, paletteTip = false }: ResetOptions = {},
) {
  await page.goto("/");
  await page.evaluate(
    ({ storage, firstVisit, paletteTip }) => {
      localStorage.clear();
      if (!firstVisit) localStorage.setItem("pepodev.hasVisited", "true");
      if (!paletteTip) {
        localStorage.setItem(
          "pepodev.commandPaletteHintShown",
          String(Date.now()),
        );
      }
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    },
    { storage, firstVisit, paletteTip },
  );
  await page.reload();
  await waitForWindowManager(page);
}

/**
 * Opens an app from its desktop icon (a pointer open, so focus stays where
 * it was) and waits until its window is shown, focused and done fading in,
 * so screenshots see the window, not a blend.
 */
export async function openApp(page: Page, label: string, appId: string) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).toHaveAttribute("aria-hidden", "false");
  await expect(window).toHaveClass(/focused/);
  await expect(window).not.toHaveClass(/opening/);
  return window;
}

/**
 * Holds back the Next.js chunks requested from now on, as a slow network
 * would, until `release()`: React's runtime and the desktop when called
 * before a (re)load (the desktop then has not hydrated, and only parse-time
 * scripts have run), or an app body's chunk on its window's first launch.
 * `hold()` holds again (before the next reload); `held()` counts the
 * requests waiting.
 */
export async function holdChunks(page: Page) {
  const waiting: (() => void)[] = [];
  let holding = true;
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    if (holding) await new Promise<void>((resolve) => waiting.push(resolve));
    await route.continue();
  });
  return {
    held: () => waiting.length,
    hold: () => {
      holding = true;
    },
    release: () => {
      holding = false;
      waiting.splice(0).forEach((resolve) => resolve());
    },
  };
}
