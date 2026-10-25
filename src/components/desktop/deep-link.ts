// Deep links into apps. A ?blog=<slug> link opens desktop mode (the head
// script), the Blog window maximized, and the article: the desktop keeps the
// slug pending until the Blog app registers its handler
// (useDeepLinkHandler in app-api.ts), which happens once its chunk has
// loaded and the body has mounted, however long that takes, and then asks
// it to open the slug. A handler that returns false shows the "Article not
// found" toast (the slug never reaches the toast). Picking website mode, or
// closing the Blog window before the app is ready, drops the pending link.
import type { AppId } from "./apps";
import { getBlogDeepLink, isDesktopSiteMode } from "./site-mode";
import { showToast } from "./toasts";
import { requestOpenApp, toggleMaximize, windowsStore } from "./window-manager";

export type DeepLinkHandler = (slug: string) => boolean;

const handlers = new Map<AppId, DeepLinkHandler>();
let pendingBlogSlug: string | null = null;

/**
 * Registers (or with null, removes) an app's deep link handler. A pending
 * link runs in a microtask: registration happens in an effect, where the
 * handler's state updates and the toast cannot commit.
 */
export function setDeepLinkHandler(appId: AppId, handler: DeepLinkHandler | null) {
  if (handler) handlers.set(appId, handler);
  else handlers.delete(appId);
  if (handler && appId === "blog" && pendingBlogSlug) queueMicrotask(runPendingBlogLink);
}

function runPendingBlogLink() {
  const slug = pendingBlogSlug;
  const handler = handlers.get("blog");
  if (!slug || !handler) return;
  pendingBlogSlug = null;
  if (!isDesktopSiteMode() || !windowsStore.get().windows.blog.open) return;
  if (!handler(slug)) {
    console.warn(`Blog post with slug "${slug}" not found`);
    // The slug comes from the URL, so it stays out of the toast.
    showToast("Article not found. Showing all articles instead.", { duration: 5000, icon: "⚠️" });
  }
}

/** Opens a ?blog= deep link, if the URL has one. Returns a cleanup. */
export function startBlogDeepLink(): () => void {
  const slug = getBlogDeepLink();
  if (!slug) return () => {};

  requestOpenApp("blog");
  const blog = windowsStore.get().windows.blog;
  // Phone widths open every window full screen (maximized) already.
  if (blog.open && !blog.minimized && !blog.maximized) toggleMaximize("blog");
  pendingBlogSlug = slug;
  runPendingBlogLink();

  const onModeChange = (event: Event) => {
    if ((event as CustomEvent<{ mode?: string }>).detail?.mode === "website") pendingBlogSlug = null;
  };
  document.addEventListener("site:mode-change", onModeChange);
  return () => {
    pendingBlogSlug = null;
    document.removeEventListener("site:mode-change", onModeChange);
  };
}
