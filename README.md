# PePoDev | Personal Website

A static personal website (portfolio, engineering blog, and digital garden),
built with Next.js 16 (App Router, `output: "export"`) and served by GitHub
Pages behind Cloudflare. It has two presentation modes: an interactive
desktop (a React app with draggable windows, shortcuts, a Quick Access
launcher, work and project content, Markdown/MDX posts, a digital garden
synced from Obsidian, music, tools, and games) and a conventional responsive
website.
The resume is a standalone page with PDF download.

Keep it **static-first**: render content at build time. Only `/` hydrates
(the desktop); every other page ships no React or Next.js JavaScript, just
its own small inline scripts.

## Setup

Requires Node `>=22.22.0` and pnpm 10.33 (pinned by `packageManager` in
`package.json`; `corepack enable` selects it). TypeScript stays on 6 (not 7).

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the development server (`next dev`, Turbopack, port 3000, in the foreground) |
| `pnpm build` | Build the static site into `out/`: `scripts/prebuild.mjs` (clears `public/_img/`), `next build`, then `scripts/postbuild.mjs`, which finishes `out/` and fails the build when it is not deployable (see Page Runtime) |
| `pnpm preview` | Serve `out/` the way pepo.dev does (`scripts/serve-static.mjs`: GitHub Pages' `/dir` 301 to `/dir/`, `/page` from `page.html`, `404.html` with status 404, byte ranges, plus the security headers Cloudflare adds; build first) |
| `pnpm check` | Type-check `src/`, `tests/` and the configs (`next typegen && tsc --noEmit`); keep it at 0 errors |
| `pnpm test:e2e` | Run Playwright tests |
| `pnpm test:e2e:ui` | Run Playwright in UI mode |
| `pnpm garden:sync` | Sync published garden notes from the vault in `GARDEN_VAULT` (or `--vault <path>`) |
| `pnpm test:garden` | Run the garden sync privacy and link checks |
| `pnpm test:scripts` | Run the build scripts' unit tests (`scripts/*.test.mjs`: the garden checks and postbuild's HTML helpers) |

Run commands from the repository root. Use `pnpm build` and `pnpm check`
after code changes and `pnpm test:e2e` after desktop, window, or app
interaction changes. Set `NEXT_TELEMETRY_DISABLED=1` in scripts and CI. The
build needs no network (fonts are committed). `next.config.ts` sets
`agentRules: false` so `next dev` never writes into `AGENTS.md`; keep it.
`next dev` logs four "preloaded using link preload but not used" warnings
for stylesheets on static routes; they are dev-only, ignore them.

`pnpm test:e2e` tests `next dev` in Playwright's bundled Chromium, which
cannot play the AAC music, so the two Music tests fail locally. `next dev`
hydrates every page, so static pages are only proven by the export: CI sets
`PLAYWRIGHT_SERVER=preview` (serve the built `out/`; run `pnpm build` first)
and `PLAYWRIGHT_CHANNEL=chrome` (installed Google Chrome); set both to
reproduce CI. In CI, `test.only` fails the run and tests get two retries; the
job uploads the `playwright-report` artifact on every run, so check it for
tests that only passed on a retry (flaky). `garden.spec.ts` skips itself
without synced notes. Specs share these helpers from `tests/e2e/helpers.ts`:

- `resetPage`, `prefsStorage`, `waitForWindowManager`.
- `openApp(page, label, appId)` opens an app from its icon and waits until
  its window is shown and its body rendered; pass `{ body: false }` when the
  test holds the app's code back.
- `holdChunks(page)` holds Next.js's chunks requested from then on (`held()`,
  `hold()`, `release()`): before a reload it holds hydration, so only
  parse-time scripts run; after the boot it holds an app's code.
- `holdAppChunks(page, markers)` holds the chunks whose code contains a
  marker (text only that app has), however they are requested (launch,
  hover, idle prefetch); install it before the page loads.
- `emulateSaveData(page)` turns idle prefetching off.

On a hydrating page the RSC payload repeats inline scripts as text: a test
that searches `document.scripts` must skip `self.__next_f.push(...)` scripts.

## Project Map

| Path | Purpose |
| --- | --- |
| `src/app/(home)/` | `/`: root layout (`runtime="react"`, the `<head>` scripts) and page (desktop and website mode) |
| `src/app/(blog)/blog/`, `src/app/(post)/blog/[slug]/` | Blog index; post pages (the root layout sits in the dynamic segment, so `<html lang>` is the post's), with `post-data.ts` and `article.json/route.ts` (the desktop Blog app's copy of each post) |
| `src/app/(resume)/resume/` | Standalone HTML resume: `page.tsx`, `resume.css`, `resume-pdf.ts` (PDF generator), `ResumeDownloadScript.tsx` |
| `src/app/(garden)/garden/[[...slug]]/` | Garden home and notes in one optional catch-all route, with its root layout and `garden-data.ts` |
| `src/app/global-not-found.tsx`, `src/app/not-found/` | Branded 404, exported as `out/404.html`; GitHub Pages serves it for unknown paths, so its URLs must be root-relative |
| `src/app/rss.xml/`, `src/app/sitemap-index.xml/`, `src/app/sitemap-0.xml/` | RSS feed and sitemaps (static route handlers, written to `out/` as files) |
| `src/components/Document.tsx`, `InlineScript.tsx`, `Prefetch.tsx` | The `<html>` shell, parse-time scripts, link prefetching |
| `src/components/SiteHeader.tsx` | Header (home, Blog, RSS) for the 404 |
| `src/components/blog/` | The blog pages' shell (website mode's header and footer) and `<head>` theme script |
| `src/components/desktop/` | The React desktop: stores, window manager, overlays (Quick Access, the tray), icons, taskbar, app registry and app API (see The React Desktop) |
| `src/components/apps/` | One app per `<Name>App.tsx` (client body, its own chunk) and `<Name>App.data.ts` (build-time data); `app-data.ts` lists the loaders |
| `src/components/WebsiteMode.tsx`, `src/components/website/` | Website mode (the `#website` panel, a Server Component) and its islands: Bangkok clock, copy e-mail |
| `src/components/home/HomeHeadScripts.tsx` | Mode and theme scripts in `/`'s `<head>` |
| `src/components/garden/`, `src/styles/garden.css` | Garden shell, note tree, parse-time scripts, page styles |
| `src/lib/` | Content layer (`content.ts`), Markdown (`markdown.ts`), images (`images.ts`), metadata (`head.ts`), `static-params.ts`, `sitemap.ts`, `xml.ts` |
| `src/content/blog/` | Markdown/MDX posts; standard and Obsidian frontmatter |
| `scripts/sync-garden.mjs` | Obsidian vault to garden sync; the privacy boundary for vault content |
| `src/content/garden/`, `src/assets/garden/` | Synced garden notes and attachments; gitignored, never edit |
| `docs/superpowers/plans/2026-10-19-garden-obsidian-sync.md` | Garden sync design and one-time setup |
| `src/assets/blog/` | Local post images |
| `src/assets/fonts/` | Committed woff2 files and `OFL.txt` |
| `src/data/` | Portfolio JSON and build-time music discovery |
| `src/types/`, `src/utils/` | Data types and reusable logic, including the shared focus rules (`overlays.ts`), the app keyboard guard (`app-keyboard.ts`), search ranking (`search.ts`), and desktop accent and background colours and experiences (`desktop-prefs.ts`) |
| `src/styles/global.css` | Shared desktop, app, and article styles (on every page) |
| `src/styles/experiences.css` | The macOS, Windows and Linux desktop looks (see Desktop Experiences) |
| `src/styles/website-mode.css` | Website-mode styles (`ws-*` classes), also used by the blog pages and the garden |
| `public/music/` | Local audio library |
| `public/robots.txt`, `public/manifest.webmanifest` | Sitemap pointer and web app manifest (icons: `favicon.svg`, `icon-192.png`, `icon-512.png`) |
| `public/_img/` | Images resized at build time; generated, gitignored |
| `scripts/postbuild.mjs`, `scripts/serve-static.mjs` | Export checks (see Page Runtime); pepo.dev-like static server |
| `scripts/security-headers.mjs` | The security headers pepo.dev sends (Cloudflare adds them; see Cloudflare) |
| `scripts/generate-og-image.mjs` | Default Open Graph image generator |
| `tests/e2e/*.spec.ts` | Playwright coverage, one spec per area; `data.spec.ts` checks rules the portfolio JSON must keep, not its current values |
| `.github/workflows/deploy.yaml`, `.github/dependabot.yml` | Build, test gate, and GitHub Pages deploy; weekly dependency updates |
| `out/` | Generated build output (the static export); never edit directly |

## Pages and Runtime

### Route Groups and `<Document>`

- Every page family is a route group with its own root layout
  (`src/app/(group)/layout.tsx`), because pages differ in `<html>`: `lang`,
  `data-site-mode`, classes, parse-time `<head>` scripts. Never add
  `src/app/layout.tsx`. A new page joins the group whose `<html>` it shares,
  or gets a new group; groups must not resolve to the same URL.
- Each root layout renders `<Document>` (`src/components/Document.tsx`):
  `runtime` (required), `lang`, `className`, `htmlData`,
  `suppressHydrationWarning`, `head` (parse-time scripts), `jsonLd`,
  `bodyClassName`. It imports `global.css` and `fonts-desktop.css` and ends
  `<body>` with `<Prefetch />`.
- A root layout inside a dynamic segment gets `params` (post `lang` and
  JSON-LD); keep the lookup in a module both layout and page import
  (`post-data.ts`, `garden-data.ts`).
- Internal links are plain `<a href>`, never `next/link`: moving between root
  layouts is a full load, and every page runs its own parse-time scripts.
  `<Prefetch>` (an inline script) prefetches a same-origin link that stays
  in view for 300ms, only on tap for slow or data-saving connections;
  `data-prefetch="false"` opts a link out.
- Metadata: each page exports `generateMetadata = () => buildMetadata(head)`
  with a `PageHead` (`src/lib/head.ts`: `title`, `description`, `path` with
  its trailing slash, `image`, `imageAlt`, `type`, `lang`, `publishedTime`,
  `modifiedTime`, `noindex`); it returns the complete object, so layouts
  export only `viewport = siteViewport`. JSON-LD goes through
  `<Document jsonLd={await buildJsonLd(head)}>` (or `siteJsonLd()` for the
  Person).

### Page Runtime

Every root layout declares its runtime:

- `runtime="none"` (static page; all pages but `/`): `scripts/postbuild.mjs`
  strips Next.js's scripts (`src` under `/_next/`, the Turbopack bootstrap,
  the `self.__next_f`/`__next_s` payload), script preloads, hydration-only
  markup and the `.txt` payload files. The page keeps its `<InlineScript>`s,
  JSON-LD, and any `<script>` a post or note writes as raw HTML.
- `runtime="react"` (hydrating page; only `/`): needed as soon as a page
  renders a client component (`"use client"`). Postbuild gives each Next.js
  script `data-cfasync="false"` so Rocket Loader cannot defer hydration.
- Small behaviours of static pages are `<InlineScript>`s (`Prefetch.tsx`,
  `NotFoundPath.tsx`, the blog, garden and resume scripts), never client
  components.
- `next dev` hydrates every page, so the difference exists only in `out/`;
  CI, which tests `out/`, proves static pages work without React.

Postbuild fails the build when:

1. a static page renders a client component (its RSC payload is read against
   `.next/`'s client reference manifests; an unreadable manifest fails too),
   a hydrating page renders none, or a static page keeps anything that needs
   the runtime (streamed Suspense content);
2. a page references a local file missing from `out/`, in its attributes or,
   on a hydrating page, as an asset URL in its RSC payload (app data such as
   Music tracks);
3. `sitemap-0.xml` does not list exactly the exported pages (every
   `out/**/index.html`) or `sitemap-index.xml` does not point to it;
4. a post has no `out/blog/<id>/article.json` (`{ id, html }`) or the file
   references a missing local file.

It also removes `out/404/` and `out/_not-found/` (copies of the 404 that
would answer with status 200). Its HTML helpers are unit-tested in
`scripts/postbuild.test.mjs`.

Weight: the site's own pages load no JavaScript from other origins; the
only such script is Cloudflare Web Analytics' beacon, which Cloudflare adds
to every page (see Cloudflare). `/` loads about 159 KB
gzip of JavaScript before the desktop takes input (React and Next.js about
134 KB); `index.html` is about 44 KB gzip. Keep app bodies out of the
initial chunks.

### Parse-Time Scripts and Rocket Loader

Cloudflare Rocket Loader defers scripts on pepo.dev. Code that must run
while the HTML parses (mode, theme, preferences and early input in `/`'s
`<head>`; icon placement and the taskbar clock; the static pages'
behaviours) is an `<InlineScript code={...} />`:

- It emits `<script data-cfasync="false">` with `code` as written. Guard
  DOMContentLoaded handlers with a `window.__pepodev…Ready` flag, since
  Rocket Loader can replay the event.
- Write `code` as a template string in a `.ts`/`.tsx` module and inject
  build-time values with `scriptValue(value)`, which escapes `<` (and U+2028,
  U+2029) so a value cannot end or corrupt the script; never inline a bare
  `JSON.stringify`.
- Render it from a Server Component, once per page; React never runs a
  script it renders on the client. `<head>` scripts go through
  `<Document head={...}>`. `next/script` is no replacement (even
  `beforeInteractive` runs after parsing).
- A script that changes `<html>` attributes needs
  `<Document suppressHydrationWarning>`.
- To share code with client modules, a script may embed a self-contained
  function with `${fn.toString()}` (`icon-grid.ts`, `prefs-core.ts`,
  `resume-pdf.ts`, `taskbar-clock.ts`). Minification may rename
  module-level names, so such a function uses only its parameters and
  globals.
- Tests find parse-time scripts by text from their comments ("Initialize
  theme immediately"); keep comments in inline code.

### Hydration Rules

React hydrates `/` (and every page under `next dev`), so scripts that touch
server-rendered DOM follow these rules:

1. Before hydration, a parse-time script may change attributes of
   React-rendered elements (`class`, `style`, `hidden`, `inert`, `aria-*`,
   `data-*`) and add listeners. It must not change text or add, remove, or
   move nodes inside them: React then silently re-renders the tree on the
   client and loses every change and listener. Exception: an element with
   `suppressHydrationWarning` keeps changed text of its own, one level deep
   (the 404 path, the taskbar clock, the Bangkok clock).
2. When a parse-time script must change a subtree's content, render that
   subtree as a static island (`dangerouslySetInnerHTML` with build-time
   HTML); React does not compare inside it.
3. After hydration, client code may change Server Component output freely
   (there is no client-side navigation or `router.refresh()`). Never let a
   client component render DOM that other code mutates.
4. Adding nodes to `<head>` is fine at any time.

Client modules: React Strict Mode is on in development, so effects that
start listeners or timers return a cleanup. Effects run after hydration,
possibly after `DOMContentLoaded` and `load`; never wait for those events in
a client module. Anything a visitor must see earlier is a parse-time script.
On `/`, `<body>` starts with React's `<div hidden="">`; mind that in
`body > :first-child` selectors.

### Dynamic Routes

- Wrap `generateStaticParams` results in `staticParams()` and read params
  with `decodeParam()` (`src/lib/static-params.ts`), so Thai ids export as
  raw directory names and `next dev` accepts the encoded form; set
  `dynamicParams = false`. Under `next dev` an unknown id logs "missing
  param ... in generateStaticParams()"; that is expected.
- A dynamic route must never be empty: `output: "export"` fails on `[]`. The
  garden is one optional catch-all whose params always start with the home
  (`{ slug: [] }`), so builds without synced notes still pass.
- List every page in `src/lib/sitemap.ts`; postbuild compares it with the
  export. RSS item links and guids stay `https://pepo.dev/?blog=<encoded id>`.
- The 404 is `global-not-found.tsx` (experimental `globalNotFound`, as there
  is no single root layout). It renders `<Document>` itself; the requested
  path is written by an inline script.

## The React Desktop

Owner decision: the desktop is a React app whose windows, taskbar, menus,
icons, and apps render from React state, not a static desktop with bundled
DOM controllers.

`src/app/(home)/page.tsx` loads every app's build-time data
(`loadAppData()`), then renders `<Desktop appData>` (the `#desktop` panel),
the icon placement and clock scripts, and `<WebsiteMode />`.

| File (`src/components/desktop/`) | Role |
| --- | --- |
| `store.ts` | `createStore`, `useStore(store, selector)` (`useSyncExternalStore`; the server snapshot is the initial state), `commit(fn)` (state changes inside `flushSync`) |
| `apps.ts` | The app registry, shared by server and client |
| `window-manager.ts`, `Window.tsx` | Windows: open, minimize, maximize, close, focus, z-order, bounds, drag and resize, phone layout, focus hand-off, Escape, `desktop:open-app`, `desktop:close-all-windows`, first-visit Welcome |
| `overlay-state.ts`, `quick-access.ts`, `StartMenu.tsx`, `Taskbar.tsx` | The overlays, Quick Access (the Start menu: apps, commands and links) and the tray (one open at a time, focus return, Reset Desktop confirmation, Ctrl/Cmd + K), and the taskbar |
| `site-mode.ts` | `pepodev.viewMode`, `?blog=` rules, `site:mode-change`, mode switches (by delegation), scroll restore |
| `prefs-core.ts`, `prefs.ts`, `system-audio.ts`, `toasts.ts` | Preferences, `desktop:preferences`, `desktop:toggle-theme`; `pepodev.systemAudio`, `desktop:audio-settings`; toasts, `desktop:show-toast` |
| `icon-grid.ts`, `icon-layout.ts`, `DesktopIcon.tsx` | The shared icon grid (also inlined in the placement script) and icon state after hydration |
| `deep-link.ts`, `blog-article.ts` | `?blog=<slug>`; the Blog app's article files |
| `runtime.tsx`, `idle.ts` | The boot, early-input replay, `[data-open-app]` launchers, Quick Access tip, idle mounts; `whenIdle(callback, timeout)` |
| `app-chunks.ts`, `app-bodies.tsx`, `app-keys.ts`, `app-api.ts` | App code loading and prefetching, body rendering (loading, error, retry), keys for apps, the API apps use |
| `DesktopScripts.tsx`, `taskbar-clock.ts` | The desktop's parse-time scripts |

### State

- Each slice is one store with plain action functions next to it (no state
  library). Components read slices with hooks (`useWindow(appId)`,
  `useOverlayOpen(id)`, `useSiteMode()`, `useDesktopPrefs()`,
  `useSystemAudio()`, `useToasts()`, `useIconState(id)`); listeners, timers
  and components change them through the actions, which `commit()`
  synchronously when focus moves or events follow, so the DOM is current.
- Never call `commit()` (or an action that commits) while React renders or
  synchronously from an effect; use `queueMicrotask`. Nested calls join the
  outer commit. `openApp` and `mountApp` defer themselves.
- Select the smallest slice, as primitives: a window re-renders on its own
  state only, its body is memoized, a taskbar button reads only `open` and
  "focused". A drag renders only the dragged window; an idle desktop renders
  nothing. Keep it that way.
- Transient DOM details stay imperative (a window's temporary `tabindex`,
  `body.style.userSelect` during drags, `<html>` attributes and variables).
- Boot: stores start in their server state (all windows closed, site mode
  `null`, no preferences), which is what hydration sees. After hydration
  `useDesktopRuntime` boots in a microtask: preferences, toasts, overlays,
  Quick Access, site mode, icon layout, window manager, launchers, Quick
  Access tip, idle mounts, app keys, system audio, `?blog=`, then the
  replay of input made before the boot; then it sets
  `window.__pepodevWindowManagerReady`.

### Parse-Time Scripts of the Desktop

`DesktopScripts.tsx` and `HomeHeadScripts.tsx`; before hydration they never
change text (hydration rule 1): they set attributes, styles and globals (the
early-input script also scrolls, focuses and writes the clipboard), and the
stores take over with the same code:

- `<head>`: site mode; theme and accent; preferences ("Initialize theme
  immediately": background, glass, radius, effects, with the defaults boot
  applies); early input (`window.__pepodevEarlyInput`). Until the boot it
  takes clicks on `[data-open-app]` launchers and the taskbar's Start,
  clock and audio buttons, Enter or Space on a desktop icon, and Ctrl/Cmd +
  K, in order; the boot replays them and they count as interaction
  (Welcome stays closed), a launch from the keyboard (a click with `detail`
  0) moves focus into its window, and Ctrl/Cmd + K (`{ type:
  "quick-access" }`) opens Quick Access with focus in its search box, also
  when pressed again before the boot. A mode switch applies at once, keeps
  the website scroll position
  (`window.__pepodevWebsiteScrollY`, which site mode takes over at the
  boot), and counts as interaction too. Until website mode's Copy email
  button hydrates, a press on it copies at once
  (`window.__pepodevEarlyCopyEmail`) and the button shows the result when it
  hydrates (`window.__pepodevCopyEmailReady`). Other keys, icon drags, and
  other clicks are lost before the boot. Until the boot the script also
  keeps the `<html>` attributes the parse-time scripts set (mode, theme,
  preference attributes and variables): a hydration error (text that an
  extension or Cloudflare's e-mail obfuscation changed) makes React render
  the page again and reset `<html>` to its server attributes
  (`data-site-mode="desktop"`, no theme), and the script puts them back
  before the next paint.
- After `#desktop`: icon placement (above 768px in desktop mode; sets
  `data-desktop-icon-ready` and `window.__pepodevDesktopIconsReady`, and
  re-places on resize until the boot) and the taskbar clock (time and date in
  `#taskbar-clock`/`#taskbar-date`, so its button is named from first paint).
- The background canvas starts at hydration; until then the desktop shows its
  plain background colour.

### Public Contract

Tests, apps, and the garden frame rely on this; change it only with the
tests.

- Markup: `#desktop`/`#website` with `data-site-mode-panel` (after boot the
  inactive one is `hidden`, `inert`, `aria-hidden="true"`); `#bg-canvas`;
  `#desktop-icons` (`button.desktop-icon[data-open-app][data-default-col]`);
  `#desktop-links` (`role="group"`, "External shortcuts"; real
  `a.desktop-link-icon#link-<icon>[data-shortcut-index]`);
  `data-desktop-icon-ready`; `#windows-container`; windows
  `section#window-<appId>.window[data-window][data-app-id][data-title]`
  (`role="dialog"`, `aria-labelledby`, `aria-hidden`, `hidden`, `inert`;
  classes `focused`, `minimized`, `maximized`, `opening` 300 ms, `closing`
  200 ms, `mobile-window`) with `.window-titlebar`, `.window-title`,
  `.window-controls` (`.min-btn`, `.max-btn` reading Maximize or Restore in
  `title` and `aria-label`, `.close-btn`), `.window-content`, and
  `.window-resize-handle[data-resize-direction]`; `#taskbar`,
  `#taskbar-start` (`aria-expanded`, `aria-controls`), `#taskbar-apps`
  (`button.taskbar-app.active(.focused)[data-app-id][title]`),
  `#taskbar-site-mode`, `#taskbar-settings` (`data-open-app="settings"`),
  `#taskbar-audio-status` (`title` Muted or Audio on,
  `.muted`), `#taskbar-clock-button`, `#tray-panel(.visible)` (`#calendar-*`,
  `#audio-mute`, `#audio-volume`, `#audio-volume-value`); Quick Access,
  `#start-menu(.visible)` (`role="dialog"` named "Start menu",
  `tabindex="-1"`, no `aria-modal`), with `#start-menu-search`,
  `#start-menu-results` holding `#start-menu-matches` (the flat list while
  searching) and `.start-menu-section` (`role="group"`, `hidden` while
  searching) with `.start-menu-section-title` (Apps, Commands, Links), the
  items `.start-menu-item[data-type][data-id]` (`.selected`, `.confirming`):
  `button.start-menu-app[data-open-app]`, `button.start-menu-command`,
  `a.start-menu-link[href][target="_blank"]`, and `#start-menu-status`
  (`role="status"`, `data-tone="warning"` while Reset Desktop is armed);
  `#toast-container` (`aria-live`) with `.toast(.toast-show|.toast-hide)`,
  `.toast-icon`, `.toast-message`, `.toast-close`. Hidden Quick Access
  items are `display: none`.
- Events on `document`: in `desktop:open-app` `{ appId, keyboard }`
  (`keyboard: true` moves focus into the window, as a key press does),
  `desktop:close-all-windows`, `desktop:open-quick-access` (opens Quick
  Access with focus in its search box; `desktop:open-command-palette`, its
  older name, is an alias), `desktop:toggle-theme`, `desktop:show-toast`
  `{ message, duration }` (plain text); in and out `desktop:overlay-open`
  `{ id }`,
  `desktop:audio-settings` `{ volume, muted }`; out `desktop:preferences`,
  `site:mode-change` `{ mode }`. On the window element (out):
  `desktop:window-open` `{ appId, firstOpen }`, `desktop:window-focus`
  `{ appId, keyboard }`, `desktop:window-close` `{ appId }`.
- Globals: `__pepodevWindowManagerReady`, `__pepodevDesktopIconsReady`,
  `__pepodevEarlyInput`, `__pepodevWebsiteScrollY`,
  `__pepodevEarlyCopyEmail`, `__pepodevCopyEmailReady`,
  `__pepoMusicController`.
- Key listener order: app handlers (`useAppKeyboard`, capture phase on
  `document`), then React's handlers (Quick Access's arrow keys and
  Enter), the overlays' Escape and Ctrl/Cmd + K (`document`, bubble), then
  the window manager's Escape on `window`, which skips a key someone called
  `preventDefault()` on. The garden frame forwards Escape and Ctrl/Cmd + K
  as a `keydown` on the parent `document`.

### App Registry

`APPS` in `apps.ts` lists the 16 apps in window (taskbar) order: `id`,
`title` (dialog name; the taskbar label is the part before "-"), `label`,
default `width`/`height`, `startDescription` (shown and searched in Quick
Access), `icon` (default grid cell; absent for an app without a desktop
icon) and `mount`. `DESKTOP_ICON_ORDER` is the icon order. Settings has no
desktop icon: it opens from the taskbar tray (`#taskbar-settings`, a
`[data-open-app]` launcher between the mode switch and the audio button).
Each body is its own chunk, loaded by `app-chunks.ts`:

- Loading: every launch and idle mount calls `loadAppChunk(appId)` before it
  commits; it runs once per app and keeps the result. `app-bodies.tsx`
  renders the body from that result as plain state, not `React.lazy` (which
  made React hold every first body back at least 300 ms after the latest
  Suspense fallback anywhere). A body whose code is there renders in the
  same commit as its window; otherwise the window shows nothing for 150 ms,
  then "Loading…" (`.app-loading`, `role="status"`).
- Prefetching: a launcher's hover, focus, or press fetches its app; 2 s after
  the boot, in desktop mode, every app is fetched one at a time in idle time
  (each waiting at most 300 ms for it; idle mounts at most 1 s), in icon
  order and then the apps without an icon, except with Save-Data on or a 2G
  connection.
- Errors: a failed download, or a body that throws, shows "This app could not
  load" with "Try again" (`role="alert"`), which relaunches the window (from
  the keyboard it moves focus into the window first); the next launch also
  retries.
- A body mounts on its window's first launch and stays mounted when it
  closes. `mount: "idle"` bodies (Music, SRE Game, Welcome) mount hidden once
  the desktop is idle in desktop mode: Settings drives Music, the background
  asks Music for levels, tests read the SRE game's text before opening it.

### App Contract

- Body: `"use client"`, `export default function <Name>App({ appId, data }:
  AppProps<"<id>">)`, rendered inside `.window-content`, its root usually
  `<div class="app-content ...">`. Keep the classes and `data-*` attributes
  tests and global CSS use. Never import other apps' bodies or anything
  large statically. It is memoized on `(appId, data)`: moves, resizes, and
  raises never re-render it.
- Data: `<Name>App.data.ts` default-exports an async loader that runs at
  build time and returns compact JSON-serializable data (inlined in the page
  for every visitor; no Dates, functions, or elements). Compute build-time
  values there. Small static JSON may be imported in the body instead.
- Blog articles are never in `data`: `BlogApp.data.ts` returns list metadata;
  each body is `/blog/<id>/article.json` (`{ id, html }`), written by the
  post page's pipeline (`renderHtml`); `loadBlogArticle(id)` fetches it once
  (a failure retries on the next call) and the reader renders it with
  `dangerouslySetInnerHTML`. `blog.spec.ts` checks every file against its
  post page.
- Window state: `useAppWindow()` gives `open`, `minimized`, `maximized`,
  `focused`, `visible` (open, not minimized, desktop mode) and
  `focusRequest`, as one object stable while they do not change (safe as an
  effect dependency; unaffected by drags and z-order). Do not listen for
  `desktop:window-*` events. Stop on close and in website mode by reacting
  to state (`if (!open || mode !== "desktop") stop()`); reset per-visit
  state the same way.
- Focus on launch: `focusRequest` (`{ seq, keyboard }`) is bumped on every
  launch and focus hand-off, after the window manager moved focus.
  `useFocusOnLaunch(ref)` focuses `ref` then (Terminal, Gallery), on touch
  screens only when `keyboard` is true. A body that renders after its window
  opened takes focus only if nothing took it since the launch: its window is
  still focused, and focus is still on `<body>`, on the window or where the
  launch left it.
- Keyboard ownership (Calculator, Snake): `useAppKeyboard(handler)` gets only
  keys that belong to the app (`isAppKeyboardEvent`), in the capture phase,
  so the Escape or Enter that closes an overlay never reaches it. Register
  it on the first render, call `preventDefault()` on keys the app uses (the
  window manager then leaves that Escape alone; to reset as the window
  closes, react to `open`), and use the hook rather than a `keydown`
  listener. `hasAppKeyboard(appId)`/`isAppKeyboardOwner(element)` tell Snake
  when to pause; Snake also checks `document.hidden` and
  `document.hasFocus()`. Keys typed while the body loads are kept and
  replayed once it renders, while its window is open (dropped if it closes
  or shows the load error, and none are kept while the error shows): into
  the text field it focused (characters, Backspace, Enter submits the form; other keys are
  dropped), else to its handlers. Tab stays in a loading window: a Tab past
  its title bar, and every Tab after it, leaves focus on the window (so the
  keys after it are kept too), and the replay moves focus on as those Tabs
  would have with the body there. The keys typed after them replay as if
  typed there: text goes into a field, Enter (or Space, except on a link)
  presses a button or link in the window, other form fields and controls
  outside the window get none, and the rest go to its handlers. A body that
  takes focus as it renders (`useFocusOnLaunch`, a `?blog=` article) drops
  the held Tabs instead, and the other keys replay with that focus.
- Desktop actions: `useDesktopPrefs()` (null before boot),
  `updateDesktopPrefs(change)`, `toggleTheme()`, `useSystemAudio()` (the one
  source of truth, it follows `desktop:audio-settings`),
  `setSystemAudio(change)`, `useSiteMode()`, `showToast(message, { duration,
  icon })`, `resetDesktop(ms)` (clears every `pepodev.*` key and reloads),
  `openApp(appId)`, `mountApp(appId)` (mount another body without opening its
  window). `openApp`/`mountApp` run in a microtask, so they are safe in
  effects; dispatching `desktop:open-app` from an effect is not.
  `[data-open-app]` elements outside the icons launch their app on click.
  `useAppWindowElement()` returns the window element.
- Deep links: `useDeepLinkHandler((slug, { focus }) => boolean)`. For
  `?blog=<slug>` the desktop opens and maximizes Blog at boot and keeps the
  slug pending until the handler registers (no time limit); `false` shows
  "Article not found". Choosing website mode or closing Blog drops it.
  `focus` is the late-mount rule above, checked as the handler runs (and
  false while an overlay is open): when false, the visitor has moved on
  (Quick Access, another app) and the handler opens the target
  without moving focus. What the handler opens commits at once, before the
  keys typed while the app loaded replay.
- Engines (Music, SRE game, Snake, White Noise): create the engine object in a
  `useState` initializer without side effects, start and stop it in effects
  with cleanups that depend on `useAppWindow()`'s primitives; draw canvases
  imperatively.
- Gotchas: a frame loop that tests count by name keeps it through
  minification (`Object.defineProperty(fn, "name", { value: "draw" })`).
  Range inputs that tests `fill()` need a native `input` listener. Compare
  `element.style.display`, not the serialized style. Text that mixes literals
  and values is one template string.

### Desktop Experiences

Settings' "Desktop experience" picks the desktop's look: the site's own
(`pepodev`), macOS (styles Tahoe, with Liquid Glass, and Sequoia), Windows
(11 and 10) or Linux (GNOME and KDE Plasma). `experienceMap` in
`src/utils/desktop-prefs.ts` lists them; the first style is the default,
and `glass: false` marks an opaque look. They are saved as `experience` and
`variant` in `pepodev.desktopPrefs` and applied before first paint as
`data-experience` and `data-experience-variant` on `<html>`; an unknown
value falls back to the default. Every look follows the theme and accent.

- `src/styles/experiences.css` holds every look, by attribute:
  - Window chrome:
    - macOS: traffic lights on the left, each with a 22px target, and a
      centred title.
    - Windows: 46px caption buttons; Windows 10 is square, with an accent
      border on the active window.
    - GNOME: round header-bar buttons.
    - KDE: Breeze title bars.
  - The bars, and type: system font stacks over Inter, with no web fonts.
- Above 768px each look lays out the taskbar without new markup:
  - macOS: a menu bar (holding the tray) and a centred dock.
  - Windows 11: a centred taskbar. Windows 10: a flat one, aligned left.
  - GNOME: a black top bar (Activities, a centred clock, the tray) and a
    floating dash.
  - KDE: a floating panel.
  
  `#taskbar` then has no backdrop filter of its own, because a filter would
  make it the containing block of the fixed tray. It draws the dock or
  panel in `::before` and a top bar in `::after`. Phones keep the shared
  bottom taskbar and full-screen windows.
- Insets: `--desktop-inset-top` and `--desktop-inset-bottom` (defaults in
  `variables.css`, set per look above 768px) are what the bars cover.
  `readDesktopInsets` (`icon-grid.ts`) reads them for the icon grid and for
  centred, clamped and maximized windows. A preference change that moves
  them re-places the icons and re-fits maximized windows. A look with bars
  must set both.
- Settings hides the window radius slider for an operating system's look,
  and the glass preferences for an opaque one.

### Adding an App

Add it to `APP_IDS`, `APPS` and `DESKTOP_ICON_ORDER` (`apps.ts`), its loader
to `app-chunks.ts` and `apps/app-data.ts`, its icon to `AppIcon.tsx`, and
`<Name>App.tsx` plus `<Name>App.data.ts` (and `<Name>App.css` for scoped
styles) to `src/components/apps/`. Do not recreate `src/content/apps.ts`.

## Development Rules

- Prefer Server Components and build-time HTML over client-generated markup;
  keep client code scoped to interactions. A page that renders a client
  component must be `runtime="react"`.
- Use existing desktop classes, CSS variables, and TypeScript aliases:
  `@/*`, `@components/*`, `@lib/*`, `@data/*`, `@utils/*`, `@app-types/*`,
  and `@styles/*`. Never use `@types/*`.
- Define site metadata in `src/consts.ts`, not `.env`.
  `public/manifest.webmanifest` repeats `SITE_TITLE` and `SITE_DESCRIPTION`,
  and `public/robots.txt` repeats `SITE_URL`; update them together
  (`pages.spec.ts` checks this).
- Avoid broad shared-component refactors.
- No `eval`, `new Function`, or string timers: the Content-Security-Policy
  (`scripts/security-headers.mjs`) has no `'unsafe-eval'`. Anything loaded
  from another origin (script, style, image, font, frame, request) needs a
  policy change there and in the Cloudflare rule.
- CSS: `global.css` comes through `<Document>`; a feature stylesheet is
  imported by the component that needs it. A component's own styles are a
  plain CSS file next to it with every selector starting at the component's
  root class (`.site-header .site-header-nav a`, `main.blog-index`). Do not
  use CSS Modules for classes tests or other stylesheets reference. A page's
  rule on `body` becomes a class through `bodyClassName`.
- Preserve keyboard access, stable `global.css` selectors, Quick Access
  stacking (above windows and the taskbar), and case-insensitive
  `Ctrl`/`Cmd` + `K`.
- Explicit `display` rules on hidden panels require a `[hidden]` override.
- `base.css` locks only `html[data-site-mode="desktop"]` to one screen; every
  other page must scroll.
- Markdown article styles are global in `src/styles/blog.css`: `.prose` on
  post pages and garden notes, `.blog-reader-body` in the desktop reader.
  Post pages restyle `.prose` in website mode's look only inside
  `main.blog-post` (`post.css`, loaded by post pages alone), so the garden
  and the desktop Blog reader keep theirs; put blog-only article rules
  there, not in `blog.css` or `global.css`, which every page loads.
- A new desktop overlay gets an `OverlayId` in `overlay-state.ts`: announce
  it with `announceOverlay` (or `desktop:overlay-open`) when it opens,
  register its closer (`registerOverlayCloser`), close it with
  `closeOverlayPanel` (focus returns to its opener), and call
  `preventDefault()` on the Escape it handles. Add its open selector to
  `isDesktopOverlayOpen` (`src/utils/app-keyboard.ts`). Move focus with
  `canTakeFocus`/`focusFirst` (`src/utils/overlays.ts`).
- Put a `-webkit-` declaration before its standard property. CSS minification
  drops a standard property followed by its prefixed twin, and keeps prefixes
  only for browsers in `browserslist` (`package.json`).
- Keep text at WCAG AA in both themes, on glass and on opaque windows, and
  focus rings at 3:1; `--text-muted` meets AA too. The accents are pale in
  the light theme, so accent-coloured text in windows and the tray uses
  `--app-accent-text`, `--app-primary-text`, or `--app-amber-text`
  (`app-base.css`, set only in the light theme, falling back to the accent
  in the dark one), or `--text-primary`/`--text-secondary`, and keeps the
  accent for borders and tints. Labels on the translucent Quick Access
  menu, tray, and taskbar use `--text-secondary`. Surfaces that stay dark
  in both themes (the Snake board, the SRE game, Terminal) point the
  `--text-*` variables at the `--dark-text-*` ones in `variables.css`. In
  the light theme the garden's links, inline code, and callout titles use
  their accent's hue at OKLCH lightness 0.42 (`garden.css`). The
  opaque-window axe test in `apps.spec.ts` checks the content apps; glass
  hides backgrounds from axe.
  One known gap: in the light theme, a window at low glass opacity stacked
  over one of those dark windows shows grey behind its text.
- Honor `prefers-reduced-motion`: the desktop background paints one still
  frame, window, icon, app, and website-mode animations stop, and toasts
  fade without sliding. Keep focus and selection visible in
  forced-colors mode (the highlighted Quick Access item gets a `Highlight`
  outline).
- Website mode is dark by default and follows the Settings theme
  (`data-theme="light"` on `<html>`) and accent, both applied by the `<head>`
  script before first paint (on `/` and on the blog pages; the garden
  applies the theme). Size its text in `rem` and set its breakpoints
  in `em`, so it follows the browser's text size. Rows that run edge to edge
  inside a panel or scroller use inset focus rings, which the panel cannot
  clip. Neither mode panel is `aria-hidden` in the markup:
  `html[data-site-mode]` hides the other one from first paint, before
  site-mode also marks it hidden and inert.
- Website mode is a Server Component (repeated in the RSC payload, so keep it
  lean); only `SiteModePanel` and two islands hydrate. The Bangkok clock's
  parse-time script writes the current time before first paint; the Copy
  email button renders from first paint and hydration hides it only where
  the Clipboard API is missing. A press before hydration copies at once
  (the early-input script), and "Copied" shows when the button hydrates.
- All type is self-hosted from the woff2 files committed in
  `src/assets/fonts/` (`src/styles/fonts-desktop.css`,
  `src/styles/fonts-website.css`): Inter and JetBrains Mono (`--font-sans`,
  `--font-mono`) for the desktop, resume, and 404, without preload so
  website mode never downloads them; IBM Plex Sans, Sans Thai, and Mono for
  website mode, imported only by the `(home)` and `(garden)` layouts and
  `BlogShell` (the blog index and posts). Never
  load fonts from Google at runtime (no CSS `@import`), and do not use
  `next/font` (it needs Google at build time or cannot express the
  `unicode-range` subsets). To update a font, download the woff2 subsets
  from the Google Fonts css2 API, replace the files and `unicode-range`
  values, and keep the file names. They are under the SIL Open Font License
  (`src/assets/fonts/OFL.txt`).
- pnpm `overrides` in `pnpm-workspace.yaml` pin patched versions of vulnerable
  build-time packages; keep `pnpm audit` clean and drop an override once
  Next.js's own ranges exclude the bad versions.
- `minimumReleaseAge: 4320` in `pnpm-workspace.yaml`: pnpm resolves only
  versions published at least 3 days ago, the rule Dependabot's npm updates
  apply. A lockfile holding a younger version makes every Dependabot update
  fail until that version turns 3 days old, so never work around it (no
  `minimumReleaseAgeExclude`) to take a release early.

### Content and Apps

- Store portfolio content in `src/data/`; update `src/types/data.ts` for schema
  changes and extract reusable logic to `src/utils/`.
- Years of experience, company count, tenure, and the career-uptime strip are
  computed at build time by `src/utils/experience.ts` from each
  `experiences.json` period (`"May 2020 - June 2022"` or
  `"February 2024 - Present"`); do not hard-code them. The uptime summary's
  `data-as-of` holds the build month, which the tests compute from, so a
  test run in a later month than the build still passes. The About role and
  bio and the SRE game's closing screen use `experiences.json[0].role`, the
  Terminal `skills` command prints `skills.json`, and the Projects heading
  counts `projects.json`. Education lives in `education.json`.
- In `projects.json`, `name` and `github` follow the repository's current name,
  every `link` is https, and `archived` and `stars` mirror GitHub; a repo
  archived on GitHub is not shown as Active. A project's optional `summary` is
  the website-mode copy; it falls back to `description`.
- Store posts in `src/content/blog/`. `src/lib/content.ts` loads them
  (`getCollection`, `render`, `renderHtml`) with zod-validated YAML
  frontmatter; ids are each path segment through github-slugger, extension
  and a trailing `/index` dropped, or a frontmatter `slug`; two entries with
  one id fail the build. Reference prefixed local images from
  `src/assets/blog/`; builds optimize them to WebP. `cover-picture` and
  `heroImage` resolve as images, so they must be relative paths to existing
  files.
- Every post needs `title` and `pubDate` frontmatter next to its Obsidian
  fields. List posts through `src/utils/blog.ts` (and notes through
  `src/utils/garden.ts`), not `getCollection`, so drafts, sort order, and
  fallbacks match everywhere. Post ids, URLs, and RSS links come from file
  names; do not change them.
- Give every content image alt text that says what it shows, in the post's
  language; a linked image's alt names the link target. Leave alt empty only
  for decorative images.
- Post pages and the desktop reader take `lang` (and post pages `og:locale`)
  from `getPostLanguage()`. Post pages also get `article:published_time` and
  BlogPosting JSON-LD, and an `og:image` JPEG at most 1200px wide. The blog
  index and RSS channel use `BLOG_TITLE` and `BLOG_DESCRIPTION`. Pages with
  `noindex` (the 404) get no canonical, `og:url`, or `twitter:url`.
- Markdown renders with `satteri` (`src/lib/markdown.ts`): GFM, no smart
  punctuation (so `--flags` and straight quotes match Obsidian), Shiki
  `github-dark` code blocks, github-slugger heading ids. `satteri` is
  pinned: the garden sync parses with the same version. MDX `import`
  statements are not supported; pass components through
  `<Content components={...} />` (not supported by `renderHtml`). A
  `<script>` written as raw HTML runs on the post page but not in the
  desktop Blog reader.
- `src/lib/images.ts` gives Markdown and `<ResponsiveImage>` output a
  constrained srcset: `src` at the display width, 1x, 2x, and the
  breakpoints 640/960/1280/1920 up to the source width (never upscaled),
  `loading="lazy"`, `decoding="async"`; `width` with `height` crops; SVGs are
  copied without srcset. Files go to `public/_img/` once per build; a missing
  source fails the build. The desktop Blog app loads each article from
  `out/blog/<id>/article.json` when it opens; check those files' size after
  adding breakpoints or many images.
- Put audio in `public/music/`; `src/data/music.ts` discovers it at build time.
  Verify playback in a real browser.
- Regenerate `public/og-image.png` with
  `node scripts/generate-og-image.mjs`. `favicon.ico` holds only 16, 32, and
  48 px and is declared with `sizes="32x32"` before `favicon.svg`, so Chromium
  uses the SVG; regenerate `icon-192.png` and `icon-512.png` from `favicon.svg`
  when the mark changes.
- The digital garden comes only from `pnpm garden:sync`. It publishes vault
  notes with `dg-publish: true` (except `Blog/`), turns links to unpublished
  notes into plain text, drops comments and frontmatter, and copies only
  embedded attachments. Code is found with `satteri`, the parser the site
  renders with, and every note is re-parsed before writing: a note that would
  publish a comment, a raw wikilink, or a vault path is skipped with a
  warning. Never commit vault content or log unpublished note names; keep
  `pnpm test:garden` passing when changing the sync. Garden URLs are
  `/garden/<slugified vault path>/`; list notes through `src/utils/garden.ts`.
- The blog index and posts are part of website mode
  (`html[data-site-mode="website"]`, `website-mode.css`, the website fonts),
  inside `BlogShell` (`src/components/blog/`): website mode's header (the
  brand home; Writing, Garden once it has notes, and Resume; the RSS feed
  where `/` has its mode switch) and footer. Their `<head>` script
  (`BlogScripts.tsx`) applies the saved theme (`pepodev.desktopPrefs`, then
  `pepodev.theme`, else dark) and accent before first paint, and follows
  changes saved in other tabs. The index is laid out like website mode's
  Writing section; a post shows its title, lede, and byline (date and
  reading time, `getReadingMinutes()`), then the article in a panel (cover,
  `.prose`, topics), and on wide screens a table of contents and three more
  posts beside it. They stay static (`runtime="none"`).
- The garden pages are static; their theme and embed script runs in `<head>`,
  the filter and frame script at the end of `<body>`. The desktop Garden app
  frames `/garden/` instead of inlining notes into `out/index.html`. Inside
  the frame the garden hides the site header, gives links that leave the
  garden `target` and `rel`, and forwards `mousedown`, `click`, `focusin`,
  `Escape`, and `Ctrl`/`Cmd` + `K` to the desktop. Lists of names that can
  repeat (folders, tags) are keyed by position.
- The resume remains a standalone static `/resume/` page (GitHub Pages
  redirects `/resume`, so link with the slash); do not restore a resume app.
  It renders as HTML from `experiences.json`, `skills.json`,
  `education.json`, and `certifications.json`, and Download PDF builds the
  PDF in the browser from the same data (`createResumePdf`, inlined into
  `ResumeDownloadScript` with its data through `scriptValue()`), measuring
  text with Helvetica AFM widths and adding `/Info` metadata and link
  annotations. Never auto-download, close the window, or navigate away.
- Music and Settings share `apps/music-settings.ts`: Music publishes
  `window.__pepoMusicController` (`setPlaying`, `setTrack`,
  `requestAudioFrame`) when its body mounts and dispatches
  `desktop:music-settings` on every save; Settings mounts Music
  (`mountApp("music")`) and drives it only through the controller, keeping a
  request made earlier until it appears. A media error shows only once
  playback was asked for, then stays visible.

### Interaction Invariants

- App and external shortcut icons share one grid (`icon-grid.ts`, used by the
  placement script and `icon-layout.ts`): saved positions first, then app
  defaults, then links down the right edge (Webring first), each taking the
  nearest free cell. Dropping an icon on an occupied cell swaps the two
  icons. Above 768px, icons stay hidden until placed
  (`data-desktop-icon-ready`), so the first layout does not shift.
- Only a drag saves an icon position. Resizes re-clamp in memory, and layout
  waits while the desktop is hidden.
- Windows are non-modal dialogs (`role="dialog"`) labelled by their title.
  `Escape` closes the focused window after overlays handle it. Opening a
  window from the keyboard focuses it before `desktop:window-open`. Every
  launch (a new window, a restore, or an already open one, from an icon,
  Quick Access, or the taskbar) and every hand-off of focus into
  the next window then dispatches `desktop:window-focus`, whose
  `detail.keyboard` says whether DOM focus moved into the window, and bumps
  the app's `focusRequest`. Closing or minimizing the focused window hands
  `.focused` to the topmost remaining one; after a pointer close, DOM focus
  is dropped so the next app gets the keys, and from the keyboard focus
  returns to the window's launcher if still shown, else into the topmost
  window, else to the app's icon. Tabbing into a window focuses it.
  Minimized and closed windows are `inert` and `aria-hidden`. Taskbar window
  buttons are named by their label, which phone widths hide only visually.
- After a click or tap on a taskbar window button, the button gives up focus,
  so the window gets the keys and Enter does not press it again; Tab then
  reaches the first window button and Shift+Tab the Start button. From the
  keyboard, focus stays on it or follows into the window.
- Windows drag by the title bar and resize from their handles with a mouse, a
  finger, or a pen (pointer events; above 768px the title bar and handles are
  `touch-action: none`), and a touch drag raises the window as a click does.
  Dragging keeps a window's title bar between the bars with at least 120px
  of it on screen. Maximized windows fill the space between the bars
  (`readDesktopInsets()`: the taskbar, or a look's top bar and dock), and
  Maximize reads Restore while maximized. An overflowing `.window-content`
  with nothing focusable inside (hidden and disabled controls do not count)
  is a labelled tab stop; an inner scroller of its own, such as the SRE
  game's boot log, is a labelled tab stop too. Toasts sit below a maximized
  window's title bar.
- Quick Access (the Start menu, `#start-menu`) is the desktop's one
  launcher; there is no separate command palette. It and the tray panel are
  `inert` while closed, and only one is open at a time: opening one closes
  the other. Both are non-modal (no focus trap, no backdrop): Tab moves
  through Quick Access's search box and visible items, and tabbing out of
  either, or a click outside, closes it. The Start button or `Ctrl`/`Cmd` +
  `K` (any case, desktop mode, also forwarded by the garden frame) opens
  Quick Access. `Ctrl`/`Cmd` + `K` focuses its search box synchronously
  after the commit, on every screen, so keys typed straight after it are
  searched rather than lost; the Start button focuses the search box too,
  but on phones and touch tablets the menu itself, so no on-screen keyboard
  covers it. Escape, the Start button, or `Ctrl`/`Cmd` + `K` return focus to
  what had it before Quick Access opened (a window or its content
  included), or, when that is gone, to the topmost window, else the Start
  button; launching an app does not (the window takes focus), and Close All
  Windows sends focus to the Start button. Escape or a toggle returns focus
  from the tray to the button that opened it. The tray's audio button opens
  the tray, so it is named "Audio settings" with no pressed state; Mute is
  in the tray. The taskbar clock is named by its time and date from first
  paint.
- Quick Access holds the apps, three commands (Toggle Theme, Close All
  Windows, Reset Desktop) and the links in `src/data/social-links.json`
  (opened in a new tab). An empty query shows them in titled sections:
  Apps, Commands, Links. A search shows one flat list across all of them,
  ranked by `rankMatch` (`src/utils/search.ts`): names that start with the
  query (or a word in it) first, then other name matches, then description
  matches (apps match their label and Start description), ties in section
  order, so "set" puts Settings above Reset Desktop. Every item stays in the
  DOM (hidden ones `display: none`), so the visual, Tab and arrow-key orders
  agree. The top match is highlighted; ArrowUp and ArrowDown move the
  highlight (and focus, when it is on an item), it follows focus and
  clicks, and Enter in the search box runs it. When nothing matches, the
  status line says "No matching apps, commands or links". Reset Desktop,
  and Settings' Reset all settings, run only on a second Enter, click, or
  tap, with the reason shown in a status line that stays in view on phones
  (touch wording on coarse pointers); typing, choosing another item, or
  closing Quick Access disarms Reset Desktop, which reloads after 500 ms.
  Toggle Theme asks Settings to switch (`desktop:toggle-theme`), so both
  apply the same preferences.
- Calculator and Snake take keys only while their window is focused in desktop
  mode with no overlay open and no Ctrl, Meta, or Alt (AltGr is allowed). Form
  fields and controls outside the window keep their keys, a focused button or
  link inside it keeps its Enter and Space, the app's own launcher hands its
  keys over, and Snake pauses whenever it loses the keyboard, including to a
  hidden tab or another app in front of the browser. Pointer presses on
  Calculator and Snake buttons do not focus them, so Enter after clicking keys
  still means "=". Keys typed right after a launch, before the app's code
  arrives, still reach it. The shared guard is `src/utils/app-keyboard.ts`.
- Storage keys are `pepodev.desktopPrefs`, `pepodev.theme` (a mirror of
  `desktopPrefs.theme`, read when the preferences have no theme),
  `pepodev.music`, `pepodev.systemAudio`, `pepodev.snake.best.v2`,
  `pepodev.desktopIcon.v3.<appId>`, `pepodev.linkIcon.v4.<link id>`,
  `pepodev.hasVisited` (first-visit Welcome), and
  `pepodev.commandPaletteHintShown` (when the Quick Access tip last showed;
  it keeps its command-palette name so returning visitors are not shown
  the tip again). Older
  icon key versions are removed on load; bump the version to discard saved
  layouts. The old `pepodev.snake.best` is removed on load. Corrupt saved
  system audio falls back to valid values.
- `pepodev.viewMode` stores `desktop` or `website`; first visits default to
  desktop, while a non-empty `?blog=` deep link temporarily opens desktop mode
  without overwriting the saved preference, and an unknown slug shows an
  "Article not found" toast. Picking a mode removes `?blog=` from the URL, so a
  reload keeps the choice. Mode switches are action buttons with fixed names
  and no `aria-pressed`; switching hands focus to the other panel's switch,
  and the website scroll position survives a round trip to desktop.
- The media element, not persisted `pepodev.music.playing`, is authoritative.
  Music and White Noise stop when their window closes and when the site
  switches to website mode, which has no audio controls. Music fetches no media
  on page load, and playback never waits for `AudioContext.resume()`. The
  visualizer animates only while music plays in its visible window; the
  desktop background asks for levels through
  `window.__pepoMusicController.requestAudioFrame()`.
- The desktop Blog reader opens every article at the top with focus on Back,
  from the list or a `?blog=` link (an unknown slug focuses the first
  article); a link whose Blog app loads after the visitor moved focus
  elsewhere opens its article without taking focus. Back restores the list
  position. An article that fails to load shows "Try again", which keeps
  focus on Back. Links in articles open in a new tab, so the desktop never
  navigates away.
- Anything that changes desktop preferences dispatches `desktop:preferences`;
  Settings re-renders from the preferences store.
- Welcome opens 1.5 s after a first visit loads unless the visitor acted first
  or followed a `?blog=` link.
- Snake's board shrinks with the window and never covers its controls; a new
  visitor's best score is 0. Calculator keeps the newest digits in view and
  reports errors without clearing the input; it evaluates with
  `calculator-expression.ts`, which gives JavaScript's results without eval.
  Terminal and Gallery focus their
  input when opened, restored, or launched again; on touch screens only when
  the keyboard opened them, so a tap does not raise the on-screen keyboard.
  The SRE game resets to its boot log on every opening, stops on close, and
  freezes (timers and music) while minimized, while its tab is hidden, or in
  website mode.
- Gallery password is intentionally the literal `password`.
- Certifications sort as Active (at least 90 days remaining), Expiring Soon,
  then Expired; badges refresh hourly. Data and sorting live in
  `src/data/certifications.json` and `src/utils/certifications.ts`. Expired
  ones read as earned history: "Earned <Month YYYY>" with a muted "Expired
  <Month YYYY>" and no badge. The resume lists "<name>, earned <YYYY>".
  `credlyUrl` is the public badge link
  `https://www.credly.com/badges/<uuid>/public_url`, and the dates follow
  Credly's public record (`https://www.credly.com/users/pepodev/badges.json`).
- White Noise intentionally has no rain animation.
- The Quick Access tip toast reads "Quick tip: Press Ctrl + K (Cmd on Mac)
  to open Quick Access". Hide it at widths `<=768px`; otherwise show it 3 s
  after load in desktop mode on the first visit or every seven days.
  It closes itself after eight seconds; other toasts after five.

## Verification

For substantial changes:

1. Run `pnpm build` (postbuild included) and `pnpm check`.
2. Run `pnpm test:e2e` for desktop/app interactions, and against the export
   (`PLAYWRIGHT_SERVER=preview`) for anything that touches static pages, the
   page runtime, or parse-time scripts. Run `pnpm test:scripts` after
   changing `scripts/`.
3. Check `out/index.html` after page composition or app content changes.
4. Manually test window opening, minimizing, maximizing, closing, dragging, and
   taskbar behavior when interaction code changes.
5. Confirm affected `/`, `/blog/`, `/garden/`, `/rss.xml`, and `/404.html`
   routes build for content changes, and blog pages scroll without sideways
   overflow at phone width. Build once with and once without synced garden
   notes after garden changes.

Still open: check on pepo.dev, with Rocket Loader on, that parse-time
scripts run before first paint and hydration is not deferred.

## Deployment and Git

GitHub Pages deploys `main` through `.github/workflows/deploy.yaml`
(permissions `contents: read` unless a job needs more):

| Job | Push to `main`, schedule, manual run on `main` | Manual run on another branch | Pull request into `main` |
| --- | --- | --- | --- |
| `garden` | Syncs the vault when `VAULT_DEPLOY_KEY` is set | Skips its steps | Skips its steps |
| `build` | `pnpm install --frozen-lockfile`, `pnpm build`, uploads `out/` (`actions/upload-pages-artifact`) | Same, without garden notes | Same, without garden notes |
| `test` | `pnpm test:scripts`, then Playwright against that artifact in Google Chrome | Same | Same |
| `deploy` | Publishes the artifact (`actions/deploy-pages`) after `build` and `test` pass | Skipped | Skipped |

- Concurrency: runs of `main` share the group `pages`, one at a time; a newer
  run waits (replacing any already waiting) instead of cancelling a deploy,
  so an older build cannot deploy over a newer one. Every other ref gets its
  own group, so a pull request or another branch can never cancel, replace,
  or delay a `main` run; a new push to a pull request cancels its older run.
- Schedule: hourly (`17 * * * *`), which keeps the computed experience values
  current and picks up newly published garden notes. GitHub disables a
  schedule after 60 days without repository activity (a push to `main`
  resets it); re-enable it in the Actions tab, or with
  `gh workflow enable deploy.yaml`, if the values go stale.
- Garden: `VAULT_DEPLOY_KEY` is a read-only deploy key on
  `PePoDev/obsidian-vault`. Only the `garden` job sees it, only for runs of
  `main`: it checks out only the vault's Markdown and attachments, installs
  packages with `--ignore-scripts` and no cache, runs nothing but the sync,
  and passes the published notes to `build` and `test` as an artifact (a sync
  that publishes nothing fails the job). Keep the key out of any job that
  builds or runs package scripts, and never use `pull_request_target`.
- Dependabot (`.github/dependabot.yml`): weekly npm updates for the pnpm
  lockfile (Next.js, React, and their types grouped together; every other
  minor and patch update in one group; majors one per pull request;
  TypeScript 7 and later ignored, since `pnpm check` stays on 6, and
  `@types/node` majors ignored, since they follow the Node.js major the
  workflow runs) and weekly GitHub Actions updates. Its pull requests run `build` and `test` without
  secrets; merge one only when green (the merge deploys). Pull request runs
  write their pnpm cache to their own ref only.

Preserve existing worktree changes, avoid destructive Git commands unless
explicitly requested, and do not commit generated artifacts unless tracked.

### Cloudflare

pepo.dev is GitHub Pages behind Cloudflare. GitHub Pages cannot send headers
or redirect hosts, so these zone settings belong to the site; keep them as
written here.

- DNS: `pepo.dev` is a proxied CNAME to `pepodev.github.io`. `www` is
  proxied too (its target does not matter): GitHub Pages has no certificate
  for `www.pepo.dev`, so the redirect rule below must answer it at
  Cloudflare. A DNS-only `www` reaches GitHub Pages, and HTTPS fails there.
- Redirect rule "www to pepo.dev" (Rules > Overview > Create rule >
  Redirect Rule): wildcard pattern, request URL `http*://www.pepo.dev/*`,
  target URL `https://pepo.dev/${2}`, status 301, preserve query string.
- Email Address Obfuscation (Security > Settings): off. It rewrites the
  address in the HTML React hydrates, and shows "[email protected]" without
  JavaScript.
- Web Analytics: on, set up automatically. Cloudflare injects its beacon, a
  module script from `https://static.cloudflareinsights.com/beacon.min.js/v…`
  with `crossorigin`, into every HTML page. It is the one script from
  another origin, so `script-src` allows that whole host (a path such as
  `…/beacon.min.js` would block the versioned URL). The beacon reports to
  the site's own `/cdn-cgi/rum` (`connect-src 'self'`);
  `https://cloudflareinsights.com` is there for a beacon added by hand,
  which reports there.
- Response header transform rule "Security headers" (Rules > Overview >
  Create rule > Response Header Transform Rule; its form reads "Modify
  response header". A request header rule sends the headers to GitHub
  Pages instead, and visitors never see them): all incoming requests, Set
  static for each header that `node scripts/security-headers.mjs` prints,
  with the name and value exactly as printed. Paste each value whole: the
  policy's directives are separated by `; `, and a comma would start a
  second policy that blocks every inline script, so the desktop would never
  boot. `scripts/serve-static.mjs` sends the same headers, so the Playwright
  suite runs under them, and `pages.spec.ts` checks that every page and app
  (with a stand-in for Cloudflare's beacon) works without a policy
  violation. Update the rule whenever that file changes.
- HSTS (SSL/TLS > Edge Certificates): on, max-age 12 months, subdomains off
  (DNS-only subdomains such as `ds925` may not serve HTTPS), no preload,
  No-Sniff header off (the transform rule sets X-Content-Type-Options). It
  is not part of the transform rule.
- Cache rules (Caching > Cache Rules), in this order:
  1. "Build assets", `starts_with(http.request.uri.path, "/_next/static/") or
     starts_with(http.request.uri.path, "/_img/")`: eligible for cache; edge
     TTL: ignore cache-control header, 1 year; browser TTL: override origin,
     1 year. Their names carry content hashes, so a deploy never changes a
     file at the same URL.
  2. "Music", `starts_with(http.request.uri.path, "/music/")`: eligible for
     cache; edge TTL: ignore cache-control header, 1 day; browser TTL:
     respect origin. Purge the cache after replacing a track under the same
     name.
- Browser Cache TTL (Caching > Configuration): Respect Existing Headers.
  Everything the cache rules do not cover keeps GitHub Pages' `max-age=600`:
  HTML is never cached at the edge, and files with an extension Cloudflare
  caches by default (`favicon.ico`, the icons, `og-image.png`, `robots.txt`)
  are cached for those 10 minutes, so a deploy shows within 10 minutes.
- Nothing may bypass the cache. `cf-cache-status: DYNAMIC` on such a file
  (as on every file, even `favicon.ico`, in October 2026) means something
  does: Development Mode (Caching > Configuration), a cache rule set to
  Bypass cache (the last matching cache rule wins), or a legacy "Cache Level:
  Bypass" Configuration Rule or Page Rule. Cloudflare Trace on
  `https://pepo.dev/favicon.ico` shows which.
- Rocket Loader may stay on (see Parse-Time Scripts and Rocket Loader).

To check, after any change: `node scripts/security-headers.mjs --check`
prints "Every header matches." (it checks `/` and the 404 page);
`curl -sI 'https://www.pepo.dev/blog/?a=1'` answers 301 with
`location: https://pepo.dev/blog/?a=1`; and `curl -sI
https://pepo.dev/favicon.ico` run twice answers `cf-cache-status: MISS`,
then `HIT`.
