// The Music player's engine: the media element, the Web Audio analyser,
// the visualizer loop and the levels the desktop background asks for. The
// React body (MusicPlayerApp.tsx) renders its snapshot and tells it about
// the window, the site mode and the system audio; it never touches the
// player's markup itself, only the media element's playback API and the
// canvas it draws on.
//
// README rules kept here:
// - A page load fetches no media: the track loads when the window opens or
//   playback starts (for video tracks the artwork element is the player).
// - The media element is authoritative; a saved `playing: true` from an
//   earlier page is dropped (music-settings.ts).
// - Playback never waits for AudioContext.resume(): the media plays on its
//   own and joins the analyser once the context runs (a media element routed
//   into a suspended context plays silently).
// - The visualizer animates only while music plays in its visible window,
//   and not with reduced motion; the background gets levels through
//   requestAudioFrame() (none with reduced motion).
import type { SystemAudio } from "@components/desktop/app-api";
import { drawVisualizer } from "./music-visualizer";
import {
  loadMusicSettings,
  normalizeMusicSettings,
  saveMusicSettings,
  type MusicController,
  type MusicSettings,
} from "./music-settings";

/** A track as MusicPlayerApp.data.ts gives it. */
export interface PlayerTrack {
  /** The file name without its extension (pepodev.music's `track`). */
  id: string;
  title: string;
  /** The file's URL, /music/<file name>. */
  src: string;
}

export interface MusicSnapshot {
  track: string;
  /** The media element is playing. */
  playing: boolean;
  status: string;
  elapsed: string;
  remaining: string;
  /** The seek range's value (0 to SEEK_MAX) and whether it is enabled. */
  seek: number;
  canSeek: boolean;
}

export interface MusicWindowState {
  /** The window is open (possibly minimized). */
  open: boolean;
  /** Open and not minimized. */
  shown: boolean;
  /** Shown in desktop mode. */
  visible: boolean;
}

export const SEEK_MAX = 1000;
const NO_TRACKS_STATUS = "Add playable files to public/music.";
const SILENT_STATUS = "Playing silently. Raise system volume to hear it.";
const PLAY_FAILED = "This browser could not play the selected file.";

type AudioContextConstructor = typeof AudioContext;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export class MusicPlayer {
  private readonly trackIds: string[];
  private settings: MusicSettings;
  private audio: SystemAudio = { volume: 1, muted: false };
  private windowState: MusicWindowState = { open: false, shown: false, visible: false };
  private media: HTMLMediaElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private reducedMotion: MediaQueryList | null = null;
  private playbackRequestId = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private outputGain: GainNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private waveformData: Uint8Array<ArrayBuffer> | null = null;
  private visualizerFrame = 0;
  private visualizerPhase = 0;
  private audioFramePlaying = false;
  private snapshot: MusicSnapshot;
  private readonly listeners = new Set<() => void>();
  readonly controller: MusicController;

  constructor(readonly tracks: readonly PlayerTrack[]) {
    this.trackIds = tracks.map((track) => track.id);
    this.settings = normalizeMusicSettings({}, this.trackIds);
    this.snapshot = {
      track: this.settings.track,
      playing: false,
      status: tracks.length ? "" : NO_TRACKS_STATUS,
      elapsed: "0:00",
      remaining: "-0:00",
      seek: 0,
      canSeek: false,
    };
    // The frame loop keeps its name through minification: tests count its
    // requestAnimationFrame calls by it.
    Object.defineProperty(this.tickVisualizer, "name", { value: "tickVisualizer" });
    this.controller = {
      setPlaying: (playing) => this.setPlaying(playing),
      setTrack: (trackId) => this.setTrack(trackId),
      requestAudioFrame: () => this.requestAudioFrame(),
    };
  }

  // --- The snapshot React renders --------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(change: Partial<MusicSnapshot>) {
    const next = { ...this.snapshot, ...change };
    if ((Object.keys(change) as (keyof MusicSnapshot)[]).every((key) => next[key] === this.snapshot[key])) return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  // --- Lifecycle (MusicPlayerApp's effects) ----------------------------------

  /** Takes over the media element and the canvas. Returns the cleanup. */
  start(media: HTMLMediaElement | null, canvas: HTMLCanvasElement | null): () => void {
    this.media = media;
    this.canvasContext = canvas?.getContext("2d") ?? null;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;

    const persisted = loadMusicSettings(this.trackIds[0] ?? "");
    this.settings = normalizeMusicSettings({ ...persisted, playing: false }, this.trackIds);
    // A saved "playing" from an earlier page is stale: nothing plays now.
    if (persisted.playing) saveMusicSettings(this.settings);

    const onPlayOrPause = () => {
      this.render();
      this.syncVisualizer();
    };
    const onTime = () => this.updatePlaybackTime();
    const onEnded = () => this.step(1);
    const onError = () => {
      const code = media?.error?.code;
      this.saveSettings({ playing: false });
      this.update({ status: code ? `${PLAY_FAILED} Media error ${code}.` : PLAY_FAILED });
    };
    const onVisibility = () => this.syncVisualizer();
    const mediaEvents: [string, () => void][] = [
      ["play", onPlayOrPause],
      ["pause", onPlayOrPause],
      ["ended", onEnded],
      ["error", onError],
      ["timeupdate", onTime],
      ["loadedmetadata", onTime],
      ["durationchange", onTime],
      ["seeked", onTime],
    ];
    mediaEvents.forEach(([type, listener]) => media?.addEventListener(type, listener));
    document.addEventListener("visibilitychange", onVisibility);
    this.reducedMotion?.addEventListener?.("change", onVisibility);
    this.render();

    return () => {
      mediaEvents.forEach(([type, listener]) => media?.removeEventListener(type, listener));
      document.removeEventListener("visibilitychange", onVisibility);
      this.reducedMotion?.removeEventListener?.("change", onVisibility);
      this.playbackRequestId += 1;
      media?.pause();
      if (this.visualizerFrame) cancelAnimationFrame(this.visualizerFrame);
      this.visualizerFrame = 0;
      this.publishAudioFrame(false);
      this.media = null;
      this.canvasContext = null;
    };
  }

  /**
   * Follows the window: opening it loads the track (and refreshes the view),
   * closing it stops the music, and the visualizer follows what is shown.
   */
  setWindow(state: MusicWindowState) {
    const previous = this.windowState;
    this.windowState = state;
    if (previous.open && !state.open) this.stop();
    if (!previous.open && state.open) {
      this.loadTrackSource();
      this.render();
    }
    this.syncVisualizer();
  }

  /** Music stops with its window and in website mode, which has no audio controls. */
  stop() {
    const media = this.media;
    if (media && (!media.paused || this.settings.playing)) void this.setPlaying(false);
  }

  setAudio(audio: SystemAudio) {
    this.audio = audio;
    this.applyVolume();
    this.render();
  }

  // --- Controls -------------------------------------------------------------

  async setPlaying(playing: boolean) {
    if (!this.media) return;
    if (playing) {
      await this.startPlayback();
    } else {
      this.playbackRequestId += 1;
      this.media.pause();
      this.saveSettings({ playing: false });
    }
  }

  setTrack(trackId: string) {
    this.saveSettings({ track: trackId });
    this.syncAudioSource();
    if (this.settings.playing) void this.startPlayback();
  }

  /** The previous (-1) or next (1) track, wrapping around. */
  step(direction: 1 | -1) {
    const { tracks } = this;
    if (!tracks.length) return;
    const index = Math.max(0, this.trackIds.indexOf(this.settings.track));
    this.setTrack(tracks[(index + direction + tracks.length) % tracks.length].id);
  }

  /** The seek range moved to `value` (0 to SEEK_MAX). */
  seek(value: number) {
    const media = this.media;
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;
    media.currentTime = (value / SEEK_MAX) * media.duration;
    this.updatePlaybackTime();
  }

  togglePlaying() {
    void this.setPlaying(!this.isMediaPlaying());
  }

  // --- Internals ------------------------------------------------------------

  private currentTrack(): PlayerTrack | undefined {
    return this.tracks.find((track) => track.id === this.settings.track) ?? this.tracks[0];
  }

  private isMediaPlaying() {
    return Boolean(this.media && !this.media.paused && !this.media.ended);
  }

  private isPlayerVisible() {
    return this.windowState.visible && !document.hidden;
  }

  private saveSettings(change: Partial<MusicSettings>) {
    this.settings = normalizeMusicSettings({ ...this.settings, ...change }, this.trackIds);
    saveMusicSettings(this.settings);
    this.render();
  }

  // Loads the track's file into the media element: only when the window
  // opens or playback starts, never on page load.
  private loadTrackSource() {
    const track = this.currentTrack();
    const media = this.media;
    if (!track || !media || media.getAttribute("src") === track.src) return;
    this.playbackRequestId += 1;
    media.preload = "metadata";
    media.src = track.src;
    media.load();
  }

  private updatePlaybackTime() {
    const currentTime = this.media?.currentTime || 0;
    const duration = this.media?.duration || 0;
    const canSeek = Number.isFinite(duration) && duration > 0;
    this.update({
      elapsed: formatTime(currentTime),
      remaining: canSeek ? `-${formatTime(Math.max(0, duration - currentTime))}` : "-0:00",
      canSeek,
      seek: canSeek ? Math.round((currentTime / duration) * SEEK_MAX) : 0,
    });
  }

  // A media element routed into a suspended AudioContext plays silently,
  // and some browsers never resume it (Firefox without an audio device).
  // So the media plays on its own and joins the analyser once it runs.
  private connectAnalyzer() {
    const { media, audioContext } = this;
    if (!media || this.analyser || audioContext?.state !== "running") return Boolean(this.analyser);
    try {
      const analyser = audioContext.createAnalyser();
      const outputGain = audioContext.createGain();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      const source = audioContext.createMediaElementSource(media);
      source.connect(analyser);
      analyser.connect(outputGain);
      outputGain.connect(audioContext.destination);
      this.analyser = analyser;
      this.outputGain = outputGain;
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
      this.waveformData = new Uint8Array(analyser.fftSize);
      this.applyVolume();
    } catch {
      this.analyser = null;
      this.outputGain = null;
      this.frequencyData = null;
      this.waveformData = null;
    }
    return Boolean(this.analyser);
  }

  private resumeAudioContext() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!this.media || !AudioContextClass) return;
    if (!this.audioContext) {
      try {
        const context = new AudioContextClass();
        context.addEventListener("statechange", () => {
          this.connectAnalyzer();
          this.syncVisualizer();
        });
        this.audioContext = context;
      } catch {
        this.audioContext = null;
        return;
      }
    }
    const context = this.audioContext;
    if (context.state !== "running") {
      // Not awaited: playback must not wait for a resume that may never
      // settle. The visualizer shows its idle pattern meanwhile.
      Promise.resolve()
        .then(() => context.resume())
        .catch(() => {});
    }
    this.connectAnalyzer();
  }

  private hasAudioData() {
    return Boolean(this.analyser && this.audioContext?.state === "running");
  }

  private sampleAudio() {
    if (this.analyser && this.frequencyData && this.waveformData && this.hasAudioData()) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      this.analyser.getByteTimeDomainData(this.waveformData);
    }
  }

  // Sends levels to the music-reactive desktop background. A stop is sent once.
  private publishAudioFrame(playing: boolean) {
    const data = this.frequencyData;
    if (playing && data && this.audioContext?.state === "running") {
      let low = 0;
      let mid = 0;
      let high = 0;
      const lowLimit = Math.max(1, Math.floor(data.length * 0.18));
      const midLimit = Math.max(lowLimit + 1, Math.floor(data.length * 0.52));
      data.forEach((value, index) => {
        if (index < lowLimit) low += value;
        else if (index < midLimit) mid += value;
        else high += value;
      });
      const lowLevel = low / (lowLimit * 255);
      const midLevel = mid / ((midLimit - lowLimit) * 255);
      const highLevel = high / ((data.length - midLimit) * 255);
      this.audioFramePlaying = true;
      document.dispatchEvent(
        new CustomEvent("desktop:music-audio-frame", {
          detail: {
            playing: true,
            low: lowLevel,
            mid: midLevel,
            high: highLevel,
            energy: Math.min(1, lowLevel * 0.46 + midLevel * 0.34 + highLevel * 0.2),
          },
        }),
      );
    } else if (!playing && this.audioFramePlaying) {
      this.audioFramePlaying = false;
      document.dispatchEvent(
        new CustomEvent("desktop:music-audio-frame", {
          detail: { playing: false, low: 0, mid: 0, high: 0, energy: 0 },
        }),
      );
    }
  }

  private draw(playing: boolean) {
    if (!this.canvasContext) return;
    drawVisualizer(this.canvasContext, {
      playing,
      hasAudioData: this.hasAudioData(),
      frequencyData: this.frequencyData,
      waveformData: this.waveformData,
      phase: this.visualizerPhase,
    });
  }

  // Animate only while music plays in the visible window. Reduced motion
  // keeps the visualizer static.
  private shouldAnimateVisualizer() {
    return this.isMediaPlaying() && this.isPlayerVisible() && !this.reducedMotion?.matches;
  }

  private tickVisualizer = () => {
    this.visualizerFrame = 0;
    if (!this.shouldAnimateVisualizer()) {
      this.syncVisualizer();
      return;
    }
    this.sampleAudio();
    this.visualizerPhase += 0.055;
    this.draw(true);
    this.visualizerFrame = requestAnimationFrame(this.tickVisualizer);
  };

  // The desktop background asks for levels on each of its own frames, so
  // the music reaches it with the player minimized or closed and without a
  // second animation loop. Reduced motion sends no levels.
  private requestAudioFrame() {
    const playing = this.isMediaPlaying() && !this.reducedMotion?.matches;
    if (playing) this.sampleAudio();
    this.publishAudioFrame(playing);
  }

  private syncVisualizer() {
    if (this.shouldAnimateVisualizer()) {
      if (!this.visualizerFrame) this.visualizerFrame = requestAnimationFrame(this.tickVisualizer);
      return;
    }
    if (this.visualizerFrame) {
      cancelAnimationFrame(this.visualizerFrame);
      this.visualizerFrame = 0;
    }
    if (this.isPlayerVisible()) this.draw(false);
  }

  private applyVolume() {
    const media = this.media;
    if (!media) return;
    const { volume: rawVolume, muted } = this.audio;
    const volume = Number.isFinite(rawVolume) ? Math.max(0, Math.min(1, rawVolume)) : 1;
    const outputVolume = muted ? 0 : volume;
    if (this.outputGain && this.audioContext) {
      this.outputGain.gain.setTargetAtTime(outputVolume, this.audioContext.currentTime, 0.015);
      media.volume = 1;
      media.muted = false;
      return;
    }
    media.volume = volume;
    media.muted = Boolean(muted);
  }

  private syncAudioSource() {
    const media = this.media;
    if (!this.currentTrack() || !media) return;
    const wasPaused = media.paused;
    // A closed, idle player loads the new track when it is next needed.
    if (this.windowState.shown || !wasPaused) this.loadTrackSource();
    if (this.settings.playing && !wasPaused) void this.startPlayback();
  }

  private async startPlayback() {
    const media = this.media;
    if (!media || !this.currentTrack()) {
      this.playbackRequestId += 1;
      this.saveSettings({ playing: false });
      this.update({ status: NO_TRACKS_STATUS });
      return false;
    }
    this.loadTrackSource();
    const requestId = this.playbackRequestId + 1;
    this.playbackRequestId = requestId;
    this.resumeAudioContext();
    this.applyVolume();
    try {
      await media.play();
      if (requestId !== this.playbackRequestId || !this.isMediaPlaying()) return false;
      this.saveSettings({ playing: true });
      return true;
    } catch (error) {
      if (requestId !== this.playbackRequestId) return false;
      this.saveSettings({ playing: false });
      this.update({
        status: error instanceof Error && error.name === "NotAllowedError" ? "Playback was blocked by the browser." : PLAY_FAILED,
      });
      return false;
    }
  }

  // Refreshes the view from the settings and the media element (the Astro
  // player's render()): it also clears an earlier error message.
  private render() {
    const track = this.currentTrack();
    if (!track) {
      this.updatePlaybackTime();
      this.update({ playing: false, status: NO_TRACKS_STATUS });
      return;
    }
    const playing = this.isMediaPlaying();
    const silent = this.audio.muted || this.audio.volume === 0;
    this.update({ track: track.id, playing, status: playing && silent ? SILENT_STATUS : "" });
    this.applyVolume();
    this.updatePlaybackTime();
  }
}
