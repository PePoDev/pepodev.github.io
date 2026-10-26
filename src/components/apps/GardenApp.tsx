"use client";
// The Garden app. The garden pages are full static pages, so the window frames
// /garden/ instead of rendering every note into the desktop. Mouse events over
// the frame never reach the page, so a window drag or resize that starts on
// the title bar or a resize handle lets the pointer pass over the frame until
// the button is released. Inside the frame, the garden page re-dispatches
// mousedown, click and focusin on this <iframe> element (they bubble to the
// window and the desktop) and forwards Escape and Ctrl/Cmd + K to the
// desktop's document.
import { useEffect, useState } from "react";
import { useAppWindowElement, type AppProps } from "@components/desktop/app-api";
import "./GardenApp.css";

export default function GardenApp({ appId }: AppProps<"garden">) {
  const getWindowElement = useAppWindowElement();
  const [passThrough, setPassThrough] = useState(false);

  // getWindowElement is a new function on every render but only depends on
  // appId, so the listeners are added once.
  useEffect(() => {
    const handles = getWindowElement()?.querySelectorAll(".window-titlebar, .window-resize-handle") ?? [];
    const start = () => setPassThrough(true);
    const end = () => setPassThrough(false);
    handles.forEach((handle) => handle.addEventListener("mousedown", start));
    document.addEventListener("mouseup", end);
    return () => {
      handles.forEach((handle) => handle.removeEventListener("mousedown", start));
      document.removeEventListener("mouseup", end);
    };
  }, [appId]);

  return (
    <iframe
      className="garden-frame"
      src="/garden/"
      title="Digital garden"
      loading="lazy"
      data-garden-frame=""
      style={passThrough ? { pointerEvents: "none" } : undefined}
    />
  );
}
