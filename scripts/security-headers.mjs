// The security headers pepo.dev sends with every response. GitHub Pages
// cannot set headers, so Cloudflare adds them (a response header transform
// rule, README.md: Cloudflare); serve-static.mjs sends the same ones, so the
// Playwright suite runs under them. Change the rule whenever this changes.
//
// The site loads nothing from other origins except Cloudflare Web Analytics:
// the beacon script Cloudflare injects, and the reports it sends. Inline
// scripts stay allowed: the parse-time scripts and Next.js's payload scripts
// are inline, and their hashes change with every build. The Garden app
// frames /garden/, so framing is same-origin, not denied.
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
