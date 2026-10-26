"use client";
// Terminal: a tiny shell. `skills` prints skills.json and `projects` opens
// Projects. The input takes focus on every launch (useFocusOnLaunch; on touch
// screens only when the keyboard opened the window, so a tap does not raise
// the on-screen keyboard), and a click or tap anywhere in the app focuses it.
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import skills from "@data/skills.json";
import { openApp, useFocusOnLaunch, type AppProps } from "@components/desktop/app-api";

const COMMANDS = ["help", "whoami", "skills", "projects", "uptime", "contact", "clear"];
const SKILL_NAMES = skills.map((skill) => skill.name);
const PROMPT = "pepo@desktop:~$";

interface Line {
  id: number;
  text: string;
  className?: string;
}

export default function TerminalApp(_props: AppProps<"terminal">) {
  const [showIntro, setShowIntro] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextLineId = useRef(0);

  useFocusOnLaunch(inputRef);

  // Each printed line scrolls the output to the bottom.
  useLayoutEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [lines]);

  const execute = (raw: string) => {
    const name = raw.trim().toLowerCase();
    const printed: Line[] = [];
    const print = (text: string, className?: string) => printed.push({ id: nextLineId.current++, text, className });

    print(`${PROMPT} ${raw}`, "terminal-command");
    if (name === "clear") {
      setShowIntro(false);
      setLines([]);
      return;
    }
    if (!name) {
      // An empty command only echoes the prompt.
    } else if (name === "help") {
      print(`Available commands: ${COMMANDS.join(", ")}`);
    } else if (name === "whoami") {
      print(
        "Pepo - Site Reliability Engineer focused on cloud platforms, observability, IaC, GitOps, and production resilience.",
      );
    } else if (name === "skills") {
      print(`${SKILL_NAMES.join(", ")}.`);
    } else if (name === "projects") {
      print("Opening Projects...");
      openApp("project");
    } else if (name === "uptime") {
      // Seconds since the desktop page loaded.
      print(`desktop uptime: ${Math.floor(performance.now() / 1000)}s`);
    } else if (name === "contact") {
      print("pepo@pepo.dev | github.com/pepodev | linkedin.com/in/pepodev");
    } else {
      print(`command not found: ${raw}`, "terminal-error");
    }
    setLines((current) => [...current, ...printed]);
  };

  // The input is uncontrolled: submitting runs its text and resets the form.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    execute(inputRef.current?.value ?? "");
    event.currentTarget.reset();
  };

  return (
    <div className="app-content terminal-app" data-terminal-app="" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-output" data-terminal-output="" ref={outputRef}>
        {showIntro && (
          <>
            <div>
              <span className="terminal-muted">pepo-shell v1.0</span>
            </div>
            <div>
              Type <span className="terminal-accent">help</span> to list commands.
            </div>
          </>
        )}
        {lines.map((line) => (
          <div key={line.id} className={line.className}>
            {line.text}
          </div>
        ))}
      </div>
      <form className="terminal-input-row" data-terminal-form="" onSubmit={onSubmit}>
        <span>{PROMPT}</span>
        <input
          ref={inputRef}
          data-terminal-input=""
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal command"
        />
      </form>
    </div>
  );
}
