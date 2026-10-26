// Local time in Bangkok for website mode (ICT is UTC+7 all year: Thailand
// has no daylight saving time). The server renders the build-time value, so
// the page reads right without JavaScript; BangkokClockScript writes the
// current time while the HTML parses, before first paint, and keeps every
// [data-bkk-time] element current. suppressHydrationWarning is for
// `next dev`, which hydrates the whole page after that script has run.

/** The status card's `<time>`. */
export function BangkokTime({ initial }: { initial: string }) {
  return (
    <time data-bkk-time="" dateTime={initial} suppressHydrationWarning>
      {initial}
    </time>
  );
}

/** The clock in the desktop teaser's mini taskbar. */
export function BangkokClockText({ initial, className }: { initial: string; className?: string }) {
  return (
    <span className={className} data-bkk-time="" suppressHydrationWarning>
      {initial}
    </span>
  );
}
