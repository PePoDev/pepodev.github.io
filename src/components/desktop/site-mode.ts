// Site mode: the desktop or the conventional website (port of the bundled
// half of SiteModeController.astro; the <head> half is HomeHeadScripts.tsx,
// which sets <html data-site-mode> before first paint).
//
// pepodev.viewMode stores "desktop" or "website". First visits default to
// desktop; a non-empty ?blog= deep link opens desktop mode without
// overwriting the saved preference, and picking a mode removes ?blog= so a
// reload keeps the choice. Mode switches are action buttons
// ([data-site-mode-toggle], or [data-site-mode-target="desktop"] one-way
// buttons) anywhere on the page, handled here by delegation; switching hands
// focus to the other panel's switch, and the website scroll position
// survives a round trip to desktop. Every change dispatches
// site:mode-change ({ mode }) on document.
import { commit, createStore, useStore } from "./store";

export type SiteMode = "desktop" | "website";

export const VIEW_MODE_KEY = "pepodev.viewMode";

/** null until the desktop boots (server render and hydration). */
export const siteModeStore = createStore<SiteMode | null>(null);

export function useSiteMode(): SiteMode | null {
  return useStore(siteModeStore, (mode) => mode);
}

export function normalizeMode(value: string | null | undefined): SiteMode {
  return value === "website" ? "website" : "desktop";
}

/** What <html data-site-mode> says; the head script set it before paint. */
export function isDesktopSiteMode(): boolean {
  return document.documentElement.dataset.siteMode !== "website";
}

/** The trimmed ?blog= deep link slug, or "". */
export function getBlogDeepLink(): string {
  return (new URLSearchParams(window.location.search).get("blog") || "").trim();
}

// Desktop mode locks the page to one screen, which resets its scroll.
let websiteScrollY = 0;

/**
 * Applies a mode: <html data-site-mode>, the panels' hidden/inert/aria-hidden
 * (SiteModePanel), then site:mode-change. `persist` saves it and drops ?blog=.
 */
export function applySiteMode(mode: SiteMode, persist: boolean) {
  const root = document.documentElement;
  const previousMode = root.dataset.siteMode;
  if (previousMode === "website" && mode === "desktop") {
    websiteScrollY = window.scrollY;
  }
  root.dataset.siteMode = mode;
  commit(() => siteModeStore.set(mode));

  if (persist) {
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // The selected mode still applies for this page.
    }
    dropBlogDeepLink();
  }

  document.dispatchEvent(new CustomEvent("site:mode-change", { detail: { mode } }));

  if (previousMode === "desktop" && mode === "website") {
    window.scrollTo({ top: websiteScrollY, behavior: "instant" });
  }
}

// A ?blog= deep link opens desktop mode only until the visitor picks a mode,
// so a reload keeps their choice.
function dropBlogDeepLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("blog")) return;
  url.searchParams.delete("blog");
  history.replaceState(history.state, "", url);
}

// The pressed button is hidden with its panel, so focus moves to the new
// panel's mode switch.
function focusModeSwitch(mode: SiteMode) {
  document
    .querySelector<HTMLElement>(`[data-site-mode-panel="${mode}"] [data-site-mode-toggle]`)
    ?.focus({ preventScroll: true });
}

/** Switches to `mode` as a visitor's choice (persisted, focus handed over). */
export function chooseSiteMode(mode: SiteMode) {
  if (mode === normalizeMode(document.documentElement.dataset.siteMode)) return;
  applySiteMode(mode, true);
  focusModeSwitch(mode);
}

function onClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest("[data-site-mode-toggle]")) {
    const current = normalizeMode(document.documentElement.dataset.siteMode);
    chooseSiteMode(current === "desktop" ? "website" : "desktop");
    return;
  }
  // One-way buttons (e.g. "Open desktop mode" in website content) keep their
  // own visible label.
  const oneWay = target.closest<HTMLElement>("[data-site-mode-target]");
  if (oneWay) chooseSiteMode(normalizeMode(oneWay.dataset.siteModeTarget));
}

/** Boots site mode: applies the head script's choice and handles the switches. */
export function startSiteMode(): () => void {
  document.addEventListener("click", onClick);
  applySiteMode(normalizeMode(document.documentElement.dataset.siteMode), false);
  return () => document.removeEventListener("click", onClick);
}
