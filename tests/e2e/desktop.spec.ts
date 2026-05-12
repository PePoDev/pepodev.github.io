import { expect, test, type Page } from "@playwright/test";

const apps = [
  { label: "Welcome", appId: "welcome", title: "Welcome - Login" },
  { label: "Blog", appId: "blog", title: "Blog - Articles" },
  { label: "Resume", appId: "resume", title: "Resume - CV" },
  { label: "Projects", appId: "project", title: "Projects - Showcase" },
  { label: "Work", appId: "work", title: "Work - Experience" },
  { label: "About Me", appId: "me", title: "About Me" },
  { label: "SRE Game", appId: "sregame", title: "SRE Game - Taming Chaos" },
  { label: "Music", appId: "music", title: "Music Player" },
  { label: "Calculator", appId: "calculator", title: "Calculator" },
  { label: "Settings", appId: "settings", title: "Settings" },
  { label: "Terminal", appId: "terminal", title: "Terminal" },
  { label: "Incidents", appId: "incidents", title: "Incident Timeline" },
  { label: "Metrics", appId: "metrics", title: "Metrics Dashboard" },
  {
    label: "Architecture",
    appId: "architecture",
    title: "Architecture Viewer",
  },
  { label: "Runbook", appId: "runbook", title: "Runbook" },
  { label: "Certs", appId: "certs", title: "Certifications Wallet" },
  { label: "Deploy Sim", appId: "deploysim", title: "Deploy Simulator" },
  { label: "Monitor", appId: "monitor", title: "System Monitor" },
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

test("opens every desktop app window from the icon grid", async ({ page }) => {
  for (const app of apps) {
    const window = await openApp(page, app.label, app.appId);
    await expect(window.locator(".window-title")).toHaveText(app.title);
    await window.getByRole("button", { name: `Close ${app.title}` }).click();
    await expect(window).toBeHidden();
  }
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
  await page.locator("#start-menu-search").fill("runbook");
  await page
    .locator("#start-menu")
    .getByRole("button", { name: /Runbook/ })
    .click();
  const runbookWindow = page.locator("#window-runbook");
  await expect(runbookWindow).toBeVisible();
  await runbookWindow.getByRole("button", { name: "Close Runbook" }).click();
  await expect(runbookWindow).toBeHidden();

  await page.locator("#desktop").click({ position: { x: 640, y: 120 } });
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await page.locator("#command-palette-input").fill("metrics");
  await page
    .getByRole("button", { name: /Metrics Open service metrics/ })
    .click();
  await expect(page.locator("#window-metrics")).toBeVisible();
});

test("downloads a generated resume PDF", async ({ page }) => {
  await openApp(page, "Resume", "resume");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
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

test("settings customizes and persists desktop preferences", async ({
  page,
}) => {
  const window = await openApp(page, "Settings", "settings");

  await window.locator('[data-setting="theme"]').selectOption("light");
  await window.locator('[data-setting="background"]').selectOption("ember");
  await window.locator('[data-accent="purple"]').click();
  await window.locator('[data-setting="radius"]').fill("18");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("--window-radius", "18px");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("--window-radius", "18px");
});

test("music player and settings music controls update state", async ({
  page,
}) => {
  const music = await openApp(page, "Music", "music");
  await music.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    music.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();

  await music.locator("[data-music-track]").selectOption("nightshift");
  await expect(music.locator("#music-title")).toHaveText("Night Shift");

  const settings = await openApp(page, "Settings", "settings");
  await settings
    .locator('[data-music-setting="track"]')
    .selectOption("incident");
  await expect(music.locator("#music-title")).toHaveText("Incident Response");
});

test("terminal commands print output and can open apps", async ({ page }) => {
  const terminal = await openApp(page, "Terminal", "terminal");
  const input = terminal.locator("[data-terminal-input]");

  await input.fill("whoami");
  await input.press("Enter");
  await expect(terminal.locator("[data-terminal-output]")).toContainText(
    "Site Reliability Engineer",
  );

  await input.fill("open metrics");
  await input.press("Enter");
  await expect(page.locator("#window-metrics")).toBeVisible();
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

test("utility apps expose their primary interactions", async ({ page }) => {
  const runbook = await openApp(page, "Runbook", "runbook");
  await runbook.locator("[data-runbook-search]").fill("kafka");
  await expect(runbook.locator("[data-runbook-card]:visible")).toHaveCount(1);
  await expect(runbook.locator("[data-runbook-card]:visible")).toContainText(
    "Kafka",
  );

  const architecture = await openApp(page, "Architecture", "architecture");
  await architecture.getByRole("button", { name: "Security" }).click();
  await expect(architecture.locator("[data-architecture-title]")).toHaveText(
    "Security",
  );

  const deploy = await openApp(page, "Deploy Sim", "deploysim");
  await deploy.getByRole("button", { name: "Start deploy" }).click();
  await expect(deploy.locator("[data-deploy-console]")).toContainText(
    "Running",
  );
  await deploy.getByRole("button", { name: "Rollback" }).click();
  await expect(deploy.locator("[data-deploy-console]")).toContainText(
    "Rollback",
  );

  const monitor = await openApp(page, "Monitor", "monitor");
  await expect(monitor.locator('[data-monitor="cpu"]')).toContainText("%");
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
