"use client";
// Calculator (port of CalculatorApp.astro). Its state is a reducer, so keys
// that arrive in one burst (typed while the chunk loaded, replayed by
// useAppKeyboard) apply in order. While typing, the display keeps the newest
// digits in view; a result reads from its first digit; a faded edge marks
// digits scrolled out of view. Errors keep the expression so it can be fixed.
// The keyboard belongs to it only while its window is focused
// (useAppKeyboard); a focused key keeps its own Enter and Space, and a
// pointer press does not focus a key, so Enter after clicking still means "=".
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useAppKeyboard, type AppProps } from "@components/desktop/app-api";
import { evaluateExpression } from "./calculator-expression";

interface CalculatorState {
  expression: string;
  history: string;
  justEvaluated: boolean;
  /** The display shows a result, which reads from its first digit. */
  result: boolean;
  /**
   * Bumped whenever the display is redrawn: it then scrolls into place, and
   * its text is written as new text nodes, as the Astro calculator's
   * textContent did, so the live region announces a repeated message (a
   * second "Incomplete expression") again.
   */
  redraws: number;
}

type CalculatorAction =
  | { type: "token"; token: string }
  | { type: "clear" }
  | { type: "backspace" }
  | { type: "escape" }
  | { type: "equals" };

const INITIAL_STATE: CalculatorState = {
  expression: "",
  history: "",
  justEvaluated: false,
  result: false,
  redraws: 0,
};

/** Redraws the display with `changes` applied (the Astro calculator's render()). */
function redraw(
  state: CalculatorState,
  changes: Partial<CalculatorState>,
  history = "",
  result = false,
): CalculatorState {
  return { ...state, ...changes, history, result, redraws: state.redraws + 1 };
}

function appendToken(state: CalculatorState, token: string): CalculatorState {
  let expression = state.justEvaluated && /[\d.]/.test(token) ? "" : state.expression;

  // One decimal point per number.
  if (token === "." && /(?:^|[+\-*/%])\d*\.\d*$/.test(expression)) {
    return { ...state, expression, justEvaluated: false };
  }
  if (/[+\-*/%]/.test(token) && /[+\-*/%]$/.test(expression)) {
    expression = expression.slice(0, -1);
  }
  // A digit replaces a lone leading 0; "05" is a syntax error.
  if (/\d/.test(token) && /(?:^|[+\-*/])0$/.test(expression)) {
    expression = expression.slice(0, -1);
  }
  return redraw(state, { expression: expression + token, justEvaluated: false });
}

function normalizePercentExpression(value: string) {
  return value.replace(/(\d+(?:\.\d+)?(?:e[+-]?\d+)?)%/g, "($1/100)");
}

// Errors keep the expression on screen so it can be fixed.
function calculate(state: CalculatorState): CalculatorState {
  const { expression } = state;
  if (!expression) return state;
  // Large results come back in exponent form (1e+22); allow that "e"
  // between digits so they can be calculated with.
  const withoutExponents = expression.replace(/(\d)e([+-]?\d)/g, "$1$2");
  if (!/^[\d+\-*/%. ()]+$/.test(withoutExponents)) return redraw(state, {}, "Invalid expression");
  if (/[+\-*/]$/.test(expression)) return redraw(state, {}, "Incomplete expression");

  let result: number;
  try {
    result = evaluateExpression(normalizePercentExpression(expression));
  } catch {
    return redraw(state, {}, "Invalid expression");
  }

  if (!Number.isFinite(result)) {
    return redraw(state, {}, /\/[0.]+(?![\d.])/.test(expression) ? "Cannot divide by 0" : "Number too large");
  }
  return redraw(
    state,
    { expression: String(Number.parseFloat(result.toFixed(10))), justEvaluated: true },
    `${expression} =`,
    true,
  );
}

function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case "token":
      return appendToken(state, action.token);
    case "clear":
      return redraw(state, { expression: "", justEvaluated: false });
    case "backspace":
      return redraw(state, { expression: state.expression.slice(0, -1) });
    case "escape":
      return redraw(state, { expression: "" });
    case "equals":
      return calculate(state);
  }
}

interface Key {
  label: string;
  token?: string;
  action?: "clear" | "backspace" | "equals";
  className?: string;
}

const KEYS: Key[] = [
  { label: "AC", action: "clear" },
  { label: "DEL", action: "backspace" },
  { label: "%", token: "%" },
  { label: "/", token: "/", className: "calculator-op" },
  { label: "7", token: "7" },
  { label: "8", token: "8" },
  { label: "9", token: "9" },
  { label: "*", token: "*", className: "calculator-op" },
  { label: "4", token: "4" },
  { label: "5", token: "5" },
  { label: "6", token: "6" },
  { label: "-", token: "-", className: "calculator-op" },
  { label: "1", token: "1" },
  { label: "2", token: "2" },
  { label: "3", token: "3" },
  { label: "+", token: "+", className: "calculator-op" },
  { label: "0", token: "0", className: "calculator-zero" },
  { label: ".", token: "." },
  { label: "=", action: "equals", className: "calculator-equals" },
];

/** "is-cut-start" / "is-cut-end" for the edges where text is scrolled out of view. */
function cutEdges(element: HTMLElement | null): string {
  if (!element) return "";
  const hidden = element.scrollWidth - element.clientWidth;
  const edges = [];
  if (element.scrollLeft > 1) edges.push("is-cut-start");
  if (element.scrollLeft < hidden - 1) edges.push("is-cut-end");
  return edges.join(" ");
}

export default function CalculatorApp(_props: AppProps<"calculator">) {
  const [state, dispatch] = useReducer(calculatorReducer, INITIAL_STATE);
  const valueRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [valueCut, setValueCut] = useState("");
  const [historyCut, setHistoryCut] = useState("");

  const markValueCut = useCallback(() => setValueCut(cutEdges(valueRef.current)), []);
  const markHistoryCut = useCallback(() => setHistoryCut(cutEdges(historyRef.current)), []);

  // While typing, keep the newest digits in view; a result reads from its
  // first digit. History always shows its end: the latest step.
  useLayoutEffect(() => {
    const value = valueRef.current;
    const history = historyRef.current;
    if (!value || !history) return;
    value.scrollLeft = state.result ? 0 : value.scrollWidth;
    history.scrollLeft = history.scrollWidth;
    markValueCut();
    markHistoryCut();
  }, [state.redraws, state.result, markValueCut, markHistoryCut]);

  // The window resizing changes what fits.
  useEffect(() => {
    const value = valueRef.current;
    const history = historyRef.current;
    if (!value || !history) return;
    const observer = new ResizeObserver(() => {
      markValueCut();
      markHistoryCut();
    });
    observer.observe(value);
    observer.observe(history);
    return () => observer.disconnect();
  }, [markValueCut, markHistoryCut]);

  useAppKeyboard((event) => {
    if (/^[\d+\-*/%.]$/.test(event.key)) {
      event.preventDefault();
      dispatch({ type: "token", token: event.key });
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      dispatch({ type: "equals" });
    } else if (event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "backspace" });
    } else if (event.key === "Escape") {
      // Not prevented: the window manager closes the window on it, and the
      // next open starts from 0.
      dispatch({ type: "escape" });
    }
  });

  // A key focused from the keyboard keeps its own Enter and Space
  // (app-keyboard.ts), so a pointer press leaves keys unfocused.
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as Element).closest("button")) return;
    event.preventDefault();
    const active = document.activeElement;
    if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur();
  };

  const press = (key: Key) => {
    if (key.token) dispatch({ type: "token", token: key.token });
    else if (key.action) dispatch({ type: key.action });
  };

  return (
    <div className="app-content calculator-app" data-calculator="" onMouseDown={onMouseDown}>
      <div className="calculator-display" aria-live="polite">
        <div
          ref={historyRef}
          className={historyCut ? `calculator-history ${historyCut}` : "calculator-history"}
          onScroll={markHistoryCut}
        >
          <Fragment key={state.redraws}>{state.history}</Fragment>
        </div>
        <div
          ref={valueRef}
          className={valueCut ? `calculator-value ${valueCut}` : "calculator-value"}
          tabIndex={-1}
          onScroll={markValueCut}
        >
          <Fragment key={state.redraws}>{state.expression || "0"}</Fragment>
        </div>
      </div>

      <div className="calculator-grid">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            className={key.className}
            data-token={key.token}
            data-action={key.action}
            onClick={() => press(key)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
