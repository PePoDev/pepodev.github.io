"use client";
// Gallery (port of GalleryApp.astro): a locked gallery. The password is
// intentionally the literal "password" (README). A wrong one is explained
// and marks the field invalid; unlocking moves focus to the pictures. Every
// launch puts the keyboard where it is needed (useFocusOnLaunch): the
// password field while locked, the pictures once unlocked; touch screens
// wait for a tap unless the keyboard opened the window, since the field
// raises the on-screen keyboard over it.
import { Fragment, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useFocusOnLaunch, type AppProps } from "@components/desktop/app-api";

const PHOTOS = [
  {
    title: "Production Dawn",
    meta: "observability wall",
    gradient: "linear-gradient(135deg, #0f766e, #22d3ee)",
  },
  {
    title: "Cluster Room",
    meta: "platform notes",
    gradient: "linear-gradient(135deg, #312e81, #a855f7)",
  },
  {
    title: "Release Night",
    meta: "deploy window",
    gradient: "linear-gradient(135deg, #7c2d12, #f59e0b)",
  },
  {
    title: "Quiet Pager",
    meta: "green dashboard",
    gradient: "linear-gradient(135deg, #14532d, #30d158)",
  },
];

const PASSWORD = "password";

export default function GalleryApp(_props: AppProps<"gallery">) {
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  // Every wrong attempt writes the message as a new text node, as the Astro
  // script's textContent did, so the live region announces it again even
  // when it reads the same as last time.
  const [attempts, setAttempts] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const picturesRef = useRef<HTMLElement>(null);
  const focusTarget = useRef<HTMLElement | null>(null);

  // Layout effects run before useFocusOnLaunch's effect, so a launch always
  // focuses the current target.
  useLayoutEffect(() => {
    focusTarget.current = unlocked ? picturesRef.current : passwordRef.current;
  }, [unlocked]);
  useFocusOnLaunch(focusTarget);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = passwordRef.current;
    if (!input) return;

    if (input.value === PASSWORD) {
      // Show the pictures before moving focus to them.
      flushSync(() => {
        setUnlocked(true);
        setError("");
      });
      picturesRef.current?.focus({ preventScroll: true });
      return;
    }

    setError("Incorrect password, try again.");
    setAttempts((count) => count + 1);
    input.select();
  };

  return (
    <div className="app-content gallery-app" data-gallery-app="">
      <section className="gallery-lock" data-gallery-lock="" hidden={unlocked}>
        <div className="gallery-lock-image" aria-hidden="true">
          <div className="gallery-lock-shackle" />
          <div className="gallery-lock-body">
            <span />
          </div>
        </div>
        <form className="gallery-lock-form" data-gallery-form="" onSubmit={onSubmit}>
          <label htmlFor="gallery-password">Please enter the password</label>
          <input
            ref={passwordRef}
            id="gallery-password"
            data-gallery-password=""
            type="password"
            autoComplete="current-password"
            aria-describedby="gallery-error"
            aria-invalid={error ? "true" : undefined}
          />
          <button type="submit">Unlock</button>
          <p id="gallery-error" data-gallery-error="" role="status" aria-live="polite">
            <Fragment key={attempts}>{error}</Fragment>
          </p>
        </form>
      </section>

      <section
        ref={picturesRef}
        className="gallery-unlocked"
        data-gallery-unlocked=""
        aria-labelledby="gallery-title"
        tabIndex={-1}
        hidden={!unlocked}
      >
        <div className="gallery-header">
          <span id="gallery-title" className="ops-pill">
            Private gallery
          </span>
          <strong>{`${PHOTOS.length} pictures`}</strong>
        </div>
        <div className="gallery-grid">
          {PHOTOS.map((photo) => (
            <article key={photo.title} className="gallery-card">
              <div className="gallery-picture" style={{ background: photo.gradient }}>
                <span>{photo.title}</span>
              </div>
              <h3>{photo.title}</h3>
              <p>{photo.meta}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
