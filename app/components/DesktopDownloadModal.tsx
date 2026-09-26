"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaWindows } from "react-icons/fa";
import { FiDownload, FiExternalLink, FiX } from "react-icons/fi";

import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_VERSION,
  PLAYNITE_EXTENSION_DOWNLOAD_URL,
  PLAYNITE_EXTENSION_VERSION,
} from "../lib/desktopDownloads";

export const openDesktopDownloadModal = () => {
  window.dispatchEvent(new Event("playcrew:open-desktop-download"));
};

export default function DesktopDownloadModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("playcrew:open-desktop-download", show);
    return () =>
      window.removeEventListener("playcrew:open-desktop-download", show);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2147483050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-download-title"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 290, damping: 27 }}
            onClick={(event) => event.stopPropagation()}
            className="theme-panel-strong relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:p-8"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/25 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close download dialog"
            >
              <FiX />
            </button>

            <div className="flex items-center gap-4 pr-10">
              <div className="theme-accent-soft-bg grid h-16 w-16 shrink-0 place-items-center rounded-2xl border">
                <Image
                  src="/exlogo.png"
                  alt="PlayCrew"
                  width={54}
                  height={54}
                  className="h-12 w-12 object-contain"
                />
              </div>
              <div>
                <p className="theme-accent-text text-[10px] font-black uppercase tracking-[0.22em]">
                  PlayCrew Desktop
                </p>
                <h2
                  id="desktop-download-title"
                  className="theme-text mt-1 text-2xl font-black"
                >
                  Download for Windows
                </h2>
                <p className="theme-text-muted mt-1 text-sm">
                  Windows 64-bit · Version {DESKTOP_VERSION}
                </p>
              </div>
            </div>

            <a
              href={DESKTOP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="theme-accent-bg mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition hover:brightness-110"
            >
              <FaWindows />
              Open latest GitHub release
              <FiExternalLink />
            </a>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start gap-3">
                <div className="theme-accent-soft-bg grid h-11 w-11 shrink-0 place-items-center rounded-xl border">
                  <Image
                    src="/playnite/Playniteapplogo.png"
                    alt=""
                    width={38}
                    height={38}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="theme-text font-bold">Playnite extension</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                      Optional
                    </span>
                  </div>
                  <p className="theme-text-muted mt-1 text-xs leading-relaxed">
                    Automatically open PlayCrew and log each completed Playnite
                    session.
                  </p>
                  <p className="theme-text-muted mt-1 text-[10px]">
                    Version {PLAYNITE_EXTENSION_VERSION} · By Youssef Ashraf
                  </p>
                </div>
              </div>
              <a
                href={PLAYNITE_EXTENSION_DOWNLOAD_URL}
                download
                className="theme-surface theme-hover-surface theme-text mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition"
              >
                <FiDownload /> Download Playnite extension
              </a>
            </div>

            <p className="theme-text-muted mt-4 text-center text-[11px] leading-relaxed">
              Install PlayCrew Desktop first. Then open the optional{" "}
              <code>.pext</code> file to add the integration through Playnite.
            </p>
            <a
              href="https://github.com/YoussefAshraf001/playcrew"
              target="_blank"
              rel="noreferrer"
              className="theme-text-muted mx-auto mt-3 flex w-fit items-center gap-1.5 text-xs transition hover:theme-text"
            >
              View source on GitHub <FiExternalLink />
            </a>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
