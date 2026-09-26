"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowRight, FiCheck, FiDownload, FiRefreshCw, FiX } from "react-icons/fi";

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
};

type UpdateProgress = {
  status: "downloading" | "installing" | "error";
  percent?: number | null;
  transferred?: number;
  total?: number;
  message?: string;
};

const formatBytes = (value = 0) => {
  if (!value) return "0 MB";
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const openDesktopUpdateModal = () => {
  window.dispatchEvent(new Event("playcrew:open-update-modal"));
};

let desktopVersionRequest: Promise<string> | null = null;

export function DesktopUpdateMenuButton({
  onClick,
  compact = false,
}: {
  onClick?: () => void;
  compact?: boolean;
}) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    desktopVersionRequest ??= desktop.getVersion();
    void desktopVersionRequest.then(setVersion).catch(() => setVersion(null));
  }, []);
  if (!version) return null;

  return (
    <button
      type="button"
      aria-label={compact ? `PlayCrew Desktop v${version}` : undefined}
      title={compact ? `Desktop v${version}` : undefined}
      onClick={() => {
        onClick?.();
        openDesktopUpdateModal();
      }}
      className={
        compact
          ? "theme-surface theme-hover-surface theme-text inline-flex h-9 w-full items-center justify-center rounded-lg border p-0 transition"
          : "theme-hover-accent theme-text mt-0.5 flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150"
      }
    >
      <span className={compact ? "inline-flex h-7 w-7 items-center justify-center" : "theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"}>
        <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
      </span>
      {!compact && (
        <span className="min-w-0 font-semibold tracking-wide">
          Desktop
          <span className="theme-text-muted block text-[10px] font-normal">
            v{version}
          </span>
        </span>
      )}
    </button>
  );
}

export default function DesktopUpdateModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState("");
  const busy = progress?.status === "downloading" || progress?.status === "installing";

  const check = useCallback(async (showModal: boolean) => {
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    if (showModal) setOpen(true);
    setChecking(true);
    setError("");
    try {
      const currentVersion = await desktop.getVersion();
      setInstalledVersion(currentVersion);
      if (!desktop.checkForUpdate) {
        throw new Error("This desktop build does not support automatic update checks.");
      }
      const result = await desktop.checkForUpdate();
      setInfo(result);
      if (showModal || result.updateAvailable) setOpen(true);
    } catch (error) {
      if (showModal) {
        setError(
          error instanceof Error && error.message.includes("does not support")
            ? error.message
            : "Could not check GitHub for desktop updates. Check your connection and try again.",
        );
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    const openModal = () => void check(true);
    window.addEventListener("playcrew:open-update-modal", openModal);
    const unsubscribe = desktop.onUpdateProgress?.((next) => {
      setProgress(next);
      if (next.status === "error") setError(next.message ?? "The update failed.");
    }) ?? (() => {});
    void check(false);
    return () => {
      window.removeEventListener("playcrew:open-update-modal", openModal);
      unsubscribe();
    };
  }, [check]);

  const install = async () => {
    const installUpdate = window.playcrewDesktop?.installUpdate;
    if (!info?.updateAvailable || !installUpdate) {
      setError("This desktop build cannot install updates automatically. Download the latest installer manually.");
      return;
    }
    setError("");
    setProgress({ status: "downloading", percent: 0, transferred: 0, total: 0 });
    try {
      await installUpdate({
        downloadUrl: info.downloadUrl,
        version: info.latestVersion,
      });
    } catch {
      setError("The update could not be downloaded or installed.");
      setProgress((current) => ({ ...current, status: "error" }));
    }
  };

  if (!mounted || !window.playcrewDesktop) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!busy) setOpen(false); }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-update-title"
            initial={{ opacity: 0, x: 80, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
            className="theme-panel-strong relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 shadow-[0_30px_100px_rgba(0,0,0,0.7)]"
          >
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(var(--theme-accent-rgb),0.24),transparent_70%)]" />
            {!busy && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/25 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close desktop update"
              >
                <FiX />
              </button>
            )}

            <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pb-8">
              <div className="flex flex-col items-center text-center">
                <div className="grid h-20 w-20 place-items-center rounded-3xl border border-white/15 bg-black/30 shadow-[0_0_35px_rgba(var(--theme-accent-rgb),0.22)]">
                  <Image src="/logo.png" alt="PlayCrew" width={62} height={62} className="h-16 w-16 object-contain" />
                </div>
                <p className="theme-accent-text mt-5 text-[10px] font-black uppercase tracking-[0.25em]">PlayCrew Desktop</p>
                <h2 id="desktop-update-title" className="theme-text mt-2 text-2xl font-black">
                  {checking
                    ? "Checking for updates"
                    : info?.updateAvailable
                      ? "A new version is ready"
                      : error
                        ? "Update check unavailable"
                        : "You’re up to date"}
                </h2>
                <p className="theme-text-muted mt-2 max-w-sm text-sm leading-relaxed">
                  {busy
                    ? progress?.status === "installing"
                      ? "Download complete. PlayCrew will close, install the update, and reopen automatically."
                      : "Keep PlayCrew open while the new version downloads."
                    : info?.updateAvailable
                      ? "Update without leaving the app. Your settings and local data will be preserved."
                      : error
                        ? "Your installed version is shown below, but the latest release could not be verified."
                        : "You’re running the newest available PlayCrew Desktop build."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Installed</p>
                  <p className="mt-1 font-black text-white">
                    {installedVersion ?? info?.currentVersion
                      ? `v${installedVersion ?? info?.currentVersion}`
                      : "Unknown"}
                  </p>
                </div>
                <FiArrowRight className="text-cyan-300" />
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Latest</p>
                  <p className="mt-1 font-black text-cyan-200">
                    {checking ? "Checking…" : info?.latestVersion ? `v${info.latestVersion}` : "Unavailable"}
                  </p>
                </div>
              </div>

              {busy && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      {progress?.status === "installing" ? "Installing update…" : "Downloading update…"}
                    </span>
                    <span className="tabular-nums text-zinc-400">{progress?.percent ?? 0}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-linear-to-r from-cyan-300 to-sky-400"
                      animate={{ width: `${progress?.percent ?? 0}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  {progress?.status === "downloading" && (
                    <p className="mt-2 text-right text-[10px] text-zinc-500">
                      {formatBytes(progress.transferred)}{progress.total ? ` of ${formatBytes(progress.total)}` : ""}
                    </p>
                  )}
                </div>
              )}

              {error && <p role="alert" className="mt-4 text-center text-sm text-red-300">{error}</p>}

              <div className="mt-6 flex justify-center">
                {info?.updateAvailable ? (
                  <button
                    type="button"
                    onClick={install}
                    disabled={checking || busy}
                    className="theme-accent-bg inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {busy ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
                    {progress?.status === "installing" ? "Restarting PlayCrew…" : busy ? "Updating…" : `Update to v${info.latestVersion}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void check(true)}
                    disabled={checking}
                    className="theme-surface theme-hover-surface inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-bold disabled:opacity-55"
                  >
                    {checking ? <FiRefreshCw className="animate-spin" /> : <FiCheck />}
                    {checking ? "Checking…" : "Check again"}
                  </button>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
