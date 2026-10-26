// The home page: the React desktop and website mode (README, "The React
// Desktop"). Build-time data is loaded here, on the server, and passed
// to the desktop as compact props: as a prop under `next dev`, and as the
// JSON in #desktop-data that the exported page's desktop bundle hydrates
// with (browser-entry.tsx). App bodies load on demand.
import { SITE_DESCRIPTION, SITE_TITLE } from "@/consts";
import { loadAppData } from "@components/apps/app-data";
import { Desktop } from "@components/desktop/Desktop";
import { DesktopClockScript, DesktopIconScript } from "@components/desktop/DesktopScripts";
import { SiteModePanel } from "@components/desktop/SiteModePanel";
import { scriptValue } from "@components/InlineScript";
import { WebsiteMode } from "@components/WebsiteMode";
import { buildMetadata } from "@lib/head";

export const generateMetadata = () =>
  buildMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

export default async function HomePage() {
  const appData = await loadAppData();
  return (
    <>
      <SiteModePanel mode="desktop" id="desktop">
        <Desktop appData={appData} />
      </SiteModePanel>
      <script
        type="application/json"
        id="desktop-data"
        dangerouslySetInnerHTML={{ __html: scriptValue(appData) }}
      />
      {/* Right after the icons and the clock they fill, before website mode. */}
      <DesktopIconScript />
      <DesktopClockScript />
      <WebsiteMode />
    </>
  );
}
