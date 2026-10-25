"use client";
// An app's body inside its window. Window.tsx renders it once the window
// first opens (or, for registry mount: "idle" apps, once the desktop is
// idle). The body's code is its own chunk (app-chunks.ts), rendered here as
// plain state rather than through React.lazy: a body whose chunk has arrived
// renders in the same commit as its window, one that arrives later renders
// as soon as it does (React would hold a Suspense reveal back until 300 ms
// after the latest fallback on the page). Slow downloads show "Loading…";
// a failed one shows an error with "Try again", and the window's next launch
// also tries again. A body that throws while rendering gets the same error
// state, and trying again mounts it afresh.
import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { AppProps } from "./app-api";
import { getAppChunk, loadAppChunk, subscribeAppChunks } from "./app-chunks";
import { setAppBodyReady } from "./app-keys";
import type { AppId } from "./apps";
import { activateWindow, isKeyboardInteraction, windowsStore } from "./window-manager";

// Rendered after the body, so its effect runs once the body has rendered
// (and after the body's own effects): keys typed while the chunk loaded go
// to the app now (app-keys.ts).
function BodyReady({ appId }: { appId: AppId }) {
  useEffect(() => {
    setAppBodyReady(appId, true);
    return () => setAppBodyReady(appId, false);
  }, [appId]);
  return null;
}

// Most chunks arrive within this time (prefetched ones at once), and a
// "Loading…" line that flashes for a few frames while the window scales in
// reads as a glitch; slower downloads show it after this delay.
const LOADING_DELAY_MS = 150;

function AppLoading() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <p className="app-loading" role="status">
      Loading…
    </p>
  );
}

/**
 * "This app could not load", with "Try again"; the window's next launch also
 * tries again. Both go through a launch (focusRequest), so focus does not
 * drop to <body> when the button goes: pressed from the keyboard, it moves
 * into the window first, and an app that focuses its input on launch
 * (useFocusOnLaunch) takes it from there once it renders.
 */
function AppLoadError({ appId, onRetry }: { appId: AppId; onRetry: () => void }) {
  const retry = useRef(onRetry);
  useEffect(() => {
    retry.current = onRetry;
  });
  useEffect(() => {
    const seq = () => windowsStore.get().windows[appId].focusRequest.seq;
    const failedAt = seq();
    let retried = false;
    return windowsStore.subscribe(() => {
      if (retried || seq() === failedAt) return;
      retried = true;
      retry.current();
    });
  }, [appId]);
  return (
    <div className="app-loading app-loading-error" role="alert">
      <p>This app could not load. Check your connection and try again.</p>
      <button
        type="button"
        className="app-loading-retry"
        onClick={() => activateWindow(appId, isKeyboardInteraction())}
      >
        Try again
      </button>
    </div>
  );
}

interface BoundaryProps {
  appId: AppId;
  onRetry: () => void;
  children: ReactNode;
}

// A body that throws while rendering.
class AppErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <AppLoadError appId={this.props.appId} onRetry={this.props.onRetry} />;
    return this.props.children;
  }
}

function retryDownload(appId: AppId) {
  loadAppChunk(appId).catch(() => {
    // Shown by the error state.
  });
}

export function AppBody<Id extends AppId>({ appId, data }: AppProps<Id>) {
  const chunk = useSyncExternalStore(
    subscribeAppChunks,
    () => getAppChunk(appId),
    () => undefined,
  );
  const [attempt, setAttempt] = useState(0);

  // The launch or idle mount that rendered the body started its download
  // (window-manager.ts); this only covers a body rendered some other way.
  useEffect(() => {
    if (!getAppChunk(appId)) retryDownload(appId);
  }, [appId]);

  if (!chunk) return <AppLoading />;
  if (chunk.status === "failed") return <AppLoadError appId={appId} onRetry={() => retryDownload(appId)} />;
  const Body = chunk.Body as ComponentType<AppProps<Id>>;
  return (
    // A new key mounts the body afresh after it threw.
    <AppErrorBoundary key={attempt} appId={appId} onRetry={() => setAttempt((count) => count + 1)}>
      {/* Only for a body that suspends on something of its own. */}
      <Suspense fallback={<AppLoading />}>
        <Body appId={appId} data={data} />
        <BodyReady appId={appId} />
      </Suspense>
    </AppErrorBoundary>
  );
}
