"use client";
// Snake (port of SnakeApp.astro). The rules, the board and the best score
// live in snake-game.ts; this body renders its snapshot. It takes keys only
// while its window owns the keyboard (useAppKeyboard: focused in desktop
// mode, no overlay open, no Ctrl, Meta or Alt), and the game pauses on its
// next tick whenever it loses the keyboard. Pointer presses leave the
// buttons unfocused, so Space after clicking Start still pauses.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { hasAppKeyboard, useAppKeyboard, useSystemAudio, type AppProps } from "@components/desktop/app-api";
import { SnakeGame, type SnakeState } from "./snake-game";

const STATUS: Record<SnakeState, { status: string; title: string; copy: string }> = {
  ready: { status: "Ready", title: "Snake Ops", copy: "Press Start or an arrow key." },
  paused: { status: "Paused", title: "Paused", copy: "Press Start to continue." },
  over: { status: "Game Over", title: "Incident Closed", copy: "Press Reset or Start for a new run." },
  running: { status: "Running", title: "", copy: "" },
};

type Direction = "up" | "down" | "left" | "right";

const DIRECTIONS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function SnakeApp({ appId }: AppProps<"snake">) {
  const [game] = useState(() => new SnakeGame());
  const view = useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
  const audio = useSystemAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text = STATUS[view.state];

  // Before the first paint, so the board and the best score never flash empty.
  useLayoutEffect(() => {
    game.ownsKeyboard = () => hasAppKeyboard(appId);
    game.restoreBest();
    game.attach(canvasRef.current);
    return () => game.dispose();
  }, [game, appId]);

  useEffect(() => {
    game.audio = audio;
  }, [game, audio]);

  const steer = (direction: Direction) => game.steer(DIRECTIONS[direction].x, DIRECTIONS[direction].y);

  useAppKeyboard((event) => {
    const key = event.key.toLowerCase();
    const direction: Direction | null =
      event.key === "ArrowUp" || key === "w"
        ? "up"
        : event.key === "ArrowDown" || key === "s"
          ? "down"
          : event.key === "ArrowLeft" || key === "a"
            ? "left"
            : event.key === "ArrowRight" || key === "d"
              ? "right"
              : null;
    if (direction) {
      event.preventDefault();
      steer(direction);
    } else if (event.key === " " || key === "p") {
      event.preventDefault();
      game.togglePause();
    }
  });

  // A control focused from the keyboard keeps its own Enter and Space
  // (app-keyboard.ts), so a pointer press leaves controls unfocused.
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as Element).closest("button")) return;
    event.preventDefault();
    const active = document.activeElement;
    if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur();
  };

  return (
    <div
      className="app-content snake-app"
      data-snake-game=""
      data-snake-state={view.state}
      onMouseDown={onMouseDown}
    >
      <div className="snake-panel">
        <div className="snake-stats" aria-live="polite">
          <div>
            <span>Score</span>
            <strong data-snake-score="">{view.score}</strong>
          </div>
          <div>
            <span>Best</span>
            <strong data-snake-best="">{view.best}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong data-snake-status="">{text.status}</strong>
          </div>
        </div>

        <div className="snake-stage">
          <canvas
            ref={canvasRef}
            className="snake-board"
            data-snake-board=""
            width="480"
            height="480"
            aria-label="Snake game board"
            role="img"
          />
          <div className="snake-overlay" data-snake-overlay="" hidden={view.state === "running"}>
            <strong data-snake-overlay-title="">{text.title}</strong>
            <span data-snake-overlay-copy="">{text.copy}</span>
          </div>
          <div
            className={view.scare ? "snake-jumpscare visible" : "snake-jumpscare"}
            data-snake-jumpscare=""
            aria-hidden="true"
            hidden={!view.scare}
          >
            <div className="snake-ghost">
              <span className="snake-ghost-eye" />
              <span className="snake-ghost-eye" />
              <span className="snake-ghost-mouth" />
            </div>
          </div>
        </div>

        <div className="snake-controls">
          <button type="button" data-snake-action="start" onClick={() => game.start()}>
            Start
          </button>
          <button type="button" data-snake-action="pause" onClick={() => game.pause()}>
            Pause
          </button>
          <button type="button" data-snake-action="reset" onClick={() => game.reset()}>
            Reset
          </button>
        </div>

        <div className="snake-pad" aria-label="Snake direction controls">
          <button type="button" data-snake-dir="up" aria-label="Move up" onClick={() => steer("up")}>
            ↑
          </button>
          <button
            type="button"
            data-snake-dir="left"
            aria-label="Move left"
            onClick={() => steer("left")}
          >
            ←
          </button>
          <button
            type="button"
            data-snake-dir="down"
            aria-label="Move down"
            onClick={() => steer("down")}
          >
            ↓
          </button>
          <button
            type="button"
            data-snake-dir="right"
            aria-label="Move right"
            onClick={() => steer("right")}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
