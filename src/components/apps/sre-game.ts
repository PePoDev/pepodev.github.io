// The SRE game's engine: the boot sequence, the alert rounds and their
// timers, and the chiptune audio. The React body (SreGameApp.tsx) renders
// its snapshot and tells it when the window opens or closes, when it is
// hidden (minimized, or the site in website mode) and what the system audio
// is.
//
// Every game timer goes through later(), so a hidden window freezes them
// all, along with the music, and each resumes with the time it had left.
import type { SystemAudio } from "@components/desktop/app-api";
import { ALERTS, BOOT_LINES } from "./sre-game-script";

export interface SreLog {
  kind: "failed" | "expired";
  /** The failed mitigation's result. */
  result?: string;
}

export interface SreAlertView {
  index: number;
  timeLeft: number;
  /** The round is over: its actions are disabled. */
  resolved: boolean;
  logs: SreLog[];
}

export interface SreSnapshot {
  /** Not reset yet: the screens still show their first copy. */
  fresh: boolean;
  /** 0 boot, 1 game, 2 failure, 3 solution. */
  screen: number;
  /** Boot lines shown so far, and whether Enter Production shows. */
  bootLines: number;
  bootDone: boolean;
  health: number;
  /** Alerts handled so far. */
  round: number;
  alert: SreAlertView | null;
  audioEnabled: boolean;
  muted: boolean;
}

interface Timeout {
  callback: () => void;
  remaining: number;
  startedAt: number;
  handle: number;
}

type AudioContextConstructor = typeof AudioContext;

export class SreGame {
  private readonly timeouts = new Set<Timeout>();
  private alertTimer: Timeout | null = null;
  private bootToken = 0;
  /** The boot whose Enter Production was pressed. */
  private enteredToken = -1;
  /**
   * The window is open (reset() to stop()). Nothing sounds while it is not,
   * so an audio start that settles after a close stays silent.
   */
  private active = false;
  private paused = false;
  private resumeBgm = false;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmTimer = 0;
  private bgmStep = 0;
  private systemAudio: SystemAudio = { volume: 1, muted: false };
  private snapshot: SreSnapshot = {
    fresh: true,
    screen: 0,
    bootLines: 0,
    bootDone: false,
    health: 100,
    round: 0,
    alert: null,
    audioEnabled: false,
    muted: false,
  };
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(change: Partial<SreSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }

  private get audioEnabled() {
    return this.snapshot.audioEnabled;
  }

  // --- Timers ---------------------------------------------------------------

  private later(callback: () => void, delay: number): Timeout {
    const timeout: Timeout = { callback, remaining: delay, startedAt: 0, handle: 0 };
    this.timeouts.add(timeout);
    if (!this.paused) this.runTimeout(timeout);
    return timeout;
  }

  private runTimeout(timeout: Timeout) {
    timeout.startedAt = Date.now();
    timeout.handle = window.setTimeout(() => {
      this.timeouts.delete(timeout);
      timeout.callback();
    }, timeout.remaining);
  }

  private cancelLater(timeout: Timeout | null) {
    if (!timeout) return;
    window.clearTimeout(timeout.handle);
    this.timeouts.delete(timeout);
  }

  private wait(delay: number) {
    return new Promise<void>((resolve) => this.later(resolve, delay));
  }

  private clearTimers() {
    this.cancelLater(this.alertTimer);
    this.alertTimer = null;
    this.timeouts.forEach((timeout) => window.clearTimeout(timeout.handle));
    this.timeouts.clear();
    this.bootToken += 1;
    this.resumeBgm = false;
    this.stopBgm();
  }

  /** Freezes (hidden window) or resumes the game, its timers and its music. */
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      const now = Date.now();
      this.timeouts.forEach((timeout) => {
        window.clearTimeout(timeout.handle);
        timeout.remaining = Math.max(0, timeout.remaining - (now - timeout.startedAt));
      });
      this.resumeBgm = Boolean(this.bgmTimer);
      this.stopBgm();
      if (this.audioContext?.state === "running") void this.audioContext.suspend();
      return;
    }
    if (this.audioEnabled && this.audioContext?.state === "suspended") void this.audioContext.resume();
    this.timeouts.forEach((timeout) => this.runTimeout(timeout));
    if (this.resumeBgm) this.startBgm();
    this.resumeBgm = false;
  }

  // --- Audio ----------------------------------------------------------------

  setSystemAudio(audio: SystemAudio) {
    this.systemAudio = audio;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(this.effectiveVolume(), this.audioContext.currentTime, 0.02);
    }
    this.update({ muted: audio.muted });
  }

  private effectiveVolume() {
    return this.systemAudio.muted ? 0 : this.systemAudio.volume;
  }

  private setupAudio() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return false;
    if (this.audioContext) return true;
    const context = new AudioContextClass();
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const sfxGain = context.createGain();
    masterGain.gain.value = this.effectiveVolume();
    musicGain.gain.value = 0.08;
    sfxGain.gain.value = 0.22;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(context.destination);
    this.audioContext = context;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    return true;
  }

  private async enableAudio() {
    if (!this.setupAudio()) return false;
    if (this.audioContext!.state === "suspended") await this.audioContext!.resume();
    this.update({ audioEnabled: true });
    this.startBgm();
    return true;
  }

  private disableAudio() {
    this.update({ audioEnabled: false });
    this.stopBgm();
  }

  /** The Audio On/Off button. */
  async toggleAudio() {
    if (this.audioEnabled) {
      this.disableAudio();
      return;
    }
    await this.enableAudio();
    this.playStartCue();
  }

  private playTone(
    freq: number,
    duration = 0.12,
    type: OscillatorType = "sine",
    volume = 0.12,
    destination: GainNode | null = this.sfxGain,
    startOffset = 0,
  ) {
    const context = this.audioContext;
    if (!this.active || !this.audioEnabled || !context || !destination) return;
    const start = context.currentTime + startOffset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private playSequence(notes: number[], type: OscillatorType = "sine", volume = 0.12, spacing = 0.08, duration = 0.1) {
    notes.forEach((note, index) => this.playTone(note, duration, type, volume, this.sfxGain, index * spacing));
  }

  private startBgm() {
    if (!this.active || !this.audioEnabled || this.bgmTimer) return;
    if (this.paused) {
      this.resumeBgm = true;
      return;
    }
    const pattern = [110, 146.83, 164.81, 220, 196, 164.81, 146.83, 123.47];
    const pulse = () => {
      const note = pattern[this.bgmStep % pattern.length];
      this.playTone(note, 0.26, "triangle", 0.16, this.musicGain);
      if (this.bgmStep % 4 === 0) this.playTone(note / 2, 0.5, "sine", 0.08, this.musicGain, 0.02);
      this.bgmStep += 1;
    };
    pulse();
    this.bgmTimer = window.setInterval(pulse, 380);
  }

  private stopBgm() {
    if (!this.bgmTimer) return;
    window.clearInterval(this.bgmTimer);
    this.bgmTimer = 0;
  }

  private playStartCue() {
    this.playSequence([220, 330, 440, 660], "triangle", 0.12, 0.075, 0.11);
  }

  private playAlertCue(severity: string) {
    if (severity === "catastrophic") this.playSequence([110, 110, 220, 110], "sawtooth", 0.18, 0.09, 0.12);
    else if (severity === "critical") this.playSequence([659.25, 440, 659.25], "square", 0.14, 0.11, 0.12);
    else this.playSequence([440, 554.37], "triangle", 0.12, 0.12, 0.12);
  }

  // --- The game -------------------------------------------------------------

  private showScreen(screen: number) {
    this.update({ screen });
    if (screen === 2) {
      this.stopBgm();
      this.playSequence([98, 73.42, 55], "sawtooth", 0.2, 0.18, 0.24);
    }
    if (screen === 3) this.playSequence([261.63, 329.63, 392, 523.25], "triangle", 0.14, 0.1, 0.15);
  }

  private async runBoot() {
    this.bootToken += 1;
    const token = this.bootToken;
    this.update({ bootLines: 0 });
    for (const line of BOOT_LINES) {
      await this.wait(line.delay);
      if (token !== this.bootToken) return;
      this.update({ bootLines: this.snapshot.bootLines + 1 });
      this.playTone(1046.5, 0.025, "square", 0.045);
    }
    this.update({ bootDone: true });
  }

  /** Back to the boot screen (the window opened, or Replay the Chaos). */
  reset() {
    this.active = true;
    this.clearTimers();
    this.showScreen(0);
    this.update({ fresh: false, bootDone: false, health: 100, round: 0, alert: null });
    void this.runBoot();
  }

  /** The window closed: nothing runs until it opens again. */
  stop() {
    this.active = false;
    this.clearTimers();
  }

  /** Enter Production. */
  async enterProduction() {
    // Once per boot: a second click, or a reset or close meanwhile, starts nothing.
    const token = this.bootToken;
    if (this.enteredToken === token) return;
    this.enteredToken = token;
    // On a device with no sound output, resume() never settles, so the game
    // starts anyway and audio joins if the browser ever starts it.
    await Promise.race([this.enableAudio(), this.wait(300)]);
    if (token !== this.bootToken) return;
    this.startBgm();
    this.playStartCue();
    this.update({ health: 100, round: 0, alert: null });
    this.showScreen(1);
    this.scheduleNextAlert();
  }

  /** What Now? */
  reveal() {
    this.showScreen(3);
  }

  private scheduleNextAlert() {
    if (this.snapshot.round >= ALERTS.length) return;
    this.later(() => this.showAlert(this.snapshot.round), this.snapshot.round === 0 ? 2500 : 3500);
  }

  private showAlert(index: number) {
    const alert = ALERTS[index];
    this.playAlertCue(alert.severity);
    this.update({ alert: { index, timeLeft: alert.timer, resolved: false, logs: [] } });
    const countDown = () => {
      const current = this.snapshot.alert;
      if (!current) return;
      const timeLeft = current.timeLeft - 1;
      this.update({ alert: { ...current, timeLeft } });
      if (timeLeft <= 0) {
        this.alertTimer = null;
        this.resolve(index, { kind: "expired" });
      } else {
        this.alertTimer = this.later(countDown, 1000);
      }
    };
    this.cancelLater(this.alertTimer);
    this.alertTimer = this.later(countDown, 1000);
  }

  /** A mitigation button: every one fails. */
  act(actionIndex: number) {
    const alert = this.snapshot.alert;
    if (!alert || alert.resolved) return;
    this.cancelLater(this.alertTimer);
    this.alertTimer = null;
    this.resolve(alert.index, { kind: "failed", result: ALERTS[alert.index].actions[actionIndex].result });
  }

  // The system absorbs the alert's damage, whatever happened.
  private resolve(index: number, log: SreLog) {
    if (log.kind === "failed") this.playSequence([246.94, 196, 146.83, 110], "sawtooth", 0.13, 0.075, 0.1);
    else this.playSequence([220, 164.81, 123.47], "square", 0.13, 0.12, 0.14);
    const health = Math.max(0, Math.min(100, this.snapshot.health - ALERTS[index].damage));
    const round = this.snapshot.round + 1;
    const alert = this.snapshot.alert;
    this.update({
      health,
      round,
      alert: alert && { ...alert, resolved: true, logs: [...alert.logs, log] },
    });
    if (health <= 0 || round >= ALERTS.length) {
      this.later(() => this.showScreen(2), 3500);
      return;
    }
    this.scheduleNextAlert();
  }

  /** The body went away: stop everything and release the audio device. */
  dispose() {
    this.active = false;
    this.clearTimers();
    // Without listeners now; a remount renders from here.
    this.snapshot = { ...this.snapshot, audioEnabled: false };
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }
}
