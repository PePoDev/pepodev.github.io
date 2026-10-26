"use client";
// The desktop, the content of the #desktop panel: background, icons, link
// shortcuts, windows, Quick Access (the Start menu), taskbar and toasts. The
// (home) page renders it in the panel with each app's build-time data; on
// the exported page it is a React root of its own (browser-entry.tsx), so
// it renders the panel's children, never the panel. It boots after
// hydration (runtime.tsx). See README, "The React Desktop".
import type { AppDataMap } from "@components/apps/app-data";
import { APPS, DESKTOP_ICON_ORDER, getApp } from "./apps";
import { DesktopIcon, ExternalLinkIcon } from "./DesktopIcon";
import { DESKTOP_LINKS } from "./icon-layout";
import { ParticleBackground } from "./ParticleBackground";
import { useDesktopRuntime } from "./runtime";
import { StartMenu } from "./StartMenu";
import { Taskbar } from "./Taskbar";
import { Toasts } from "./Toasts";
import { Window } from "./Window";
import "./app-loading.css";
// The app bodies' own styles, linked by the page: the bodies load on demand,
// and the desktop bundle loads no styles (scripts/desktop-bundle.mjs).
import "@components/apps/CertificationsWalletApp.css";
import "@components/apps/GardenApp.css";
import "@components/apps/WelcomeApp.css";

export function Desktop({ appData }: { appData: AppDataMap }) {
  useDesktopRuntime();
  return (
    <>
      <ParticleBackground />

      <div id="desktop-icons">
        {DESKTOP_ICON_ORDER.map((appId) => (
          <DesktopIcon key={appId} app={getApp(appId)!} />
        ))}
      </div>

      <div id="desktop-links" role="group" aria-label="External shortcuts">
        {DESKTOP_LINKS.map((link) => (
          <ExternalLinkIcon key={link.id} link={link} />
        ))}
      </div>

      <div id="windows-container">
        {APPS.map((app) => (
          <Window key={app.id} app={app} data={appData[app.id]} />
        ))}
      </div>

      <StartMenu />
      <Taskbar />
      <Toasts />
    </>
  );
}
