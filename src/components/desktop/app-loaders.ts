// Imports an app body's code (src/components/apps/<Name>App.tsx), for
// app-chunks.ts. Under `next dev` and `next build` each fixed path below
// becomes its own chunk, and Turbopack retries a failed chunk itself. The
// desktop bundle of the exported / (scripts/desktop-bundle.mjs) swaps this
// module for app-loaders.browser.ts.
import type { AppModule } from "./app-chunks";
import type { AppId } from "./apps";

const loaders: { [Id in AppId]: () => Promise<AppModule<Id>> } = {
  welcome: () => import("@components/apps/WelcomeApp"),
  blog: () => import("@components/apps/BlogApp"),
  garden: () => import("@components/apps/GardenApp"),
  project: () => import("@components/apps/ProjectsApp"),
  work: () => import("@components/apps/WorkApp"),
  me: () => import("@components/apps/AboutApp"),
  sregame: () => import("@components/apps/SreGameApp"),
  snake: () => import("@components/apps/SnakeApp"),
  music: () => import("@components/apps/MusicPlayerApp"),
  whitenoise: () => import("@components/apps/WhiteNoiseApp"),
  calculator: () => import("@components/apps/CalculatorApp"),
  settings: () => import("@components/apps/SettingsApp"),
  terminal: () => import("@components/apps/TerminalApp"),
  certs: () => import("@components/apps/CertificationsWalletApp"),
  gallery: () => import("@components/apps/GalleryApp"),
  trash: () => import("@components/apps/TrashBinApp"),
};

/** `attempt` counts the app's failed downloads before this one (unused here). */
export function importAppModule<Id extends AppId>(appId: Id, attempt: number): Promise<AppModule<Id>> {
  return loaders[appId]();
}
