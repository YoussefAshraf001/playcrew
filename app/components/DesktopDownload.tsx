"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaWindows } from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";

export const DESKTOP_VERSION = "0.1.17";
export const DESKTOP_DOWNLOAD_URL =
  "https://github.com/YoussefAshraf001/playcrew/releases/download/desktop-v0.1.17/PlayCrew-Setup-0.1.17-x64.exe";

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
  const [isOpen, setIsOpen] = useState(true);
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
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="desktop-app-download-content"
          onClick={() => setIsOpen((open) => !open)}
          className="theme-text flex w-full items-center justify-between gap-3 text-left text-base font-semibold"
        >
          <span id="desktop-app-heading" className="flex items-center gap-2">
            {icon} Desktop App
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <FiChevronDown aria-hidden="true" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              id="desktop-app-download-content"
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
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
