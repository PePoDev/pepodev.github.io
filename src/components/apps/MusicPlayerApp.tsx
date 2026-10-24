"use client";
// Music Player (port of MusicPlayerApp.astro). Mounted once the desktop is
// idle (registry mount: "idle"), hidden in its closed window, because
// Settings drives the music and the desktop background asks it for levels
// (window.__pepoMusicController, music-settings.ts). The engine in
// music-player.ts owns playback, the analyser and the visualizer; this body
// renders its snapshot and tells it about the window, the site mode and the
// system audio.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useAppWindow, useSiteMode, useSystemAudio, type AppProps } from "@components/desktop/app-api";
import { MusicPlayer, SEEK_MAX } from "./music-player";
import { provideMusicController } from "./music-settings";

// Every track comes from the site's own folder (src/data/music.ts).
const TRACK_DETAIL = "Local music library";

export default function MusicPlayerApp({ data }: AppProps<"music">) {
  const { tracks } = data;
  const [player] = useState(() => new MusicPlayer(tracks));
  const view = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  const { open, minimized, visible } = useAppWindow();
  const mode = useSiteMode();
  const audio = useSystemAudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The order matters: the engine takes its elements first, and the
  // controller goes public last (Settings may be waiting to drive it).
  useEffect(() => player.start(videoRef.current ?? audioRef.current, canvasRef.current), [player]);
  useEffect(() => player.setAudio(audio), [player, audio]);
  useEffect(() => player.setWindow({ open, shown: open && !minimized, visible }), [player, open, minimized, visible]);
  useEffect(() => {
    if (mode === "website") player.stop();
  }, [player, mode]);
  useEffect(() => provideMusicController(player.controller), [player]);

  // For video tracks the artwork is the player, so one element loads a track.
  const firstTrack = tracks[0];
  const track = tracks.find((item) => item.id === view.track) ?? firstTrack;
  const seekProgress = Math.max(0, Math.min(100, (view.seek / SEEK_MAX) * 100));

  return (
    <div className={view.playing ? "app-content music-player-app music-playing" : "app-content music-player-app"} data-music-player="">
      <div className="music-now">
        {firstTrack && data.video ? (
          <video
            ref={videoRef}
            className="music-art"
            id="music-art"
            data-music-media=""
            playsInline
            preload="none"
            aria-hidden="true"
          />
        ) : firstTrack ? (
          <img className="music-art" id="music-art" alt="Album artwork for currently playing track" loading="lazy" />
        ) : (
          <div className="music-art music-art-empty" id="music-art" aria-hidden="true" />
        )}
        <div>
          <label className="music-title-picker">
            <select
              id="music-title"
              data-music-track=""
              aria-label="Track"
              value={view.track}
              disabled={!track}
              onChange={(event) => player.setTrack(event.target.value)}
            >
              {tracks.length ? (
                tracks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))
              ) : (
                <option value="">No Music Found</option>
              )}
            </select>
          </label>
          <div className="music-eyebrow">Now Playing</div>
          <p id="music-detail">{track ? TRACK_DETAIL : "Add audio files to public/music"}</p>
        </div>
      </div>

      <div className="music-playback-header">
        <div className="music-time-row" aria-label="Playback time">
          <span data-music-elapsed="">{view.elapsed}</span>
          <input
            data-music-seek=""
            type="range"
            min="0"
            max={SEEK_MAX}
            value={view.seek}
            aria-label="Seek track"
            disabled={!view.canSeek}
            onChange={(event) => player.seek(Number(event.target.value))}
            style={{ "--range-progress": `${seekProgress}%` } as CSSProperties}
          />
          <span data-music-remaining="">{view.remaining}</span>
        </div>
      </div>

      <div className="music-transport">
        <button type="button" data-music-prev="" aria-label="Previous track" onClick={() => player.step(-1)}>
          &lt;&lt;
        </button>
        <button
          type="button"
          className="music-play"
          data-music-toggle=""
          disabled={!track}
          onClick={() => player.togglePlaying()}
        >
          {view.playing ? "Pause" : "Play"}
        </button>
        <button type="button" data-music-next="" aria-label="Next track" onClick={() => player.step(1)}>
          &gt;&gt;
        </button>
      </div>

      <div className="music-visualizer" aria-hidden="true">
        <canvas ref={canvasRef} data-music-visualizer="" width="720" height="160" />
        <div className="music-visualizer-glow" />
      </div>

      <p className="music-status" data-music-status="" aria-live="polite">
        {view.status}
      </p>

      {firstTrack && !data.video && (
        <audio ref={audioRef} className="music-media" data-music-media="" preload="none" />
      )}
    </div>
  );
}
