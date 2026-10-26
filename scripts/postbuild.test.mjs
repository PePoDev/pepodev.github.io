// node --test scripts/postbuild.test.mjs (pnpm test:scripts)
import assert from "node:assert/strict";
import test from "node:test";
import { appModuleProblems, bundleProblems, esbuildTargets, readAppModules, useIdProblems } from "./desktop-bundle.mjs";
import {
  addDesktopBundle,
  dataAssetUrls,
  DESKTOP_COMPONENT,
  readClientManifest,
  rocketLoaderProblems,
  runtimeLeftovers,
  stripRuntime,
} from "./postbuild.mjs";

const push = (chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`;

// What next build writes for a static page, trimmed: Next.js's scripts
// around the page's own inline script, JSON-LD and a post's raw HTML.
const page = (body, payload = '0:["$","p",null,{}]\n', runtime = "none") =>
  [
    '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>',
    `<meta name="pepodev-runtime" content="${runtime}"/>`,
    '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/1-abc.js"/>',
    '<script src="/_next/static/chunks/3hd4.js" async=""></script>',
    '<script src="/_next/static/chunks/turbopack-2c3m.js" async=""></script>',
    '<script type="application/ld+json">{"@type":"Person"}</script>',
    '<script src="/_next/static/chunks/0cz1.js" noModule=""></script>',
    '<link rel="preconnect" href="/" crossorigin=""/><meta name="next-size-adjust" content=""/>',
    '</head><body><div hidden=""><!--$--><!--/$--></div>',
    body,
    '<script data-cfasync="false">(() => { window.__pepodevPrefetchReady = true; })();</script>',
    '<script id="_R_">(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push({"otherChunks":[]})</script>',
    '<script>(self.__next_f=self.__next_f||[]).push([0])</script>',
    push(payload),
    "</body></html>",
  ].join("");

test("static pages lose Next.js's scripts and keep their own and the content's", () => {
  const content =
    '<main><p>Embed:</p><script src="https://gist.github.com/example/abc.js"></script>' +
    "<p>Escaping test: <script>alert(1)</script> and 5 &lt; 6</p></main>";
  const { html, problems } = stripRuntime(page(content), new Map());
  assert.deepEqual(problems, []);
  assert.ok(html.includes(content), "the post's raw HTML scripts stay");
  assert.ok(html.includes('<script data-cfasync="false">(() => { window.__pepodevPrefetchReady'));
  assert.ok(html.includes('<script type="application/ld+json">'));
  for (const gone of ["/_next/", "__next_f", "TURBOPACK", "pepodev-runtime", "next-size-adjust", '<div hidden="">']) {
    assert.ok(!html.includes(gone), `${gone} is removed`);
  }
});

test("a static page that needs the runtime is reported", () => {
  const clientModules = new Map([
    ["101", "src/components/Island.tsx"],
    ["102", "node_modules/.pnpm/next@16.4.3/node_modules/next/dist/client/components/layout-router.js"],
  ]);
  const payload = '1:I[101,["/_next/static/chunks/a.js"],"default"]\n2:I[102,[],""]\n3:I[999,[],""]\n';
  const { problems } = stripRuntime(page("<main></main>", payload), clientModules);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /src\/components\/Island\.tsx/);
  assert.match(problems[0], /client module 999 \(not in the manifests\)/);
  assert.doesNotMatch(problems[0], /layout-router/);

  const streamed = stripRuntime(page('<template id="B:0"></template><script>$RC("B:0","S:0")</script>'), new Map());
  assert.deepEqual(streamed.problems, ["still contains streamed Suspense content"]);
});

test("client reference manifests are read whatever the route key holds", () => {
  const manifest = (route) =>
    "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n" +
    `globalThis.__RSC_MANIFEST[${JSON.stringify(route)}] = ${JSON.stringify({
      clientModules: {
        "[project]/src/components/NegClient.tsx <module evaluation>": { id: 46367, chunks: [] },
      },
    })};\n`;
  for (const route of ["/(home)/page", "/(post)/blog/[slug]/page", "/(garden)/garden/[[...slug]]/page"]) {
    assert.deepEqual(readClientManifest(manifest(route)), [["46367", "src/components/NegClient.tsx"]], route);
  }
  assert.equal(readClientManifest("module.exports = {};"), null);
});

test("the desktop page keeps the desktop hydrating and nothing else", () => {
  const clientModules = new Map([
    ["101", DESKTOP_COMPONENT],
    ["102", "src/components/website/Clock.tsx"],
  ]);
  const desktopOnly = '1:I[101,["/_next/static/chunks/a.js"],"Desktop"]\n';
  assert.deepEqual(stripRuntime(page("<main></main>", desktopOnly, "desktop"), clientModules, [DESKTOP_COMPONENT]).problems, []);
  const { problems } = stripRuntime(
    page("<main></main>", `${desktopOnly}2:I[102,[],"Clock"]\n`, "desktop"),
    clientModules,
    [DESKTOP_COMPONENT],
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /src\/components\/website\/Clock\.tsx/);
  assert.doesNotMatch(problems[0], /Desktop\.tsx/);
});

test("the desktop bundle's files go in <head>, its entry at the end of <body>, and data asset URLs are found", () => {
  const html = addDesktopBundle(
    '<html><head><meta charSet="utf-8"/></head><body>' +
      '<script type="application/json" id="desktop-data">{"music":{"src":"/music/Midnight_Velocity(1).mp4"},"blog":{"href":"/blog/","icon":"/favicon.svg"}}</script>' +
      "</body></html>",
    {
      entry: "/_next/static/desktop/desktop-AB.js",
      preload: ["/_next/static/desktop/chunk-CD.js"],
      apps: { calculator: "/_next/static/desktop/CalculatorApp-EF.js", gallery: "</script>" },
    },
  );
  assert.equal(
    html.slice(html.indexOf("<link"), html.indexOf("</head>")),
    '<link rel="modulepreload" href="/_next/static/desktop/chunk-CD.js"/>' +
      '<link rel="modulepreload" href="/_next/static/desktop/desktop-AB.js"/>' +
      '<script data-cfasync="false" type="module" async="" src="/_next/static/desktop/chunk-CD.js"></script>' +
      '<script type="application/json" id="desktop-apps">' +
      '{"calculator":"/_next/static/desktop/CalculatorApp-EF.js","gallery":"\\u003c/script>"}</script>',
  );
  assert.ok(
    html.endsWith(
      '</script><script data-cfasync="false" type="module" async="" src="/_next/static/desktop/desktop-AB.js"></script></body></html>',
    ),
  );
  assert.deepEqual(rocketLoaderProblems(html), []);
  assert.deepEqual(dataAssetUrls(html), [
    "/_next/static/desktop/CalculatorApp-EF.js",
    "/music/Midnight_Velocity(1).mp4",
    "/favicon.svg",
  ]);
});

test("every script on the desktop page opts out of Rocket Loader before its src", () => {
  assert.deepEqual(
    rocketLoaderProblems(
      '<script data-cfasync="false">1</script><script type="application/ld+json">{}</script>' +
        '<script type="application/json" id="x">{}</script>',
    ),
    [],
  );
  assert.deepEqual(rocketLoaderProblems('<script type="module" src="/a.js" data-cfasync="false"></script><script>1</script>'), [
    'Rocket Loader would take over <script type="module" src="/a.js" data-cfasync="false">',
    "Rocket Loader would take over <script>",
  ]);
});

test("the desktop bundle reads the app bodies from app-loaders.ts and the targets from browserslist", () => {
  const source = [
    "const loaders = {",
    '  welcome: () => import("@components/apps/WelcomeApp"),',
    '  me: () => import("@components/apps/AboutApp"),',
    "};",
  ].join("\n");
  assert.deepEqual(readAppModules(source), [
    ["welcome", "WelcomeApp"],
    ["me", "AboutApp"],
  ]);
  assert.deepEqual(esbuildTargets(["chrome 111", "ios_saf 16.4", "safari 16.4"]), ["chrome111", "ios16.4", "safari16.4"]);
});

test("the desktop bundle's app list must match APP_IDS", () => {
  const modules = [
    ["welcome", "WelcomeApp"],
    ["me", "AboutApp"],
  ];
  assert.deepEqual(appModuleProblems(modules, ["welcome", "me"]), []);
  assert.match(appModuleProblems(modules, ["welcome", "me", "blog"]).join(), /line for blog/);
  assert.match(appModuleProblems([...modules, ["me", "AboutApp"]], ["welcome", "me"]).join(), /repeated app ids: me/);
});

test("every shared chunk loads with the entry, and app bodies load on demand", () => {
  const dir = "out/_next/static/desktop";
  const metafile = (outputs) => ({ inputs: { "src/x.ts": {} }, outputs });
  const entry = `${dir}/desktop-A.js`;
  const modules = [
    ["music", "MusicPlayerApp"],
    ["settings", "SettingsApp"],
  ];
  const good = {
    [entry]: {
      entryPoint: "src/components/desktop/browser-entry.tsx",
      inputs: { "src/components/desktop/Desktop.tsx": {} },
      imports: [
        { path: `${dir}/chunk-B.js`, kind: "import-statement" },
        { path: `${dir}/MusicPlayerApp-C.js`, kind: "dynamic-import" },
      ],
    },
    [`${dir}/chunk-B.js`]: { inputs: { "react/index.js": {} }, imports: [{ path: `${dir}/chunk-D.js`, kind: "import-statement" }] },
    [`${dir}/chunk-D.js`]: { inputs: { "src/components/apps/music-settings.ts": {} }, imports: [] },
    [`${dir}/MusicPlayerApp-C.js`]: {
      entryPoint: "src/components/apps/MusicPlayerApp.tsx",
      inputs: { "src/components/apps/MusicPlayerApp.tsx": {} },
      imports: [{ path: `${dir}/chunk-D.js`, kind: "import-statement" }],
    },
  };
  assert.deepEqual(bundleProblems(metafile(good), entry, modules), []);

  // A chunk only app bodies import, reached from the entry only through import().
  const appOnly = structuredClone(good);
  appOnly[`${dir}/chunk-B.js`].imports = [];
  appOnly[entry].imports.push({ path: `${dir}/chunk-D.js`, kind: "dynamic-import" });
  assert.match(bundleProblems(metafile(appOnly), entry, modules).join(), /chunk-D\.js is shared by app bodies only/);

  // An app body that ended up in a shared chunk: something imports it statically.
  const eager = structuredClone(good);
  eager[`${dir}/chunk-B.js`].inputs["src/components/apps/SettingsApp.tsx"] = {};
  assert.match(bundleProblems(metafile(eager), entry, modules).join(), /must load on demand: src\/components\/apps\/SettingsApp\.tsx/);

  const cssModule = metafile(good);
  cssModule.inputs["src/components/apps/x.module.css"] = {};
  assert.match(bundleProblems(cssModule, entry, modules).join(), /CSS modules are not supported/);

  // A file an import() inside the bundle creates.
  const dynamic = structuredClone(good);
  dynamic[`${dir}/lazy-E.js`] = { entryPoint: "src/components/apps/lazy.ts", inputs: { "src/components/apps/lazy.ts": {} }, imports: [] };
  assert.match(bundleProblems(metafile(dynamic), entry, modules).join(), /import\(\) of src\/components\/apps\/lazy\.ts/);

  // CSS: imported by the desktop (which the page links) or by on-demand code.
  const inputs = {
    "src/components/desktop/browser-entry.tsx": {
      imports: [{ path: "src/components/desktop/Desktop.tsx", kind: "import-statement" }],
    },
    "src/components/desktop/Desktop.tsx": {
      imports: [
        { path: "src/components/apps/WelcomeApp.css", kind: "import-statement" },
        { path: "node_modules/react/index.js", kind: "import-statement" },
      ],
    },
    "node_modules/react/index.js": { imports: [{ path: "node_modules/react/cjs/react.js", kind: "require-call" }] },
    "node_modules/react/cjs/react.js": { imports: [] },
    "src/components/apps/WelcomeApp.css": { imports: [] },
    "src/components/apps/MusicPlayerApp.tsx": {
      imports: [{ path: "src/components/apps/MusicPlayerApp.css", kind: "import-statement" }],
    },
  };
  assert.deepEqual(bundleProblems({ inputs, outputs: good }, entry, modules), [
    "src/components/apps/MusicPlayerApp.tsx loads on demand but imports src/components/apps/MusicPlayerApp.css, which nothing would load; import it in Desktop.tsx",
  ]);
});

test("the desktop calls no useId", () => {
  assert.deepEqual(useIdProblems({ "src/a.tsx": "const x = useState(0);" }), []);
  assert.match(useIdProblems({ "src/b.tsx": "const id = useId();" }).join(), /src\/b\.tsx calls useId/);
});

test("a page without the runtime marker must hold nothing of the runtime", () => {
  assert.deepEqual(runtimeLeftovers("<html><head></head><body><p>Hi</p></body></html>"), []);
  assert.deepEqual(runtimeLeftovers(page("<p>Hi</p>")), [
    "still contains a reference to a Next.js script chunk",
    "still contains RSC payload or runtime code",
  ]);
});
