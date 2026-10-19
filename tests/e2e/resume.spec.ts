import { expect, test, type Download, type Page } from "@playwright/test";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};

async function readPdf(download: Download) {
  let pdf = "";
  for await (const chunk of await download.createReadStream()) {
    pdf += chunk.toString("latin1");
  }
  return pdf;
}

async function downloadResumePdf(page: Page) {
  await page.goto("/resume/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  return readPdf(await downloadPromise);
}

async function openCertifications(page: Page) {
  await page.goto("/");
  // Returning visitor, so the first-visit Welcome window cannot cover Certs.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("pepodev.hasVisited", "true");
  });
  await page.reload();
  await page
    .locator("#desktop-icons")
    .getByRole("button", { name: "Certs" })
    .click();
  const window = page.locator("#window-certs");
  await expect(window).toBeVisible();
  return window;
}

test("resume page renders the resume as HTML without auto-downloading", async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );

  await page.goto("/resume");

  await expect(page).toHaveTitle("Resume - Thiwanon Chomcharoen (PePo)");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https:\/\/pepo\.dev\/resume\/?$/,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Site Reliability Engineer/,
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Thiwanon Chomcharoen (PePo)",
    }),
  ).toBeVisible();
  for (const name of [
    "Experience",
    "Technical Skills",
    "Education",
    "Certifications",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.locator(".resume-entries article")).toHaveCount(
    experiences.length,
  );
  await expect(
    page.getByRole("heading", { level: 3, name: experiences[0].role }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "PePoDev", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("button", { name: "Download PDF" }),
  ).toBeVisible();

  // The old page downloaded on load, then closed or left after about 1s
  await page.waitForTimeout(1500);
  expect(downloads).toEqual([]);
  await expect(page).toHaveURL(/\/resume\/?$/);
});

test("resume skip link keeps dark text on the accent", async ({ page }) => {
  await page.goto("/resume");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  // --bg-primary text on --accent-primary, about 8.4:1 in the default theme.
  await expect(skip).toHaveCSS("color", "rgb(28, 28, 30)");
  await expect(skip).toHaveCSS("background-color", "rgb(48, 209, 88)");
});

test("printing the resume hides the skip link", async ({ page }) => {
  await page.goto("/resume/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".resume-skip-link")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeInViewport();
});

test("resume lists certifications as earned history in HTML and PDF", async ({
  page,
}) => {
  await page.goto("/resume");

  const items = page.locator(".resume-certifications li");
  await expect(items).toHaveCount(certifications.length);
  for (const [index, certification] of certifications.entries()) {
    const year = certification.issueDate.slice(0, 4);
    await expect(items.nth(index)).toContainText(
      `${certification.name}, earned ${year}`,
    );
    await expect(
      items.nth(index).getByRole("link", { name: certification.name }),
    ).toHaveAttribute("href", certification.credlyUrl);
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pepo-resume.pdf");
  await expect(page.getByRole("status")).toHaveText("Download started.");

  const pdf = await readPdf(download);
  expect(pdf.startsWith("%PDF-1.4")).toBe(true);
  expect(pdf).toContain("(CERTIFICATIONS) Tj");
  for (const certification of certifications) {
    const year = certification.issueDate.slice(0, 4);
    const line = `${certification.name}, earned ${year}`.replace(
      /[()]/g,
      "\\$&",
    );
    expect(pdf).toContain(`(${line}) Tj`);
  }
});

test("certifications wallet keeps active and expiring-soon badges for valid certifications", async ({
  page,
}) => {
  // Terraform Associate expires 2024-04-11; the others are still valid
  await page.clock.install({ time: new Date("2024-02-15T12:00:00Z") });
  const certs = await openCertifications(page);

  const terraform = certs.locator(".cert-card", {
    hasText: "Terraform Associate",
  });
  await expect(terraform).toHaveAttribute("data-status", "expiring");
  await expect(terraform.locator(".cert-status")).toHaveText("Expiring Soon");
  await expect(terraform.locator(".cert-expiry")).toHaveText(
    "Expires April 2024",
  );
  await expect(terraform.locator(".cert-earned")).toHaveText(
    "Earned April 2022",
  );

  const cka = certs.locator(".cert-card", { hasText: "CKA" });
  await expect(cka).toHaveAttribute("data-status", "active");
  await expect(cka.locator(".cert-status")).toHaveText("Active");
  await expect(cka.locator(".cert-expiry")).toHaveText("Valid until May 2025");

  const statuses = await certs
    .locator(".cert-card")
    .evaluateAll((cards) => cards.map((card) => card.dataset.status));
  expect(statuses).toEqual([
    "active",
    "active",
    "active",
    "active",
    "active",
    "expiring",
  ]);
});

test("certifications wallet refreshes badges hourly and shows expiry quietly", async ({
  page,
}) => {
  // Google Cloud Digital Leader expires at 2026-09-01T00:00:00Z
  await page.clock.install({ time: new Date("2026-08-31T23:30:00Z") });
  const certs = await openCertifications(page);
  const digitalLeader = certs.locator(".cert-card", {
    hasText: "Google Cloud Digital Leader",
  });

  await expect(digitalLeader.locator(".cert-status")).toHaveText(
    "Expiring Soon",
  );
  await expect(digitalLeader.locator(".cert-expiry")).toHaveText(
    "Expires September 2026",
  );

  await page.clock.fastForward("01:00:00");

  await expect(digitalLeader).toHaveAttribute("data-status", "expired");
  await expect(digitalLeader.locator(".cert-status")).toBeHidden();
  await expect(digitalLeader.locator(".cert-expiry")).toHaveText(
    "Expired September 2026",
  );
  await expect(digitalLeader.locator(".cert-earned")).toHaveText(
    "Earned May 2023",
  );
  await expect(certs.locator(".cert-status:visible")).toHaveCount(0);
});

// Advance widths (1/1000 em) of ASCII 32-126 in Helvetica (Adobe AFM).
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

test("the resume PDF has metadata, clickable links, and a flush date column", async ({
  page,
}) => {
  const pdf = await downloadResumePdf(page);

  expect(pdf).toContain("/Title (Thiwanon Chomcharoen \\(PePo\\) - Resume)");
  expect(pdf).toContain("/Author (Thiwanon Chomcharoen \\(PePo\\))");
  expect(pdf).toMatch(/\/Info \d+ 0 R/);
  for (const uri of [
    "mailto:pepo@pepo.dev",
    "https://github.com/pepodev",
    "https://linkedin.com/in/pepodev",
    ...certifications.map((c) => c.credlyUrl),
  ]) {
    expect(pdf).toContain(`/S /URI /URI (${uri})`);
  }
  expect(pdf).toMatch(/\/Annots \[/);

  // Each period's right edge sits on the 549pt right margin (595 - 46).
  for (const { period } of experiences) {
    const match = pdf.match(
      new RegExp(`([\\d.]+) [\\d.]+ Td\\n\\(${period}\\) Tj`),
    );
    expect(match, period).not.toBeNull();
    const width = [...period].reduce(
      (sum, c) => sum + HELVETICA[c.charCodeAt(0) - 32],
      0,
    );
    expect(Number(match![1]) + (width * 9.3) / 1000).toBeCloseTo(549, 1);
  }
});

test("resume PDF section headings stay on the page with their first lines", async ({
  page,
}) => {
  const pdf = await downloadResumePdf(page);
  // One content stream per page, in page order; each Tj draws one line.
  const pages = [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(
    ([, content]) =>
      [...content.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(([, text]) =>
        text.replace(/\\(.)/g, "$1"),
      ),
  );
  const headings = [
    "SUMMARY",
    "EXPERIENCE",
    "TECHNICAL SKILLS",
    "EDUCATION",
    "CERTIFICATIONS",
  ];

  expect(pages.flat()).toEqual(expect.arrayContaining(headings));
  for (const lines of pages) {
    expect(headings).not.toContain(lines.at(-1));
  }
  const certificationsPage = pages.find((lines) =>
    lines.includes("CERTIFICATIONS"),
  );
  const first = certifications[0];
  expect(certificationsPage).toContain(
    `${first.name}, earned ${first.issueDate.slice(0, 4)}`,
  );
});
