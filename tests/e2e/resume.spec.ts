import { expect, test, type Page } from "@playwright/test";
import certifications from "../../src/data/certifications.json" with {
  type: "json",
};
import experiences from "../../src/data/experiences.json" with {
  type: "json",
};

async function openCertifications(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
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

  let pdf = "";
  for await (const chunk of await download.createReadStream()) {
    pdf += chunk.toString("latin1");
  }
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
  // Terraform Associate expires 2024-04-10; the others are still valid
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
  // Google Cloud Digital Leader expires at 2026-08-31T00:00:00Z
  await page.clock.install({ time: new Date("2026-08-30T23:30:00Z") });
  const certs = await openCertifications(page);
  const digitalLeader = certs.locator(".cert-card", {
    hasText: "Google Cloud Digital Leader",
  });

  await expect(digitalLeader.locator(".cert-status")).toHaveText(
    "Expiring Soon",
  );
  await expect(digitalLeader.locator(".cert-expiry")).toHaveText(
    "Expires August 2026",
  );

  await page.clock.fastForward("01:00:00");

  await expect(digitalLeader).toHaveAttribute("data-status", "expired");
  await expect(digitalLeader.locator(".cert-status")).toBeHidden();
  await expect(digitalLeader.locator(".cert-expiry")).toHaveText(
    "Expired August 2026",
  );
  await expect(digitalLeader.locator(".cert-earned")).toHaveText(
    "Earned August 2024",
  );
  await expect(certs.locator(".cert-status:visible")).toHaveCount(0);
});
