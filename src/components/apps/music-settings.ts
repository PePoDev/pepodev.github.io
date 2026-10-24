// The music settings and controller the Music player and Settings share.
//
// - pepodev.music holds { track, playing }. The media element, not the saved
//   `playing`, is authoritative: the player saves `playing` from what its
//   element does, and a `playing: true` left by an earlier page is dropped
//   when the player starts. Every save dispatches desktop:music-settings
//   (detail: the settings) on document; Settings re-renders on it.
// - The player publishes window.__pepoMusicController ({ setPlaying,
//   setTrack, requestAudioFrame }): the desktop background asks it for
//   levels every frame, and Settings drives the music through it
//   (requestMusic()). Settings mounts the player's body when it opens, in
//   case the idle mount has not happened yet; a request made before the
//   controller exists waits for it.
import { mountApp } from "@components/desktop/app-api";

export interface MusicSettings {
  /** A track id (its file name without the extension). */
  track: string;
  /** Whether the music plays (as last saved by the player). */
  playing: boolean;
}

export interface MusicController {
  setPlaying(playing: boolean): Promise<void>;
  setTrack(trackId: string): void;
  /** Sends the current levels as desktop:music-audio-frame (the background calls it every frame). */
  requestAudioFrame(): void;
}

declare global {
  interface Window {
    __pepoMusicController?: MusicController;
  }
}

export const MUSIC_KEY = "pepodev.music";
export const MUSIC_SETTINGS_EVENT = "desktop:music-settings";

/** A known track (else the first one) and a boolean `playing`. */
export function normalizeMusicSettings(next: Partial<MusicSettings>, trackIds: readonly string[]): MusicSettings {
  const track = next.track !== undefined && trackIds.includes(next.track) ? next.track : (trackIds[0] ?? "");
  return { track, playing: Boolean(next.playing) };
}

/** The saved settings over the defaults, as saved (not normalized). */
export function loadMusicSettings(defaultTrack: string): Partial<MusicSettings> {
  try {
    const raw = localStorage.getItem(MUSIC_KEY);
    if (raw) return { track: defaultTrack, playing: false, ...JSON.parse(raw) };
  } catch {
    // Ignore corrupt persisted settings.
  }
  return { track: defaultTrack, playing: false };
}

/** Saves the settings and announces them (desktop:music-settings). */
export function saveMusicSettings(settings: MusicSettings) {
  try {
    localStorage.setItem(MUSIC_KEY, JSON.stringify(settings));
  } catch {
    // The settings still apply for this page.
  }
  document.dispatchEvent(new CustomEvent(MUSIC_SETTINGS_EVENT, { detail: settings }));
}

/** What Settings asks the player to do. */
export interface MusicRequest {
  track?: string;
  playing?: boolean;
}

// What Settings asked before the player's controller existed: one merged
// request (the latest track and the latest play state), not a queue.
let pending: MusicRequest | null = null;

function applyMusicRequest(controller: MusicController, { track, playing }: MusicRequest) {
  if (track !== undefined) controller.setTrack(track);
  if (playing !== undefined) void controller.setPlaying(playing);
}

/**
 * Drives the player through its controller. Before the player's body has
 * mounted (Settings mounts it when it opens, so this is rare), the request
 * waits for it and the body is mounted now.
 */
export function requestMusic(request: MusicRequest) {
  const controller = window.__pepoMusicController;
  if (controller) {
    applyMusicRequest(controller, request);
    return;
  }
  pending = { ...pending, ...request };
  mountApp("music");
}

/** Publishes the player's controller (and runs what waited for it). Returns the cleanup. */
export function provideMusicController(controller: MusicController): () => void {
  window.__pepoMusicController = controller;
  const request = pending;
  pending = null;
  if (request) applyMusicRequest(controller, request);
  return () => {
    if (window.__pepoMusicController === controller) delete window.__pepoMusicController;
  };
}
