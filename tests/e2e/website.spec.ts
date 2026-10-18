import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};
import projects from "../../src/data/projects.json" with { type: "json" };

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
];
const accents = ["green", "cyan", "purple", "amber"];
const background = { dark: "rgb(11, 15, 20)", light: "rgb(244, 244, 239)" };

// Expected career numbers, worked out here independently of the app's util.
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const now = new Date();
const thisMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
const toIndex = (text: string) => {
  if (/present/i.test(text)) return thisMonth;
  const [month, year] = text.trim().split(/\s+/);
  return Number(year) * 12 + MONTHS.indexOf(month.toLowerCase());
};
const spans = experiences
  .map(({ period }) => period.split(" - ").map(toIndex))
  .sort((a, b) => a[0] - b[0]);
const earliest = spans[0][0];
const expectedYears = Math.floor((thisMonth - earliest) / 12);
const expectedMonths = thisMonth - earliest + 1;
const expectedCompanies = new Set(
  experiences.map(({ company }) => company.replace(/,?\s*Co\.,?\s*Ltd\.?$/, "")),
).size;
let gapMonths = 0;
for (let i = 1; i < spans.length; i += 1) {
  gapMonths += Math.max(0, spans[i][0] - spans[i - 1][1] - 1);
}
const tenure = (months: number) =>
  [
    Math.floor(months / 12) > 0 && `${Math.floor(months / 12)} yr`,
    months % 12 > 0 && `${months % 12} mo`,
  ]
    .filter(Boolean)
    .join(" ");

async function openWebsite(
  page: Page,
  prefs?: { theme?: string; accent?: string },
) {
  await page.addInitScript((savedPrefs) => {
    if (sessionStorage.getItem("website-spec-ready")) return;
    sessionStorage.setItem("website-spec-ready", "1");
    localStorage.clear();
    localStorage.setItem("pepodev.viewMode", "website");
    if (savedPrefs) {
      localStorage.setItem("pepodev.desktopPrefs", JSON.stringify(savedPrefs));
    }
  }, prefs ?? null);
  await page.goto("/");
  const website = page.locator("#website");
  await expect(website).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return website;
}

// The focused element's outline, grown by its offset and width, must lie
// inside every ancestor that clips (rounded panels, the nav scroller).
async function focusRingProblems(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return ["nothing focused"];
    const cs = getComputedStyle(el);
    if (!el.matches(":focus-visible")) return ["not :focus-visible"];
    if (cs.outlineStyle === "none") return ["no outline"];
    const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
    const box = el.getBoundingClientRect();
    const problems: string[] = [];
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === "visible" && acs.overflowY === "visible") continue;
      const r = a.getBoundingClientRect();
      const left = r.left + a.clientLeft;
      const top = r.top + a.clientTop;
      if (
        box.left - grow < left - 0.5 ||
        box.top - grow < top - 0.5 ||
        box.right + grow > left + a.clientWidth + 0.5 ||
        box.bottom + grow > top + a.clientHeight + 0.5
      ) {
        problems.push(`clipped by .${a.className}`);
      }
    }
    return problems;
  });
}

async function seriousViolations(page: Page, rules?: string[]) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (runOnly) => {
    const axe = (window as unknown as { axe: any }).axe;
    const results = await axe.run(document, {
      resultTypes: ["violations"],
      ...(runOnly ? { runOnly: { type: "rule", values: runOnly } } : {}),
    });
    return results.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v: any) =>
          `${v.id}: ${v.nodes
            .slice(0, 3)
            .map((n: any) => n.target.join(" "))
            .join(", ")}`,
      );
  }, rules ?? null);
}

for (const theme of ["dark", "light"] as const) {
  for (const viewport of viewports) {
    test(`website mode fits ${viewport.width}px and passes axe in the ${theme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWebsite(page, { theme });
      await expect(page.locator(".website-shell")).toHaveCSS(
        "background-color",
        background[theme],
      );

      // Audit the collapsed content too.
      await page.evaluate(() =>
        document
          .querySelectorAll<HTMLDetailsElement>("#website details")
          .forEach((details) => {
            details.open = true;
          }),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}

test("accent text keeps AA contrast for every Settings accent", async ({
  page,
}) => {
  await page.goto("/");
  for (const theme of ["dark", "light"]) {
    for (const accent of accents) {
      await page.evaluate(
        ([theme, accent]) => {
          localStorage.setItem("pepodev.viewMode", "website");
          localStorage.setItem(
            "pepodev.desktopPrefs",
            JSON.stringify({ theme, accent }),
          );
        },
        [theme, accent],
      );
      await page.goto("/");
      await expect(page.locator("#website")).toBeVisible();
      await page.evaluate(() =>
        document
          .querySelectorAll<HTMLDetailsElement>("#website details")
          .forEach((details) => {
            details.open = true;
          }),
      );
      expect(
        await seriousViolations(page, ["color-contrast"]),
        `${theme} theme, ${accent} accent`,
      ).toEqual([]);
    }
  }
});

test("website mode follows the Settings theme and is dark by default", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  const shell = page.locator(".website-shell");
  await expect(shell).toHaveCSS("background-color", background.dark);

  // Change the theme in the desktop Settings app, then come back.
  await page
    .locator("#website header")
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Settings" })
    .click();
  await page
    .locator('#window-settings [data-setting="theme"]')
    .selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");
  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await expect(shell).toHaveCSS("background-color", background.light);

  await page.reload();
  await expect(shell).toHaveCSS("background-color", background.light);
});

test("shows years, companies, tenure and uptime computed from experiences.json", async ({
  page,
}) => {
  const website = await openWebsite(page);

  // June 2019 is the earliest start, so this is at least 7 from 2026 on.
  expect(expectedYears).toBeGreaterThanOrEqual(7);
  await expect(website.locator(".ws-lede")).toContainText(
    `${expectedYears}+ years of experience`,
  );
  await expect(website.locator("[data-experience-years] dd")).toContainText(
    `${expectedYears}+ years`,
  );
  await expect(website.locator("[data-experience-years] dd")).toContainText(
    `${expectedCompanies} companies since ${Math.floor(earliest / 12)}`,
  );

  const summary = website.locator("[data-uptime-summary]");
  await expect(summary).toContainText(`${expectedMonths} months`);
  await expect(summary).toContainText(`${expectedCompanies} companies`);
  await expect(website.locator(".ws-seg i")).toHaveCount(expectedMonths);
  await expect(website.locator(".ws-seg--gap i")).toHaveCount(gapMonths);

  const [currentStart] = experiences[0].period.split(" - ").map(toIndex);
  await expect(website.locator("[data-tenure]").first()).toHaveText(
    tenure(thisMonth - currentStart + 1),
  );
  await expect(website.locator(".ws-release")).toHaveCount(experiences.length);

  // The first four bullets show, the rest wait in "+N more".
  for (const [index, experience] of experiences.entries()) {
    const release = website.locator(".ws-release").nth(index);
    const tags = release.locator(".ws-rel-body > .ws-changes .ws-tag");
    await expect(tags).toHaveText(
      experience.details.slice(0, 4).map((detail) => detail.split(" ")[0]),
    );
    const more = release.locator("details.ws-more");
    if (experience.details.length > 4) {
      await expect(more.locator("summary")).toHaveText(
        new RegExp(`^\\+${experience.details.length - 4} more`),
        { useInnerText: true },
      );
      await expect(more).not.toHaveAttribute("open");
    } else {
      await expect(more).toHaveCount(0);
    }
  }

  // After the verb tag, each line reads as a sentence: capitalised, and the
  // whole bullet when the rest would start mid-phrase. The data is unchanged.
  const lines = website.locator(".ws-changes li");
  const details = experiences.flatMap((experience) => experience.details);
  await expect(lines).toHaveCount(details.length);
  for (const [index, detail] of details.entries()) {
    const text = (await lines.nth(index).locator("span").nth(1).textContent())!;
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
    expect(detail.toLowerCase()).toContain(text.toLowerCase());
  }
  const deployed = details.find((detail) => detail.startsWith("Deployed and"));
  if (deployed) {
    await expect(website.locator(".ws-changes li", { hasText: deployed })).toHaveCount(1);
  }

  const zilo = website.locator(".ws-release").first().locator("details.ws-more");
  await zilo.locator("summary").click();
  await expect(zilo.locator("summary")).toHaveText(/^Show fewer/, {
    useInnerText: true,
  });

  const certified = website.locator(".ws-sc-list div", { hasText: "Certified" });
  await expect(certified).toContainText(`${certifications.length} earned`);
  await expect(
    website.locator(".ws-sc-list div", { hasText: "Studied" }),
  ).toContainText("B.Sc. Computer Science");
});

test("the Work app shows the computed experience metrics", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Work" })
    .click();
  await expect(page.locator("#window-work .work-metric-value")).toHaveText([
    `${expectedYears}+`,
    String(expectedCompanies),
  ]);
});

test("the desktop bridge in the hero switches to desktop mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWebsite(page);

  const bridge = page
    .locator(".ws-bridge")
    .getByRole("button", { name: "Open desktop mode" });
  const box = await bridge.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(900);

  await bridge.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-mode",
    "desktop",
  );
  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#website")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("pepodev.viewMode")))
    .toBe("desktop");
  await expect(
    page
      .locator("#taskbar")
      .getByRole("button", { name: "Switch to website mode" }),
  ).toBeFocused();

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await page
    .locator(".ws-desk-card")
    .getByRole("button", { name: "Launch desktop mode" })
    .click();
  await expect(page.locator("#desktop")).toBeVisible();
});

for (const viewport of [
  { width: 961, height: 800 },
  { width: 1024, height: 768 },
  { width: 1181, height: 800 },
]) {
  test(`the hero bridge keeps its title clear of the button at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openWebsite(page);
    const title = await page.locator(".ws-bridge-title").boundingBox();
    const button = await page.locator(".ws-btn--bridge").boundingBox();
    expect(title && button).toBeTruthy();
    const overlaps =
      title!.x + title!.width > button!.x &&
      button!.x + button!.width > title!.x &&
      title!.y + title!.height > button!.y &&
      button!.y + button!.height > title!.y;
    expect(overlaps).toBe(false);
    // Never one word per line: at most two lines of 14.5px text.
    expect(title!.height).toBeLessThanOrEqual(42);
    expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height);
  });
}

test("the desktop teaser follows the Settings accent", async ({ page }) => {
  await openWebsite(page, { theme: "dark", accent: "purple" });
  await expect(page.locator(".ws-btn--desk")).toHaveCSS(
    "background-color",
    "rgb(191, 90, 242)",
  );
});

test("archived projects start collapsed and active ones show as cards", async ({
  page,
}) => {
  const website = await openWebsite(page);
  const active = projects.filter(({ archived }) => !archived);
  const archived = projects.filter(({ archived }) => archived);

  await expect(website.locator(".ws-svc")).toHaveCount(active.length);
  await expect(website.locator(".ws-svc", { hasText: "★ 0" })).toHaveCount(0);

  const archive = website.locator("details[data-archive]");
  await expect(archive).not.toHaveAttribute("open");
  await expect(archive.locator("tbody tr").first()).toBeHidden();

  await archive.locator("summary").click();
  await expect(archive).toHaveAttribute("open", "");
  await expect(archive.locator("tbody tr")).toHaveCount(archived.length);
  await expect(archive.locator("tbody tr").first()).toBeVisible();
  await expect(archive.locator(".ws-ggj")).toHaveCount(4);
  await expect(archive.locator("tbody", { hasText: "★ 0" })).toHaveCount(0);
});

test("the Bangkok clock is pre-rendered and kept current", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/")).text();
  const rendered = html.match(/data-bkk-time[^>]*>(\d{2}:\d{2})</);
  expect(rendered?.[1]).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);

  const bangkokNow = () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  // Read the minute before the page loads and after the clock is read, so
  // a minute that rolls over in between still matches one of them.
  const before = bangkokNow();
  const website = await openWebsite(page);
  const shown = await website.locator(".ws-sc-time time").textContent();
  expect([before, bangkokNow()]).toContain(shown);
  await expect(website.locator(".ws-sc-time")).toContainText("ICT");
});

test("website mode keeps a skip link, visible focus and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const website = await openWebsite(page);

  await page.keyboard.press("Tab");
  const skip = website.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Tab");
  const brand = website.getByRole("link", { name: "pepo.dev, back to top" });
  await expect(brand).toBeFocused();
  await expect(brand).not.toHaveCSS("outline-style", "none");

  // Rows that fill a rounded panel draw their ring inside it.
  for (const selector of [
    "details[data-archive] > summary",
    ".ws-certs li:last-child a",
    ".ws-channels li:last-child a",
    ".ws-elsewhere li:first-child a",
  ]) {
    const target = website.locator(selector);
    await target.focus();
    await expect(target).toBeFocused();
    expect(await focusRingProblems(page), selector).toEqual([]);
  }

  const animation = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector("#website .ws-pulse")!,
        "::after",
      ).animationName,
  );
  expect(animation).toBe("none");

  for (const name of ["RSS", "Report an issue"]) {
    await expect(
      website.locator("footer").getByRole("link", { name }),
    ).toBeVisible();
  }
  for (const href of [
    "https://github.com/pepodev",
    "https://linkedin.com/in/pepodev",
    "https://fb.com/pepodev",
    "https://blog.pepo.dev",
    "https://garden.pepo.dev",
    "mailto:pepo@pepo.dev",
  ]) {
    await expect(website.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
});

test("the website header keeps two rows and all section links on small phones", async ({
  page,
}) => {
  await openWebsite(page);
  const header = page.locator("#website header").first();
  const nav = page.getByRole("navigation", { name: "Portfolio sections" });
  const modeSwitch = header.getByRole("button", {
    name: "Switch to desktop mode",
  });
  for (const width of [320, 340, 345, 350, 356, 360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    const box = await header.boundingBox();
    expect(box!.height, `${width}px header`).toBeLessThanOrEqual(100);
    expect(
      await nav.evaluate((element) => element.scrollWidth - element.clientWidth),
      `${width}px nav`,
    ).toBeLessThanOrEqual(0);
    await expect(nav.getByRole("link", { name: "Contact" })).toBeInViewport({
      ratio: 1,
    });
    await expect(modeSwitch).toBeVisible();
  }
  // The label gives way to the icon only on the narrowest screens.
  await page.setViewportSize({ width: 340, height: 780 });
  await expect(modeSwitch.locator("[data-site-mode-label]")).toBeHidden();
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(modeSwitch.locator("[data-site-mode-label]")).toBeVisible();

  // Section links keep a whole focus ring inside the scroller.
  await page.keyboard.press("Tab");
  const overview = nav.getByRole("link", { name: "Overview" });
  await overview.focus();
  expect(await focusRingProblems(page)).toEqual([]);
});

test("the header stops sticking on short screens such as 400% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 256 });
  const website = await openWebsite(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
  await expect(website.locator("header").first()).not.toBeInViewport();
});

test("the uptime chart stays visible in forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  const website = await openWebsite(page);
  const colors = await website.locator(".ws-uptime").evaluate((figure) =>
    [".ws-seg i", ".ws-seg--gap i", ".ws-key--on", ".ws-key--gap"].map(
      (selector) =>
        getComputedStyle(figure.querySelector(selector)!).backgroundColor,
    ),
  );
  const canvas = await website.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  for (const color of colors) expect(color).not.toBe(canvas);
  expect(colors[0]).not.toBe(colors[1]);
});

test("the website header and section nav stay on screen while scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const website = await openWebsite(page);
  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(3000);

  const header = website.locator("header").first();
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(0);
  await expect(
    website
      .getByRole("navigation", { name: "Portfolio sections" })
      .getByRole("link", { name: "Contact", exact: true }),
  ).toBeInViewport();
});
