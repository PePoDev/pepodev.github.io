// The garden's parse-time scripts (ported from GardenLayout.astro). The
// garden is a static page (runtime "none"), so its behaviour is
// <InlineScript>s, never client components.
import { InlineScript } from "@components/InlineScript";

// <head>, before first paint: the saved light or dark theme, or the
// desktop's own inside the desktop Garden window (whose titlebar then
// replaces the site header: html[data-embed], garden.css). Theme changes
// made in other tabs are followed live. It sets <html> attributes, so the
// layout renders <Document suppressHydrationWarning>.
const themeScript = `(() => {
  const root = document.documentElement;
  const embedded = window.top !== window.self;
  if (embedded) root.dataset.embed = "";
  try {
    root.dataset.theme =
      (embedded && parent.document.documentElement.dataset.theme) ||
      JSON.parse(localStorage.getItem("pepodev.desktopPrefs") || "{}").theme ||
      localStorage.getItem("pepodev.theme") ||
      "dark";
  } catch {
    root.dataset.theme = "dark";
  }
  addEventListener("storage", (event) => {
    if (event.key === "pepodev.theme" && event.newValue) root.dataset.theme = event.newValue;
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
