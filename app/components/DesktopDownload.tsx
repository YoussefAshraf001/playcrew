"use client";

import { useSyncExternalStore } from "react";
import { FaWindows } from "react-icons/fa";

export const DESKTOP_VERSION = "0.1.2";
export const DESKTOP_DOWNLOAD_URL =
  "https://github.com/YoussefAshraf001/playcrew/releases/download/desktop-v0.1.2/PlayCrew-Setup-0.1.2-x64.exe";

const subscribe = () => () => {};
const isDesktop = () => /\bElectron\//i.test(navigator.userAgent);
const serverSnapshot = () => true;

export default function DesktopDownload({
  variant = "menu",
  onClick,
}: {
  variant?: "menu" | "dashboard" | "settings" | "widget";
  onClick?: () => void;
}) {
  const desktop = useSyncExternalStore(subscribe, isDesktop, serverSnapshot);
  if (desktop) return null;

  const icon = <FaWindows className="shrink-0" aria-hidden="true" />;
  const hrefProps = { href: DESKTOP_DOWNLOAD_URL, onClick };
  if (variant === "widget") {
    return (
      <a
        {...hrefProps}
        aria-label="Download for Windows"
        title="Download for Windows"
        className="theme-surface theme-hover-surface theme-text hidden lg:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
      >
        {icon}
      </a>
    );
  }
  if (variant === "dashboard") {
    return (
      <li className="hidden lg:list-item">
        <a
          {...hrefProps}
          className="group inline-flex max-w-full items-center gap-3 rounded-lg py-1 text-left text-lg tracking-wide text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--theme-accent)] sm:text-xl md:text-2xl"
        >
          {icon}
          <span className="min-w-0">Download for Windows</span>
        </a>
      </li>
    );
  }
  if (variant === "settings") {
    return (
      <section
        className="theme-panel-strong hidden lg:block min-w-0 rounded-xl border p-3"
        aria-labelledby="desktop-app-heading"
      >
        <h2
          id="desktop-app-heading"
          className="theme-text flex items-center gap-2 text-base font-semibold"
        >
          {icon} Desktop App
        </h2>
        <p className="theme-text-muted mt-2 text-xs leading-relaxed">
          Keep PlayCrew on your desktop, with music in the background and quick
          access from the system tray.
        </p>
        <a
          {...hrefProps}
          className="theme-accent-bg mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
        >
          {icon}
          <span>Download for Windows</span>
        </a>
        <p className="theme-text-muted mt-2 text-[11px] leading-relaxed">
          Version {DESKTOP_VERSION} · Windows 64-bit · 112 MB
        </p>
      </section>
    );
  }
  return (
    <a
      {...hrefProps}
      className="theme-hover-accent theme-text mt-0.5 hidden lg:flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-sm transition-colors"
    >
      <span className="theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
        {icon}
      </span>
      <span className="min-w-0 font-semibold leading-snug">
        Get desktop app
        <span className="theme-text-muted block text-[10px] font-normal">
          For Windows
        </span>
      </span>
    </a>
  );
}
