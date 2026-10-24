// The pepo.dev "P" mark used in website mode and the garden header (port of
// BrandMark.astro). Colors come from the website shell's --ws-mark-* tokens
// and the Settings accent. A Server Component (no client code), so both the
// website-mode panel and the garden layout render it without hydrating it.
export function BrandMark({ size }: { size: number }) {
  return (
    <svg className="ws-mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="7" fill="var(--ws-mark-bg)" />
      <path fill="var(--ws-mark-fg)" d="M7 6h10v1.5h1.5V9H20v5h-1.5v1.5H17V17h-7v5H7zM10 9v5h7V9z" />
      <rect x="14" y="19.5" width="7" height="2.5" fill="var(--accent-primary)" />
    </svg>
  );
}
