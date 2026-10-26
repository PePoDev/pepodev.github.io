"use client";
// The Welcome - Login app. The quote is a button: each press fades the text
// out, swaps in another random quote after 200 ms and fades it back in.
import { useEffect, useRef, useState } from "react";
import type { AppProps } from "@components/desktop/app-api";
import "./WelcomeApp.css";

const QUOTES = [
  {
    text: "Any sufficiently advanced technology is indistinguishable from magic.",
    author: "Arthur C. Clarke",
  },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "The only way to go fast, is to go well.", author: "Robert C. Martin" },
  { text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde" },
  {
    text: "In theory, theory and practice are the same. In practice, they're not.",
    author: "Yogi Berra",
  },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson",
  },
  {
    text: "Walking on water and developing software from a specification are easy if both are frozen.",
    author: "Edward V. Berard",
  },
  { text: "Hope is not a strategy.", author: "Traditional SRE saying" },
  { text: "Everything fails, all the time.", author: "Werner Vogels" },
  { text: "You build it, you run it.", author: "Werner Vogels" },
  { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  {
    text: "There are only two hard things in Computer Science: cache invalidation and naming things.",
    author: "Phil Karlton",
  },
  {
    text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    author: "Martin Fowler",
  },
  {
    text: "A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.",
    author: "Leslie Lamport",
  },
  {
    text: "The cheapest, fastest, and most reliable components are those that aren't there.",
    author: "Gordon Bell",
  },
  {
    text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    author: "Antoine de Saint-Exupéry",
  },
  { text: "In the face of ambiguity, refuse the temptation to guess.", author: "Tim Peters" },
  { text: "Errors should never pass silently.", author: "Tim Peters" },
  { text: "If it hurts, do it more often.", author: "Martin Fowler" },
];

// The first quote reads in quotation marks until the visitor asks for another.
const FIRST_QUOTE = { text: `"${QUOTES[0].text}"`, author: QUOTES[0].author };

const ASCII_ART = [
  " ██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗",
  " ██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝",
  " ██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗  ",
  " ██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝  ",
  " ╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗",
  "  ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝",
  // The <pre> ends with an indented line; it adds height.
  "    ",
].join("\n");

const FADE_MS = 200;

export default function WelcomeApp(_props: AppProps<"welcome">) {
  const [quote, setQuote] = useState(FIRST_QUOTE);
  const [fading, setFading] = useState(false);
  const currentIndex = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const showAnotherQuote = () => {
    let index: number;
    do {
      index = Math.floor(Math.random() * QUOTES.length);
    } while (index === currentIndex.current && QUOTES.length > 1);
    currentIndex.current = index;
    const next = QUOTES[index];

    setFading(true);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setQuote(next);
      setFading(false);
    }, FADE_MS);
    timers.current.add(timer);
  };

  const fadeStyle = { transition: "opacity 0.2s ease", opacity: fading ? 0 : undefined };

  return (
    <div className="app-content welcome-app">
      <div className="terminal-heading">
        <span className="prompt">~/system $</span> login.sh
      </div>

      <div className="welcome-header">
        <pre className="ascii-art">{ASCII_ART}</pre>
      </div>

      <div className="welcome-messages">
        <div className="terminal-prompt">
          <span className="prompt">~/explore $</span> <span className="cursor-blink">▊</span>
          <p className="welcome-hint">
            Hint: Click on the desktop icons to explore my work, projects, and experience!
          </p>
        </div>

        <div className="section-divider" />

        <button
          type="button"
          className="quote-box"
          data-quote-box=""
          aria-describedby="welcome-quote-hint"
          onClick={showAnotherQuote}
        >
          <span className="quote-icon" aria-hidden="true">
            💭
          </span>
          <span className="quote-text" aria-live="polite">
            <span className="quote-main" data-quote-text="" style={fadeStyle}>
              {quote.text}
            </span>
            <span className="quote-author" data-quote-author="" style={fadeStyle}>
              {`— ${quote.author}`}
            </span>
          </span>
        </button>
        <p id="welcome-quote-hint" className="welcome-quote-hint">
          Click the quote for more wisdom ✨
        </p>
      </div>
    </div>
  );
}
