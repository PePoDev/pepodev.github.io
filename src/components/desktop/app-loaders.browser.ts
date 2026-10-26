// app-loaders.ts in the desktop bundle of the exported / (scripts/
// desktop-bundle.mjs). There every app body is an entry point of its own,
// and postbuild writes their URLs into the page as JSON (#desktop-apps). A
// browser keeps a failed module download for the page's lifetime (import()
// of that URL fails again without fetching), so a later try asks for the
// same file under a query of its own. The chunks a body imports are all
// the entry's, loaded with the page (the build checks it:
// scripts/desktop-bundle.mjs), so the body's own file is all a launch can
// fail on.
import type { AppModule } from "./app-chunks";
import type { AppId } from "./apps";

let urls: Record<AppId, string> | null = null;

/** `attempt` counts the app's failed downloads before this one. */
export function importAppModule<Id extends AppId>(appId: Id, attempt: number): Promise<AppModule<Id>> {
  urls ??= JSON.parse(document.getElementById("desktop-apps")?.textContent ?? "{}") as Record<AppId, string>;
  const url = urls[appId];
  return import(attempt > 0 ? `${url}?retry=${attempt}` : url);
}
