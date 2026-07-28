# Desktop and Website Mode Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an instant, persistent switch between the existing interactive desktop and a responsive conventional portfolio on `/`.

**Architecture:** Astro statically renders both sibling shells. A head-safe controller selects `desktop` or `website` before paint, synchronizes visibility and accessibility state, and persists explicit selections in `pepodev.viewMode`. The normal portfolio reads the current JSON and blog collection directly; desktop-only effects and keyboard handlers suspend while their shell is inactive.

**Tech Stack:** Astro 6.3.1 static output, Astro components, TypeScript browser scripts, CSS, Playwright 1.60.

---

## File Structure

- Create `src/components/ModeSwitch.astro`: reusable accessible switch markup only.
- Create `src/components/SiteModeController.astro`: pre-paint initialization and the single runtime state controller.
- Create `src/components/WebsiteMode.astro`: server-rendered normal portfolio shell and data composition.
- Create `src/styles/website-mode.css`: isolated mode visibility and normal-portfolio styles.
- Modify `src/pages/index.astro`: compose both shells and suspend/resume the particle canvas.
- Modify `src/components/desktop/Taskbar.astro`: place the desktop-side switch.
- Modify `src/components/desktop/Window.astro`: keep hidden desktop windows inactive without destroying their state.
- Modify `src/components/desktop/CommandPalette.astro`: disable desktop keyboard shortcuts in website mode.
- Modify `src/styles/taskbar.css`: style the taskbar switch across desktop, light theme, and mobile breakpoints.
- Modify `tests/e2e/desktop.spec.ts`: add mode, persistence, content, state-preservation, and animation coverage.
- Modify `README.md`: document the new shell, storage key, and deep-link rule while preserving the user's existing uncommitted edits.

Astro's current documentation confirms that static output remains the default,
`is:inline` is appropriate for the immediate local-storage initializer, and
standard component scripts are bundled. Reference:
`https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/directives-reference.mdx`.

### Task 1: Persistent mode controller and shell switching

**Files:**

- Create: `src/components/ModeSwitch.astro`
- Create: `src/components/SiteModeController.astro`
- Create: `src/components/WebsiteMode.astro`
- Create: `src/styles/website-mode.css`
- Modify: `src/components/desktop/Taskbar.astro`
- Modify: `src/styles/taskbar.css`
- Modify: `src/pages/index.astro`
- Test: `tests/e2e/desktop.spec.ts`

- [ ] **Step 1: Write the failing switching, persistence, fallback, and deep-link tests**

Insert these tests after `renders the desktop and all launchers`:

```ts
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
```

Rename the existing blog-query test to
`opens a blog article in desktop mode from the blog query parameter`. Before
its `const blogWindow` line, replace the navigation with:

```ts
  await page.evaluate(() => {
    localStorage.setItem("pepodev.viewMode", "website");
  });
  await page.goto("/?blog=aws-local-zone-bangkok-launch");

  await expect(page.locator("#desktop")).toBeVisible();
  await expect(page.locator("#website")).toBeAttached();
  await expect(page.locator("#website")).toBeHidden();
```

Add this assertion before that test closes:

```ts
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("pepodev.viewMode")),
    )
    .toBe("website");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "switches modes|saved mode|blog query parameter"
```

Expected: FAIL because `#website` and the mode-switch buttons do not exist.
Confirm that the failure is an assertion failure, not a server or syntax error.

- [ ] **Step 3: Create the reusable mode-switch markup**

Create `src/components/ModeSwitch.astro`:

```astro
---
interface Props {
  id?: string;
  variant: "taskbar" | "website";
}

const { id, variant } = Astro.props;
---

<button
  id={id}
  class:list={["site-mode-switch", `site-mode-switch--${variant}`]}
  type="button"
  data-site-mode-toggle
  aria-label="Switch to website mode"
  aria-pressed="false"
  title="Switch to website mode"
>
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect
      x="3"
      y="4"
      width="18"
      height="13"
      rx="2"
      stroke="currentColor"
      stroke-width="1.8"
    />
    <path
      d="M8 21h8M12 17v4M7 8h10M7 11h6"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
  </svg>
  {
    variant === "website" && (
      <span data-site-mode-label>Website mode</span>
    )
  }
</button>
```

- [ ] **Step 4: Create the pre-paint initializer and runtime controller**

Create `src/components/SiteModeController.astro`:

```astro
<script is:inline>
  (() => {
    const storageKey = "pepodev.viewMode";
    let mode = "desktop";

    try {
      const storedMode = localStorage.getItem(storageKey);
      if (storedMode === "desktop" || storedMode === "website") {
        mode = storedMode;
      }
    } catch {
      mode = "desktop";
    }

    const blogSlug = new URLSearchParams(window.location.search)
      .get("blog")
      ?.trim();
    if (blogSlug) mode = "desktop";

    document.documentElement.dataset.siteMode = mode;
  })();
</script>

<script>
  type SiteMode = "desktop" | "website";

  const storageKey = "pepodev.viewMode";

  function normalizeMode(value: string | undefined): SiteMode {
    return value === "website" ? "website" : "desktop";
  }

  function initializeSiteMode() {
    const root = document.documentElement;
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>("[data-site-mode-panel]"),
    );
    const switches = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-site-mode-toggle]"),
    );

    function applyMode(mode: SiteMode, persist: boolean) {
      root.dataset.siteMode = mode;

      panels.forEach((panel) => {
        const active = panel.dataset.siteModePanel === mode;
        panel.hidden = !active;
        panel.toggleAttribute("inert", !active);
        panel.setAttribute("aria-hidden", String(!active));
      });

      const nextMode: SiteMode = mode === "desktop" ? "website" : "desktop";
      const actionLabel = `Switch to ${nextMode} mode`;
      const visibleLabel =
        nextMode === "website" ? "Website mode" : "Desktop mode";

      switches.forEach((button) => {
        button.setAttribute("aria-label", actionLabel);
        button.setAttribute("title", actionLabel);
        button.setAttribute("aria-pressed", String(mode === "website"));
        const label = button.querySelector<HTMLElement>(
          "[data-site-mode-label]",
        );
        if (label) label.textContent = visibleLabel;
      });

      if (persist) {
        try {
          localStorage.setItem(storageKey, mode);
        } catch {
          // The selected mode still applies for this page.
        }
      }

      document.dispatchEvent(
        new CustomEvent("site:mode-change", { detail: { mode } }),
      );
    }

    switches.forEach((button) => {
      button.addEventListener("click", () => {
        const currentMode = normalizeMode(root.dataset.siteMode);
        const nextMode = currentMode === "desktop" ? "website" : "desktop";
        applyMode(nextMode, true);
      });
    });

    applyMode(normalizeMode(root.dataset.siteMode), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSiteMode, {
      once: true,
    });
  } else {
    initializeSiteMode();
  }
</script>
```

- [ ] **Step 5: Create the minimal server-rendered website shell**

Create `src/components/WebsiteMode.astro`:

```astro
---
import ModeSwitch from "@components/ModeSwitch.astro";
import "@styles/website-mode.css";
---

<div
  id="website"
  class="website-shell"
  data-site-mode-panel="website"
  aria-hidden="true"
>
  <a class="website-skip-link" href="#website-main">Skip to content</a>
  <header class="website-header">
    <div class="website-header-inner">
      <a class="website-brand" href="#website-main">PePoDev</a>
      <ModeSwitch variant="website" />
    </div>
  </header>
  <main id="website-main" class="website-main"></main>
</div>
```

Create `src/styles/website-mode.css` with the mode rules and minimal shell
styles:

```css
html[data-site-mode="desktop"] #website,
html[data-site-mode="website"] #desktop,
[data-site-mode-panel][hidden] {
  display: none !important;
}

html[data-site-mode="website"],
html[data-site-mode="website"] body {
  height: auto;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.website-shell {
  min-height: 100dvh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.website-skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 10001;
  transform: translateY(-160%);
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: var(--bg-primary);
}

.website-skip-link:focus {
  transform: translateY(0);
}

.website-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  backdrop-filter: blur(20px);
}

.website-header-inner {
  width: min(calc(100% - 32px), 1120px);
  min-height: 64px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.website-brand {
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: none;
}

.site-mode-switch--website {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
}

.site-mode-switch--website svg {
  width: 18px;
  height: 18px;
}

.website-main {
  min-height: calc(100dvh - 64px);
}
```

- [ ] **Step 6: Add the taskbar switch**

Add this frontmatter to the top of `src/components/desktop/Taskbar.astro`:

```astro
---
import ModeSwitch from "@components/ModeSwitch.astro";
---
```

Inside `#taskbar-tray`, before `#taskbar-audio-status`, insert:

```astro
<ModeSwitch id="taskbar-site-mode" variant="taskbar" />
```

In `src/styles/taskbar.css`, add `#taskbar-site-mode` beside the existing start
and command-palette selectors:

```css
#taskbar-start,
#taskbar-command-palette,
#taskbar-site-mode {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  background: transparent;
  color: var(--text-secondary);
}

#taskbar-start:hover,
#taskbar-command-palette:hover,
#taskbar-site-mode:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

#taskbar-start svg,
#taskbar-command-palette svg,
#taskbar-site-mode svg {
  width: 20px;
  height: 20px;
}
```

Also include `#taskbar-site-mode:hover` in the light-theme hover selector and
`#taskbar-site-mode` in the `@media (max-width: 768px)` 44-pixel control
selector.

- [ ] **Step 7: Compose both shells on the home page**

Add these imports to `src/pages/index.astro`:

```astro
import SiteModeController from "@components/SiteModeController.astro";
import WebsiteMode from "@components/WebsiteMode.astro";
```

Change the root element and head to:

```astro
<html lang="en" data-site-mode="desktop">
  <head>
    <BaseHead title={SITE_TITLE} description={SITE_DESCRIPTION} />
    <SiteModeController />
  </head>
```

Change the desktop root to:

```astro
<div
  id="desktop"
  data-site-mode-panel="desktop"
  aria-hidden="false"
>
```

Render the website shell immediately after the closing `#desktop` element:

```astro
<WebsiteMode />
```

- [ ] **Step 8: Run the focused tests and verify GREEN**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "switches modes|saved mode|blog query parameter"
```

Expected: 3 tests pass. Confirm the blog deep link opens in desktop mode while
`pepodev.viewMode` remains `website`.

- [ ] **Step 9: Commit the first vertical slice**

Run:

```powershell
git add src/components/ModeSwitch.astro src/components/SiteModeController.astro src/components/WebsiteMode.astro src/components/desktop/Taskbar.astro src/styles/website-mode.css src/styles/taskbar.css src/pages/index.astro tests/e2e/desktop.spec.ts
git diff --cached --check
git commit -m "feat: add persistent portfolio mode switching"
```

Do not stage `README.md`.

### Task 2: Data-driven normal website portfolio

**Files:**

- Modify: `src/components/WebsiteMode.astro`
- Modify: `src/styles/website-mode.css`
- Test: `tests/e2e/desktop.spec.ts`

- [ ] **Step 1: Write the failing website-content test**

Insert after the mode-switching test:

```ts
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
    await expect(navigation.getByRole("link", { name: link.name })).toHaveAttribute(
      "href",
      link.href,
    );
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
```

- [ ] **Step 2: Run the content test and verify RED**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "current portfolio content"
```

Expected: FAIL because the minimal shell has no portfolio headings or
navigation.

- [ ] **Step 3: Replace the minimal shell with the current data-driven portfolio**

Replace `src/components/WebsiteMode.astro` with:

```astro
---
import ContactIcon from "@components/apps/ContactIcon.astro";
import FormattedDate from "@components/FormattedDate.astro";
import ModeSwitch from "@components/ModeSwitch.astro";
import { SITE_DESCRIPTION } from "@/consts";
import experiences from "@data/experiences.json";
import projects from "@data/projects.json";
import skills from "@data/skills.json";
import socialLinks from "@data/social-links.json";
import workMetrics from "@data/work-metrics.json";
import "@styles/website-mode.css";
import { getCollection } from "astro:content";

const latestPosts = (await getCollection("blog"))
  .filter(({ data }) => data.publish !== false)
  .sort(
    (a, b) =>
      (b.data.pubDate?.valueOf() ?? 0) - (a.data.pubDate?.valueOf() ?? 0),
  )
  .slice(0, 3);
const featuredProjects = projects.filter(({ archived }) => !archived);
const socialIcons = new Set(["github", "linkedin", "email", "blog", "garden"]);
const primarySocials = socialLinks.filter(({ icon }) => socialIcons.has(icon));
const emailHref =
  socialLinks.find(({ icon }) => icon === "email")?.href ??
  "mailto:pepo@pepo.dev";
const resumeHref =
  socialLinks.find(({ icon }) => icon === "resume")?.href ?? "/resume";
const currentYear = new Date().getFullYear();
const getPostTitle = (post: (typeof latestPosts)[number]) =>
  post.data.title ??
  post.id.split("/").at(-1)?.replace(/[-_]+/g, " ") ??
  post.id;
---

<div
  id="website"
  class="website-shell"
  data-site-mode-panel="website"
  aria-hidden="true"
>
  <a class="website-skip-link" href="#website-main">Skip to content</a>

  <header class="website-header">
    <div class="website-header-inner">
      <a class="website-brand" href="#website-hero">PePoDev</a>
      <nav class="website-nav" aria-label="Portfolio sections">
        <a href="#website-about">About</a>
        {experiences.length > 0 && (
          <a href="#website-experience">Experience</a>
        )}
        {featuredProjects.length > 0 && (
          <a href="#website-projects">Projects</a>
        )}
        {latestPosts.length > 0 && <a href="#website-writing">Writing</a>}
        <a href="#website-contact">Contact</a>
      </nav>
      <div class="website-header-actions">
        <a class="website-resume-link" href={resumeHref}>Resume</a>
        <ModeSwitch variant="website" />
      </div>
    </div>
  </header>

  <main id="website-main" class="website-main">
    <section
      id="website-hero"
      class="website-section website-hero"
      aria-labelledby="website-title"
    >
      <div class="website-hero-copy">
        <p class="website-eyebrow">
          Site Reliability Engineer · Bangkok, Thailand
        </p>
        <h1 id="website-title">Thiwanon Chomcharoen (PePoDev)</h1>
        <p class="website-lede">{SITE_DESCRIPTION}</p>
        <div class="website-actions">
          <a class="website-button website-button--primary" href="#website-projects">
            Explore projects
          </a>
          <a class="website-button" href={emailHref}>Start a conversation</a>
        </div>
        <p class="website-status">
          <span aria-hidden="true"></span>
          Available for opportunities
        </p>
      </div>
      {workMetrics.length > 0 && (
        <div class="website-metrics" aria-label="Career highlights">
          {workMetrics.map((metric) => (
            <div class="website-metric">
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>

    <section
      id="website-about"
      class="website-section"
      aria-labelledby="website-about-title"
    >
      <div class="website-section-heading">
        <p class="website-eyebrow">About</p>
        <h2 id="website-about-title">Reliable systems, practical outcomes</h2>
      </div>
      <div class="website-about-grid">
        <div class="website-copy">
          <p>
            I design and operate cloud platforms with Kubernetes, Terraform,
            observability, and open-source tooling. My work focuses on making
            infrastructure dependable, understandable, and efficient.
          </p>
          <p>
            I also build tools, games, and experiments that turn operational
            lessons into useful experiences for other engineers.
          </p>
        </div>
        <ul class="website-skills" aria-label="Core expertise">
          {skills.map((skill) => <li>{skill.name}</li>)}
        </ul>
      </div>
    </section>

    {experiences.length > 0 && (
      <section
        id="website-experience"
        class="website-section"
        aria-labelledby="website-experience-title"
      >
        <div class="website-section-heading">
          <p class="website-eyebrow">Work</p>
          <h2 id="website-experience-title">Experience</h2>
        </div>
        <div class="website-timeline">
          {experiences.map((experience) => (
            <article class="website-experience-card">
              <div class="website-experience-meta">
                <span>{experience.period}</span>
              </div>
              <div>
                <h3>{experience.role}</h3>
                <p class="website-company">{experience.company}</p>
                <ul>
                  {experience.details.map((detail) => <li>{detail}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    )}

    {featuredProjects.length > 0 && (
      <section
        id="website-projects"
        class="website-section"
        aria-labelledby="website-projects-title"
      >
        <div class="website-section-heading">
          <p class="website-eyebrow">Build</p>
          <h2 id="website-projects-title">Selected projects</h2>
        </div>
        <div class="website-project-grid">
          {featuredProjects.map((project) => (
            <article class="website-project-card">
              <div class="website-project-heading">
                <h3>{project.name}</h3>
                <span aria-label={`${project.stars} GitHub stars`}>
                  ★ {project.stars}
                </span>
              </div>
              <p>{project.description}</p>
              <ul class="website-tags" aria-label={`${project.name} technologies`}>
                {project.tags.map((tag) => <li>{tag}</li>)}
              </ul>
              <div class="website-project-links">
                <a href={project.link} target="_blank" rel="noopener noreferrer">
                  Visit project
                </a>
                {project.github !== project.link && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    )}

    {latestPosts.length > 0 && (
      <section
        id="website-writing"
        class="website-section"
        aria-labelledby="website-writing-title"
      >
        <div class="website-section-heading website-section-heading--split">
          <div>
            <p class="website-eyebrow">Learn</p>
            <h2 id="website-writing-title">Latest writing</h2>
          </div>
          <a href="/blog/">View all articles</a>
        </div>
        <div class="website-writing-grid">
          {latestPosts.map((post) => (
            <article class="website-writing-card">
              {post.data.pubDate && <FormattedDate date={post.data.pubDate} />}
              <h3>
                <a href={`/blog/${post.id}/`}>{getPostTitle(post)}</a>
              </h3>
              <p>{post.data.description ?? post.data["sub-title"] ?? ""}</p>
              {post.data.tags && post.data.tags.length > 0 && (
                <ul class="website-tags" aria-label="Article tags">
                  {post.data.tags.slice(0, 3).map((tag) => <li>{tag}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    )}

    <section
      id="website-contact"
      class="website-section website-contact"
      aria-labelledby="website-contact-title"
    >
      <div>
        <p class="website-eyebrow">Connect</p>
        <h2 id="website-contact-title">Let's build something reliable</h2>
        <p>Reach out about infrastructure, SRE, open source, or collaboration.</p>
      </div>
      <div class="website-contact-actions">
        <a class="website-button website-button--primary" href={emailHref}>
          Email me
        </a>
        <a class="website-button" href={resumeHref} aria-label="View resume">
          View resume
        </a>
      </div>
      <ul class="website-socials" aria-label="Social links">
        {primarySocials.map((link) => (
          <li>
            <a
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http")
                ? "noopener noreferrer"
                : undefined}
            >
              <ContactIcon name={link.icon} />
              <span>{link.label.split(" - ")[0]}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  </main>

  <footer class="website-footer">
    <p>© {currentYear} PePoDev. Built as a static Astro site.</p>
  </footer>
</div>
```

- [ ] **Step 4: Extend the isolated website stylesheet**

Keep Task 1's mode rules and replace the remaining minimal declarations in
`src/styles/website-mode.css` with the following complete styles:

```css
html[data-site-mode="desktop"] #website,
html[data-site-mode="website"] #desktop,
[data-site-mode-panel][hidden] {
  display: none !important;
}

html[data-site-mode="website"],
html[data-site-mode="website"] body {
  height: auto;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.website-shell {
  --website-content-width: 1120px;
  min-height: 100dvh;
  background:
    radial-gradient(
      circle at 15% 0%,
      color-mix(in srgb, var(--accent-primary) 14%, transparent),
      transparent 32rem
    ),
    var(--bg-primary);
  color: var(--text-primary);
}

.website-shell a {
  color: inherit;
}

.website-skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 10001;
  transform: translateY(-160%);
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: var(--bg-primary);
  font-weight: 700;
  text-decoration: none;
}

.website-skip-link:focus {
  transform: translateY(0);
}

.website-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.website-header-inner {
  width: min(calc(100% - 32px), var(--website-content-width));
  min-height: 68px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.website-brand {
  flex: 0 0 auto;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 700;
  text-decoration: none;
}

.website-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex: 1;
}

.website-nav a,
.website-resume-link {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.website-nav a:hover,
.website-resume-link:hover {
  color: var(--text-primary);
}

.website-header-actions,
.website-actions,
.website-contact-actions,
.website-project-links {
  display: flex;
  align-items: center;
  gap: 10px;
}

.site-mode-switch--website {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
}

.site-mode-switch--website:hover {
  border-color: color-mix(
    in srgb,
    var(--accent-primary) 58%,
    var(--glass-border)
  );
}

.site-mode-switch--website svg {
  width: 18px;
  height: 18px;
}

.website-main {
  display: block;
}

.website-section {
  width: min(calc(100% - 32px), var(--website-content-width));
  margin-inline: auto;
  padding-block: clamp(64px, 9vw, 112px);
  border-bottom: 1px solid var(--glass-border);
  scroll-margin-top: 80px;
}

.website-section:last-child {
  border-bottom: 0;
}

.website-hero {
  min-height: calc(100dvh - 68px);
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.5fr);
  align-items: center;
  gap: clamp(40px, 8vw, 96px);
}

.website-eyebrow {
  margin-bottom: 14px;
  color: var(--accent-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.website-hero h1 {
  max-width: 820px;
  font-size: clamp(2.75rem, 7vw, 6.25rem);
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.website-lede {
  max-width: 720px;
  margin-top: 24px;
  color: var(--text-secondary);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.65;
}

.website-actions {
  margin-top: 30px;
  flex-wrap: wrap;
}

.website-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: none;
}

.website-button--primary {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: #07110a;
}

.website-status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 24px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.website-status span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 18px var(--accent-primary);
}

.website-metrics {
  display: grid;
  gap: 12px;
}

.website-metric {
  padding: 24px;
  border: 1px solid var(--glass-border);
  border-radius: var(--window-radius);
  background: var(--glass-bg);
}

.website-metric strong,
.website-metric span {
  display: block;
}

.website-metric strong {
  color: var(--accent-secondary);
  font-family: var(--font-mono);
  font-size: 2rem;
}

.website-metric span {
  margin-top: 5px;
  color: var(--text-secondary);
}

.website-section-heading {
  max-width: 760px;
  margin-bottom: 40px;
}

.website-section-heading--split {
  max-width: none;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
}

.website-section-heading--split > a {
  color: var(--accent-secondary);
  font-weight: 700;
  text-decoration: none;
}

.website-section h2 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.website-about-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr);
  gap: clamp(32px, 8vw, 96px);
}

.website-copy {
  display: grid;
  gap: 18px;
  color: var(--text-secondary);
  font-size: 1.05rem;
  line-height: 1.75;
}

.website-skills,
.website-tags,
.website-socials {
  list-style: none;
}

.website-skills {
  display: flex;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.website-skills li,
.website-tags li {
  padding: 7px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.website-timeline {
  display: grid;
}

.website-experience-card {
  display: grid;
  grid-template-columns: minmax(180px, 0.35fr) minmax(0, 1fr);
  gap: 32px;
  padding-block: 32px;
  border-top: 1px solid var(--glass-border);
}

.website-experience-meta,
.website-company,
.website-experience-card li {
  color: var(--text-secondary);
}

.website-experience-meta {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.website-experience-card h3 {
  font-size: 1.35rem;
}

.website-company {
  margin-top: 6px;
  font-weight: 700;
}

.website-experience-card ul {
  display: grid;
  gap: 9px;
  margin-top: 18px;
  padding-left: 20px;
  line-height: 1.55;
}

.website-project-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.website-project-card,
.website-writing-card {
  padding: 24px;
  border: 1px solid var(--glass-border);
  border-radius: var(--window-radius);
  background: var(--glass-bg);
  box-shadow: var(--window-shadow);
}

.website-project-card {
  display: flex;
  min-height: 260px;
  flex-direction: column;
}

.website-project-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.website-project-heading h3,
.website-writing-card h3 {
  font-size: 1.25rem;
}

.website-project-heading span,
.website-writing-card time {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.website-project-card > p,
.website-writing-card > p,
.website-contact > div > p:last-child {
  margin-top: 14px;
  color: var(--text-secondary);
  line-height: 1.65;
}

.website-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 18px;
}

.website-project-links {
  margin-top: auto;
  padding-top: 22px;
}

.website-project-links a,
.website-writing-card h3 a {
  color: var(--accent-secondary);
  font-weight: 700;
  text-decoration: none;
}

.website-writing-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.website-writing-card h3 {
  margin-top: 14px;
}

.website-contact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 32px;
}

.website-socials {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.website-socials a {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  color: var(--text-secondary);
  text-decoration: none;
}

.website-socials svg {
  width: 17px;
  height: 17px;
}

.website-footer {
  width: min(calc(100% - 32px), var(--website-content-width));
  margin-inline: auto;
  padding-block: 28px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.website-shell :is(a, button):focus-visible {
  outline: 3px solid var(--accent-secondary);
  outline-offset: 3px;
}

@media (hover: hover) {
  .website-project-card,
  .website-writing-card,
  .website-button,
  .site-mode-switch--website {
    transition:
      transform 0.18s ease,
      border-color 0.18s ease;
  }

  .website-project-card:hover,
  .website-writing-card:hover {
    transform: translateY(-3px);
    border-color: color-mix(
      in srgb,
      var(--accent-primary) 45%,
      var(--glass-border)
    );
  }
}

@media (max-width: 860px) {
  .website-header-inner {
    min-height: 64px;
    flex-wrap: wrap;
    gap: 10px 16px;
    padding-block: 10px;
  }

  .website-nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .website-hero,
  .website-about-grid,
  .website-contact {
    grid-template-columns: 1fr;
  }

  .website-hero {
    min-height: auto;
  }

  .website-project-grid,
  .website-writing-grid {
    grid-template-columns: 1fr;
  }

  .website-contact-actions {
    justify-self: start;
  }
}

@media (max-width: 620px) {
  .website-resume-link {
    display: none;
  }

  .site-mode-switch--website span {
    display: none;
  }

  .site-mode-switch--website {
    width: 42px;
    padding: 0;
    justify-content: center;
  }

  .website-section {
    padding-block: 60px;
  }

  .website-hero h1 {
    font-size: clamp(2.5rem, 14vw, 4rem);
  }

  .website-experience-card {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .website-section-heading--split {
    align-items: start;
    flex-direction: column;
  }

  .website-contact-actions,
  .website-actions {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  html[data-site-mode="website"],
  html[data-site-mode="website"] body {
    scroll-behavior: auto;
  }

  .website-shell *,
  .website-shell *::before,
  .website-shell *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run the focused content and switching tests**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "current portfolio content|switches modes"
```

Expected: 2 tests pass with no browser errors.

- [ ] **Step 6: Build to catch Astro/template/type errors**

Run:

```powershell
pnpm build
```

Expected: exit code 0 and generated `/index.html`, `/blog/`, and blog post
routes.

- [ ] **Step 7: Commit the normal portfolio**

Run:

```powershell
git add src/components/WebsiteMode.astro src/styles/website-mode.css tests/e2e/desktop.spec.ts
git diff --cached --check
git commit -m "feat: add normal website portfolio"
```

Do not stage `README.md`.

### Task 3: Suspend hidden desktop interactions and effects

**Files:**

- Modify: `src/pages/index.astro`
- Modify: `src/components/desktop/Window.astro`
- Modify: `src/components/desktop/CommandPalette.astro`
- Test: `tests/e2e/desktop.spec.ts`

- [ ] **Step 1: Write failing state, shortcut, tutorial, and animation tests**

Insert near the other mode tests:

```ts
test("preserves desktop window state and ignores desktop shortcuts in website mode", async ({
  page,
}) => {
  const aboutWindow = await openApp(page, "About Me", "me");

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.locator("#command-palette")).toHaveAttribute(
    "data-visible",
    "false",
  );

  await page
    .locator("#website")
    .locator("header")
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();

  await expect(aboutWindow).toBeVisible();
  await expect(aboutWindow).toHaveAttribute("aria-hidden", "false");
});

test("pauses the desktop animation loop in website mode and resumes it", async ({
  page,
}) => {
  await page.evaluate(() => {
    const probe = window as typeof window & { __modeRafCount?: number };
    const requestFrame = window.requestAnimationFrame.bind(window);
    probe.__modeRafCount = 0;
    window.requestAnimationFrame = (callback) => {
      probe.__modeRafCount = (probe.__modeRafCount ?? 0) + 1;
      return requestFrame(callback);
    };
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __modeRafCount?: number })
            .__modeRafCount ?? 0,
      ),
    )
    .toBeGreaterThan(2);

  await page
    .locator("#taskbar")
    .getByRole("button", { name: "Switch to website mode" })
    .click();
  await page.waitForTimeout(80);
  const pausedCount = await page.evaluate(
    () =>
      (window as typeof window & { __modeRafCount?: number }).__modeRafCount ??
      0,
  );
  await page.waitForTimeout(120);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __modeRafCount?: number })
            .__modeRafCount ?? 0,
      ),
    )
    .toBe(pausedCount);

  await page
    .locator("#website")
    .locator("header")
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __modeRafCount?: number })
            .__modeRafCount ?? 0,
      ),
    )
    .toBeGreaterThan(pausedCount);
});

test("defers the desktop command-palette hint while website mode is active", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("pepodev.viewMode", "website");
    localStorage.removeItem("pepodev.commandPaletteHintShown");
  });
  await page.reload();

  await page.waitForTimeout(3200);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("pepodev.commandPaletteHintShown"),
      ),
    )
    .toBeNull();

  await page
    .locator("#website")
    .locator("header")
    .getByRole("button", { name: "Switch to desktop mode" })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("pepodev.commandPaletteHintShown"),
        ),
      { timeout: 4_000 },
    )
    .not.toBeNull();
});
```

- [ ] **Step 2: Run these tests and verify RED**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "preserves desktop window|animation loop|defers the desktop"
```

Expected: failures show that Escape closes the hidden focused window, the
particle frame count keeps increasing, the palette opens, and the hint
timestamp is consumed while website mode is active.

- [ ] **Step 3: Gate window-manager globals and restore viewport state on return**

In `src/components/desktop/Window.astro`, add:

```js
function isDesktopSiteMode() {
  return document.documentElement.dataset.siteMode !== "website";
}
```

Guard the global open-app and Escape listeners:

```js
document.addEventListener("desktop:open-app", (event) => {
  if (!isDesktopSiteMode()) return;
  userOpenedWindow = true;
  openWindow(event.detail.appId);
});

document.addEventListener("keydown", (event) => {
  if (!isDesktopSiteMode()) return;
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (isEscapeOwnedByOverlay()) return;

  const activeWindow = getActiveWindow();
  if (!activeWindow) return;

  event.preventDefault();
  closeWindow(activeWindow.appId);
});
```

Start `syncViewportMode()` with:

```js
if (!isDesktopSiteMode()) return;
```

After the resize listener, add:

```js
document.addEventListener("site:mode-change", (event) => {
  if (event.detail?.mode === "desktop") {
    syncViewportMode();
    scheduleWelcomeWindow();
  }
});
```

Replace the existing first-visit block with:

```js
const firstVisitKey = "pepodev.hasVisited";
let hasVisited = localStorage.getItem(firstVisitKey) === "true";
let welcomeTimerId = 0;

function markVisited() {
  hasVisited = true;
  localStorage.setItem(firstVisitKey, "true");
}

function scheduleWelcomeWindow() {
  if (hasVisited || welcomeTimerId || !isDesktopSiteMode()) return;

  welcomeTimerId = window.setTimeout(() => {
    welcomeTimerId = 0;
    if (!isDesktopSiteMode()) return;

    if (userInteracted || userOpenedWindow || getActiveWindow()) {
      markVisited();
      return;
    }

    openWindow("welcome");
    markVisited();
  }, 1500);
}

scheduleWelcomeWindow();
```

- [ ] **Step 4: Gate the command palette**

In `src/components/desktop/CommandPalette.astro`, add:

```js
function isDesktopSiteMode() {
  return document.documentElement.dataset.siteMode !== "website";
}
```

Start `openPalette()` with:

```js
if (!isDesktopSiteMode()) return;
```

Add:

```js
document.addEventListener("site:mode-change", (event) => {
  if (event.detail?.mode === "website") closePalette();
});
```

Start the global keyboard listener with:

```js
if (!isDesktopSiteMode()) return;
```

- [ ] **Step 5: Make the particle canvas mode- and visibility-aware**

In the particle-network state in `src/pages/index.astro`, add:

```js
let siteMode =
  document.documentElement.dataset.siteMode === "website"
    ? "website"
    : "desktop";
```

Replace direct start/stop decisions with these functions:

```js
function shouldAnimate() {
  return (
    backgroundEffectEnabled &&
    siteMode === "desktop" &&
    !document.hidden
  );
}

function startAnimation() {
  if (animationId || !shouldAnimate()) return;
  draw();
}

function pauseAnimation() {
  if (!animationId) return;
  cancelAnimationFrame(animationId);
  animationId = 0;
}

function syncAnimation() {
  if (shouldAnimate()) {
    startAnimation();
  } else {
    pauseAnimation();
  }
}
```

Change the `desktop:preferences` listener to call `syncAnimation()` after it
updates the preference and attributes. Add:

```js
document.addEventListener("site:mode-change", (event) => {
  siteMode = event.detail?.mode === "website" ? "website" : "desktop";
  if (siteMode === "desktop") resize();
  syncAnimation();
});
document.addEventListener("visibilitychange", syncAnimation);
```

Replace the final initial `if (backgroundEffectEnabled)` block with:

```js
syncAnimation();
```

Do not clear particles, pulses, rings, time, or smoothed audio on pause.

- [ ] **Step 6: Defer the command-palette tutorial until desktop mode is active**

Replace the existing command-palette hint block in `src/pages/index.astro`
with:

```js
const hintKey = "pepodev.commandPaletteHintShown";
let hintTimerId = 0;

function scheduleCommandPaletteHint() {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const isDesktopMode =
    document.documentElement.dataset.siteMode === "desktop";
  if (isMobile || !isDesktopMode || hintTimerId) return;

  const lastShown = localStorage.getItem(hintKey);
  const now = Date.now();
  const daysSinceLastShown = lastShown
    ? (now - Number(lastShown)) / (1000 * 60 * 60 * 24)
    : Infinity;
  if (lastShown && daysSinceLastShown <= 7) return;

  hintTimerId = window.setTimeout(() => {
    hintTimerId = 0;
    if (document.documentElement.dataset.siteMode !== "desktop") return;

    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const key = isMac ? "Cmd" : "Ctrl";
    showToast(
      `Quick tip: Press <kbd>${key} + K</kbd> to open the command palette`,
      0,
    );
    localStorage.setItem(hintKey, String(Date.now()));
  }, 3000);
}

scheduleCommandPaletteHint();
document.addEventListener("site:mode-change", (event) => {
  if (event.detail?.mode === "desktop") {
    scheduleCommandPaletteHint();
    return;
  }

  if (hintTimerId) {
    clearTimeout(hintTimerId);
    hintTimerId = 0;
  }
});
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "preserves desktop window|animation loop|defers the desktop"
```

Expected: 3 tests pass. Re-run the existing command-palette and window tests:

```powershell
pnpm exec playwright test tests/e2e/desktop.spec.ts --project=chromium --grep "command palette|window"
```

Expected: all matching tests pass.

- [ ] **Step 8: Commit the inactive-desktop behavior**

Run:

```powershell
git add src/pages/index.astro src/components/desktop/Window.astro src/components/desktop/CommandPalette.astro tests/e2e/desktop.spec.ts
git diff --cached --check
git commit -m "fix: suspend desktop behavior in website mode"
```

Do not stage `README.md`.

### Task 4: Source-of-truth documentation and full verification

**Files:**

- Modify: `README.md`
- Verify: `dist/index.html`

- [ ] **Step 1: Update the existing README without replacing user edits**

Adjust the opening description to state that the site offers both an
interactive desktop and a conventional responsive portfolio. Add these Project
Map entries:

```markdown
| `src/components/WebsiteMode.astro` | Normal responsive portfolio shell |
| `src/components/SiteModeController.astro` | Persisted desktop/website mode coordination |
```

Add this Interaction Invariant:

```markdown
- `pepodev.viewMode` stores `desktop` or `website`; first visits default to
  desktop, while a non-empty `?blog=` deep link temporarily opens desktop mode
  without overwriting the saved preference.
```

Keep every pre-existing README worktree change intact.

- [ ] **Step 2: Verify the generated page contains both static shells**

Run:

```powershell
pnpm build
Select-String -Path dist\index.html -Pattern 'id="desktop"','id="website"','pepodev.viewMode'
```

Expected: build exits 0 and all three patterns are present.

- [ ] **Step 3: Run the entire E2E suite**

Run:

```powershell
pnpm test:e2e
```

Expected: all tests pass with zero failures.

- [ ] **Step 4: Inspect the complete diff and worktree ownership**

Run:

```powershell
git diff --check
git status --short
git diff -- src/pages/index.astro src/components src/styles tests/e2e/desktop.spec.ts README.md
```

Expected: no whitespace errors; implementation files match this plan; README
still appears as an unstaged user-owned modification. Do not stage or commit
README because it contained user changes before implementation.

- [ ] **Step 5: Manually verify both interaction paths**

Run `pnpm dev` and check:

1. First visit opens desktop.
2. Taskbar switch opens the normal site without a flash.
3. Normal-site navigation scrolls and links work at desktop and mobile widths.
4. Header switch returns to the exact open desktop-window state.
5. Refresh preserves each explicit selection.
6. `/?blog=aws-local-zone-bangkok-launch` opens the desktop article while
   retaining a saved website preference.
7. Light and dark themes remain readable in both modes.

Stop the development server after the checks.
