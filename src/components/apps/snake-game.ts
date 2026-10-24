// The Snake game's rules, board drawing, best score and scare sound. The
// React body (SnakeApp.tsx) renders its snapshot (score, best, status,
// overlay, jumpscare), draws through it on its canvas, and feeds it keys,
// buttons and the keyboard-ownership check it pauses on.
import type { SystemAudio } from "@components/desktop/app-api";
import { loadBest, saveBest } from "./snake-best";

export type SnakeState = "ready" | "running" | "paused" | "over";

export interface SnakeSnapshot {
  score: number;
  best: number;
  state: SnakeState;
  /** The jumpscare is on screen. */
  scare: boolean;
}

interface Cell {
  x: number;
  y: number;
}

type AudioContextConstructor = typeof AudioContext;

const SIZE = 20;
const TICK_MS = 300;
const SCARE_SCORE = 120;
const SCARE_MS = 1150;

export class SnakeGame {
  private snake: Cell[] = [];
  private food: Cell = { x: 14, y: 10 };
  private direction: Cell = { x: 1, y: 0 };
  private nextDirection: Cell = { x: 1, y: 0 };
  private timer = 0;
  private scareTimer = 0;
  private scareShown = false;
  private canvas: CanvasRenderingContext2D | null = null;
  private audioContext: AudioContext | null = null;
  private snapshot: SnakeSnapshot;
  private readonly listeners = new Set<() => void>();
  /** Whether the game hears its keys; the game pauses on a tick when it does not. */
  ownsKeyboard: () => boolean = () => true;
  audio: SystemAudio = { volume: 1, muted: false };

  constructor() {
    this.snapshot = { score: 0, best: 0, state: "ready", scare: false };
    this.placeStart();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(change: Partial<SnakeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }

  /** Shows the saved best (and drops the old key's made-up one). */
  restoreBest() {
    this.update({ best: loadBest() });
  }

  /** Draws on `canvas` from now on (null to stop). */
  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas?.getContext("2d") ?? null;
    this.draw();
  }

  /** Stops the clock and the jumpscare timer (the body went away). */
  dispose() {
    this.stopTimer();
    window.clearTimeout(this.scareTimer);
    this.canvas = null;
  }

  // --- Controls -------------------------------------------------------------

  start() {
    if (this.snapshot.state === "over") this.reset("running");
    this.stopTimer();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.update({ state: "running" });
  }

  pause() {
    if (this.snapshot.state !== "running") return;
    this.stopTimer();
    this.update({ state: "paused" });
  }

  /** Space and P. */
  togglePause() {
    if (this.snapshot.state === "running") this.pause();
    else this.start();
  }

  reset(state: SnakeState = "ready") {
    this.stopTimer();
    this.placeStart();
    this.scareShown = false;
    window.clearTimeout(this.scareTimer);
    this.update({ score: 0, state, scare: false });
    this.draw();
  }

  /** Steers (never straight back); a ready or paused game starts moving. */
  steer(x: number, y: number) {
    if (this.direction.x + x === 0 && this.direction.y + y === 0) return;
    this.nextDirection = { x, y };
    const { state } = this.snapshot;
    if (state === "ready" || state === "paused") this.start();
  }

  // --- Rules ----------------------------------------------------------------

  private placeStart() {
    this.snake = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.food = { x: 14, y: 10 };
  }

  private stopTimer() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private tick() {
    // Pause whenever the game can't hear its keys, so it never runs on while
    // the player can't steer or pause it.
    if (!this.ownsKeyboard()) {
      this.pause();
      return;
    }

    this.direction = this.nextDirection;
    const head = { x: this.snake[0].x + this.direction.x, y: this.snake[0].y + this.direction.y };
    const hitWall = head.x < 0 || head.x >= SIZE || head.y < 0 || head.y >= SIZE;
    const hitSelf = this.snake.some((segment) => segment.x === head.x && segment.y === head.y);
    if (hitWall || hitSelf) {
      this.stopTimer();
      const best = Math.max(this.snapshot.best, this.snapshot.score);
      saveBest(best);
      this.update({ state: "over", best });
      return;
    }

    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      const score = this.snapshot.score + 10;
      const best = Math.max(this.snapshot.best, score);
      saveBest(best);
      this.update({ score, best });
      this.showJumpScare();
      this.placeFood();
    } else {
      this.snake.pop();
    }
    this.draw();
  }

  private placeFood() {
    do {
      this.food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
    } while (this.snake.some((segment) => segment.x === this.food.x && this.food.y === segment.y));
  }

  private showJumpScare() {
    if (this.scareShown || this.snapshot.score < SCARE_SCORE) return;
    this.scareShown = true;
    this.update({ scare: true });
    void this.playScareSound();
    this.scareTimer = window.setTimeout(() => this.update({ scare: false }), SCARE_MS);
  }

  // --- Output ---------------------------------------------------------------

  private draw() {
    const context = this.canvas;
    if (!context) return;
    const { width, height } = context.canvas;
    const cell = width / SIZE;
    const drawCell = (x: number, y: number, fill: string, inset = 2) => {
      context.fillStyle = fill;
      context.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
    };

    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(3, 7, 18, 0.72)";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(148, 163, 184, 0.08)";
    context.lineWidth = 1;
    for (let i = 1; i < SIZE; i += 1) {
      context.beginPath();
      context.moveTo(i * cell, 0);
      context.lineTo(i * cell, height);
      context.moveTo(0, i * cell);
      context.lineTo(width, i * cell);
      context.stroke();
    }

    drawCell(this.food.x, this.food.y, "#ff9f0a", 4);
    this.snake.forEach((segment, index) => {
      drawCell(segment.x, segment.y, index === 0 ? "#64d2ff" : "#30d158", index === 0 ? 2 : 3);
    });
  }

  private outputVolume() {
    const { volume, muted } = this.audio;
    const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
    return muted ? 0 : level;
  }

  private async playScareSound() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass || this.outputVolume() === 0) return;
    this.audioContext ??= new AudioContextClass();
    const context = this.audioContext;
    if (context.state === "suspended") await context.resume();

    const now = context.currentTime;
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const shriek = context.createOscillator();
    const growl = context.createOscillator();
    const tremolo = context.createOscillator();
    const tremoloGain = context.createGain();

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.34 * this.outputVolume(), now + 0.035);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.72);
    filter.Q.value = 7;

    shriek.type = "sawtooth";
    shriek.frequency.setValueAtTime(980, now);
    shriek.frequency.exponentialRampToValueAtTime(120, now + 0.75);
    growl.type = "square";
    growl.frequency.setValueAtTime(74, now);
    growl.frequency.exponentialRampToValueAtTime(42, now + 0.75);
    tremolo.type = "sine";
    tremolo.frequency.value = 19;
    tremoloGain.gain.value = 28;

    tremolo.connect(tremoloGain);
    tremoloGain.connect(shriek.frequency);
    shriek.connect(filter);
    growl.connect(filter);
    filter.connect(master);
    master.connect(context.destination);

    shriek.start(now);
    growl.start(now);
    tremolo.start(now);
    shriek.stop(now + 0.92);
    growl.stop(now + 0.92);
    tremolo.stop(now + 0.92);
  }
}
