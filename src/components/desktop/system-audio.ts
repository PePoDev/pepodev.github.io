// System audio (pepodev.systemAudio): the tray's volume and mute. Every
// change saves it and dispatches desktop:audio-settings ({ volume, muted })
// on document. The store also follows desktop:audio-settings events that
// other scripts dispatch (tests do; the old apps listened for the event),
// without saving or re-dispatching them, so useSystemAudio() is the one
// source of truth for Music, White Noise, Snake, the SRE game and the tray.
import { createStore, useStore } from "./store";

export interface SystemAudio {
  /** 0 to 1. */
  volume: number;
  muted: boolean;
}

export const SYSTEM_AUDIO_KEY = "pepodev.systemAudio";
const defaults: SystemAudio = { volume: 1, muted: false };

export const systemAudioStore = createStore<SystemAudio>(defaults);

export function useSystemAudio(): SystemAudio {
  return useStore(systemAudioStore, (audio) => audio);
}

/** The saved settings over the defaults. */
export function readSystemAudio(): SystemAudio {
  try {
    const raw = localStorage.getItem(SYSTEM_AUDIO_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Ignore corrupt persisted settings.
  }
  return { ...defaults };
}

/** The valid fields of an incoming change (an event's detail). */
function validChange(detail: unknown): Partial<SystemAudio> {
  const change: Partial<SystemAudio> = {};
  if (!detail || typeof detail !== "object") return change;
  const { volume, muted } = detail as Record<string, unknown>;
  if (typeof volume === "number" && Number.isFinite(volume)) change.volume = Math.max(0, Math.min(1, volume));
  if (typeof muted === "boolean") change.muted = muted;
  return change;
}

let booted = false;
let announcing = false;

function announce(settings: SystemAudio) {
  systemAudioStore.set(settings);
  announcing = true;
  try {
    document.dispatchEvent(new CustomEvent("desktop:audio-settings", { detail: settings }));
  } finally {
    announcing = false;
  }
}

/** Changes and saves the system audio settings. */
export function setSystemAudio(change: Partial<SystemAudio>) {
  // After the boot the store holds what the page uses, including changes
  // other scripts announced without saving them.
  const settings = { ...(booted ? systemAudioStore.get() : readSystemAudio()), ...change };
  try {
    localStorage.setItem(SYSTEM_AUDIO_KEY, JSON.stringify(settings));
  } catch {
    // The settings still apply for this page.
  }
  announce(settings);
}

// desktop:audio-settings from another script: follow it.
function onAudioSettings(event: Event) {
  if (announcing) return;
  const change = validChange((event as CustomEvent).detail);
  if (Object.keys(change).length === 0) return;
  systemAudioStore.set((current) =>
    Object.entries(change).every(([key, value]) => current[key as keyof SystemAudio] === value)
      ? current
      : { ...current, ...change },
  );
}

/** Boots the settings from storage, announces them once and follows incoming events. */
export function startSystemAudio(): () => void {
  booted = true;
  announce(readSystemAudio());
  document.addEventListener("desktop:audio-settings", onAudioSettings);
  return () => {
    booted = false;
    document.removeEventListener("desktop:audio-settings", onAudioSettings);
  };
}
