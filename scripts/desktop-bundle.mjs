// Builds the desktop bundle of the exported / (postbuild.mjs runs it after
// `next build`): the React desktop as ES modules, without the Next.js
// runtime. Next.js renders the page's HTML; this bundle hydrates only the
// #desktop panel (src/components/desktop/browser-entry.tsx). Every app body
// is an entry point of its own, imported on demand by
// app-loaders.browser.ts, which replaces app-loaders.ts here.
//
// The files go to out/_next/static/desktop/ with content hashes in their
// names, under the path Cloudflare caches for a year (README, Cloudflare).
// Styles are not bundled: the page links them (Next.js extracts every
// stylesheet the server render imports; Desktop.tsx imports the app bodies'
// own), so CSS imports load nothing here; postbuild fails on a stylesheet
// no page links.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as esbuild from "esbuild";

export const BUNDLE_DIR = "_next/static/desktop";

/** [app id, module name] for each body, read from app-loaders.ts. */
export function readAppModules(source) {
  return [...source.matchAll(/^\s*(\w+): \(\) => import\("@components\/apps\/(\w+)"\),$/gm)].map(
    ([, appId, name]) => [appId, name],
  );
}

/**
 * The ids readAppModules found must be exactly `appIds` (APP_IDS in
 * apps.ts): a loader line in another format would otherwise leave its app
 * unloadable in out/ alone. Returns the problems.
 */
export function appModuleProblems(appModules, appIds) {
  const found = appModules.map(([appId]) => appId);
  const problems = [];
  const missing = appIds.filter((appId) => !found.includes(appId));
  if (missing.length > 0) {
    problems.push(
      `app-loaders.ts has no \`<id>: () => import("@components/apps/<Name>"),\` line for ${missing.join(", ")}`,
    );
  }
  const unknown = found.filter((appId, index) => !appIds.includes(appId) || found.indexOf(appId) !== index);
  if (unknown.length > 0) problems.push(`app-loaders.ts lists unknown or repeated app ids: ${unknown.join(", ")}`);
  return problems;
}

/**
 * What the bundle's module graph must hold (esbuild's metafile), as
 * problems:
 * - every shared chunk is a static import of the entry, however deep. A
 *   browser keeps a failed module download for the page's lifetime: a
 *   chunk the entry imports fails the boot as a whole (the desktop the
 *   server rendered stays on screen but ignores input until a reload; the
 *   early-input script keeps taking its clicks, as it did when Next.js's
 *   own boot scripts failed), and a retry asks for an app body under a new
 *   URL (app-loaders.browser.ts), but a chunk only app bodies share would
 *   leave them unloadable until a reload. Import such a module from
 *   browser-entry.tsx;
 * - the only entry points are the desktop's and the app bodies': a file an
 *   import() inside the bundle creates is neither preloaded nor retried;
 * - no app body is in another output: one imported statically would load
 *   with the page instead of on demand;
 * - no CSS is imported from code that loads on demand (the bundle loads no
 *   styles, and the page links only what the server render imports: import
 *   it in Desktop.tsx), and no CSS Module (its class names would differ
 *   from the server render's).
 */
export function bundleProblems(metafile, entry, appModules) {
  const problems = [];
  const { inputs, outputs } = metafile;
  const reached = new Set();
  const visit = (file) => {
    for (const { path: imported, kind } of outputs[file]?.imports ?? []) {
      if (kind !== "import-statement" || reached.has(imported)) continue;
      reached.add(imported);
      visit(imported);
    }
  };
  visit(entry);
  const entryModule = outputs[entry]?.entryPoint;
  const bodies = new Set(appModules.map(([, name]) => `src/components/apps/${name}.tsx`));
  for (const [file, output] of Object.entries(outputs)) {
    if (!file.endsWith(".js")) continue;
    if (output.entryPoint && output.entryPoint !== entryModule && !bodies.has(output.entryPoint)) {
      problems.push(`${file} comes from an import() of ${output.entryPoint}, which is neither preloaded nor retried`);
    }
    if (!output.entryPoint && !reached.has(file)) {
      problems.push(
        `${file} is shared by app bodies only (${Object.keys(output.inputs).join(", ")}); import it from browser-entry.tsx`,
      );
    }
    const eager = Object.keys(output.inputs).filter((input) => bodies.has(input) && input !== output.entryPoint);
    if (eager.length > 0) problems.push(`${file} holds app bodies that must load on demand: ${eager.join(", ")}`);
  }
  // Modules the entry imports statically, however deep (require() is how
  // React's CommonJS files import each other).
  const loaded = new Set();
  const load = (input) => {
    if (loaded.has(input) || !inputs[input]) return;
    loaded.add(input);
    for (const { path: imported, kind } of inputs[input].imports ?? []) {
      if (kind === "import-statement" || kind === "require-call") load(imported);
    }
  };
  load(entryModule);
  for (const [input, { imports = [] }] of Object.entries(inputs)) {
    if (loaded.has(input)) continue;
    const css = imports.filter(({ path: imported }) => imported.endsWith(".css")).map(({ path: imported }) => imported);
    if (css.length > 0) {
      problems.push(`${input} loads on demand but imports ${css.join(", ")}, which nothing would load; import it in Desktop.tsx`);
    }
  }
  const cssModules = Object.keys(inputs).filter((input) => input.endsWith(".module.css"));
  if (cssModules.length > 0) problems.push(`CSS modules are not supported: ${cssModules.join(", ")}`);
  return problems;
}

/**
 * The desktop's own modules that call useId: React derives its ids from
 * where a component sits in the tree, and the desktop is a root of its own
 * in the browser but a subtree of Next.js's page on the server, so the ids
 * would differ from the server HTML's.
 */
export function useIdProblems(sources) {
  return Object.entries(sources)
    .filter(([, source]) => /\buseId\s*\(/.test(source))
    .map(([file]) => `${file} calls useId, whose ids would differ from the server render's (the desktop is a root of its own)`);
}

/**
 * The React that rendered the HTML. Next.js's App Router renders with the
 * React build it vendors (next/dist/compiled/react…, a canary that can
 * differ from package.json's react), and a client must hydrate with the
 * same build, or the markup can differ. Next.js takes the experimental
 * channel for some experimental options; this follows its choice.
 */
function reactAliases(root) {
  const require = createRequire(path.join(root, "package.json"));
  const { needsExperimentalReact } = require("next/dist/lib/needs-experimental-react");
  const { config } = JSON.parse(readFileSync(path.join(root, ".next/required-server-files.json"), "utf8"));
  const channel = needsExperimentalReact(config) ? "-experimental" : "";
  return Object.fromEntries(
    ["react", "react-dom", "scheduler"].map((name) => [name, `next/dist/compiled/${name}${channel}`]),
  );
}

/** APP_IDS from src/components/desktop/apps.ts. */
async function readAppIds(root) {
  const { outputFiles } = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ["src/components/desktop/apps.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const { APP_IDS } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`);
  return APP_IDS;
}

/** package.json's browserslist ("ios_saf 16.4") as esbuild targets ("ios16.4"). */
export function esbuildTargets(browserslist) {
  return browserslist.map((query) => {
    const [browser, version] = query.split(" ");
    return `${browser === "ios_saf" ? "ios" : browser}${version}`;
  });
}

const appLoaders = {
  name: "app-loaders",
  setup(build) {
    build.onResolve({ filter: /^\.\/app-loaders$/ }, (args) => ({
      path: path.join(args.resolveDir, "app-loaders.browser.ts"),
    }));
  },
};

/**
 * Builds the bundle into <root>/out/_next/static/desktop/ and returns the
 * URLs the page needs: the entry, the modules it imports (to preload), and
 * each app body's.
 */
export async function buildDesktopBundle(root) {
  const appModules = readAppModules(
    readFileSync(path.join(root, "src/components/desktop/app-loaders.ts"), "utf8"),
  );
  const appProblems = appModuleProblems(appModules, await readAppIds(root));
  if (appProblems.length > 0) throw new Error(`The desktop bundle: ${appProblems.join("; ")}.`);
  const { browserslist } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  const { metafile } = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [
      { in: "src/components/desktop/browser-entry.tsx", out: "desktop" },
      ...appModules.map(([, name]) => ({ in: `src/components/apps/${name}.tsx`, out: name })),
    ],
    outdir: path.join("out", BUNDLE_DIR),
    entryNames: "[name]-[hash]",
    chunkNames: "chunk-[hash]",
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: esbuildTargets(browserslist),
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty" },
    alias: reactAliases(root),
    plugins: [appLoaders],
    metafile: true,
    // "use client" means nothing outside Next.js.
    logOverride: { "module-level-directive": "silent" },
    logLevel: "warning",
  });

  const url = (output) => `/${path.relative(path.join(root, "out"), path.join(root, output)).split(path.sep).join("/")}`;
  const outputFor = (entryPoint) => {
    const output = Object.keys(metafile.outputs).find((file) => metafile.outputs[file].entryPoint === entryPoint);
    if (!output) throw new Error(`The desktop bundle has no output for ${entryPoint}.`);
    return output;
  };

  const entry = outputFor("src/components/desktop/browser-entry.tsx");
  const sources = Object.fromEntries(
    Object.keys(metafile.inputs)
      .filter((input) => input.startsWith("src/") && /\.tsx?$/.test(input))
      .map((input) => [input, readFileSync(path.join(root, input), "utf8")]),
  );
  const problems = [...bundleProblems(metafile, entry, appModules), ...useIdProblems(sources)];
  if (problems.length > 0) throw new Error(`The desktop bundle: ${problems.join("; ")}.`);
  // Every shared chunk, which the page loads with the entry (bundleProblems).
  const preload = Object.keys(metafile.outputs).filter(
    (file) => file.endsWith(".js") && !metafile.outputs[file].entryPoint,
  );

  return {
    entry: url(entry),
    preload: preload.map(url),
    apps: Object.fromEntries(appModules.map(([appId, name]) => [appId, url(outputFor(`src/components/apps/${name}.tsx`))])),
  };
}
