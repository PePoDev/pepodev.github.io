"use client";
// Every app body, each loaded on demand from its fixed path
// (src/components/apps/<Name>App.tsx) into its own chunk. Window.tsx
// renders one once its window first opens, with a small loading state while
// the chunk downloads and an error state if it fails. A failed download is
// tried again from the error state's button or on the window's next launch
// (React.lazy keeps a rejected import, so each try gets a new one).
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import type { AppProps } from "./app-api";
import { setAppBodyReady } from "./app-keys";
import type { AppId } from "./apps";
import { windowsStore } from "./window-manager";

type Loader<Id extends AppId> = () => Promise<{ default: ComponentType<AppProps<Id>> }>;
type Body<Id extends AppId> = LazyExoticComponent<ComponentType<AppProps<Id>>>;

const loaders: { [Id in AppId]: Loader<Id> } = {
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

// One lazy component per app and try, so renders (and Strict Mode's double
// renders) of the same try share it.
const bodies = new Map<AppId, { attempt: number; Body: Body<AppId> }>();

function getBody<Id extends AppId>(appId: Id, attempt: number): Body<Id> {
  const cached = bodies.get(appId);
  if (cached?.attempt === attempt) return cached.Body as unknown as Body<Id>;
  const Body = lazy(loaders[appId] as Loader<Id>);
  bodies.set(appId, { attempt, Body: Body as unknown as Body<AppId> });
  return Body;
}

// Rendered after the body inside its Suspense boundary, so its effect runs
// once the body has rendered (and after the body's own effects): keys typed
// while the chunk loaded go to the app now (app-keys.ts).
function BodyReady({ appId }: { appId: AppId }) {
  useEffect(() => {
    setAppBodyReady(appId, true);
    return () => setAppBodyReady(appId, false);
  }, [appId]);
  return null;
}

function AppLoading() {
  return (
    <p className="app-loading" role="status">
      Loading…
    </p>
  );
}

interface BoundaryProps {
  appId: AppId;
  onRetry: () => void;
  children: ReactNode;
}

class AppErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  private stopWatching: (() => void) | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidMount() {
    this.watchForLaunch();
  }

  componentDidUpdate() {
    this.watchForLaunch();
  }

  componentWillUnmount() {
    this.stopWatching?.();
  }

  // After a failure, the window's next launch (desktop:window-focus) tries again.
  private watchForLaunch() {
    if (!this.state.failed || this.stopWatching) return;
    const seq = () => windowsStore.get().windows[this.props.appId].focusRequest.seq;
    const failedAt = seq();
    const unsubscribe = windowsStore.subscribe(() => {
      if (seq() === failedAt) return;
      this.stopWatching?.();
      this.props.onRetry();
    });
    this.stopWatching = () => {
      unsubscribe();
      this.stopWatching = null;
    };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="app-loading app-loading-error" role="alert">
          <p>This app could not load. Check your connection and try again.</p>
          <button type="button" className="app-loading-retry" onClick={this.props.onRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppBody<Id extends AppId>({ appId, data }: AppProps<Id>) {
  const [attempt, setAttempt] = useState(0);
  const Body = getBody(appId, attempt);
  return (
    // A new key gives the next try a fresh boundary and Suspense.
    <AppErrorBoundary key={attempt} appId={appId} onRetry={() => setAttempt((count) => count + 1)}>
      <Suspense fallback={<AppLoading />}>
        <Body appId={appId} data={data} />
        <BodyReady appId={appId} />
      </Suspense>
    </AppErrorBoundary>
  );
}
