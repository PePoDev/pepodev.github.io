// Sync published Obsidian notes into the garden collection.
//
//   node scripts/sync-garden.mjs --vault <path>   (or GARDEN_VAULT=<path>)
//
// The vault is private and this repo is public, so this script is the privacy
// boundary: only notes with `dg-publish: true` and the attachments they embed
// are written, links to anything else become plain text, and logs print counts
// and published ids only. Every note is re-parsed before it is written, and the
// sync fails rather than publish anything Obsidian hides or a vault path.
// Output goes to gitignored folders and is rebuilt on every run.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The CommonMark parser the site renders with (src/lib/markdown.ts), so
// "what is code" matches the page.
import { markdownToMdast } from "satteri";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOTES_OUT = path.join(ROOT, "src/content/garden");
const ASSETS_OUT = path.join(ROOT, "src/assets/garden");
// Blog posts already live in src/content/blog, so the garden skips them.
const EXCLUDED_FOLDERS = ["Blog/"];
const SKIP_DIRS = new Set(["node_modules"]);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const FEATURES = { gfm: true };
// A Markdown link: (!)[label with [balanced] brackets](<dest> or
// dest-with-(balanced)-parens "title").
const MD_LINK =
  /(!?)\[((?:[^[\]\n]|\[[^[\]\n]*\])*)\]\(\s*(?:<([^>\n]*)>|((?:[^()\s]|\([^()\s]*\))+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** Readable URL segments, as @sindresorhus/slugify makes them (IoT -> io-t, & -> and). */
export function slugify(text) {
  const slug = text
    .replace(/&/g, " and ")
    .replace(/([A-Z]{2,})(\d+)/g, "$1 $2")
    .replace(/([a-z\d]+)([A-Z]{2,})/g, "$1 $2")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-rt-z\d]+)/g, "$1 $2")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\d]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // ponytail: an all-Thai name would slug to nothing; keep its letters so the
  // note still gets a URL.
  return slug || text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
}

/** Heading ids as github-slugger writes them (src/lib/markdown.ts). */
const headingId = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");

/**
 * Frontmatter only counts at byte 0, as in Obsidian. Returns top-level scalar
 * keys; nothing from here is copied out except the home note's title.
 */
function splitFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([\w-]+):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (kv) data[kv[1]] = kv[2];
  }
  return { data, body: text.slice(match[0].length) };
}

const unquote = (value = "") => value.replace(/^(["'])(.*)\1$/, "$2");
const isTrue = (value) => /^true$/i.test(value ?? "");
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * Index every vault note. `notes` is [{ rel, text }], `images` every image path
 * in the vault, both forward-slash and relative to the vault root. Only images
 * inside `attachmentDir` are ever published.
 */
export function buildIndex(notes, images = [], attachmentDir = "Attachments") {
  const all = notes.map(({ rel, text }) => {
    const { data, body } = splitFrontmatter(stripBom(text).replace(/\r\n?/g, "\n"));
    const stem = rel.replace(/\.md$/i, "");
    const parts = stem.split("/");
    const home = isTrue(data["dg-home"]);
    const published =
      isTrue(data["dg-publish"]) &&
      !EXCLUDED_FOLDERS.some((folder) => rel.startsWith(folder));
    return {
      rel,
      key: stem.toLowerCase(),
      name: parts.at(-1),
      folder: parts.slice(0, -1).join("/"),
      folders: parts.slice(0, -1),
      title: (home && unquote(data.title)) || parts.at(-1),
      id: home ? "index" : parts.map(slugify).join("/"),
      home,
      published,
      body,
    };
  });
  return {
    all,
    byName: groupBy(all, (note) => note.name.toLowerCase()),
    imagePaths: new Map(images.map((rel) => [rel.toLowerCase(), rel])),
    imageNames: groupBy(images, (rel) => path.posix.basename(rel).toLowerCase()),
    attachmentDir,
  };
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

const depth = (note) => note.rel.split("/").length;
const shortest = (notes) =>
  notes.toSorted((a, b) => depth(a) - depth(b) || a.rel.length - b.rel.length)[0];

/** Obsidian's rule: full path if given, else same folder first, then shortest path. */
function resolveNote(target, from, index) {
  const key = target.replace(/\.md$/i, "").replace(/^\/+/, "").toLowerCase();
  if (!key) return from;
  if (key.includes("/")) {
    return (
      index.all.find((note) => note.key === key) ??
      shortest(index.all.filter((note) => note.key.endsWith(`/${key}`)))
    );
  }
  const candidates = index.byName.get(key) ?? [];
  return candidates.find((note) => note.folder === from.folder) ?? shortest(candidates);
}

/**
 * Obsidian's rule for embeds: `./x` and `../x` from the note's folder, other
 * paths from the vault root (or the note's folder), bare names from the note's
 * folder first, else the only file with that name. Anything ambiguous, or
 * outside the attachment folder, is dropped rather than risk the wrong file.
 */
function resolveAttachment(ref, from, index) {
  const decoded = safeDecode(ref.trim());
  const lower = decoded.toLowerCase();
  const inFolder = (p) => path.posix.normalize(`${from.folder}/${p}`).toLowerCase();
  let rel;
  if (/^\.\.?\//.test(decoded)) rel = index.imagePaths.get(inFolder(lower));
  else if (lower.includes("/")) {
    rel = index.imagePaths.get(lower.replace(/^\//, "")) ?? index.imagePaths.get(inFolder(lower));
  } else {
    const candidates = index.imageNames.get(lower) ?? [];
    rel =
      candidates.find((p) => path.posix.dirname(p) === from.folder) ??
      (candidates.length === 1 ? candidates[0] : undefined);
  }
  return rel?.startsWith(`${index.attachmentDir}/`) ? rel : undefined;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const escapeLabel = (text) => text.replace(/([[\]])/g, "\\$1");
/** Leave alone: web links, in-page anchors, and site paths that are not notes. */
const isExternal = (url) =>
  (/^([a-z][\w+.-]*:|#)/i.test(url) && !/^(obsidian|file):/i.test(url)) ||
  (url.startsWith("/") && !/\.md(#|$)/i.test(safeDecode(url)));

/** A URL that would point into the vault (or at Obsidian) on the public site. */
const isVaultUrl = (url) => {
  const value = safeDecode(url.trim());
  if (/^[a-z][\w+.-]*:/i.test(value)) return /^(obsidian|file):/i.test(value);
  if (value.startsWith("#") || /^(\.\.\/)+assets\/garden\/[^/]+$/.test(value)) return false;
  return !value.startsWith("/") || /\.md(#|$)/i.test(value);
};

/**
 * Hide code from the rewrites below; returns [masked, restore]. Code ranges
 * come from the parser. Each code line becomes a placeholder after its
 * blockquote markers, so code inside callouts stays inside them. B marks block
 * code, C a code span that continues on the next line, I the rest.
 */
function maskCode(text) {
  const stash = [];
  const ranges = [];
  const visit = (node) => {
    if (node.type === "code" || node.type === "inlineCode") {
      ranges.push([node.position.start.offset, node.position.end.offset, node.type === "code"]);
    } else node.children?.forEach(visit);
  };
  visit(markdownToMdast(text, { features: FEATURES }));
  let masked = "";
  let pos = 0;
  for (const [start, end, block] of ranges.sort((a, b) => a[0] - b[0])) {
    if (start < pos) continue;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const quotes = (text.slice(lineStart, start).match(/>/g) ?? []).length;
    const container = new RegExp(`^(?:[ \\t]*>[ \\t]?){0,${quotes}}`);
    const lines = text.slice(start, end).split("\n");
    masked += text.slice(pos, start);
    masked += lines
      .map((line, i) => {
        const prefix = i === 0 ? "" : container.exec(line)[0];
        let code = line.slice(prefix.length);
        // Obsidian accepts ```SH; the highlighter only knows lowercase names.
        if (block && i === 0) code = code.replace(/^([`~]{3,}\s*)(\S+)/, (_, f, l) => f + l.toLowerCase());
        const kind = block ? "B" : i < lines.length - 1 ? "C" : "I";
        return `${prefix}\u0000${kind}${stash.push(code) - 1}\u0000`;
      })
      .join("\n");
    pos = end;
  }
  masked += text.slice(pos);
  const restore = (value) =>
    value.replace(/\u0000[BCI](\d+)\u0000/g, (_, i) => stash[Number(i)]);
  return [masked, restore];
}

/** `> [!type|meta]± title` blockquotes become HTML that still renders Markdown inside. */
function convertCallouts(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const head = /^ {0,3}>\s?\[!([\w-]+)(?:\|[^\]]*)?\]([+-]?)[ \t]*(.*)$/.exec(lines[i]);
    if (!head) {
      out.push(lines[i]);
      continue;
    }
    const [, rawType, fold, title] = head;
    const type = rawType.toLowerCase();
    const content = [];
    while (i + 1 < lines.length && /^ {0,3}>/.test(lines[i + 1])) {
      content.push(lines[++i].replace(/^ {0,3}>\s?/, ""));
    }
    const tag = fold ? "details" : "aside";
    const titleTag = fold ? "summary" : "div";
    // Blank lines end each HTML block so the title and body render as Markdown.
    out.push(
      "",
      `<${tag} class="callout" data-callout="${type}"${fold === "+" ? " open" : ""}>`,
      `<${titleTag} class="callout-title">`,
      "",
      title || type[0].toUpperCase() + type.slice(1),
      "",
      `</${titleTag}>`,
      "",
    );
    if (content.some((line) => line.trim())) out.push(convertCallouts(content.join("\n")), "");
    out.push(`</${tag}>`, "");
  }
  return out.join("\n");
}

const parseTarget = (inner) => {
  const [, ref = "", alias] = /^(.*?)(?:\\?\|(.*))?$/.exec(inner.trim());
  const [file, ...fragment] = ref.split("#");
  return { file: file.trim(), heading: fragment.join("#"), alias: alias?.trim() };
};

const mdTarget = (url) => {
  const [file, ...fragment] = safeDecode(url).split("#");
  return { file, heading: fragment.join("#") };
};

/**
 * Re-parse a converted note and fail if anything Obsidian hides (comments,
 * unconverted wikilinks) or any URL into the vault would reach the site.
 */
function assertPublishable(body, id) {
  const problems = [];
  const visit = (node) => {
    if (node.type === "code" || node.type === "inlineCode") return;
    if (node.type === "text" && /%%|\[\[[^\]\n]*\]\]/.test(node.value)) {
      problems.push("a comment or wikilink outside code");
    }
    if (node.type === "html") {
      if (/<!--|%%/.test(node.value)) problems.push("a comment in HTML");
      for (const [, url] of node.value.matchAll(/\b(?:href|src)\s*=\s*["']?([^"'\s>]+)/gi)) {
        if (isVaultUrl(url)) problems.push("an HTML link into the vault");
      }
    }
    if (["link", "image", "definition"].includes(node.type) && isVaultUrl(node.url)) {
      problems.push("a link into the vault");
    }
    node.children?.forEach(visit);
  };
  visit(markdownToMdast(body, { features: FEATURES, position: false }));
  if (problems.length) {
    throw new Error(`Refusing to publish /garden/${id}/: ${[...new Set(problems)].join(", ")}.`);
  }
}

/**
 * Turn one published note into standard Markdown. Returns the body, the ids
 * it links to, the attachments it needs ({ from, to } vault/output names), and
 * how many links were left as text because their target is not public.
 */
export function convertNote(note, index, assetNames = new Map()) {
  const links = new Set();
  const assets = [];
  let dropped = 0;
  // Notes sit at src/content/garden/<id>.md; attachments at src/assets/garden.
  const assetPrefix = `${"../".repeat(note.id.split("/").length + 1)}assets/garden/`;
  const assetHref = (rel) => {
    if (!assetNames.has(rel)) {
      const ext = path.posix.extname(rel).toLowerCase();
      const base = slugify(path.posix.basename(rel, path.posix.extname(rel)));
      const taken = new Set(assetNames.values());
      let name = `${base}${ext}`;
      for (let n = 2; taken.has(name); n++) name = `${base}-${n}${ext}`;
      assetNames.set(rel, name);
    }
    assets.push({ from: rel, to: assetNames.get(rel) });
    return assetPrefix + assetNames.get(rel);
  };
  const isPublic = (file) => resolveNote(file, note, index)?.published === true;
  /** Site URL of a published note, or undefined (and counted) when private. */
  const hrefTo = ({ file, heading }) => {
    const dest = resolveNote(file, note, index);
    if (!dest?.published) {
      dropped++;
      return undefined;
    }
    links.add(dest.id);
    const anchor = heading && !heading.startsWith("^") ? `#${headingId(heading)}` : "";
    return dest === note && anchor ? anchor : `/garden/${dest.home ? "" : `${dest.id}/`}${anchor}`;
  };
  const linkTo = (ref) => {
    const label = ref.alias || ref.heading.replace(/^\^.*/, "") || path.posix.basename(ref.file);
    const href = hrefTo(ref);
    return href ? `[${escapeLabel(label)}](${href})` : label;
  };

  let [text, restore] = maskCode(note.body);
  // An unclosed comment hides the rest of the note, as in Obsidian.
  text = text.replace(/<!--[\s\S]*?(-->|$)/g, "");
  // Waypoint/Landmark lists ignore dg-publish: keep only items whose every
  // link is public (folder names without a note have no link and are dropped).
  text = text.replace(
    /(^#{1,6}[ \t][^\n]*\n\s*)?%% Begin (Waypoint|Landmark) %%([\s\S]*?)%% End \2 %%/gm,
    (_, heading = "", _kind, items) => {
      const kept = items.split("\n").filter((line) => {
        const targets = [
          ...[...line.matchAll(/\[\[([^\]]+)\]\]/g)].map(([, inner]) => parseTarget(inner).file),
          ...[...line.matchAll(MD_LINK)].map((m) => mdTarget(m[3] ?? m[4]).file),
        ];
        return targets.length > 0 && targets.every(isPublic);
      });
      return kept.length ? `${heading}${kept.join("\n")}\n` : "";
    },
  );
  text = text.replace(/%%[\s\S]*?(%%|$)/g, "");
  text = convertCallouts(text);
  // Markdown links first: the wikilink pass below emits relative image paths.
  text = text.replace(MD_LINK, (whole, embed, label, angled, bare) => {
    const url = angled ?? bare;
    if (isExternal(url)) return whole;
    if (embed) {
      const rel = resolveAttachment(url, note, index);
      return rel ? `![${label}](${assetHref(rel)})` : "";
    }
    const target = mdTarget(url);
    if (!/\.md$/i.test(target.file)) return label;
    const href = hrefTo(target);
    return href ? `[${label}](${href})` : label;
  });
  // Reference definitions ([1]: Note.md) follow the same rules; private ones go.
  text = text.replace(/^( {0,3}\[[^\]\n]+\]:[ \t]*)<?([^>\s]+)>?.*$/gm, (whole, def, url) => {
    if (isExternal(url)) return whole;
    const target = mdTarget(url);
    const href = /\.md$/i.test(target.file) ? hrefTo(target) : undefined;
    return href ? def + href : "";
  });
  text = text.replace(/(!?)\[\[([^[\]\n]+)\]\]/g, (_, embed, inner) => {
    const ref = parseTarget(inner);
    if (embed && IMAGE_EXT.test(ref.file)) {
      const rel = resolveAttachment(ref.file, note, index);
      const alt = ref.alias && !/^\d+(x\d+)?$/.test(ref.alias) ? ref.alias : "";
      return rel ? `![${escapeLabel(alt)}](${assetHref(rel)})` : "";
    }
    // ponytail: a note embed renders as a link, not a transclusion; anything
    // private or non-note (PDF, audio) renders nothing.
    if (embed && (!/^[^.]*$|\.md$/i.test(path.posix.basename(ref.file)) || !isPublic(ref.file))) {
      return "";
    }
    return linkTo(ref);
  });
  // Obsidian shows every newline as a line break; CommonMark needs two
  // trailing spaces. Harmless where a block ends anyway (lists, headings);
  // skipped in code and after a line that already ends in a `\` break.
  const lines = text.split("\n");
  const keepBreak = (line) =>
    /\u0000B\d+\u0000|\u0000C\d+\u0000$/.test(line) || /(^|[^\\])(\\\\)*\\$/.test(line);
  text = lines
    .map((line, i) => (line.trim() && lines[i + 1]?.trim() && !keepBreak(line) ? `${line}  ` : line))
    .join("\n");
  const body = restore(text).trim();
  assertPublishable(body, note.id);
  return { body, links: [...links], assets, dropped };
}

/** Latest commit date per vault path, when the vault is a git checkout with history. */
function gitDates(vault) {
  const dates = new Map();
  try {
    let date;
    // --no-renames: rename detection would download old blobs in CI's partial clone.
    for (const line of git(vault, ["log", "--no-renames", "--format=%x00%cs", "--name-only"]).split("\n")) {
      if (line.startsWith("\u0000")) date = line.slice(1);
      else if (line && !dates.has(line)) dates.set(line, date);
    }
  } catch {
    // Not a git checkout: notes simply have no "last tended" date.
  }
  return dates;
}

const git = (vault, args) =>
  execFileSync("git", ["-C", vault, "-c", "core.quotePath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

/**
 * Vault files, skipping dot-folders. A git checkout lists what git tracks,
 * which is also all that CI's sparse checkout can see.
 */
function listFiles(vault) {
  const visible = (rel) =>
    !rel.split("/").some((part) => part.startsWith(".") || SKIP_DIRS.has(part));
  try {
    return git(vault, ["ls-files", "-z"]).split("\0").filter((rel) => rel && visible(rel));
  } catch {
    const walk = (dir) =>
      readdirSync(path.join(vault, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (!visible(rel)) return [];
        return entry.isDirectory() ? walk(rel) : [rel];
      });
    return walk("");
  }
}

function main() {
  const flag = process.argv.indexOf("--vault");
  const vault = path.resolve(
    (flag > -1 && process.argv[flag + 1]) || process.env.GARDEN_VAULT || "",
  );
  if (!existsSync(path.join(vault, ".obsidian"))) {
    console.error("Pass an Obsidian vault with --vault <path> or GARDEN_VAULT.");
    process.exit(1);
  }

  const files = listFiles(vault);
  const attachmentDir = (() => {
    try {
      return JSON.parse(readFileSync(path.join(vault, ".obsidian/app.json"), "utf8"))
        .attachmentFolderPath;
    } catch {
      return "Attachments";
    }
  })();
  const index = buildIndex(
    files
      .filter((rel) => rel.endsWith(".md") && existsSync(path.join(vault, rel)))
      .map((rel) => ({ rel, text: readFileSync(path.join(vault, rel), "utf8") })),
    files.filter((rel) => IMAGE_EXT.test(rel)),
    attachmentDir,
  );
  const published = index.all.filter((note) => note.published);
  const ids = new Map();
  for (const note of published) {
    if (ids.has(note.id)) {
      throw new Error(`Two published notes share the URL /garden/${note.id}/`);
    }
    ids.set(note.id, note);
  }
  // A note that fails the publish check is left out (and links to it become
  // text), so one odd note never blocks the rest of the garden or the site.
  let converted;
  let assetNames;
  for (let refused = true; refused; ) {
    refused = false;
    assetNames = new Map();
    converted = published
      .filter((note) => note.published)
      .flatMap((note) => {
        try {
          return [{ note, ...convertNote(note, index, assetNames) }];
        } catch (error) {
          console.warn(`${process.env.GITHUB_ACTIONS ? "::warning::" : ""}${error.message}`);
          note.published = false;
          refused = true;
          return [];
        }
      });
  }

  rmSync(NOTES_OUT, { recursive: true, force: true });
  rmSync(ASSETS_OUT, { recursive: true, force: true });
  mkdirSync(ASSETS_OUT, { recursive: true });

  const dates = gitDates(vault);
  const copied = new Set();
  let textLinks = 0;
  for (const { note, body, links, assets, dropped } of converted) {
    textLinks += dropped;
    for (const { from, to } of assets) {
      if (copied.has(to)) continue;
      copyFileSync(path.join(vault, from), path.join(ASSETS_OUT, to));
      copied.add(to);
    }
    const frontmatter = {
      title: note.title,
      folders: note.folders,
      updated: dates.get(note.rel),
      links,
      "dg-publish": true,
    };
    const out = path.join(NOTES_OUT, `${note.id}.md`);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `---\n${JSON.stringify(frontmatter)}\n---\n\n${body}\n`);
  }

  console.log(
    `Garden: ${converted.length} notes, ${copied.size} attachments, ` +
      `${textLinks} links to private notes left as text.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
