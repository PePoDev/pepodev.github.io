// The desktop's app and shortcut icons: desktop icons, window title bars,
// taskbar buttons, the Start menu and link shortcuts all draw them. Decorative:
// every icon is aria-hidden, and the control around it carries the name.
import { memo } from "react";
import webringIcon from "@/assets/icons/webring.svg";

// Apps without a drawn icon get a labelled tile in their colour.
const utilityIcons: Record<string, { label: string; color: string }> = {
  terminal: { label: ">_", color: "#30d158" },
  certs: { label: "CK", color: "#30d158" },
  gallery: { label: "IMG", color: "#bf5af2" },
  snake: { label: "SN", color: "#64d2ff" },
  whitenoise: { label: "RN", color: "#64d2ff" },
  trash: { label: "TR", color: "#8b949e" },
};

/** Memoized: title bars and taskbar buttons re-render on every drag step, their icons need not. */
export const AppIcon = memo(function AppIcon({ name }: { name: string }) {
  const utilityIcon = utilityIcons[name];
  if (utilityIcon) {
    return (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect
          x="4"
          y="4"
          width="32"
          height="32"
          rx="6"
          fill="#1e293b"
          stroke={utilityIcon.color}
          strokeWidth="1.5"
        />
        <path
          d="M10 27H30M10 13H30M13 13V27M27 13V27"
          stroke={utilityIcon.color}
          strokeWidth="1"
          opacity="0.28"
        />
        <text
          x="20"
          y="23"
          textAnchor="middle"
          fill={utilityIcon.color}
          fontSize="8"
          fontWeight="700"
          fontFamily="monospace"
        >
          {utilityIcon.label}
        </text>
      </svg>
    );
  }

  switch (name) {
    case "welcome":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="4"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <circle
            cx="20"
            cy="15"
            r="5"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <path
            d="M11 30C11 25 15 22 20 22C25 22 29 25 29 30"
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="15" r="2" fill="#22c55e" opacity="0.5" />
          <path
            d="M27 10L29 8M29 8L31 10M29 8L31 6M29 8L27 6"
            stroke="#fbbf24"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect
            x="8"
            y="26"
            width="6"
            height="2"
            rx="1"
            fill="#22c55e"
            opacity="0.3"
          />
        </svg>
      );
    case "blog":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="2"
            width="32"
            height="36"
            rx="3"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <line
            x1="10"
            y1="10"
            x2="30"
            y2="10"
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="15"
            x2="26"
            y2="15"
            stroke="#4ade80"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />
          <line
            x1="10"
            y1="19"
            x2="28"
            y2="19"
            stroke="#4ade80"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.4"
          />
          <line
            x1="10"
            y1="23"
            x2="22"
            y2="23"
            stroke="#4ade80"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.3"
          />
          <rect
            x="10"
            y="28"
            width="8"
            height="6"
            rx="1"
            fill="#22c55e"
            opacity="0.3"
          />
        </svg>
      );
    case "resume":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="8"
            y="2"
            width="24"
            height="36"
            rx="2"
            fill="#1e293b"
            stroke="#06b6d4"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="12" r="4" stroke="#06b6d4" strokeWidth="1.2" />
          <line
            x1="14"
            y1="22"
            x2="26"
            y2="22"
            stroke="#06b6d4"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />
          <line
            x1="14"
            y1="26"
            x2="24"
            y2="26"
            stroke="#06b6d4"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.4"
          />
          <line
            x1="14"
            y1="30"
            x2="22"
            y2="30"
            stroke="#06b6d4"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
      );
    case "project":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
            fill="#1e293b"
            stroke="#a855f7"
            strokeWidth="1.5"
          />
          <path d="M20 4V36" stroke="#a855f7" strokeWidth="0.8" opacity="0.4" />
          <path d="M6 12L34 28" stroke="#a855f7" strokeWidth="0.8" opacity="0.4" />
          <path d="M34 12L6 28" stroke="#a855f7" strokeWidth="0.8" opacity="0.4" />
          <circle cx="20" cy="20" r="4" fill="#a855f7" opacity="0.3" />
        </svg>
      );
    case "work":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="6"
            y="14"
            width="28"
            height="22"
            rx="2"
            fill="#1e293b"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
          <path
            d="M14 14V10C14 6 16 4 20 4C24 4 26 6 26 10V14"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="12"
            y="20"
            width="16"
            height="3"
            rx="1"
            fill="#f59e0b"
            opacity="0.4"
          />
          <rect
            x="12"
            y="26"
            width="10"
            height="3"
            rx="1"
            fill="#f59e0b"
            opacity="0.3"
          />
        </svg>
      );
    case "me":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="14"
            r="7"
            fill="#1e293b"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
          <path
            d="M8 34C8 26 13 22 20 22C27 22 32 26 32 34"
            fill="#1e293b"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="14" r="3" fill="#3b82f6" opacity="0.3" />
        </svg>
      );
    case "connect":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <circle cx="14" cy="16" r="2.5" fill="#22c55e" opacity="0.7" />
          <circle cx="26" cy="16" r="2.5" fill="#06b6d4" opacity="0.7" />
          <circle cx="20" cy="26" r="2.5" fill="#a855f7" opacity="0.7" />
          <path
            d="M14 16L20 26L26 16"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "sregame":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="4"
            fill="#1e293b"
            stroke="#ef4444"
            strokeWidth="1.5"
          />
          <path
            d="M12 14h16M12 20h10M12 26h13"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="28" cy="26" r="4" fill="#ef4444" opacity="0.3" />
          <path
            d="M28 24v4M26 26h4"
            stroke="#ef4444"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="5"
            y="5"
            width="30"
            height="30"
            rx="6"
            fill="#1e293b"
            stroke="#64d2ff"
            strokeWidth="1.5"
          />
          <path
            d="M24 12V25.5C24 28 22.1 30 19.8 30C17.8 30 16.2 28.8 16.2 27.2C16.2 25.5 17.8 24.3 19.8 24.3C21 24.3 22.1 24.7 22.8 25.4"
            stroke="#64d2ff"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M24 12L30 14V18L24 16"
            stroke="#30d158"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 18C11.5 16.5 13 16.5 14.5 18M9 24C11.5 21.6 14 21.6 16.5 24"
            stroke="#64d2ff"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      );
    case "calculator":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="8"
            y="4"
            width="24"
            height="32"
            rx="4"
            fill="#1e293b"
            stroke="#ff9f0a"
            strokeWidth="1.5"
          />
          <rect
            x="12"
            y="9"
            width="16"
            height="6"
            rx="1.5"
            fill="#ff9f0a"
            opacity="0.25"
          />
          <path
            d="M14 21H14.1M20 21H20.1M26 21H26.1M14 27H14.1M20 27H20.1M26 27H26.1"
            stroke="#ff9f0a"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="7"
            fill="#1e293b"
            stroke="#bf5af2"
            strokeWidth="1.5"
          />
          <path
            d="M20 13V10M20 30V27M27 20H30M10 20H13M25 15L27 13M13 27L15 25M25 25L27 27M13 13L15 15"
            stroke="#bf5af2"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="20" r="5" stroke="#64d2ff" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="2" fill="#64d2ff" opacity="0.45" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#8b5cf6"
            strokeWidth="1.5"
          />
          <path
            d="M20 10C14.5 10 10 14.5 10 20C10 24.4 12.8 28.1 16.7 29.5C17.2 29.6 17.4 29.3 17.4 29V27.5C14.7 28.1 14.1 26.3 14.1 26.3C13.7 25.2 13 24.9 13 24.9C12 24.2 13.1 24.2 13.1 24.2C14.2 24.3 14.7 25.3 14.7 25.3C15.7 27 17.3 26.5 17.5 26.4C17.6 25.7 17.9 25.2 18.2 24.9C16.2 24.6 14.1 23.8 14.1 20.3C14.1 19.2 14.5 18.3 14.8 17.6C14.7 17.3 14.3 16.3 14.9 15C14.9 15 15.8 14.7 17.4 15.8C18.2 15.6 19.1 15.5 20 15.5C20.9 15.5 21.8 15.6 22.6 15.8C24.2 14.7 25.1 15 25.1 15C25.7 16.3 25.3 17.3 25.2 17.6C25.5 18.3 25.9 19.2 25.9 20.3C25.9 23.8 23.8 24.6 21.8 24.9C22.2 25.2 22.5 25.8 22.5 26.7V29C22.5 29.3 22.7 29.6 23.2 29.5C27.1 28.1 30 24.4 30 20C30 14.5 25.5 10 20 10Z"
            fill="#8b5cf6"
            opacity="0.8"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#0ea5e9"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="10"
            width="20"
            height="20"
            rx="2"
            fill="#0ea5e9"
            opacity="0.2"
          />
          <path
            d="M13 17V27M13 14.5V14M17 17V27M17 17C17 17 17 15 20 15C23 15 23 17 23 17V27M23 17V27"
            stroke="#0ea5e9"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="14"
            width="20"
            height="12"
            rx="2"
            fill="#1e293b"
            stroke="#22c55e"
            strokeWidth="1.5"
          />
          <path
            d="M10 14L20 21L30 14"
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20" r="2" fill="#22c55e" opacity="0.4" />
        </svg>
      );
    case "webring":
      return (
        <img src={webringIcon.src} alt="" aria-hidden="true" loading="lazy" />
      );
    case "garden":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#30d158"
            strokeWidth="1.5"
          />
          <path
            d="M20 29V17"
            stroke="#30d158"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M20 18C16 12 11 12 9 15C12 20 17 21 20 18Z"
            fill="#30d158"
            opacity="0.28"
            stroke="#30d158"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M20 21C24 14 29 14 31 17C28 23 23 24 20 21Z"
            fill="#64d2ff"
            opacity="0.24"
            stroke="#64d2ff"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M13 29H27"
            stroke="#30d158"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "issue":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#ff453a"
            strokeWidth="1.5"
          />
          <path
            d="M20 10L30 28H10L20 10Z"
            fill="#ff453a"
            opacity="0.18"
            stroke="#ff453a"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M20 16V22"
            stroke="#ff453a"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="20" cy="26" r="1.4" fill="#ff453a" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="#1e293b"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="10"
            width="20"
            height="20"
            rx="2"
            fill="#3b82f6"
            opacity="0.2"
          />
          <path
            d="M22 12H24V16H22C21 16 20.5 16.5 20.5 17.5V19H24V22H20.5V30H17V22H15V19H17V17.5C17 14.5 18.5 12 22 12Z"
            fill="#3b82f6"
            opacity="0.9"
          />
        </svg>
      );
    default:
      return null;
  }
});
