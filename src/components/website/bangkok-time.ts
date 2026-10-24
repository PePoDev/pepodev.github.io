// "17:08": the time in Bangkok, as website mode shows it. Shared by the
// server (the build-time value), the clock components and the parse-time
// script (website/BangkokClockScript.tsx), which inlines BANGKOK_TIME_OPTIONS.
export const BANGKOK_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

let format: Intl.DateTimeFormat | undefined;

export function bangkokTime(date: Date): string {
  format ??= new Intl.DateTimeFormat("en-GB", BANGKOK_TIME_OPTIONS);
  return format.format(date);
}
