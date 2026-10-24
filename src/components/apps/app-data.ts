// Every app's build-time data, loaded by the (home) page on the server and
// passed to the desktop as compact JSON props (each app gets its own as
// `data`). Each app owns its loader in <Name>App.data.ts; this file only
// lists them. Server-only: loaders may read the file system and must return
// JSON-serializable values. Never put whole articles here: the Blog app
// loads article bodies on demand.
import type { AppId } from "@components/desktop/apps";
import loadAbout from "./AboutApp.data";
import loadBlog from "./BlogApp.data";
import loadCalculator from "./CalculatorApp.data";
import loadCertificationsWallet from "./CertificationsWalletApp.data";
import loadGallery from "./GalleryApp.data";
import loadGarden from "./GardenApp.data";
import loadMusicPlayer from "./MusicPlayerApp.data";
import loadProjects from "./ProjectsApp.data";
import loadSettings from "./SettingsApp.data";
import loadSnake from "./SnakeApp.data";
import loadSreGame from "./SreGameApp.data";
import loadTerminal from "./TerminalApp.data";
import loadTrashBin from "./TrashBinApp.data";
import loadWelcome from "./WelcomeApp.data";
import loadWhiteNoise from "./WhiteNoiseApp.data";
import loadWork from "./WorkApp.data";

const loaders = {
  welcome: loadWelcome,
  blog: loadBlog,
  garden: loadGarden,
  project: loadProjects,
  work: loadWork,
  me: loadAbout,
  sregame: loadSreGame,
  snake: loadSnake,
  music: loadMusicPlayer,
  whitenoise: loadWhiteNoise,
  calculator: loadCalculator,
  settings: loadSettings,
  terminal: loadTerminal,
  certs: loadCertificationsWallet,
  gallery: loadGallery,
  trash: loadTrashBin,
} satisfies Record<AppId, () => Promise<unknown>>;

/** Each app's `data` prop, by app id. */
export type AppDataMap = { [Id in AppId]: Awaited<ReturnType<(typeof loaders)[Id]>> };

export async function loadAppData(): Promise<AppDataMap> {
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([appId, load]) => [appId, await load()] as const),
  );
  return Object.fromEntries(entries) as AppDataMap;
}
