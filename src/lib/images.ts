// Build-time image pipeline, replacing Astro's `astro:assets`.
//
// Server Components ask for an image at a display size; this module writes
// the WebP variants (and JPEG share cards) with sharp into public/_img/ and
// returns the <img> attributes. `next dev` serves public/ directly, and
// `next build` exports it into out/_img/ (scripts/postbuild.mjs then checks
// that every image a page references exists). Names carry a hash of the
// source file and the transform, so a file is written once per build and a
// URL never changes its content (safe to cache for as long as the host
// allows; GitHub Pages sends max-age=600).
//
// The rules follow Astro's `image.layout: "constrained"` with the breakpoints
// in IMAGE_BREAKPOINTS, so the srcsets match the Astro build: 1x and 2x the
// display width plus every breakpoint in between, never wider than the
// source (no upscaling). SVGs are copied as they are.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Screen widths for srcsets; keep the list short (every Blog article file carries them). */
export const IMAGE_BREAKPOINTS = [640, 960, 1280, 1920] as const;

/** Share cards (og:image) are JPEGs at most this wide. */
export const SOCIAL_IMAGE_MAX_WIDTH = 1200;

/** Where generated files go, and the URL they are served from. */
export const IMAGE_OUTPUT_DIR = path.join(process.cwd(), "public", "_img");
const IMAGE_URL_PREFIX = "/_img/";

/** A local source image, the counterpart of Astro's ImageMetadata. */
export interface ImageAsset {
  /** Absolute path of the source file. */
  path: string;
  /** Intrinsic size after EXIF orientation. */
  width: number;
  height: number;
  format: string;
}

/** Attributes for an <img>, ready to spread (React names). */
export interface ResponsiveImage {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
}

export interface ResponsiveImageOptions {
  /** Display width in CSS px; defaults to the source width. */
  width?: number;
  /**
   * Display height. With a width, the image is cropped to that aspect ratio
   * (object-fit: cover, centred); without one, it follows the source.
   */
  height?: number;
  /** Defaults to `(min-width: <width>px) <width>px, 100vw`. */
  sizes?: string;
}

// sharp's libvips cache races when many small files are written at once
// (lovell/sharp#3935); Astro turns it off for the same reason.
sharp.cache(false);

const assetCache = new Map<string, Promise<ImageAsset & { hash: string }>>();
const writes = new Map<string, Promise<void>>();

/**
 * Reads a local image's size and format. Throws when the file is missing or
 * is not an image, which fails the build.
 */
export async function loadImage(filePath: string): Promise<ImageAsset> {
  const { hash: _hash, ...asset } = await loadSource(filePath);
  return asset;
}

/**
 * Resolves `src` (as written in Markdown or frontmatter, relative to
 * `fromFile`) to a local image. Throws when the file does not exist.
 */
export function resolveImage(fromFile: string, src: string): Promise<ImageAsset> {
  return loadImage(path.resolve(path.dirname(fromFile), decodeURI(src)));
}

async function loadSource(filePath: string) {
  const absolute = path.resolve(filePath);
  let info;
  try {
    info = await stat(absolute);
  } catch {
    throw new Error(`Image not found: ${path.relative(process.cwd(), absolute)}`);
  }
  // Keyed on mtime and size, so `next dev` sees replaced files.
  const key = `${absolute}:${info.mtimeMs}:${info.size}`;
  let pending = assetCache.get(key);
  if (!pending) {
    pending = (async () => {
      const buffer = await readFile(absolute);
      let metadata;
      try {
        metadata = await sharp(buffer).metadata();
      } catch (error) {
        throw new Error(
          `Not a readable image: ${path.relative(process.cwd(), absolute)} (${String(error)})`,
        );
      }
      if (!metadata.width || !metadata.height || !metadata.format) {
        throw new Error(`Image without a size: ${path.relative(process.cwd(), absolute)}`);
      }
      // EXIF orientations 5-8 swap the axes; the output is rotated upright.
      const swap = (metadata.orientation ?? 1) >= 5;
      return {
        path: absolute,
        width: swap ? metadata.height : metadata.width,
        height: swap ? metadata.width : metadata.height,
        format: metadata.format === "jpeg" ? "jpg" : metadata.format,
        hash: createHash("sha256").update(buffer).digest("hex"),
      };
    })();
    assetCache.set(key, pending);
    pending.catch(() => assetCache.delete(key));
  }
  return pending;
}

interface Transform {
  width: number;
  height: number;
  /** Crop to width x height (cover), or resize by width only. */
  crop: boolean;
  format: "webp" | "jpg";
}

/** Writes one variant (once per build) and returns its URL. */
async function emit(asset: ImageAsset, transform: Transform): Promise<string> {
  const source = await loadSource(asset.path);
  const stem = path
    .basename(asset.path, path.extname(asset.path))
    .replace(/[^\w.-]+/g, "-");

  if (source.format === "svg") {
    // Vector: one copy serves every width.
    const name = `${stem}.${source.hash.slice(0, 10)}.svg`;
    await writeOnce(name, () => readFile(source.path));
    return IMAGE_URL_PREFIX + name;
  }

  const hash = createHash("sha256")
    .update(source.hash)
    .update(JSON.stringify(transform))
    .digest("hex")
    .slice(0, 10);
  const name = `${stem}.${transform.width}x${transform.height}.${hash}.${transform.format}`;
  await writeOnce(name, async () => {
    // The same sharp calls as Astro's image service.
    const image = sharp(await readFile(source.path), {
      failOn: "none",
      pages: -1,
    }).rotate();
    if (transform.crop) {
      image.resize({
        width: transform.width,
        height: transform.height,
        fit: "cover",
        withoutEnlargement: true,
      });
    } else {
      image.resize({ width: transform.width, withoutEnlargement: true });
    }
    if (transform.format === "jpg") return image.jpeg().toBuffer();
    return image.webp(source.format === "gif" ? { loop: 0 } : {}).toBuffer();
  });
  return IMAGE_URL_PREFIX + name;
}

async function writeOnce(name: string, produce: () => Promise<Buffer>) {
  let pending = writes.get(name);
  if (!pending) {
    pending = (async () => {
      const target = path.join(IMAGE_OUTPUT_DIR, name);
      try {
        await stat(target);
        return; // written by an earlier render or another build worker
      } catch {
        // not there yet
      }
      const data = await produce();
      await mkdir(IMAGE_OUTPUT_DIR, { recursive: true });
      // Build workers run in parallel: write aside, then rename atomically.
      const temporary = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(temporary, data);
      await rename(temporary, target);
    })();
    writes.set(name, pending);
    pending.catch(() => writes.delete(name));
  }
  return pending;
}

/**
 * A responsive WebP <img> for `asset` at a display size, like Astro's
 * <Image layout="constrained">: `src` is the display size, `srcSet` adds 2x
 * and the breakpoints up to the source width.
 */
export async function getResponsiveImage(
  asset: ImageAsset,
  options: ResponsiveImageOptions = {},
): Promise<ResponsiveImage> {
  const width = Math.round(options.width ?? asset.width);
  const height = Math.round(
    options.height ??
      (options.width ? width / (asset.width / asset.height) : asset.height),
  );
  const crop = options.height !== undefined && options.width !== undefined;
  const sizes = options.sizes ?? `(min-width: ${width}px) ${width}px, 100vw`;

  if ((await loadSource(asset.path)).format === "svg") {
    return { src: await emit(asset, { width, height, crop, format: "webp" }), sizes, width, height };
  }

  const aspectRatio = width / height;
  const maxWidth = Math.min(width * 2, asset.width);
  const widths = [...new Set([width, width * 2, ...IMAGE_BREAKPOINTS])]
    .filter((candidate) => candidate <= maxWidth)
    .sort((a, b) => a - b);

  const variant = (w: number) =>
    emit(asset, {
      width: w,
      height: w === width ? height : Math.round(w / aspectRatio),
      crop,
      format: "webp",
    });
  const [src, ...entries] = await Promise.all([
    variant(width),
    ...widths.map(async (w) => `${await variant(w)} ${w}w`),
  ]);
  return {
    src,
    ...(entries.length ? { srcSet: entries.join(", ") } : {}),
    sizes,
    width,
    height,
  };
}

/**
 * The share-card copy of `asset` (og:image, twitter:image, JSON-LD): one
 * JPEG at most SOCIAL_IMAGE_MAX_WIDTH wide, which every link-preview crawler
 * renders. Returns a root-relative URL.
 */
export async function getSocialImage(
  asset: ImageAsset,
): Promise<{ src: string; width: number; height: number }> {
  const width = Math.min(asset.width, SOCIAL_IMAGE_MAX_WIDTH);
  const height = Math.round(width / (asset.width / asset.height));
  const src = await emit(asset, { width, height, crop: false, format: "jpg" });
  return { src, width, height };
}
