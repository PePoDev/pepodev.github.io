"use client";
// The Settings app. Appearance renders from the desktop preferences
// (useDesktopPrefs) and changes them through updateDesktopPrefs, which
// applies, saves and announces them (desktop:preferences), so a change made
// elsewhere (the palette's Toggle Theme) shows here too. Music drives the
// Music player through its controller (music-settings.ts) and follows what the
// player saves. Reset all settings, like the palette's Reset Desktop, only
// runs on a second click, tap or Enter.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { experienceMap } from "@utils/desktop-prefs";
import {
  mountApp,
  resetDesktop,
  updateDesktopPrefs,
  useAppWindow,
  useDesktopPrefs,
  type AppProps,
  type DesktopPrefs,
} from "@components/desktop/app-api";
import {
  loadMusicSettings,
  MUSIC_SETTINGS_EVENT,
  normalizeMusicSettings,
  requestMusic,
  type MusicSettings,
} from "./music-settings";

const ACCENTS = [
  { id: "green", label: "Green", color: "#30d158" },
  { id: "cyan", label: "Cyan", color: "#64d2ff" },
  { id: "purple", label: "Purple", color: "#bf5af2" },
  { id: "amber", label: "Amber", color: "#ff9f0a" },
];

const DARK_BACKGROUNDS = [
  { id: "network", label: "Primary" },
  { id: "aurora", label: "Aurora" },
  { id: "midnight", label: "Midnight" },
  { id: "ember", label: "Ember" },
  { id: "ocean", label: "Ocean Deep" },
  { id: "glacier", label: "Glacier" },
  { id: "void", label: "Void" },
  { id: "neon", label: "Neon City" },
  { id: "plasma", label: "Plasma" },
  { id: "storm", label: "Storm" },
  { id: "matrix", label: "Matrix" },
  { id: "sakura", label: "Sakura" },
  { id: "forest", label: "Forest" },
  { id: "sunset", label: "Sunset" },
  { id: "copper", label: "Copper" },
];

const LIGHT_BACKGROUNDS = [
  { id: "cloud", label: "Cloud" },
  { id: "daylight", label: "Daylight" },
  { id: "mint", label: "Mint" },
  { id: "peach", label: "Peach" },
  { id: "sky", label: "Sky" },
  { id: "lavender", label: "Lavender" },
  { id: "cream", label: "Cream" },
  { id: "rose", label: "Rose" },
  { id: "sage", label: "Sage" },
  { id: "coral", label: "Coral" },
  { id: "powder", label: "Powder Blue" },
  { id: "lemon", label: "Lemon" },
  { id: "blush", label: "Blush" },
  { id: "seafoam", label: "Seafoam" },
  { id: "sand", label: "Sand" },
];

// What the desktop boots with (prefs-core.ts); the body mounts after the boot.
const DEFAULT_PREFS: DesktopPrefs = {
  theme: "dark",
  accent: "green",
  background: "network",
  radius: 6,
  glass: 55,
  backgroundEffect: true,
  windowGlass: true,
  experience: "pepodev",
  variant: "default",
};

const EXPERIENCES = Object.entries(experienceMap).map(([id, { label, variants }]) => ({ id, label, variants }));

function rangeProgress(value: number, min: number, max: number) {
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { "--range-progress": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties;
}

/**
 * A preference slider. It listens for native input events, since scripts
 * (and tests) that set its value and dispatch "input" bypass React's change
 * detection, and follows the preference when it changes elsewhere.
 */
function RangeSetting(props: {
  label: string;
  name: "radius" | "glass";
  min: number;
  max: number;
  value: number;
  onInput: (value: number) => void;
}) {
  const { label, name, min, max, value, onInput } = props;
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef(onInput);
  useEffect(() => {
    latest.current = onInput;
  });

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const listener = () => latest.current(Number(input.value));
    input.addEventListener("input", listener);
    return () => input.removeEventListener("input", listener);
  }, []);

  useEffect(() => {
    const input = ref.current;
    if (input && input.value !== String(value)) input.value = String(value);
  }, [value]);

  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        ref={ref}
        data-setting={name}
        type="range"
        min={min}
        max={max}
        defaultValue={value}
        style={rangeProgress(value, min, max)}
      />
    </label>
  );
}

/**
 * The saved music settings. Only a running player can be playing, so a
 * saved `playing` counts once the player has started (it drops a stale one).
 */
function readShownMusic(trackIds: readonly string[]): MusicSettings {
  const saved = normalizeMusicSettings(loadMusicSettings(trackIds[0] ?? ""), trackIds);
  return { ...saved, playing: saved.playing && Boolean(window.__pepoMusicController) };
}

export default function SettingsApp({ data }: AppProps<"settings">) {
  const prefs = useDesktopPrefs() ?? DEFAULT_PREFS;
  const { open } = useAppWindow();
  const trackIds = useMemo(() => data.tracks.map((track) => track.id), [data]);
  const [music, setMusic] = useState(() => readShownMusic(trackIds));
  const [resetPrompt, setResetPrompt] = useState("");
  const resetRef = useRef<HTMLButtonElement>(null);
  const backgrounds = prefs.theme === "light" ? LIGHT_BACKGROUNDS : DARK_BACKGROUNDS;
  const variants = experienceMap[prefs.experience]?.variants ?? [];
  // The PePoDev look has the radius slider; an operating system's look draws
  // its own corners, and an opaque one (Windows 10, GNOME, KDE) no glass.
  const ownLook = prefs.experience === "pepodev";
  const glassLook = variants.find((variant) => variant.id === prefs.variant)?.glass !== false;

  // The Music controls drive the player, so its body mounts with Settings
  // (if the desktop's idle mount has not mounted it yet): a click then
  // reaches a player that exists and plays inside the click.
  useEffect(() => {
    if (!window.__pepoMusicController) mountApp("music");
  }, []);

  // The player announces every save (desktop:music-settings).
  useEffect(() => {
    const sync = () => setMusic(readShownMusic(trackIds));
    sync();
    document.addEventListener(MUSIC_SETTINGS_EVENT, sync);
    return () => document.removeEventListener(MUSIC_SETTINGS_EVENT, sync);
  }, [trackIds]);

  // Clicking anywhere else, leaving the button or closing the window
  // cancels a pending Reset all settings.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.target !== resetRef.current) setResetPrompt("");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) setResetPrompt("");
  }, [open]);

  const onReset = () => {
    // Destructive, like the palette's Reset Desktop: the first click or tap
    // only asks for confirmation.
    if (!resetPrompt) {
      setResetPrompt(
        window.matchMedia("(pointer: coarse)").matches
          ? "Tap Reset all settings again to clear all settings and reload."
          : "Press Enter or click Reset all settings again to clear all settings and reload.",
      );
      return;
    }
    resetDesktop(200);
  };

  const chooseTrack = (track: string) => {
    setMusic((current) => ({ ...current, track }));
    requestMusic({ track });
  };

  const togglePlaying = () => {
    requestMusic({ playing: !music.playing });
  };

  return (
    <div className="app-content settings-app" data-settings-app="">
      <div className="settings-layout">
        <section className="settings-panel">
          <h2>Appearance</h2>
          <div className="settings-grid">
            <label className="settings-field">
              <span>Desktop experience</span>
              <select
                data-setting="experience"
                value={prefs.experience}
                onChange={(event) => updateDesktopPrefs({ experience: event.target.value })}
              >
                {EXPERIENCES.map((experience) => (
                  <option key={experience.id} value={experience.id}>
                    {experience.label}
                  </option>
                ))}
              </select>
            </label>

            {variants.length > 1 && (
              <label className="settings-field">
                <span>Style</span>
                <select
                  data-setting="variant"
                  value={prefs.variant}
                  onChange={(event) => updateDesktopPrefs({ variant: event.target.value })}
                >
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="settings-field">
              <span>Theme</span>
              <select
                data-setting="theme"
                value={prefs.theme}
                onChange={(event) => updateDesktopPrefs({ theme: event.target.value })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Background</span>
              <select
                data-setting="background"
                data-background-select=""
                value={prefs.background}
                onChange={(event) => updateDesktopPrefs({ background: event.target.value })}
              >
                {backgrounds.map((background) => (
                  <option key={background.id} value={background.id}>
                    {background.label}
                  </option>
                ))}
              </select>
            </label>

            {ownLook && (
              <RangeSetting
                label="Window radius"
                name="radius"
                min={6}
                max={20}
                value={prefs.radius}
                onInput={(radius) => updateDesktopPrefs({ radius })}
              />
            )}

            {glassLook && (
              <RangeSetting
                label="Glass opacity"
                name="glass"
                min={55}
                max={90}
                value={prefs.glass}
                onInput={(glass) => updateDesktopPrefs({ glass })}
              />
            )}

            <label className="settings-field settings-checkbox">
              <input
                data-setting="backgroundEffect"
                type="checkbox"
                checked={Boolean(prefs.backgroundEffect)}
                onChange={(event) => updateDesktopPrefs({ backgroundEffect: event.target.checked })}
              />
              <span>Background effect</span>
            </label>

            {glassLook && (
              <label className="settings-field settings-checkbox">
                <input
                  data-setting="windowGlass"
                  type="checkbox"
                  checked={Boolean(prefs.windowGlass)}
                  onChange={(event) => updateDesktopPrefs({ windowGlass: event.target.checked })}
                />
                <span>Window glass style</span>
              </label>
            )}
          </div>

          <div className="settings-swatches" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                data-accent={accent.id}
                aria-label={`${accent.label} accent`}
                aria-pressed={prefs.accent === accent.id}
                style={{ "--swatch": accent.color } as CSSProperties}
                onClick={() => updateDesktopPrefs({ accent: accent.id })}
              />
            ))}
          </div>
        </section>

        <section className="settings-panel">
          <h2>Music</h2>
          <div className="settings-grid">
            <label className="settings-field">
              <span>Track</span>
              <select data-music-setting="track" value={music.track} onChange={(event) => chooseTrack(event.target.value)}>
                {data.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="settings-actions">
            <button type="button" data-music-setting="toggle" onClick={togglePlaying}>
              {music.playing ? "Pause music" : "Play music"}
            </button>
            <button
              ref={resetRef}
              type="button"
              className={resetPrompt ? "confirming" : undefined}
              data-settings-reset=""
              onClick={onReset}
              onBlur={() => setResetPrompt("")}
            >
              Reset all settings
            </button>
          </div>
          <p className="settings-status" data-settings-status="" role="status">
            {resetPrompt}
          </p>
        </section>
      </div>
    </div>
  );
}
