// Prefetches same-origin pages linked from the current one: a link that stays
// in view for 300ms gets a <link rel="prefetch">, so the next full page load
// comes from the HTTP cache. On slow or data-saving connections only a tap
// prefetches. Links opt out with data-prefetch="false".
// Pages navigate with plain <a> (full loads, not client-side routing), since
// every page runs its own parse-time scripts.
//
// A plain inline script at the end of <body>, not a client component, so
// static pages (runtime "none") keep it without the React runtime. It only
// adds <link> elements to <head>, which React 19 hydration skips over on
// pages that hydrate.
import { InlineScript } from "./InlineScript";

const prefetchScript = `(() => {
  if (window.__pepodevPrefetchReady) return;
  window.__pepodevPrefetchReady = true;
  if (!document.createElement("link").relList?.supports?.("prefetch")) return;
  const done = new Set();
  const observed = new WeakSet();
  const timers = new WeakMap();
  const connection = navigator.connection;
  const slow = () =>
    !!connection && (!!connection.saveData || /2g/.test(connection.effectiveType || ""));

  const prefetch = (href) => {
    const target = href.replace(/#.*/, "");
    if (!navigator.onLine || done.has(target)) return;
    let url;
    try {
      url = new URL(target, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    done.add(target);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = target;
    document.head.append(link);
  };
  const eligible = (anchor) =>
    anchor instanceof HTMLAnchorElement && !!anchor.href && anchor.dataset.prefetch !== "false";

  const viewport = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) {
        timers.set(
          target,
          setTimeout(() => {
            viewport.unobserve(target);
            timers.delete(target);
            prefetch(target.href);
          }, 300),
        );
      } else {
        clearTimeout(timers.get(target));
        timers.delete(target);
      }
    }
  });
  const observeLinks = () => {
    if (slow()) return;
    for (const anchor of document.getElementsByTagName("a")) {
      if (observed.has(anchor) || !eligible(anchor)) continue;
      observed.add(anchor);
      viewport.observe(anchor);
    }
  };
  const onTap = (event) => {
    const anchor = event.target?.closest?.("a") ?? null;
    if (slow() && eligible(anchor)) prefetch(anchor.href);
  };

  observeLinks();
  new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some((node) => node instanceof Element)))
      observeLinks();
  }).observe(document.body, { childList: true, subtree: true });
  for (const type of ["touchstart", "mousedown"]) {
    document.addEventListener(type, onTap, { passive: true });
  }
})();`;

/** Render once, as the last element of <body> (Document does). */
export function Prefetch() {
  return <InlineScript code={prefetchScript} />;
}
