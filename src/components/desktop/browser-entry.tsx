// The entry of the desktop bundle that the exported / loads (scripts/
// desktop-bundle.mjs): the desktop is a React root of its own, hydrated in
// the #desktop panel with the props the page wrote as JSON (#desktop-data).
// Nothing else on the page is React, and the page loads no Next.js runtime
// (README, "The React Desktop").
import { hydrateRoot } from "react-dom/client";
import type { AppDataMap } from "@components/apps/app-data";
// Shared by Music and Settings alone, so it would be a chunk only app bodies
// import; it loads with the entry instead (bundleProblems in
// scripts/desktop-bundle.mjs).
import "@components/apps/music-settings";
import { Desktop } from "./Desktop";

// postbuild puts this module's script at the end of <body>: it runs only
// once the page has parsed, so it hydrates at once, never waiting on
// readyState or DOMContentLoaded (which Rocket Loader fakes).
const appData = JSON.parse(document.getElementById("desktop-data")!.textContent!) as AppDataMap;
hydrateRoot(document.getElementById("desktop")!, <Desktop appData={appData} />);
