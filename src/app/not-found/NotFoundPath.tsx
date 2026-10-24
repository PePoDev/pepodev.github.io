// The requested path in the 404's terminal line. out/404.html answers every
// unknown URL, so the path is only known in the browser: the server renders
// a stand-in, and NotFoundPathScript (rendered after it) writes the path at
// parse time. The 404 is a static page (runtime "none"); under `next dev`,
// where it hydrates, suppressHydrationWarning keeps the written text.
import { InlineScript } from "@components/InlineScript";

export function NotFoundPath() {
  return (
    <span data-not-found-path="" suppressHydrationWarning>
      this-page
    </span>
  );
}

const script = `(() => {
  const target = document.querySelector("[data-not-found-path]");
  if (!target) return;
  let requested = location.pathname;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    // Malformed escapes: show the path as requested.
  }
  target.textContent = requested;
})();`;

/** Render after <NotFoundPath />. */
export function NotFoundPathScript() {
  return <InlineScript code={script} />;
}
