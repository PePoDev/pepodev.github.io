"use client";
// The desktop (#desktop panel): background, icons, link shortcuts, windows,
// Quick Access (the Start menu), taskbar and toasts. The (home) page renders
// it with each app's build-time data; it boots after hydration
// (runtime.tsx). See README, "The React Desktop".
import type { AppDataMap } from "@components/apps/app-data";
import { APPS, DESKTOP_ICON_ORDER, getApp } from "./apps";
import { DesktopIcon, ExternalLinkIcon } from "./DesktopIcon";
import { DESKTOP_LINKS } from "./icon-layout";
import { ParticleBackground } from "./ParticleBackground";
import { useDesktopRuntime } from "./runtime";
import { SiteModePanel } from "./SiteModePanel";
import { StartMenu } from "./StartMenu";
import { Taskbar } from "./Taskbar";
import { Toasts } from "./Toasts";
import { Window } from "./Window";
import "./app-loading.css";

export function Desktop({ appData }: { appData: AppDataMap }) {
  useDesktopRuntime();
  return (
    <SiteModePanel mode="desktop" id="desktop">
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
    </SiteModePanel>
  );
}
