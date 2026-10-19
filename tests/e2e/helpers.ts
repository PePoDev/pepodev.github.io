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
 * Holds back the page's scripts that `match` (their tag or inline text), as
 * Cloudflare Rocket Loader does on pepo.dev, until the returned function
 * runs them and replays DOMContentLoaded for them. Scripts that must run
 * while the page parses carry data-cfasync="false" and are never held. Call
 * it before loading the page.
 */
export async function holdScripts(page: Page, match: RegExp) {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
        (tag, attributes: string, body: string) => {
          if (/data-cfasync="false"/.test(attributes)) return tag;
          if (!match.test(attributes + body)) return tag;
          const type = /type="module"/.test(attributes) ? "module" : "classic";
          const rest = attributes.replace(/\s*type="[^"]*"/, "");
          return `<script type="text/plain" data-held="${type}"${rest}>${body}</script>`;
        },
      );
      await route.fulfill({ response, body: html });
    },
  );
  return () =>
    page.evaluate(() => {
      // Inline classic scripts run as they are inserted; only the
      // DOMContentLoaded listeners they add hear the replayed event.
      const listeners: EventListenerOrEventListenerObject[] = [];
      const addEventListener = document.addEventListener;
      document.addEventListener = function (
        this: Document,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type === "DOMContentLoaded") listeners.push(listener);
        else addEventListener.call(this, type, listener, options);
      } as typeof document.addEventListener;
      document
        .querySelectorAll<HTMLScriptElement>("script[data-held]")
        .forEach((held) => {
          const script = document.createElement("script");
          if (held.dataset.held === "module") script.type = "module";
          for (const { name, value } of Array.from(held.attributes)) {
            if (name !== "type" && name !== "data-held") {
              script.setAttribute(name, value);
            }
          }
          script.textContent = held.textContent;
          held.replaceWith(script);
        });
      document.addEventListener = addEventListener;
      const event = new Event("DOMContentLoaded");
      listeners.forEach((listener) =>
        typeof listener === "function"
          ? listener.call(document, event)
          : listener.handleEvent(event),
      );
    });
}
