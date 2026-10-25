// A classic inline <script> that runs while the HTML parses: before first
// paint and before React hydrates (on pages that hydrate at all; see
// PageRuntime in Document.tsx). Use it for code that must run that early
// (mode and theme in <head>, controllers that must claim the desktop before
// a visitor clicks) and for the small behaviours of static pages.
//
// data-cfasync="false" keeps Cloudflare Rocket Loader, which defers scripts
// on pepo.dev, from holding it back (README, Parse-Time Scripts and Rocket
// Loader). Guard any DOMContentLoaded handler in `code` with a
// `window.__pepodev…Ready` flag: Rocket Loader can replay the event. React never runs scripts it renders on
// the client, so these only work in the server-rendered HTML; render them
// from Server Components. A script that changes <html> attributes needs
// <Document suppressHydrationWarning>.
//
// `code` is emitted as written. Inject build-time values with scriptValue(),
// never with a bare JSON.stringify.
export function InlineScript({ code, id }: { code: string; id?: string }) {
  return <script id={id} data-cfasync="false" dangerouslySetInnerHTML={{ __html: code }} />;
}

/**
 * A build-time value as a JavaScript literal for InlineScript code: the
 * counterpart of Astro's define:vars. Like Astro's stringifyForScript, it
 * escapes `<`, so a string holding `</script>` or `<!--` cannot end or
 * corrupt the inline script. U+2028 and U+2029 are escaped too.
 */
export function scriptValue(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) return "undefined";
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
