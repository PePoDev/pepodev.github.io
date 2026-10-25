#!/usr/bin/env node
// Serves the exported site (out/) the way GitHub Pages does, for
// `pnpm preview` and the Playwright suite in CI (PLAYWRIGHT_SERVER=preview):
//
// - /dir/ serves dir/index.html, and /dir redirects to /dir/ (301);
// - /page serves page.html when there is no page/ directory (not /page/);
// - anything else is out/404.html with status 404;
// - byte ranges (206) for audio and video, HEAD, and conditional GETs.
//
// Usage: node scripts/serve-static.mjs [--dir out] [--host 127.0.0.1] [--port 4321]
// (--hostname and -H/-p are accepted too, as `next dev` spells them).
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "out" },
    host: { type: "string" },
    hostname: { type: "string", short: "H" },
    port: { type: "string", short: "p", default: "4321" },
  },
});
const root = path.resolve(values.dir);
const host = values.host ?? values.hostname ?? "127.0.0.1";
const port = Number(values.port);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

async function fileAt(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? info : info.isDirectory() ? "directory" : undefined;
  } catch {
    return undefined;
  }
}

function send(request, response, filePath, info, status = 200) {
  const type = TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const lastModified = info.mtime.toUTCString();
  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": type,
    "Last-Modified": lastModified,
    ETag: etag,
    "Accept-Ranges": "bytes",
    "Cache-Control": "max-age=600",
  };

  if (status === 200 && request.headers["if-none-match"] === etag) {
    response.writeHead(304, headers).end();
    return;
  }

  let start = 0;
  let end = info.size - 1;
  const range = status === 200 && request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(info.size - Number(range[2]), 0);
    }
    if (start > end || start >= info.size) {
      response.writeHead(416, { ...headers, "Content-Range": `bytes */${info.size}` }).end();
      return;
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  response.writeHead(status, headers);
  if (request.method === "HEAD" || info.size === 0) {
    response.end();
    return;
  }
  createReadStream(filePath, { start, end }).pipe(response);
}

async function notFound(request, response) {
  const page = path.join(root, "404.html");
  const info = await fileAt(page);
  if (info && info !== "directory") return send(request, response, page, info, 404);
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  // A path, never an authority: "//blog" is /blog (GitHub Pages redirects it
  // to /blog/), and no redirect can start with "//" (another host).
  const url = new URL("/" + (request.url ?? "/").replace(/^\/+/, ""), "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return notFound(request, response);
  }
  const filePath = path.join(root, pathname);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return notFound(request, response);
  }

  const info = await fileAt(filePath);
  if (info === "directory") {
    if (!url.pathname.endsWith("/")) {
      response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    const index = path.join(filePath, "index.html");
    const indexInfo = await fileAt(index);
    if (indexInfo && indexInfo !== "directory") return send(request, response, index, indexInfo);
    return notFound(request, response);
  }
  if (info) return send(request, response, filePath, info);

  // /page serves page.html; /page/ does not (it would answer /404/ with
  // out/404.html and status 200).
  if (!url.pathname.endsWith("/")) {
    const html = `${filePath}.html`;
    const htmlInfo = await fileAt(html);
    if (htmlInfo && htmlInfo !== "directory") return send(request, response, html, htmlInfo);
  }
  return notFound(request, response);
});

server.listen(port, host, () => {
  console.log(`Serving ${path.relative(process.cwd(), root) || "."}/ at http://${host}:${port}/`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(0));
