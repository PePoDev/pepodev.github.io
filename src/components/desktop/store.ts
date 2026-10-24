// The desktop's state primitive: a small external store read through
// useSyncExternalStore. Each slice of desktop state (windows, overlays, site
// mode, preferences, audio, toasts, icons) is one store with plain action
// functions next to it, so DOM event listeners, timers and components all
// change state the same way, synchronously.
//
// Server rendering and hydration see each store's initial value
// (getServerSnapshot), so the first client render matches the HTML; the
// desktop boots (reads storage and the DOM) after hydration.
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export interface Store<T> {
  readonly initial: T;
  get(): T;
  set(next: T | ((state: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    get: () => state,
    set(next) {
      const value = typeof next === "function" ? (next as (state: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Reads a slice of a store. The selector must return a value that keeps its
 * identity while the slice is unchanged (a property, not a new object).
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.initial),
  );
}

let committing = 0;

/**
 * Runs state changes and commits them to the DOM before returning, so the
 * caller can move focus into what they show or measure it, as the old DOM
 * controllers did. Call it from event handlers and timers, never while React
 * renders or from an effect (wrap those in queueMicrotask): React cannot
 * flush inside its own lifecycle. Nested calls join the outer commit.
 */
export function commit(update: () => void) {
  if (committing > 0) {
    update();
    return;
  }
  committing++;
  try {
    flushSync(update);
  } finally {
    committing--;
  }
}
