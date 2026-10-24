// The body every not-yet-ported app shows (the stub <Name>App.tsx files).
// Delete this file once no app uses it.
import { getApp, type AppId } from "./apps";

export function AppPlaceholder({ appId, source }: { appId: AppId; source: string }) {
  const app = getApp(appId)!;
  return (
    <div className="app-content" data-app-placeholder={appId}>
      <div className="terminal-heading">
        <span className="prompt">~/{appId} $</span> port --status
      </div>
      <h2>{app.label} is being ported</h2>
      <p className="app-subtitle">
        This app is a placeholder in the Next.js port: its React version will replace{" "}
        <code>src/components/apps/{source.replace(".astro", ".tsx")}</code> (ported from {source}).
      </p>
    </div>
  );
}
