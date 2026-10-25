// The taskbar clock's text ("14:05", "Sun, Oct 25"), for the taskbar
// (Taskbar.tsx) and for the parse-time script that fills it before the
// desktop hydrates (DesktopClockScript in DesktopScripts.tsx). That script
// inlines this function with Function#toString, so it may use only its
// parameter and globals.
export function formatTaskbarClock(now: Date): { time: string; date: string } {
  return {
    time: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"),
    date: new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(now),
  };
}
