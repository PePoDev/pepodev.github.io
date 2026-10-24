// Build-time data of Settings: the music tracks its Track list offers
// (src/data/music.ts discovers public/music when the site is built).
import { getMusicTracks } from "@data/music";

export default async function loadSettingsData() {
  return {
    tracks: getMusicTracks().map((track) => ({ id: track.id, label: track.title })),
  };
}
