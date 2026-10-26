"use client";
// #toast-container and its toasts (toast-state.ts).
import { dismissToast, useToasts } from "./toast-state";

export function Toasts() {
  const toasts = useToasts();
  return (
    <div id="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={"toast" + (toast.phase === "show" ? " toast-show" : toast.phase === "hide" ? " toast-hide" : "")}
        >
          <div className="toast-content">
            <span className="toast-icon">{toast.icon}</span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close" type="button" aria-label="Close notification" onClick={() => dismissToast(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
