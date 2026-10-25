// The home page: the React desktop and website mode (README, "The React
// Desktop"). Build-time data is loaded here, on the server, and passed
// to the desktop as compact props; app bodies load on demand.
import { SITE_DESCRIPTION, SITE_TITLE } from "@/consts";
import { loadAppData } from "@components/apps/app-data";
import { Desktop } from "@components/desktop/Desktop";
import { DesktopClockScript, DesktopIconScript } from "@components/desktop/DesktopScripts";
import { WebsiteMode } from "@components/WebsiteMode";
import { buildMetadata } from "@lib/head";

export const generateMetadata = () =>
  buildMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

export default async function HomePage() {
  const appData = await loadAppData();
  return (
    <>
      <Desktop appData={appData} />
      {/* Right after the icons and the clock they fill, before website mode. */}
      <DesktopIconScript />
      <DesktopClockScript />
      <WebsiteMode />
    </>
  );
}
