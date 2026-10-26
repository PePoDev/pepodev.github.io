"use client";
// Website mode's "Copy" button next to the e-mail address, and the status
// line that announces the result. The server renders the button, so it is
// there from first paint (the e-mail row never grows when scripts run);
// hydration hides it where the Clipboard API is missing (an insecure context,
// an old browser). Until it hydrates, the parse-time input script
// (DesktopScripts.tsx) copies on a press, and the button shows that result
// once it has hydrated.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

declare global {
  interface Window {
    /** Set once the button has hydrated and handles its own presses. */
    __pepodevCopyEmailReady?: boolean;
    /** Whether a press made before that copied (DesktopScripts.tsx). */
    __pepodevEarlyCopyEmail?: Promise<boolean>;
  }
}

const subscribeNever = () => () => {};
const hasClipboard = () => Boolean(navigator.clipboard);
const serverHasClipboard = () => true;

export function CopyEmailButton({ email }: { email: string }) {
  const supported = useSyncExternalStore(subscribeNever, hasClipboard, serverHasClipboard);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const resetTimer = useRef(0);

  function showResult(ok: boolean) {
    if (!ok) {
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

  useEffect(() => {
    window.__pepodevCopyEmailReady = true;
    window.__pepodevEarlyCopyEmail?.then(showResult);
    window.__pepodevEarlyCopyEmail = undefined;
    return () => window.clearTimeout(resetTimer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      showResult(false);
      return;
    }
    showResult(true);
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
