"use client";
// Website mode's "Copy" button next to the e-mail address, and the status
// line that announces the result. The server renders the button, so it is
// there from first paint (as on the Astro site, where the e-mail row never
// grew when scripts ran); hydration hides it where the Clipboard API is
// missing (an insecure context, an old browser).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
const hasClipboard = () => Boolean(navigator.clipboard);
const serverHasClipboard = () => true;

export function CopyEmailButton({ email }: { email: string }) {
  const supported = useSyncExternalStore(subscribeNever, hasClipboard, serverHasClipboard);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const resetTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      setStatus("Copy failed");
      return;
    }
    setCopied(true);
    setStatus("Email address copied");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setCopied(false);
      setStatus("");
    }, 2000);
  }

  return (
    <>
      <button className="ws-copy" type="button" data-copy-email={email} hidden={!supported} onClick={copy}>
        {copied ? "Copied" : "Copy"}
        <span className="ws-sr"> email address</span>
      </button>{" "}
      <span className="ws-sr" role="status" data-copy-status="">
        {status}
      </span>
    </>
  );
}
