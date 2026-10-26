// The garden's parse-time scripts. The garden is a static page (runtime
// "none"), so its behaviour is <InlineScript>s, never client components.
import { InlineScript, scriptValue } from "@components/InlineScript";
import { accentMap } from "@utils/desktop-prefs";

// <head>, before first paint: the saved light or dark theme and the Settings
// accent, as / and the blog apply them to website mode. Inside the desktop
// Garden window (whose titlebar then replaces the site header:
// html[data-embed], garden.css) both come from the desktop around it, so the
// frame never disagrees with it. Changes saved in other tabs (or by the
// desktop around the Garden window, whose saves reach the frame as storage
// events) are followed live. It sets <html> attributes and variables, so the
// layout renders <Document suppressHydrationWarning>.
const themeScript = `(() => {
  const accentMap = ${scriptValue(accentMap)};
  const root = document.documentElement;
  const embedded = window.top !== window.self;
  if (embedded) root.dataset.embed = "";
  const apply = () => {
    let prefs = {};
    let desktop = null;
    try {
      prefs = JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}") || {};
      if (embedded) desktop = parent.document.documentElement;
    } catch {}
    let theme = prefs.theme;
    try {
      theme = desktop?.dataset.theme || theme || localStorage.getItem("pepodev.theme");
    } catch {}
    root.dataset.theme = theme === "light" ? "light" : "dark";
    const accent = accentMap[prefs.accent] || accentMap.green;
    const fromDesktop = (name) => desktop?.style.getPropertyValue(name).trim();
    const primary = fromDesktop("--accent-primary") || accent.primary;
    const secondary = fromDesktop("--accent-secondary") || accent.secondary;
    root.style.setProperty("--accent-primary", primary);
    root.style.setProperty("--accent-secondary", secondary);
    // The older accent variables note bodies (.prose, blog.css) still read,
    // mapped as the desktop maps them (prefs-core.ts).
    root.style.setProperty("--accent-green", primary);
    root.style.setProperty("--accent-cyan", secondary);
  };
  apply();
  addEventListener("storage", (event) => {
    if (event.key === "pepodev.desktopPrefs" || event.key === "pepodev.theme") apply();
  });
})();`;

export function GardenThemeScript() {
  return <InlineScript code={themeScript} />;
}

// End of <body>: the sidebar filter, and the desktop Garden window's
// behaviour. Inside that window (an <iframe>), events in the frame never
// reach the desktop, so the script re-sends the ones it needs to the frame
// element in the parent page: mousedown, click and focusin (window focus,
// closing menus), and Escape and Ctrl/Cmd + K as a keydown on the parent
// document. Links that leave the garden open in a new tab instead of inside
// the window. It only changes attributes (hidden, open, target, rel) of the
// server-rendered markup, so under `next dev`, where the page hydrates, React
// keeps them (hydration rule 1). The header's links carry
// suppressHydrationWarning (GardenShell.tsx); a note whose Markdown links
// leave the garden still makes React log, inside the Garden window under
// `next dev` only, that their target and rel differ from the server HTML
// (Markdown elements take no props here). The export does not hydrate.
const pageScript = `(() => {
  const input = document.querySelector("[data-garden-filter]");
  const tree = document.querySelector("[data-garden-tree]");
  const empty = document.querySelector("[data-garden-filter-empty]");

  input?.addEventListener("input", () => {
    if (!tree || !empty) return;
    const query = input.value.trim().toLowerCase();
    tree.querySelectorAll("[data-note]").forEach((item) => {
      item.hidden = query !== "" && !item.dataset.note?.includes(query);
    });
    // Deepest folders first, so a parent sees its children's final state.
    [...tree.querySelectorAll("details")].reverse().forEach((details) => {
      const match = details.querySelector("[data-note]:not([hidden])");
      details.parentElement.hidden = query !== "" && !match;
      details.open = query ? Boolean(match) : details.hasAttribute("data-open");
    });
    empty.hidden = query === "" || Boolean(tree.querySelector("[data-note]:not([hidden])"));
  });

  const frame = window.frameElement;
  if (!frame) return;
  for (const type of ["mousedown", "click", "focusin"]) {
    document.addEventListener(type, () => {
      frame.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.origin !== location.origin || !link.pathname.startsWith("/garden/")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  });
  document.addEventListener("keydown", (event) => {
    const palette = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    if (event.key !== "Escape" && !palette) return;
    // Escape first clears a filled-in filter, like any search field.
    if (event.key === "Escape" && event.target === input && input?.value) return;
    const forwarded = new KeyboardEvent("keydown", {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      bubbles: true,
      cancelable: true,
    });
    window.parent.document.dispatchEvent(forwarded);
    if (forwarded.defaultPrevented) event.preventDefault();
  });
})();`;

export function GardenPageScript() {
  return <InlineScript code={pageScript} />;
}
