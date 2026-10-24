"use client";
// Local time in Bangkok for website mode (ICT is UTC+7 all year: Thailand
// has no daylight saving time). The server renders the build-time value, so
// the page reads right without JavaScript; BangkokClockScript corrects it
// while the HTML parses, before first paint; once hydrated, every clock
// follows one shared 15-second ticker, which stops when no clock is mounted.
import { useSyncExternalStore } from "react";
import { bangkokTime } from "./bangkok-time";

const listeners = new Set<() => void>();
let ticker = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    ticker = window.setInterval(() => listeners.forEach((notify) => notify()), 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearInterval(ticker);
  };
}

/**
 * Hydrates with `initial` (the time the page was built, which the server
 * rendered), then shows the current time. The parse-time script may already
 * have written it into the element, hence suppressHydrationWarning.
 */
function useBangkokTime(initial: string) {
  return useSyncExternalStore(subscribe, () => bangkokTime(new Date()), () => initial);
}

/** The status card's `<time>`. */
export function BangkokTime({ initial }: { initial: string }) {
  const time = useBangkokTime(initial);
  return (
    <time data-bkk-time="" dateTime={time} suppressHydrationWarning>
      {time}
    </time>
  );
}

/** The clock in the desktop teaser's mini taskbar. */
export function BangkokClockText({ initial, className }: { initial: string; className?: string }) {
  const time = useBangkokTime(initial);
  return (
    <span className={className} data-bkk-time="" suppressHydrationWarning>
      {time}
    </span>
  );
}
