// The two parse-time scripts in the <head> of / (ported from
// SiteModeController.astro and index.astro). They set <html data-site-mode>,
// data-theme and the accent colours before first paint, so website-mode and
// light-theme visitors never see a flash of the desktop or the dark theme.
// The (home) layout renders them with <Document suppressHydrationWarning>.
import { InlineScript, scriptValue } from "@components/InlineScript";
import { accentMap } from "@utils/desktop-prefs";

// data-cfasync="false" (InlineScript) stops Cloudflare Rocket Loader from
// deferring this past first paint, which shows website-mode visitors the
// desktop first.
const siteModeScript = `(() => {
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
})();`;

const themeScript = `(() => {
  // Apply the saved theme and accent before first paint so website mode does
  // not flash dark or green for light-theme or other-accent visitors. The
  // rest of the preferences (background, glass) follow in the desktop
  // preferences script (DesktopScripts.tsx).
  const accentMap = ${scriptValue(accentMap)};
  const root = document.documentElement;
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}");
    root.dataset.theme =
      prefs.theme || localStorage.getItem("pepodev.theme") || "dark";
  } catch {
    root.dataset.theme = "dark";
  }
  const accent = accentMap[prefs?.accent] || accentMap.green;
  root.style.setProperty("--accent-primary", accent.primary);
  root.style.setProperty("--accent-secondary", accent.secondary);
})();`;

export function HomeHeadScripts() {
  return (
    <>
      <InlineScript code={siteModeScript} />
      <InlineScript code={themeScript} />
    </>
  );
}
