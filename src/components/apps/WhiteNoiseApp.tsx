"use client";
// White Noise: a rain loop made with Web Audio (filtered noise plus random
// drops). It follows the system volume and mute (useSystemAudio), and stops
// when its window closes and in website mode, which has no audio controls.
// Intentionally no rain animation (README).
import { useEffect, useRef, useState } from "react";
import { useAppWindow, useSiteMode, useSystemAudio, type AppProps, type SystemAudio } from "@components/desktop/app-api";

type AudioContextConstructor = typeof AudioContext;

const WAITING_STATUS = "Waiting for the browser to start audio. Allow sound for this site to hear the rain.";

function outputVolume({ volume, muted }: SystemAudio) {
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  return muted ? 0 : level;
}

/** The rain's Web Audio graph, built on the first start and kept for the page. */
class Rain {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private dropTimer = 0;
  private resumeTimer = 0;
  private playing = false;
  private volume = 1;

  /** Called when the browser starts audio late (or never, when the wait gives up). */
  constructor(private readonly onWaiting: (waiting: boolean) => void) {}

  /** Starts (or restarts) the loop; false when the browser has no Web Audio. */
  start(): boolean {
    if (!this.setup()) return false;
    this.stop();
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.createNoiseBuffer(context);
    source.loop = true;
    source.connect(this.filter!);
    source.start();
    this.source = source;
    this.playing = true;
    this.applyVolume();
    this.scheduleDrops();
    this.resume();
    return true;
  }

  stop() {
    this.playing = false;
    window.clearTimeout(this.resumeTimer);
    window.clearInterval(this.dropTimer);
    this.dropTimer = 0;
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // The source may already be stopped.
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.setTargetAtTime(this.volume * 0.42, this.context.currentTime, 0.025);
  }

  private setup() {
    if (this.context) return true;
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return false;
    let context: AudioContext;
    try {
      context = new AudioContextClass();
    } catch {
      return false;
    }
    const masterGain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.62;
    filter.connect(masterGain);
    masterGain.connect(context.destination);
    // A context that starts late brings the rain in by itself.
    context.addEventListener("statechange", () => {
      if (context.state === "running" && this.playing) this.onWaiting(false);
    });
    this.context = context;
    this.masterGain = masterGain;
    this.filter = filter;
    this.applyVolume();
    return true;
  }

  private createNoiseBuffer(context: AudioContext) {
    const { sampleRate } = context;
    const buffer = context.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[index] = last * 0.72 + white * 0.18;
    }
    return buffer;
  }

  private playDrop() {
    const { context, masterGain } = this;
    if (!context || !masterGain || !this.playing) return;
    // Drops queued on a stopped clock would all sound at once on resume.
    if (context.state !== "running") return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(650 + Math.random() * 900, now);
    oscillator.frequency.exponentialRampToValueAtTime(180 + Math.random() * 160, now + 0.08);
    filter.type = "lowpass";
    filter.frequency.value = 1400 + Math.random() * 900;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }

  private scheduleDrops() {
    window.clearInterval(this.dropTimer);
    this.dropTimer = window.setInterval(() => {
      this.playDrop();
      if (Math.random() > 0.55) this.playDrop();
    }, 130);
  }

  // Some browsers start the context late (a slow audio device) or never
  // settle resume() (Firefox without an audio device). The rain keeps going
  // and says it is waiting until the context runs.
  private resume() {
    const context = this.context!;
    if (context.state === "running") return;
    const showWaiting = () => {
      if (this.playing && context.state !== "running") this.onWaiting(true);
    };
    this.resumeTimer = window.setTimeout(showWaiting, 1500);
    Promise.resolve()
      .then(() => context.resume())
      .catch(showWaiting);
  }
}

export default function WhiteNoiseApp(_props: AppProps<"whitenoise">) {
  const { open } = useAppWindow();
  const mode = useSiteMode();
  const audio = useSystemAudio();
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [rain] = useState(() => new Rain(setWaiting));
  const playingRef = useRef(false);
  const volume = outputVolume(audio);

  const start = () => {
    if (!rain.start()) {
      setUnavailable(true);
      return;
    }
    playingRef.current = true;
    setWaiting(false);
    setPlaying(true);
  };

  const stop = () => {
    rain.stop();
    playingRef.current = false;
    setWaiting(false);
    setPlaying(false);
  };

  useEffect(() => rain.setVolume(volume), [rain, volume]);

  // Rain stops with its window and in website mode, which has no audio
  // controls (and when the body goes away).
  useEffect(() => {
    if ((!open || mode === "website") && playingRef.current) {
      rain.stop();
      playingRef.current = false;
      setWaiting(false);
      setPlaying(false);
    }
  }, [rain, open, mode]);
  useEffect(() => () => rain.stop(), [rain]);

  const status = unavailable && !playing
    ? "Audio is not available in this browser."
    : !playing
      ? "Ready"
      : waiting
        ? WAITING_STATUS
        : volume === 0
          ? "Muted by system audio"
          : "Rain loop active";

  return (
    <div className={playing ? "app-content white-noise-app noise-playing" : "app-content white-noise-app"} data-white-noise-app="">
      <div className="noise-panel">
        <div>
          <div className="music-eyebrow">White Noise</div>
          <h2>Rain Terminal</h2>
          <p data-noise-status="" aria-live="polite">
            {status}
          </p>
        </div>

        <label className="settings-field">
          <span>Mode</span>
          <select data-noise-mode="" onChange={() => playingRef.current && start()}>
            <option value="rain">Rainy sound</option>
          </select>
        </label>

        <div className="settings-actions">
          <button type="button" data-noise-toggle="" onClick={() => (playingRef.current ? stop() : start())}>
            {playing ? "Stop rain" : "Start rain"}
          </button>
        </div>
      </div>
    </div>
  );
}
