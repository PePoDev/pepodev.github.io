// PLACEHOLDER for website mode (the #website panel), until the website
// track ports WebsiteMode.astro into this file. It already has what the
// desktop and the site-mode state expect from the panel: the SiteModePanel
// wrapper (#website, .website-shell, data-site-mode-panel="website", hidden
// and inert while inactive), a <header> with the two-way ModeSwitch, a
// one-way [data-site-mode-target="desktop"] button, and website-mode.css
// (which also hides the inactive panel before hydration). Replace the
// placeholder content; keep the wrapper, the header switch and the import.
// It stays a Server Component: its markup is server-rendered (and repeated
// in the page's RSC payload), only SiteModePanel hydrates.
import "@styles/website-mode.css";
import { BrandMark } from "@components/BrandMark";
import { ModeSwitch } from "@components/desktop/ModeSwitch";
import { MonitorIcon } from "@components/desktop/MonitorIcon";
import { SiteModePanel } from "@components/desktop/SiteModePanel";

export function WebsiteMode() {
  return (
    <SiteModePanel mode="website" id="website" className="website-shell">
      <a className="website-skip-link" href="#website-main">
        Skip to content
      </a>
      <header className="website-header">
        <div className="ws-header-inner">
          <a className="ws-brand" href="#website-hero" aria-label="pepo.dev, back to top">
            <BrandMark size={26} />
            <span>pepo.dev</span>
          </a>
          <div className="ws-header-actions">
            <a className="ws-resume-link" href="/resume/">
              Resume
            </a>
            <ModeSwitch variant="website" />
          </div>
        </div>
      </header>
      <main id="website-main" className="ws-main" tabIndex={-1} data-website-placeholder="">
        <section id="website-hero" className="ws-hero ws-wrap" aria-labelledby="website-title">
          <h1 id="website-title">Website mode is being ported</h1>
          <p>
            This panel is a placeholder in the Next.js port. Meanwhile, read the <a href="/blog/">blog</a> or the{" "}
            <a href="/resume/">resume</a>.
          </p>
          <button className="ws-btn" type="button" data-site-mode-target="desktop">
            <MonitorIcon size={16} />
            Open desktop mode
          </button>
        </section>
      </main>
    </SiteModePanel>
  );
}
