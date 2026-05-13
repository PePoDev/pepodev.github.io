import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

export type MusicTrack = {
  id: string;
  title: string;
  detail: string;
  src: string;
  mediaType: "audio" | "video";
};

const musicDirectory = join(process.cwd(), "public", "music");
const audioExtensions = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
  ".webm",
]);
const videoContainerExtensions = new Set([".m4v", ".mov", ".mp4", ".webm"]);

function toTitle(fileBase: string) {
  return fileBase
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getMusicTracks(): MusicTrack[] {
  if (!existsSync(musicDirectory)) return [];

  return readdirSync(musicDirectory)
    .filter((fileName) => audioExtensions.has(extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => {
      const extension = extname(fileName).toLowerCase();
      const fileBase = basename(fileName, extension);
      const title = toTitle(fileBase);

      return {
        id: fileBase,
        title,
        detail: "Local music library",
        src: `/music/${fileName}`,
        mediaType: videoContainerExtensions.has(extension) ? "video" : "audio",
      };
    });
}
