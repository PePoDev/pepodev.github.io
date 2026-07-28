import { expect, test, type Page } from "@playwright/test";

const apps = [
  { label: "Welcome", appId: "welcome", title: "Welcome - Login" },
  { label: "Blog", appId: "blog", title: "Blog - Articles" },
  { label: "Projects", appId: "project", title: "Projects - Showcase" },
  { label: "Work", appId: "work", title: "Work - Experience" },
  { label: "About Me", appId: "me", title: "About Me" },
  { label: "SRE Game", appId: "sregame", title: "SRE Game - Taming Chaos" },
  { label: "Snake", appId: "snake", title: "Snake" },
  { label: "Music", appId: "music", title: "Music Player" },
  { label: "Noise", appId: "whitenoise", title: "White Noise" },
  { label: "Calculator", appId: "calculator", title: "Calculator" },
  { label: "Settings", appId: "settings", title: "Settings" },
  { label: "Terminal", appId: "terminal", title: "Terminal" },
  { label: "Certs", appId: "certs", title: "Certifications" },
  { label: "Gallery", appId: "gallery", title: "Gallery" },
  { label: "Trash", appId: "trash", title: "Trash Bin" },
];

async function resetPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function openApp(page: Page, label: string, appId: string) {
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: label })
    .click();
  const window = page.locator(`#window-${appId}`);
  await expect(window).toBeVisible();
  await expect(window).toHaveAttribute("aria-hidden", "false");
  return window;
}

test.beforeEach(async ({ page }) => {
  await resetPage(page);
});

test("renders the desktop and all launchers", async ({ page }) => {
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#bg-canvas")).toBeVisible();

  for (const app of apps) {
    await expect(
      page.locator("#desktop-icons").getByRole("button", { name: app.label }),
    ).toBeVisible();
  }
});

test("switches modes from the taskbar and website header and persists each choice", async ({
  page,
}) => {
  const desktop = page.locator("#desktop");
  const website = page.locator("#website");

  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "desktop",
  );
  await expect(desktop).toBeVisible();
  await expect(desktop).toHaveAttribute("aria-hidden", "false");
  await expect(website).toBeAttached();
  await expect(website).toBeHidden();
  await expect(website).toHaveAttribute("aria-hidden", "true");

  const taskbarSwitch = page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" });
  await taskbarSwitch.click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "website",
  );
  await expect(desktop).toBeHidden();
  await expect(desktop).toHaveAttribute("aria-hidden", "true");
  await expect(website).toBeVisible();
  await expect(website).toHaveAttribute("aria-hidden", "false");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
    )
    .toBe("website");

  await page.reload();
  await expect(desktop).toBeHidden();
  await expect(website).toBeVisible();

  const websiteSwitch = website
    .locator("header")
    .getByRole("button", { name: "Switch to desktop mode" });
  await expect(websiteSwitch).toHaveAttribute("aria-pressed", "true");
  await websiteSwitch.click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "desktop",
  );
  await expect(desktop).toBeVisible();
  await expect(website).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
    )
    .toBe("desktop");

  await page.reload();
  await expect(desktop).toBeVisible();
  await expect(website).toBeHidden();
});

test("renders current portfolio content in website mode", async ({ page }) => {
  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();

  const website = page.locator("#website");
  await expect(
    website.getByRole("heading", {
      level: 1,
      name: "Thiwanon Chomcharoen (PePoDev)",
    }),
  ).toBeVisible();

  const navigation = website.getByRole("navigation", {
    name: "Portfolio sections",
  });
  for (const link of [
    { name: "About", href: "#website-about" },
    { name: "Experience", href: "#website-experience" },
    { name: "Projects", href: "#website-projects" },
    { name: "Writing", href: "#website-writing" },
    { name: "Contact", href: "#website-contact" },
  ]) {
    await expect(
      navigation.getByRole("link", { name: link.name }),
    ).toHaveAttribute("href", link.href);
  }

  await expect(
    website.getByRole("heading", { level: 2, name: "Experience" }),
  ).toBeVisible();
  await expect(website.locator("#website-experience article")).not.toHaveCount(
    0,
  );
  await expect(
    website.getByRole("heading", { level: 2, name: "Selected projects" }),
  ).toBeVisible();
  await expect(website.locator("#website-projects article")).not.toHaveCount(0);
  await expect(
    website.getByRole("heading", { level: 2, name: "Latest writing" }),
  ).toBeVisible();
  await expect(website.locator('a[href^="/blog/"]').first()).toBeVisible();
  await expect(
    website.getByRole("link", { name: "View resume" }),
  ).toHaveAttribute("href", "/resume");
});

test("falls back to desktop mode when the saved mode is invalid", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("pepodev.viewMode", "invalid");
  });
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "desktop",
  );
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#website")).toBeAttached();
  await expect(page.locator("#website")).toBeHidden();
});

test("opens every desktop app window from the icon grid", async ({ page }) => {
  for (const app of apps) {
    const window = await openApp(page, app.label, app.appId);
    await expect(window.locator(".window-title")).toHaveText(app.title);
    await page.keyboard.press("Escape");
    await expect(window).toBeHidden();
  }
});

test("opens a blog article in desktop mode from the blog query parameter", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.evaluate(() => {
    localStorage.setItem("pepodev.viewMode", "website");
  });
  await page.goto("/?blog=aws-local-zone-bangkok-launch");

  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#website")).toBeAttached();
  await expect(page.locator("#website")).toBeHidden();

  const blogWindow = page.locator("#window-blog");
  const article = blogWindow.locator(
    '[data-blog-post][data-blog-slug="aws-local-zone-bangkok-launch"]',
  );

  await expect(blogWindow).toBeVisible();
  await expect(blogWindow).toHaveAttribute("aria-hidden", "false");
  await expect(blogWindow).toHaveClass(/maximized/);
  await expect(blogWindow.locator("[data-blog-list-view]")).toBeHidden();
  await expect(article).toBeVisible();
  await expect(article.locator(".blog-reader-title")).toHaveText(
    "Aws Local Zone Bangkok Launch",
  );
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    "cat articles/aws-local-zone-bangkok-launch",
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
    )
    .toBe("website");
  expect(pageErrors).toEqual([]);
});

test("blog reader supports article navigation, sharing, and close reset", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { __copiedText?: string }).__copiedText =
            text;
        },
      },
    });
  });

  const blogWindow = await openApp(page, "Blog", "blog");
  const firstArticleButton = blogWindow.locator("[data-blog-index]").first();
  const slug = await firstArticleButton.getAttribute("data-blog-slug");
  expect(slug).toBeTruthy();

  await firstArticleButton.click();
  await expect(blogWindow.locator("[data-blog-list-view]")).toBeHidden();
  await expect(
    blogWindow.locator(`[data-blog-post][data-blog-slug="${slug}"]`),
  ).toBeVisible();
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    `cat articles/${slug}`,
  );

  await blogWindow.locator("[data-blog-share]").first().click();
  await expect(page.locator("#toast-container")).toContainText(
    "Link copied to clipboard!",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { __copiedText?: string }).__copiedText,
      ),
    )
    .toContain(`/?blog=${encodeURIComponent(slug!)}`);

  await blogWindow.getByRole("button", { name: "Back to articles" }).click();
  await expect(blogWindow.locator("[data-blog-list-view]")).toBeVisible();
  await expect(blogWindow.locator("[data-blog-reader].active")).toHaveCount(0);
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    "ls articles/",
  );

  await firstArticleButton.click();
  await blogWindow.getByRole("button", { name: "Close Blog - Articles" }).click();
  await openApp(page, "Blog", "blog");
  await expect(blogWindow.locator("[data-blog-list-view]")).toBeVisible();
  await expect(blogWindow.locator("[data-blog-command]")).toHaveText(
    "ls articles/",
  );
});

test("supports window minimize, restore, maximize, close, and taskbar state", async ({
  page,
}) => {
  const window = await openApp(page, "Projects", "project");

  await window
    .getByRole("button", { name: "Minimize Projects - Showcase" })
    .click();
  await expect(window).toHaveClass(/minimized/);

  await page
    .locator("#taskbar-apps")
    .getByRole("button", { name: /Projects/ })
    .click();
  await expect(window).not.toHaveClass(/minimized/);
  await expect(window).toHaveClass(/focused/);

  await window
    .getByRole("button", { name: "Maximize Projects - Showcase" })
    .click();
  await expect(window).toHaveClass(/maximized/);

  await page.keyboard.press("Escape");
  await expect(window).toBeHidden();
});

test("resizes windows from the right and bottom borders", async ({ page }) => {
  const window = await openApp(page, "Projects", "project");
  await expect(window).not.toHaveClass(/opening/);
  const initialBox = await window.boundingBox();
  expect(initialBox).not.toBeNull();

  const rightHandle = window.locator(".window-resize-handle-right");
  const rightHandleBox = await rightHandle.boundingBox();
  expect(rightHandleBox).not.toBeNull();

  await page.mouse.move(
    rightHandleBox!.x + rightHandleBox!.width / 2,
    rightHandleBox!.y + rightHandleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    rightHandleBox!.x + rightHandleBox!.width / 2 + 80,
    rightHandleBox!.y + rightHandleBox!.height / 2,
  );
  await page.mouse.up();

  const widthResizedBox = await window.boundingBox();
  expect(widthResizedBox).not.toBeNull();
  expect(widthResizedBox!.width).toBeGreaterThan(initialBox!.width + 60);
  expect(widthResizedBox!.height).toBeCloseTo(initialBox!.height, 0);

  const bottomHandle = window.locator(".window-resize-handle-bottom");
  const bottomHandleBox = await bottomHandle.boundingBox();
  expect(bottomHandleBox).not.toBeNull();

  await page.mouse.move(
    bottomHandleBox!.x + bottomHandleBox!.width / 2,
    bottomHandleBox!.y + bottomHandleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bottomHandleBox!.x + bottomHandleBox!.width / 2,
    bottomHandleBox!.y + bottomHandleBox!.height / 2 + 80,
  );
  await page.mouse.up();

  const heightResizedBox = await window.boundingBox();
  expect(heightResizedBox).not.toBeNull();
  expect(heightResizedBox!.width).toBeCloseTo(widthResizedBox!.width, 0);
  expect(heightResizedBox!.height).toBeGreaterThan(
    widthResizedBox!.height + 60,
  );
});

test("searches and launches apps from start menu and command palette", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open start menu" }).click();
  await page.locator("#start-menu-search").fill("certs");
  await page
    .locator("#start-menu")
    .getByRole("button", { name: /Certs/ })
    .click();
  const certsWindow = page.locator("#window-certs");
  await expect(certsWindow).toBeVisible();
  await certsWindow
    .getByRole("button", { name: "Close Certifications" })
    .click();
  await expect(certsWindow).toBeHidden();

  await page.locator("#desktop").click({ position: { x: 640, y: 120 } });
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await page.locator("#command-palette-input").fill("gallery");
  await page
    .getByRole("button", { name: /Gallery Open protected pictures/ })
    .click();
  await expect(page.locator("#window-gallery")).toBeVisible();
});

test("command palette keyboard navigation runs desktop commands", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("pepodev.someTransientState", "remove-me");
  });

  await openApp(page, "Projects", "project");
  await openApp(page, "Work", "work");

  await page.keyboard.press("ControlOrMeta+K");
  await page.locator("#command-palette-input").fill("close all");
  await page.keyboard.press("Enter");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "false",
  );
  await expect(page.locator("#window-project")).toBeHidden();
  await expect(page.locator("#window-work")).toBeHidden();

  await page.keyboard.press("ControlOrMeta+K");
  await page.locator("#command-palette-input").fill("toggle theme");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS(
    "--desktop-bg-color",
    "#f0f4f8",
  );

  await page.keyboard.press("ControlOrMeta+K");
  await page.locator("#command-palette-input").fill("reset desktop");
  await page.keyboard.press("Enter");
  await page.waitForLoadState("domcontentloaded");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("pepodev.someTransientState")),
    )
    .toBeNull();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("downloads a generated resume PDF", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.goto("/resume");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pepo-resume.pdf");
});

test("calculator handles arithmetic, percent, keyboard input, and clear", async ({
  page,
}) => {
  const window = await openApp(page, "Calculator", "calculator");

  await window.getByRole("button", { name: "9" }).click();
  await window.getByRole("button", { name: "%" }).click();
  await window.getByRole("button", { name: "=" }).click();
  await expect(window.locator(".calculator-value")).toHaveText("0.09");

  await window.getByRole("button", { name: "AC" }).click();
  await page.keyboard.press("1");
  await page.keyboard.press("+");
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");
  await expect(window.locator(".calculator-value")).toHaveText("3");
});

test("snake game starts, scores, pauses, and resets", async ({ page }) => {
  const window = await openApp(page, "Snake", "snake");

  await expect(window.locator("[data-snake-status]")).toHaveText("Ready");
  await expect(window.locator("[data-snake-best]")).toHaveText("170");
  await window.getByRole("button", { name: "Start" }).click();
  await expect(window.locator("[data-snake-status]")).toHaveText("Running");

  await expect
    .poll(() => window.locator("[data-snake-score]").textContent())
    .toBe("10");
  await expect(window.locator("[data-snake-best]")).toHaveText("170");

  await window.getByRole("button", { name: "Pause" }).click();
  await expect(window.locator("[data-snake-status]")).toHaveText("Paused");

  await window.getByRole("button", { name: "Reset" }).click();
  await expect(window.locator("[data-snake-status]")).toHaveText("Ready");
  await expect(window.locator("[data-snake-score]")).toHaveText("0");
});

test("settings customizes and persists desktop preferences", async ({
  page,
}) => {
  const window = await openApp(page, "Settings", "settings");

  await window.locator('[data-setting="theme"]').selectOption("light");
  await window.locator('[data-setting="background"]').selectOption("cloud");
  await window.locator('[data-accent="purple"]').click();
  await window.locator('[data-setting="radius"]').fill("18");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("--window-radius", "18px");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("--window-radius", "18px");
});

test("taskbar tray calendar and system audio controls update persisted state", async ({
  page,
}) => {
  await page.locator("#taskbar-clock-button").click();
  const tray = page.locator("#tray-panel");
  await expect(tray).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#calendar-grid .calendar-day")).not.toHaveCount(0);

  const initialMonth = await page.locator("#calendar-title").textContent();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator("#calendar-title")).not.toHaveText(
    initialMonth ?? "",
  );
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator("#calendar-title")).toHaveText(initialMonth ?? "");

  await page.locator("#audio-volume").fill("35");
  await expect(page.locator("#audio-volume-value")).toHaveText("35%");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("pepodev.systemAudio") || "{}"),
      ),
    )
    .toMatchObject({ volume: 0.35, muted: false });

  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.locator("#audio-volume-value")).toHaveText("Muted");
  await expect(page.locator("#taskbar-audio-status")).toHaveAttribute(
    "aria-label",
    "System audio muted",
  );
  await page.keyboard.press("Escape");
  await expect(tray).toHaveAttribute("aria-hidden", "true");
});

test("music player and settings music controls update state", async ({
  page,
}) => {
  const music = await openApp(page, "Music", "music");
  await expect(music.locator("[data-music-volume]")).toHaveCount(0);
  await music.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    music.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      music
        .locator("[data-music-media]")
        .evaluate((media: HTMLMediaElement) => ({
          currentTime: media.currentTime,
          muted: media.muted,
          paused: media.paused,
          volume: media.volume,
        })),
    )
    .toMatchObject({
      muted: false,
      paused: false,
      volume: 1,
    });
  await expect
    .poll(() =>
      music
        .locator("[data-music-media]")
        .evaluate((media: HTMLMediaElement) => media.currentTime),
    )
    .toBeGreaterThan(0);

  await music.locator("[data-music-track]").selectOption("late_shift_protocol");
  await expect(music.locator("#music-title")).toHaveValue(
    "late_shift_protocol",
  );

  const settings = await openApp(page, "Settings", "settings");
  await expect(settings.locator('[data-music-setting="volume"]')).toHaveCount(
    0,
  );
  await settings
    .locator('[data-music-setting="track"]')
    .selectOption("late_shift_protocol");
  await expect(music.locator("#music-title")).toHaveValue(
    "late_shift_protocol",
  );
});

test("music player recovers from stale saved playback state", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "pepodev.music",
      JSON.stringify({
        track: "late_shift_protocol",
        playing: true,
      }),
    );
  });
  await page.reload();

  const music = await openApp(page, "Music", "music");
  await expect(
    music.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      music
        .locator("[data-music-media]")
        .evaluate((media: HTMLMediaElement) => media.paused),
    )
    .toBe(true);

  await music.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    music.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();

  await music.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    music.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      music
        .locator("[data-music-media]")
        .evaluate((media: HTMLMediaElement) => media.paused),
    )
    .toBe(true);
});

test("terminal commands print output and can open apps", async ({ page }) => {
  const terminal = await openApp(page, "Terminal", "terminal");
  const input = terminal.locator("[data-terminal-input]");

  await input.fill("whoami");
  await input.press("Enter");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "Site Reliability Engineer",
  );

  await input.fill("projects");
  await input.press("Enter");
  await expect(page.locator("#window-project")).toBeVisible();

  await input.fill("unknown-command");
  await input.press("Enter");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "command not found: unknown-command",
  );

  await input.fill("clear");
  await input.press("Enter");
  await expect(terminal.locator("[data-terminal-output] > div")).toHaveCount(0);
});

test("gallery requires the password before showing pictures", async ({
  page,
}) => {
  const gallery = await openApp(page, "Gallery", "gallery");

  await expect(gallery.getByText("Please enter the password")).toBeVisible();
  await expect(gallery.locator("[data-gallery-unlocked]")).toBeHidden();

  await gallery.locator("[data-gallery-password]").fill("wrong");
  await gallery.getByRole("button", { name: "Unlock" }).click();
  await expect(gallery.locator("[data-gallery-error]")).toContainText(
    "Please enter the password",
  );
  await expect(gallery.locator("[data-gallery-unlocked]")).toBeHidden();

  await gallery.locator("[data-gallery-password]").fill("password");
  await gallery.getByRole("button", { name: "Unlock" }).click();
  await expect(gallery.locator("[data-gallery-lock]")).toBeHidden();
  await expect(gallery.locator("[data-gallery-unlocked]")).toBeVisible();
  await expect(gallery.locator(".gallery-card")).toHaveCount(4);
});

test("certifications wallet renders sorted dynamic status badges", async ({
  page,
}) => {
  const certs = await openApp(page, "Certs", "certs");
  const cards = certs.locator(".cert-card");
  await expect(cards).toHaveCount(6);
  await expect(certs.locator(".cert-wallet-header")).toHaveText(
    "6 verified records",
  );
  await expect
    .poll(() => certs.locator(".cert-status").allTextContents())
    .not.toContain("Loading...");

  const statuses = await certs.locator(".cert-status").allTextContents();
  expect(statuses).toHaveLength(6);
  // Statuses are date-sensitive; just verify they are valid values
  for (const status of statuses) {
    expect(["Active", "Expiring Soon", "Expired"]).toContain(status);
  }

  await expect(cards.first()).toHaveAttribute("target", "_blank");
  await expect(cards.first()).toHaveAttribute("rel", /noopener/);
});

test("white noise starts, responds to system mute events, and stops", async ({
  page,
}) => {
  const noise = await openApp(page, "Noise", "whitenoise");
  const noiseApp = noise.locator("[data-white-noise-app]");
  await expect(noise.locator("[data-noise-status]")).toHaveText("Ready");

  await noise.getByRole("button", { name: "Start rain" }).click();
  await expect(noiseApp).toHaveClass(/noise-playing/);
  await expect(noise.locator("[data-noise-status]")).toHaveText(
    "Rain loop active",
  );

  await page.evaluate(() => {
    localStorage.setItem(
      "pepodev.systemAudio",
      JSON.stringify({ volume: 1, muted: true }),
    );
    document.dispatchEvent(
      new CustomEvent("desktop:audio-settings", {
        detail: { volume: 1, muted: true },
      }),
    );
  });
  await expect(noise.locator("[data-noise-status]")).toHaveText(
    "Muted by system audio",
  );

  await noise.getByRole("button", { name: "Stop rain" }).click();
  await expect(noiseApp).not.toHaveClass(/noise-playing/);
  await expect(noise.locator("[data-noise-status]")).toHaveText("Ready");
});

test("desktop icons snap and swap occupied grid cells", async ({ page }) => {
  const welcome = page.locator("#desktop-icons").getByRole("button", {
    name: "Welcome",
  });
  const blog = page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Blog" });
  const welcomeBox = await welcome.boundingBox();
  const blogBox = await blog.boundingBox();
  expect(welcomeBox).not.toBeNull();
  expect(blogBox).not.toBeNull();

  await welcome.dragTo(blog);

  const movedWelcome = await welcome.boundingBox();
  const movedBlog = await blog.boundingBox();
  expect(Math.round(movedWelcome!.x)).toBe(Math.round(blogBox!.x));
  expect(Math.round(movedWelcome!.y)).toBe(Math.round(blogBox!.y));
  expect(Math.round(movedBlog!.x)).not.toBe(Math.round(blogBox!.x));
  expect(Math.round(movedBlog!.y)).toBe(Math.round(welcomeBox!.y));
});
