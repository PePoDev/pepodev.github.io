// Work the desktop does once it is idle: the "idle" app mounts (runtime.tsx)
// and app prefetching (app-chunks.ts). On a slow device the animated
// background can leave no idle period at all, so `timeout` is how long the
// work may wait for one, not a fallback for rare cases: keep it short.

/**
 * Runs `callback` in the next idle period, or after `timeout` ms without
 * one (a timer where requestIdleCallback is missing, as in Safari). Returns
 * the cancel function, which cancels with the API that scheduled it.
 */
export function whenIdle(callback: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(id);
}
