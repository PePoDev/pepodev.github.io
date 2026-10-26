import { expect, test, type Page } from "@playwright/test";
import { openApp, resetPage } from "./helpers";

type Counter =
  | "__audioFrames"
  | "__oscillators"
  | "__settingsEvents"
  | "__visualizerDraws"
  | "__visualizerFrames";
type Probe = typeof window & Partial<Record<Counter, number>> & {
  __mediaSources?: number;
};

// The bundled tracks are H.264/AAC, which open-source Chromium cannot play.
// Serve a short PCM WAV in their place so playback can be tested anywhere.
function wav(seconds = 20, rate = 8000) {
  const samples = seconds * rate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.sin((i / rate) * 2 * Math.PI * 220) * 8000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }
  return buffer;
}

const playableTrack = wav();

async function servePlayableMusic(page: Page) {
  const requests: string[] = [];
  await page.route("**/music/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: playableTrack,
    });
  });
  return requests;
}

// Counts visualizer draws (clearRect on its canvas), visualizer frames,
// levels sent to the desktop background and settings broadcasts.
async function probeMusic(page: Page) {
  await page.addInitScript(() => {
    const probe = window as Probe;
    probe.__audioFrames = 0;
    probe.__visualizerDraws = 0;
    probe.__visualizerFrames = 0;
    probe.__settingsEvents = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.matches("[data-music-visualizer]")) {
        probe.__visualizerDraws = (probe.__visualizerDraws ?? 0) + 1;
      }
      return clearRect.apply(this, args);
    };
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      if (callback.name === "tickVisualizer") {
        probe.__visualizerFrames = (probe.__visualizerFrames ?? 0) + 1;
      }
      return requestFrame(callback);
    };
    document.addEventListener("desktop:music-settings", () => {
      probe.__settingsEvents = (probe.__settingsEvents ?? 0) + 1;
    });
    document.addEventListener("desktop:music-audio-frame", () => {
      probe.__audioFrames = (probe.__audioFrames ?? 0) + 1;
    });
  });
}

async function countDuring(page: Page, counter: Counter, ms = 600) {
  await page.evaluate((counter) => {
    (window as Probe)[counter] = 0;
  }, counter);
  await page.waitForTimeout(ms);
  return page.evaluate((counter) => (window as Probe)[counter] ?? 0, counter);
}

// An AudioContext that stays suspended and never settles resume(), as in
// Firefox without an audio device. It counts media elements routed into it.
async function stallAudioContext(page: Page) {
  await page.addInitScript(() => {
    const probe = window as Probe;
    probe.__mediaSources = 0;
    class StalledAudioContext extends window.AudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        void super.suspend();
      }
      resume() {
        return new Promise<void>(() => {});
      }
      createMediaElementSource(element: HTMLMediaElement) {
        probe.__mediaSources = (probe.__mediaSources ?? 0) + 1;
        return super.createMediaElementSource(element);
      }
    }
    Object.defineProperty(StalledAudioContext.prototype, "state", {
      get: () => "suspended",
    });
    window.AudioContext = StalledAudioContext;
  });
}

const media = (page: Page) => page.locator("#window-music [data-music-media]");
const isPaused = (page: Page) =>
  media(page).evaluate((element: HTMLMediaElement) => element.paused);

async function playMusic(page: Page) {
  const music = await openApp(page, "Music", "music");
  await music.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    music.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  return music;
}

async function switchMode(page: Page, mode: "website" | "desktop") {
  const scope =
    mode === "website" ? page.locator("#taskbar") : page.locator("#website");
  await scope
    .getByRole("button", { name: `Switch to ${mode} mode` })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-site-mode", mode);
}

test.describe("Music", () => {
  test("a page load fetches no track, and opening Music loads one element", async ({
    page,
  }) => {
    const requests = await servePlayableMusic(page);
    for (const mode of ["desktop", "website"]) {
      await resetPage(page, { "pepodev.viewMode": mode });
      requests.length = 0;
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
      expect(requests, `${mode} mode`).toEqual([]);
    }

    await resetPage(page);
    requests.length = 0;
    await openApp(page, "Music", "music");
    // The artwork video is the player, so one element loads the track.
    await expect(media(page)).toHaveCount(1);
    await expect(media(page)).toHaveAttribute("id", "music-art");
    await expect.poll(() => requests.length).toBe(1);
    await expect(media(page)).toHaveJSProperty("readyState", 4);
  });

  test("the visualizer animates only while music plays in a visible window", async ({
    page,
  }) => {
    await probeMusic(page);
    await servePlayableMusic(page);
    await resetPage(page);

    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerDraws")).toBe(0);

    // An idle open window shows one static frame, drawn as it opens.
    const music = await openApp(page, "Music", "music");
    await page.waitForTimeout(400);
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerDraws")).toBe(0);

    await music.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      music.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    expect(
      await countDuring(page, "__visualizerDraws", 1000),
    ).toBeGreaterThan(1);
    // The frame probe matches the loop by its function name, so it must see
    // the loop run here; otherwise its zero counts elsewhere prove nothing.
    expect(
      await countDuring(page, "__visualizerFrames", 1000),
    ).toBeGreaterThan(1);

    await music.getByRole("button", { name: "Minimize Music Player" }).click();
    await expect(music).toHaveClass(/minimized/);
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerDraws")).toBe(0);
    expect(await isPaused(page)).toBe(false);

    await page.locator("#taskbar-apps").getByText("Music").click();
    expect(
      await countDuring(page, "__visualizerDraws", 1000),
    ).toBeGreaterThan(1);

    await music.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      music.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerDraws")).toBe(0);
  });

  test("the desktop background follows the music without a visualizer loop", async ({
    page,
  }) => {
    await probeMusic(page);
    await servePlayableMusic(page);
    await resetPage(page);

    // Settings can start the music while the Music window stays closed.
    const settings = await openApp(page, "Settings", "settings");
    await settings.locator("[data-music-setting='toggle']").click();
    await expect.poll(() => isPaused(page)).toBe(false);
    await page.waitForTimeout(300);
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__audioFrames", 1000)).toBeGreaterThan(0);

    // With the effect off nothing samples the music.
    await settings.locator('[data-setting="backgroundEffect"]').uncheck();
    await page.waitForTimeout(100);
    expect(await countDuring(page, "__audioFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await isPaused(page)).toBe(false);
  });

  test("the visualizer stays static under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await probeMusic(page);
    await servePlayableMusic(page);
    await resetPage(page);

    await playMusic(page);
    expect(await countDuring(page, "__visualizerFrames")).toBe(0);
    expect(await countDuring(page, "__visualizerDraws")).toBe(0);
    const paintedPixels = await page
      .locator("[data-music-visualizer]")
      .evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) painted += 1;
        return painted;
      });
    expect(paintedPixels).toBeGreaterThan(0);
  });

  test("music pauses when its window closes and in website mode", async ({
    page,
  }) => {
    await servePlayableMusic(page);
    await resetPage(page);

    const music = await playMusic(page);
    await music.getByRole("button", { name: "Close Music Player" }).click();
    await expect(music).toBeHidden();
    await expect.poll(() => isPaused(page)).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("pepodev.music")!).playing,
        ),
      )
      .toBe(false);

    await playMusic(page);
    await switchMode(page, "website");
    await expect.poll(() => isPaused(page)).toBe(true);

    await switchMode(page, "desktop");
    await expect(
      music.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();
  });

  test("playing music does not keep re-broadcasting its settings", async ({
    page,
  }) => {
    await probeMusic(page);
    await servePlayableMusic(page);
    await resetPage(page);

    await playMusic(page);
    await page.waitForTimeout(200);
    expect(await countDuring(page, "__settingsEvents", 500)).toBe(0);
  });

  test("Play still plays when the AudioContext never starts", async ({
    page,
  }) => {
    await stallAudioContext(page);
    await servePlayableMusic(page);
    await resetPage(page);

    await playMusic(page);
    await expect
      .poll(() =>
        media(page).evaluate(
          (element: HTMLMediaElement) => element.currentTime,
        ),
      )
      .toBeGreaterThan(0.5);
    expect(await isPaused(page)).toBe(false);
    // Routed into the suspended context, the music would play silently.
    expect(
      await page.evaluate(() => (window as Probe).__mediaSources),
    ).toBe(0);
  });
});

test.describe("White Noise", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const probe = window as Probe;
      probe.__oscillators = 0;
      const createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        probe.__oscillators = (probe.__oscillators ?? 0) + 1;
        return createOscillator.call(this);
      };
    });
  });

  test("rain stops when its window closes and in website mode", async ({
    page,
  }) => {
    await resetPage(page);
    const noise = await openApp(page, "Noise", "whitenoise");
    await noise.getByRole("button", { name: "Start rain" }).click();
    await expect(noise.locator("[data-noise-status]")).toHaveText(
      "Rain loop active",
    );
    expect(await countDuring(page, "__oscillators", 500)).toBeGreaterThan(0);

    await noise.getByRole("button", { name: "Close White Noise" }).click();
    expect(await countDuring(page, "__oscillators", 600)).toBe(0);

    await openApp(page, "Noise", "whitenoise");
    await expect(
      noise.getByRole("button", { name: "Start rain" }),
    ).toBeVisible();
    await noise.getByRole("button", { name: "Start rain" }).click();
    await expect(noise.locator("[data-noise-status]")).toHaveText(
      "Rain loop active",
    );

    await switchMode(page, "website");
    expect(await countDuring(page, "__oscillators", 600)).toBe(0);
    await switchMode(page, "desktop");
    await expect(noise.locator("[data-noise-status]")).toHaveText("Ready");
  });

  test("Start explains itself when the AudioContext never starts", async ({
    page,
  }) => {
    await stallAudioContext(page);
    await resetPage(page);
    const noise = await openApp(page, "Noise", "whitenoise");
    await noise.getByRole("button", { name: "Start rain" }).click();
    await expect(noise.locator("[data-noise-status]")).toHaveText(
      /Waiting for the browser to start audio/,
    );
    // Drops on a stopped clock would all sound at once when it starts.
    expect(await countDuring(page, "__oscillators", 500)).toBe(0);
    await noise.getByRole("button", { name: "Stop rain" }).click();
    await expect(noise.locator("[data-noise-status]")).toHaveText("Ready");
  });

  test("rain that starts late clears the waiting message", async ({ page }) => {
    // resume() settles after 2.5 s, as with a slow audio device.
    await page.addInitScript(() => {
      class LateAudioContext extends window.AudioContext {
        late = "suspended" as AudioContextState;
        get state() {
          return this.late;
        }
        resume() {
          return new Promise<void>((resolve) => {
            window.setTimeout(() => {
              void super.resume();
              this.late = "running";
              this.dispatchEvent(new Event("statechange"));
              resolve();
            }, 2500);
          });
        }
      }
      window.AudioContext = LateAudioContext;
    });
    await resetPage(page);
    const noise = await openApp(page, "Noise", "whitenoise");
    await noise.getByRole("button", { name: "Start rain" }).click();
    await expect(noise.locator("[data-noise-status]")).toHaveText(
      /Waiting for the browser to start audio/,
    );
    await expect(noise.locator("[data-noise-status]")).toHaveText(
      "Rain loop active",
      { timeout: 3000 },
    );
    await expect(
      noise.getByRole("button", { name: "Stop rain" }),
    ).toBeVisible();
    expect(await countDuring(page, "__oscillators", 500)).toBeGreaterThan(0);
  });
});

test.describe("Blog reader", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("articles open at the top and Back restores the list position", async ({
    page,
  }) => {
    await resetPage(page);
    const blog = await openApp(page, "Blog", "blog");
    const scroller = blog.locator(".window-content");
    const scrollTop = () =>
      scroller.evaluate((element) => Math.round(element.scrollTop));

    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const listTop = await scrollTop();
    expect(listTop).toBeGreaterThan(0);

    // A plain click could first scroll the item into view and move the list.
    await blog.locator("[data-blog-index]").last().dispatchEvent("click");
    const article = blog.locator("[data-blog-post]:not([hidden])");
    await expect(article).toBeVisible();
    expect(await scrollTop()).toBe(0);
    await expect(article.locator("[data-blog-back]")).toBeInViewport();

    await scroller.evaluate((element) => {
      element.scrollTop = 900;
    });
    await article.locator("[data-blog-back]").click();
    await expect(blog.locator("[data-blog-list-view]")).toBeVisible();
    expect(await scrollTop()).toBe(listTop);

    // Another article also opens at the top, wherever the last one was left.
    await blog.locator("[data-blog-index]").first().click();
    expect(await scrollTop()).toBe(0);
  });

  test("keyboard focus moves into the article and back to its list item", async ({
    page,
  }) => {
    await resetPage(page);
    const blog = await openApp(page, "Blog", "blog");
    const item = blog.locator("[data-blog-index]").nth(2);
    await item.focus();
    await page.keyboard.press("Enter");
    const back = blog.locator(
      "[data-blog-post]:not([hidden]) [data-blog-back]",
    );
    await expect(back).toBeFocused();
    expect(
      await blog
        .locator(".window-content")
        .evaluate((element) => element.scrollTop),
    ).toBe(0);

    await page.keyboard.press("Enter");
    await expect(blog.locator("[data-blog-list-view]")).toBeVisible();
    await expect(item).toBeFocused();
  });

  test("external article links open in a new tab and keep the desktop", async ({
    page,
    context,
  }) => {
    await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>external</p>" }),
    );
    await resetPage(page);
    const blog = await openApp(page, "Blog", "blog");
    // The reader loads each article's body when it opens, so open them all
    // (once the list is there: the app's code may still be loading).
    const items = blog.locator("[data-blog-index]");
    const openBody = blog.locator(
      "[data-blog-post]:not([hidden]) .blog-reader-body",
    );
    await expect(items.first()).toBeVisible();
    const attributes: string[] = [];
    for (let i = 0; i < (await items.count()); i += 1) {
      await items.nth(i).click();
      await expect(openBody).not.toBeEmpty();
      attributes.push(
        ...(await openBody
          .locator("a[href^='http']")
          .evaluateAll((anchors: HTMLAnchorElement[]) =>
            anchors.map((anchor) => `${anchor.target} ${anchor.rel}`),
          )),
      );
      await blog
        .locator("[data-blog-post]:not([hidden]) [data-blog-back]")
        .click();
    }
    expect(attributes.length).toBeGreaterThan(0);
    expect(new Set(attributes)).toEqual(
      new Set(["_blank noopener noreferrer"]),
    );

    const desktopUrl = page.url();
    await blog.locator("[data-blog-index]").first().click();
    const link = blog
      .locator("[data-blog-post]:not([hidden])")
      .locator(".blog-reader-body a[href^='http']")
      .first();
    const href = await link.getAttribute("href");
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      link.click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(new URL(href!).href);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(page.url()).toBe(desktopUrl);
    await expect(blog).toBeVisible();
  });

  test("Thai articles are marked as Thai", async ({ page }) => {
    await resetPage(page);
    const blog = await openApp(page, "Blog", "blog");
    await expect(
      blog.locator(
        "[data-blog-post][data-blog-slug='aws-graviton-ทักครับ'] .blog-reader-body",
      ),
    ).toHaveAttribute("lang", "th");
    await expect(
      blog.locator("button[data-blog-slug='aws-graviton-ทักครับ'] .blog-item-title"),
    ).toHaveAttribute("lang", "th");
  });

  test("an article that fails to load can be retried without losing focus", async ({
    page,
  }) => {
    // Article bodies load when they open (/blog/<id>/article.json).
    let fail = true;
    await page.route("**/blog/*/article.json", (route) =>
      fail ? route.fulfill({ status: 500, body: "" }) : route.continue(),
    );
    await resetPage(page);
    const blog = await openApp(page, "Blog", "blog");
    const article = blog.locator("[data-blog-post]:not([hidden])");
    const body = article.locator(".blog-reader-body");
    const back = article.locator("[data-blog-back]");
    const retry = article.getByRole("button", { name: "Try again" });

    await blog.locator("[data-blog-index]").nth(0).click();
    await expect(retry).toBeVisible();
    await expect(body).toBeEmpty();

    // "Try again" goes away when pressed; focus stays in the article.
    fail = false;
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(body).not.toBeEmpty();
    await expect(back).toBeFocused();

    // Opening an article whose load failed loads it again.
    fail = true;
    await back.click();
    await blog.locator("[data-blog-index]").nth(1).click();
    await expect(retry).toBeVisible();
    await back.click();
    fail = false;
    await blog.locator("[data-blog-index]").nth(1).click();
    await expect(body).not.toBeEmpty();
    await expect(article.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Settings", () => {
  test("controls follow a theme change made in the command palette", async ({
    page,
  }) => {
    await resetPage(page, {
      "pepodev.desktopPrefs": JSON.stringify({
        theme: "light",
        background: "lavender",
      }),
    });
    const settings = await openApp(page, "Settings", "settings");
    await expect(settings.locator('[data-setting="theme"]')).toHaveValue(
      "light",
    );

    await page.keyboard.press("ControlOrMeta+K");
    await page.locator("#command-palette-input").fill("toggle theme");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(settings.locator('[data-setting="theme"]')).toHaveValue(
      "dark",
    );
    await expect(settings.locator('[data-setting="background"]')).toHaveValue(
      "network",
    );
    await expect(
      settings.locator('[data-setting="background"] option').first(),
    ).toHaveAttribute("value", "network");
  });

  test("a legacy light theme without saved preferences gets a light background", async ({
    page,
  }) => {
    await resetPage(page, { "pepodev.theme": "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveCSS(
      "--desktop-bg-color",
      "#f0f4f8",
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pepodev.desktopPrefs")!).background,
      ),
    ).toBe("cloud");
  });
});

// Hides the text, screenshots what is behind it, and compares the text color
// with the median background pixel. axe cannot judge the translucent glass.
async function contrastFailures(page: Page, selectors: string[]) {
  const items = await page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const element = document.querySelector(selector)!;
        // A target below the fold of its window's scroller is sampled where
        // it shows.
        element.scrollIntoView({ block: "nearest" });
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const size = parseFloat(style.fontSize);
        const large =
          size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        return {
          selector,
          color: style.color,
          rect: [rect.x, rect.y, rect.width, rect.height],
          minimum: large ? 3 : 4.5,
        };
      }),
    selectors,
  );
  const hide = await page.addStyleTag({
    content: `${selectors.join(",")} { color: transparent !important; }`,
  });
  const screenshot = (await page.screenshot()).toString("base64");
  await hide.evaluate((node) => (node as Element).remove());

  return page.evaluate(
    async ({ screenshot, items }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${screenshot}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      // Computed colors may be oklch() or color-mix(); a 1px draw resolves
      // them to sRGB.
      const swatch = document
        .createElement("canvas")
        .getContext("2d", { willReadFrequently: true })!;
      const toRgba = (value: string) => {
        swatch.clearRect(0, 0, 1, 1);
        swatch.fillStyle = value;
        swatch.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = ([r, g, b]: number[]) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      return items.flatMap(({ selector, color, rect, minimum }) => {
        const [x, y, width, height] = rect.map(Math.round);
        const data = context.getImageData(x, y, width, height).data;
        const pixels: number[][] = [];
        for (let i = 0; i < data.length; i += 4) {
          pixels.push([data[i], data[i + 1], data[i + 2]]);
        }
        pixels.sort((a, b) => luminance(a) - luminance(b));
        const background = pixels[Math.floor(pixels.length / 2)];
        const text = toRgba(color);
        const alpha = text[3];
        const blended = [0, 1, 2].map(
          (i) => text[i] * alpha + background[i] * (1 - alpha),
        );
        const [lighter, darker] = [luminance(blended), luminance(background)]
          .sort((a, b) => b - a);
        const ratio = (lighter + 0.05) / (darker + 0.05);
        return ratio >= minimum
          ? []
          : [`${selector}: ${ratio.toFixed(2)} (${color} on ${background})`];
      });
    },
    { screenshot, items },
  );
}

const contrastTargets = {
  music: [
    ".music-eyebrow",
    "#music-detail",
    "[data-music-elapsed]",
    "[data-music-remaining]",
    "[data-music-toggle]",
    "[data-music-status]",
  ],
  whitenoise: [
    ".music-eyebrow",
    ".noise-panel h2",
    "[data-noise-status]",
    ".settings-field span",
    "[data-noise-toggle]",
  ],
  settings: [
    ".settings-field:not(.settings-checkbox) span",
    ".settings-checkbox span",
    "[data-music-setting='toggle']",
    "[data-settings-reset]",
  ],
};

for (const [theme, background, accent] of [
  ["light", "cloud", "green"],
  ["light", "sky", "cyan"],
  ["dark", "network", "purple"],
]) {
  test(`Music, White Noise and Settings text meets AA (${theme}, ${background}, ${accent})`, async ({
    page,
  }) => {
    await resetPage(page, {
      "pepodev.desktopPrefs": JSON.stringify({ theme, background, accent }),
    });
    const failures: string[] = [];
    for (const [label, appId] of [
      ["Music", "music"],
      ["Noise", "whitenoise"],
      ["Settings", "settings"],
    ] as const) {
      const window = await openApp(page, label, appId);
      // The app's code may still be loading; then let the opening animation
      // finish before sampling.
      await expect(
        window.locator(contrastTargets[appId][0]).first(),
      ).toBeVisible();
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        document.querySelector("[data-music-status]")!.textContent =
          "This browser could not play the selected file.";
      });
      const selectors = contrastTargets[appId].map(
        (selector) => `#window-${appId} ${selector}`,
      );
      failures.push(...(await contrastFailures(page, selectors)));
      await window.getByRole("button", { name: /^Close / }).click();
      await expect(window).toBeHidden();
    }
    expect(failures).toEqual([]);
  });
}
