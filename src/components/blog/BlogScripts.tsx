// The blog pages' parse-time script. The blog index and posts are static
// pages (runtime "none"), so their behaviour is <InlineScript>s, never client
// components.
import { InlineScript, scriptValue } from "@components/InlineScript";
import { accentMap } from "@utils/desktop-prefs";

// <head>, before first paint: the saved light or dark theme and the Settings
// accent, as / applies them to website mode (HomeHeadScripts.tsx), so a
// visitor never sees the page flash dark or green first. Changes saved in
// another tab (the desktop's Settings) are followed live. It sets <html>
// attributes, so the layouts render <Document suppressHydrationWarning>.
const themeScript = `(() => {
  // Apply the saved website theme and accent before first paint.
  const accentMap = ${scriptValue(accentMap)};
  const root = document.documentElement;
  const apply = () => {
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
  };
  apply();
  addEventListener("storage", (event) => {
    if (event.key === "pepodev.desktopPrefs" || event.key === "pepodev.theme") apply();
  });
})();`;

export function BlogThemeScript() {
  return <InlineScript code={themeScript} />;
}
