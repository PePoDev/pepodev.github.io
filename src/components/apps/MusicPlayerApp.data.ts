// Build-time data of the Music player: the tracks in public/music, found
// when the site is built (src/data/music.ts). Inlined for every visitor, so
// only what the player needs: each track's id, title and file, and whether
// the first track is a video (the player then uses one <video> for every
// track, as the Astro player did). The detail line is the same for every
// track, so the body has it.
import { getMusicTracks } from "@data/music";

export default async function loadMusicPlayerData() {
  const tracks = getMusicTracks();
  return {
    video: tracks[0]?.mediaType === "video",
    tracks: tracks.map(({ id, title, src }) => ({ id, title, src })),
  };
}
