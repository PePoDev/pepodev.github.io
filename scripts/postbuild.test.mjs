// node --test scripts/postbuild.test.mjs (pnpm test:scripts)
import assert from "node:assert/strict";
import test from "node:test";
import { markScripts, payloadAssetUrls, readClientManifest, stripRuntime } from "./postbuild.mjs";

const push = (chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`;

// What next build writes for a static page, trimmed: Next.js's scripts
// around the page's own inline script, JSON-LD and a post's raw HTML.
const page = (body, payload = '0:["$","p",null,{}]\n') =>
  [
    '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>',
    '<meta name="pepodev-runtime" content="none"/>',
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
  assert.ok(html.includes(content), "the post's raw HTML scripts stay, as on the Astro site");
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

test("hydrating pages: Next.js's scripts opt out of Rocket Loader, and payload asset URLs are found", () => {
  const html =
    '<script src="/_next/static/chunks/a.js" async=""></script><script data-cfasync="false">own()</script>' +
    '<script type="application/ld+json">{}</script>' +
    push('5:["$","audio",null,{"src":"/music/Midnight_Velocity(1).mp4"}]\n6:{"href":"/blog/","icon":"/favicon.svg"}\n');
  assert.equal(
    markScripts(html).match(/<script\b[^>]*>/g).join(""),
    '<script data-cfasync="false" src="/_next/static/chunks/a.js" async=""><script data-cfasync="false">' +
      '<script type="application/ld+json"><script data-cfasync="false">',
  );
  assert.deepEqual(payloadAssetUrls(markScripts(html)), ["/music/Midnight_Velocity(1).mp4", "/favicon.svg"]);
});
