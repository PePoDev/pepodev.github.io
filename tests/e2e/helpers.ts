import { expect, type Page } from "@playwright/test";

type ResetOptions = {
  /** Keep the first-visit Welcome window, which opens 1.5s after load. */
  firstVisit?: boolean;
  /** Keep the Quick Access tip toast, which shows 3s after load. */
  quickAccessTip?: boolean;
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
 * the Quick Access tip can open over the test.
 */
export async function resetPage(
  page: Page,
  storage: Record<string, string> = {},
  { firstVisit = false, quickAccessTip = false }: ResetOptions = {},
) {
  await page.goto("/");
  await page.evaluate(
    ({ storage, firstVisit, quickAccessTip }) => {
      localStorage.clear();
      if (!firstVisit) localStorage.setItem("pepodev.hasVisited", "true");
      // The tip's key keeps its command-palette name (runtime.tsx).
      if (!quickAccessTip) {
        localStorage.setItem(
          "pepodev.commandPaletteHintShown",
          String(Date.now()),
        );
      }
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    },
    { storage, firstVisit, quickAccessTip },
  );
  await page.reload();
  await waitForWindowManager(page);
}

/**
 * Opens an app from its desktop icon, or Settings from its taskbar tray
 * button (a pointer open, so focus stays where it was) and waits until its window is shown, focused and done fading in,
 * so screenshots see the window, not a blend, and until its body has
 * rendered (its code can arrive after the window opened; pass
 * `{ body: false }` when a test holds that code back on purpose).
 */
export async function openApp(
  page: Page,
  label: string,
  appId: string,
  { body = true }: { body?: boolean } = {},
) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .or(page.locator(`#taskbar-tray [data-open-app="${appId}"]`))
    .click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).toHaveAttribute("aria-hidden", "false");
  await expect(window).toHaveClass(/focused/);
  await expect(window).not.toHaveClass(/opening/);
  if (body) {
    await expect(
      window.locator(".window-content > :not(.app-loading)").first(),
    ).toBeAttached();
  }
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

/**
 * Holds back the chunks of some app bodies, as a slow network would, until
 * `release()`: each chunk whose code contains one of `markers` (text only
 * that app's code has, such as one of its messages), however the page asks
 * for it (a launch, a launcher's hover or focus, idle prefetching). Every
 * other chunk passes, so call it before the page loads. `requested(marker)`
 * gives the URL of that app's chunk once the page has asked for it;
 * `release(marker)` lets one app's chunk through, `release()` all of them.
 */
export async function holdAppChunks(page: Page, markers: string[]) {
  const waiting = new Map<string, (() => void)[]>();
  const released = new Set<string>();
  const requested = new Map<string, string>();
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    // Idle prefetching keeps fetching app code, so a request can still be in
    // flight when the test ends and closes the page (or its context, which
    // disposes the fetched response): let it go quietly.
    try {
      const response = await route.fetch();
      const body = await response.text();
      const marker = markers.find((text) => body.includes(text));
      if (marker) {
        requested.set(marker, route.request().url());
        if (!released.has(marker)) {
          await new Promise<void>((resolve) =>
            waiting.set(marker, [...(waiting.get(marker) ?? []), resolve]),
          );
        }
      }
      await route.fulfill({ response, body });
    } catch (error) {
      if (
        !page.isClosed() &&
        !/has been (closed|disposed)/.test(String(error))
      ) {
        throw error;
      }
    }
  });
  return {
    requested: (marker: string) => requested.get(marker),
    release: (marker?: string) => {
      for (const text of marker ? [marker] : markers) {
        released.add(text);
        waiting.get(text)?.splice(0).forEach((resolve) => resolve());
      }
    },
  };
}

/**
 * Makes the page see a visitor who asked to save data (the Save-Data
 * setting), so the desktop does not prefetch app code in idle time. Call
 * before the page loads.
 */
export async function emulateSaveData(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "connection", {
      configurable: true,
      get: () => ({ saveData: true, effectiveType: "4g" }),
    });
  });
}
