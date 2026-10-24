// Runs while the HTML parses, right after the website panel: replaces the
// build-time Bangkok time (which can be hours old) with the current one
// before first paint, as the Astro module script did, instead of waiting for
// hydration (about 1.8 s on a slow phone). It only rewrites the text and
// `datetime` of the [data-bkk-time] elements, which carry
// suppressHydrationWarning (hydration rule 1); the BangkokClock components
// keep them current once hydrated.
import { InlineScript, scriptValue } from "@components/InlineScript";
import { BANGKOK_TIME_OPTIONS } from "./bangkok-time";

const code = `(() => {
  const time = new Intl.DateTimeFormat("en-GB", ${scriptValue(BANGKOK_TIME_OPTIONS)}).format(new Date());
  document.querySelectorAll("#website [data-bkk-time]").forEach((element) => {
    if (element.textContent !== time) element.textContent = time;
    if (element instanceof HTMLTimeElement) element.dateTime = time;
  });
})();`;

export function BangkokClockScript() {
  return <InlineScript code={code} />;
}
