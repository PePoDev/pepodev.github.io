"use client";
// SRE Game - Taming Chaos (port of SreGameApp.astro). Mounted once the
// desktop is idle (registry mount: "idle"), so its text exists before the
// window opens. Each opening starts from the boot log, including an opening
// that happened before the body mounted; closing stops the game; a
// minimized window, a hidden tab or website mode freezes it (timers and
// music), and it resumes where it left off. The engine is sre-game.ts;
// reduced motion is sre-game.css's.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAppWindow, useSiteMode, useSystemAudio, type AppProps } from "@components/desktop/app-api";
import { SreGame, type SreAlertView } from "./sre-game";
import { ALERTS, BOOT_LINES } from "./sre-game-script";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function screenClass(screen: number, active: number) {
  return screen === active ? "sre-game-screen sre-game-screen-active" : "sre-game-screen";
}

function healthStatus(health: number) {
  if (health > 60) return { text: "Stable", cls: "sre-status-ok" };
  if (health > 30) return { text: "Degraded", cls: "sre-status-warn" };
  return { text: "Critical", cls: "sre-status-crit" };
}

function AlertCard({ alert }: { alert: SreAlertView }) {
  const { severity, title, desc } = ALERTS[alert.index];
  return (
    <>
      <div className={`sre-alert-card sre-severity-${severity}`}>
        <div className="sre-alert-header">
          <span className="sre-alert-title">{title}</span>
          <span className="sre-alert-severity">{severity}</span>
        </div>
        <div className="sre-alert-desc">{desc}</div>
        <div className="sre-alert-timer">{`Time remaining: ${alert.timeLeft}s`}</div>
      </div>
      {alert.logs.map((log, index) => (
        <div key={index} className="sre-mitigation-log">
          {log.kind === "failed" ? (
            <>
              <strong>Mitigation failed:</strong>
              {` ${log.result}`}
            </>
          ) : (
            <>
              <strong>Time expired - alert unresolved.</strong> System absorbed the damage.
            </>
          )}
        </div>
      ))}
    </>
  );
}

export default function SreGameApp({ data }: AppProps<"sregame">) {
  const [game] = useState(() => new SreGame());
  const view = useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
  const { open, minimized } = useAppWindow();
  const mode = useSiteMode();
  const audio = useSystemAudio();
  // A hidden tab still runs timers (Chrome about once a second), so rounds
  // would expire unseen.
  const tabHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => game.dispose(), [game]);
  useEffect(() => game.setSystemAudio(audio), [game, audio]);
  useEffect(() => game.setPaused(minimized || tabHidden || mode === "website"), [game, minimized, tabHidden, mode]);
  useEffect(() => {
    if (!open) return;
    game.reset();
    return () => game.stop();
  }, [game, open]);

  // The boot log follows its newest line.
  useLayoutEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [view.bootLines]);

  const { fresh, screen, health, alert } = view;
  const status = fresh ? { text: "All Systems Go", cls: "sre-status-ok" } : healthStatus(health);
  const audioLabel = view.audioEnabled ? (view.muted ? "Audio Muted" : "Audio On") : "Audio Off";

  return (
    <div className="app-content sre-game-container" data-sre-game="">
      <button
        className="sre-audio-toggle"
        type="button"
        aria-pressed={view.audioEnabled}
        onClick={() => void game.toggleAudio()}
      >
        {audioLabel}
      </button>
      <div className={screenClass(screen, 0)}>
        {/* A scroller of its own at phone widths, so it is a tab stop. */}
        <div ref={outputRef} className="sre-boot-output" role="log" aria-label="Boot log" tabIndex={0}>
          {BOOT_LINES.slice(0, view.bootLines).map((line, index) => (
            <div key={index} className={line.cls ? `sre-line ${line.cls}` : "sre-line"}>
              {line.text || " "}
            </div>
          ))}
        </div>
        <button
          className={view.bootDone ? "sre-boot-enter sre-btn" : "sre-boot-enter sre-btn sre-hidden"}
          type="button"
          onClick={() => void game.enterProduction()}
        >
          Enter Production
        </button>
      </div>
      <div className={screenClass(screen, 1)}>
        <div className="sre-game-hud">
          <div className="sre-hud-item">
            <span className="sre-hud-label">System Health</span>
            <div className="sre-health-bar">
              <div
                className="sre-health-fill"
                style={
                  fresh
                    ? undefined
                    : {
                        width: `${health}%`,
                        background: health > 60 ? "#22c55e" : health > 30 ? "#eab308" : "#ef4444",
                      }
                }
              />
            </div>
            <span className="sre-health-pct">{`${health}%`}</span>
          </div>
          <div className="sre-hud-item">
            <span className="sre-hud-label">Round</span>
            <span className="sre-round-num">{Math.min(view.round + 1, ALERTS.length)}</span>
          </div>
          <div className="sre-hud-item">
            <span className="sre-hud-label">Status</span>
            <span className={`sre-game-status ${status.cls}`}>{status.text}</span>
          </div>
        </div>
        <div className="sre-game-area">
          {alert ? (
            <AlertCard alert={alert} />
          ) : fresh ? (
            <div className="sre-game-message">
              <p>Monitoring production... Everything looks green.</p>
              <p className="sre-sub">Watch for alerts. Click to mitigate before health drops to zero.</p>
            </div>
          ) : (
            <div className="sre-game-message">
              <p>Monitoring production...</p>
              <p className="sre-sub">Alerts will appear below. Click an action to mitigate before time runs out.</p>
            </div>
          )}
        </div>
        <div className="sre-game-actions">
          {alert &&
            ALERTS[alert.index].actions.map((action, index) => (
              <button
                key={`${alert.index}-${index}`}
                className="sre-action-btn"
                type="button"
                disabled={alert.resolved}
                style={alert.resolved ? { opacity: 0.4 } : undefined}
                onClick={() => game.act(index)}
              >
                {action.text}
              </button>
            ))}
        </div>
      </div>
      <div className={screenClass(screen, 2)}>
        <div className="sre-gameover">
          <div className="sre-glitch-wrap">
            <h1 className="sre-glitch">SYSTEM FAILURE</h1>
          </div>
          <p className="sre-gameover-sub">All mitigation attempts have been exhausted.</p>
          <p className="sre-gameover-sub">The chaos is beyond manual remediation.</p>
          <br />
          <button className="sre-gameover-reveal sre-btn sre-btn-danger" type="button" onClick={() => game.reveal()}>
            What Now?
          </button>
        </div>
      </div>
      <div className={screenClass(screen, 3)}>
        <div className="sre-solution">
          <div className="sre-hero-badge">The Only Solution</div>
          <h1 className="sre-hero-title">
            Meet <span className="sre-accent">PePoDev</span>
          </h1>
          <p className="sre-hero-subtitle">{data.currentRole}</p>
          <div className="sre-divider" />
          <p className="sre-hero-tagline">
            You don&apos;t need another engineer who patches fires.
            <br />
            You need someone who <em>understands fire</em>.
          </p>
          <div className="sre-skills-grid">
            {SKILLS.map((skill) => (
              <div key={skill.icon} className="sre-skill-card">
                <div className="sre-skill-icon">{skill.icon}</div>
                <h3>{skill.title}</h3>
                <p>{skill.text}</p>
              </div>
            ))}
          </div>
          <div className="sre-cta-group">
            <a
              href="https://linkedin.com/in/pepodev"
              className="sre-btn sre-btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Connect on LinkedIn
            </a>
            <button className="sre-btn sre-btn-outline sre-solution-replay" type="button" onClick={() => game.reset()}>
              Replay the Chaos
            </button>
          </div>
          <p className="sre-footer-note">Every production has a hero.</p>
        </div>
      </div>
    </div>
  );
}

const SKILLS = [
  { icon: "IR", title: "Incident Response", text: "Fast triage and resolution when systems are under pressure." },
  { icon: "SR", title: "System Resilience", text: "Architecture that survives stress and recovers cleanly." },
  { icon: "OB", title: "Observability", text: "Metrics, logs, and traces that explain what production is doing." },
  { icon: "IaC", title: "Infrastructure as Code", text: "Reproducible, versioned, and tested systems." },
  { icon: "K8s", title: "Kubernetes", text: "Orchestrating containers at scale without losing sleep." },
  {
    icon: "CP",
    title: "Capacity Planning",
    text: "Predicting and preventing bottlenecks before they become incidents.",
  },
];
