// Runs while the HTML parses, right after the website panel: replaces the
// build-time Bangkok time (which can be hours old) with the current one
// before first paint, then every 15 seconds. It only rewrites the text and
// `datetime` of the [data-bkk-time] elements (BangkokClock.tsx).
import { InlineScript, scriptValue } from "@components/InlineScript";
import { BANGKOK_TIME_OPTIONS } from "./bangkok-time";

const code = `(() => {
  const format = new Intl.DateTimeFormat("en-GB", ${scriptValue(BANGKOK_TIME_OPTIONS)});
  const clocks = document.querySelectorAll("#website [data-bkk-time]");
  const tick = () => {
    const time = format.format(new Date());
    clocks.forEach((element) => {
      if (element.textContent !== time) element.textContent = time;
      if (element instanceof HTMLTimeElement) element.dateTime = time;
    });
  };
  tick();
  setInterval(tick, 15000);
})();`;

export function BangkokClockScript() {
  return <InlineScript code={code} />;
}
