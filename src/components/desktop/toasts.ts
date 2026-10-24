// Toast notifications in #toast-container (aria-live="polite"). A toast
// fades in (.toast-show), closes itself after `duration` ms (none when 0)
// or from its close button, and fades out (.toast-hide) before it is
// removed. Apps call showToast(), or dispatch desktop:show-toast
// ({ message, duration }) on document; event messages are plain text.
import type { ReactNode } from "react";
import { createStore, useStore } from "./store";

export interface Toast {
  id: number;
  message: ReactNode;
  icon: string;
  phase: "enter" | "show" | "hide";
}

export interface ToastOptions {
  /** ms before it closes itself; 0 keeps it until closed. Default 5000. */
  duration?: number;
  /** Emoji shown before the message. Default 💡. */
  icon?: string;
}

export const toastStore = createStore<readonly Toast[]>([]);

export function useToasts(): readonly Toast[] {
  return useStore(toastStore, (toasts) => toasts);
}

let nextId = 1;
const timers = new Map<number, number>();

function setPhase(id: number, phase: Toast["phase"]) {
  toastStore.set((toasts) => toasts.map((toast) => (toast.id === id ? { ...toast, phase } : toast)));
}

/** Shows a toast and returns its id. */
export function showToast(message: ReactNode, { duration = 5000, icon = "💡" }: ToastOptions = {}): number {
  const id = nextId++;
  toastStore.set((toasts) => [...toasts, { id, message, icon, phase: "enter" }]);
  // One frame unstyled first, so the fade-in transition runs.
  window.setTimeout(() => setPhase(id, "show"), 10);
  if (duration && duration > 0) {
    timers.set(id, window.setTimeout(() => dismissToast(id), duration));
  }
  return id;
}

export function dismissToast(id: number) {
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  if (!toastStore.get().some((toast) => toast.id === id && toast.phase !== "hide")) return;
  setPhase(id, "hide");
  window.setTimeout(() => toastStore.set((toasts) => toasts.filter((toast) => toast.id !== id)), 300);
}

function onShowToast(event: Event) {
  const { message, duration } = (event as CustomEvent<{ message?: unknown; duration?: number }>).detail || {};
  if (message === undefined || message === null) return;
  showToast(String(message), { duration });
}

export function startToasts(): () => void {
  document.addEventListener("desktop:show-toast", onShowToast);
  return () => document.removeEventListener("desktop:show-toast", onShowToast);
}
