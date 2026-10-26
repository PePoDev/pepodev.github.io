// The security headers pepo.dev sends with every response. GitHub Pages
// cannot set headers, so Cloudflare adds them (a response header transform
// rule, README.md: Cloudflare); serve-static.mjs sends the same ones, so the
// Playwright suite runs under them. Change the rule whenever this changes:
// `node scripts/security-headers.mjs` prints the names and values to paste,
// and `node scripts/security-headers.mjs --check` compares pepo.dev's.
//
// The site loads nothing from other origins except Cloudflare Web Analytics'
// beacon, which Cloudflare injects and which reports to the site's own
// /cdn-cgi/rum (cloudflareinsights.com takes the reports of a manually added
// beacon). Inline scripts stay allowed: the parse-time scripts and Next.js's
// payload scripts are inline, and their hashes change with every build. The
// Garden app frames /garden/, so framing is same-origin, not denied.
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "media-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Header name to value, in the order the Cloudflare rule lists them. */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    // A page and the 404, since the rule must cover every response.
    let wrong = 0;
    for (const url of ["https://pepo.dev/", "https://pepo.dev/this-page-does-not-exist/"]) {
      const { headers } = await fetch(url, { method: "HEAD" });
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        const actual = headers.get(name);
        if (actual === value) continue;
        wrong += 1;
        console.log(`${url} ${name}: ${actual === null ? "missing" : `"${actual}"`}`);
      }
    }
    console.log(wrong ? `${wrong} header(s) differ from scripts/security-headers.mjs` : "Every header matches.");
    process.exitCode = wrong ? 1 : 0;
  } else {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) console.log(`${name}: ${value}`);
  }
}
