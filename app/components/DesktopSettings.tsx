"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCloud, FiDownload, FiInfo, FiRefreshCw } from "react-icons/fi";
import {
  DEFAULT_DESKTOP_CLOUD_COPIES,
  DEFAULT_DESKTOP_IMAGE_STORAGE,
  type DesktopImageCategory,
  type DesktopImageStorageSettings,
} from "@/app/lib/desktopImageStorage";
import { openDesktopUpdateModal } from "@/app/components/DesktopUpdateModal";

type CloseBehavior = "tray" | "quit";
type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
};

const imageOptions: Array<{ key: DesktopImageCategory; label: string }> = [
  { key: "profileImage", label: "Profile image" },
  { key: "wallpaper", label: "Wallpaper" },
  { key: "customGameCovers", label: "Custom game covers" },
  { key: "screenshots", label: "Screenshots" },
];

export default function DesktopSettings({ isAdmin = false }: { isAdmin?: boolean }) {
  const [available, setAvailable] = useState(false);
  const [behavior, setBehavior] = useState<CloseBehavior | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [error, setError] = useState("");
  const [imageStorage, setImageStorage] = useState<DesktopImageStorageSettings | null>(null);
  const [cloudCopies, setCloudCopies] = useState<DesktopImageStorageSettings | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const checkForUpdates = useCallback(async (showError = true) => {
    const check = window.playcrewDesktop?.checkForUpdate;
    if (!check) return;
    setCheckingUpdate(true);
    if (showError) setError("");
    try {
      setUpdateInfo(await check());
    } catch {
      if (showError) setError("Could not check for desktop updates.");
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  useEffect(() => {
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    let active = true;
    setAvailable(true);
    void checkForUpdates(false);
    desktop.getCloseBehavior().then((value) => {
      if (active) setBehavior(value);
    }).catch(() => { if (active) setError("Could not load desktop settings. Reopen Settings to try again."); });
    if (isAdmin) {
      desktop.getImageStorageSettings().then((value) => {
        if (active) setImageStorage({ ...DEFAULT_DESKTOP_IMAGE_STORAGE, ...value });
      }).catch(() => { if (active) setError("Could not load desktop image settings."); });
      desktop.getCloudCopySettings().then((value) => {
        if (active) setCloudCopies({ ...DEFAULT_DESKTOP_CLOUD_COPIES, ...value });
      }).catch(() => { if (active) setError("Could not load cloud-copy settings."); });
    }
    return () => { active = false; };
  }, [checkForUpdates, isAdmin]);

  if (!available) return null;
  return (
    <section className="mt-4 border-t border-[var(--theme-border)] pt-4" aria-labelledby="desktop-settings-heading">
      <h2 id="desktop-settings-heading" className="theme-text text-base font-semibold">Desktop App</h2>
      <div className={`mt-3 rounded-xl border p-3 ${updateInfo?.updateAvailable ? "border-cyan-300/40 bg-cyan-400/10" : "theme-surface"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="theme-text text-sm font-semibold">
              {updateInfo?.updateAvailable
                ? `Update ${updateInfo.latestVersion} available`
                : updateInfo
                  ? `PlayCrew ${updateInfo.currentVersion} is up to date`
                  : "Desktop updates"}
            </p>
            <p className="theme-text-muted mt-0.5 text-xs">
              {updateInfo?.updateAvailable
                ? `Installed version: ${updateInfo.currentVersion}`
                : "Check GitHub for the newest PlayCrew Desktop release."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void checkForUpdates(true)}
              disabled={checkingUpdate}
              className="theme-surface theme-hover-surface grid h-9 w-9 place-items-center rounded-lg border disabled:opacity-50"
              aria-label="Check for desktop updates"
              title="Check for updates"
            >
              <FiRefreshCw className={checkingUpdate ? "animate-spin" : ""} />
            </button>
            {updateInfo?.updateAvailable && (
              <button
                type="button"
                onClick={openDesktopUpdateModal}
                className="theme-accent-bg inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold"
              >
                <FiDownload /> Update now
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="theme-text mt-3 text-sm">When I close PlayCrew</p>
      <button
        type="button"
        role="switch"
        aria-checked={behavior === "tray"}
        disabled={saving || behavior === null}
        onClick={async () => {
          const value: CloseBehavior = behavior === "quit" ? "tray" : "quit";
          setSaving(true);
          setError("");
          try {
            const saved = await window.playcrewDesktop!.setCloseBehavior(value);
            setBehavior(saved);
          } catch { setError("Could not save this setting. Please try again."); }
          finally { setSaving(false); }
        }}
        className={`mt-2 flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${behavior === "tray" ? "theme-accent-soft-bg" : "theme-surface opacity-70"}`}
      >
        <span className="theme-text font-medium">
          {behavior === null
            ? "Loading..."
            : behavior === "quit"
              ? "Close PlayCrew"
              : "Minimize to tray"}
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${behavior === "tray" ? "border-[var(--theme-accent)] bg-[var(--theme-accent)]" : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)]"}`}>
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-[var(--theme-accent-contrast)] shadow-sm transition-transform ${behavior === "tray" ? "translate-x-6" : "translate-x-1"}`} />
        </span>
      </button>
      <p className="theme-text-muted mt-2 text-xs leading-relaxed">{behavior === "quit" ? "Exit completely and stop background playback." : "Keep PlayCrew running in the system tray, including music playback."} This setting is saved on this computer.</p>
      {isAdmin && imageStorage && cloudCopies && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <h3 className="theme-text text-sm font-semibold">Save images locally</h3>
            <span className="group relative">
              <button type="button" aria-label="Local storage benefits" className="theme-text-muted grid h-5 w-5 place-items-center rounded-full border border-current text-[11px] hover:theme-text">
                <FiInfo />
              </button>
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-200 shadow-2xl group-hover:block group-focus-within:block">
                Local originals load faster in the desktop app, remain available offline, and avoid Cloudinary bandwidth. Enable the cloud button when you also want a smaller web-accessible copy.
              </span>
            </span>
          </div>
          <p className="theme-text-muted mt-1 text-xs leading-relaxed">The left switch keeps the original on this computer. The cloud button controls whether a website copy is uploaded.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {imageOptions.map(({ key, label }) => (
              <div key={key} className={`theme-panel flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity ${imageStorage[key] ? "opacity-100" : "opacity-50"}`}>
                <button
                  type="button"
                  role="switch"
                  aria-label={`Save ${label} locally`}
                  aria-checked={imageStorage[key]}
                  disabled={saving}
                  onClick={async () => {
                    const next = { ...imageStorage, [key]: !imageStorage[key] };
                    setSaving(true); setError("");
                    try { setImageStorage(await window.playcrewDesktop!.setImageStorageSettings(next)); }
                    catch { setError("Could not save image storage settings."); }
                    finally { setSaving(false); }
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left disabled:opacity-60"
                >
                  <span className="theme-text truncate">{label}</span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${imageStorage[key] ? "bg-emerald-500" : "bg-zinc-600"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${imageStorage[key] ? "translate-x-6" : "translate-x-1"}`} />
                  </span>
                </button>
                {(key === "profileImage" || key === "wallpaper") && (
                  <button
                    type="button"
                    aria-label={`${cloudCopies[key] ? "Disable" : "Enable"} Cloudinary copy for ${label}`}
                    aria-pressed={cloudCopies[key]}
                    title={cloudCopies[key] ? "Cloudinary web copy enabled" : "Local only — no website copy"}
                    disabled={saving || !imageStorage[key]}
                    onClick={async () => {
                      const next = { ...cloudCopies, [key]: !cloudCopies[key] };
                      setSaving(true); setError("");
                      try { setCloudCopies(await window.playcrewDesktop!.setCloudCopySettings(next)); }
                      catch { setError("Could not save cloud-copy settings."); }
                      finally { setSaving(false); }
                    }}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition disabled:cursor-not-allowed ${cloudCopies[key] ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.45)]" : "border-white/10 bg-black/20 text-white/25 shadow-none"}`}
                  >
                    <FiCloud size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={openingFolder}
            onClick={async () => {
              setOpeningFolder(true);
              setError("");
              try {
                const openFolder = window.playcrewDesktop?.openLocalImagesFolder;
                if (!openFolder) {
                  setError("This desktop build does not include folder access yet. Update PlayCrew Desktop to enable it.");
                  return;
                }
                await openFolder();
              } catch {
                setError("Could not open the local image folder. Please try again.");
              } finally {
                setOpeningFolder(false);
              }
            }}
            className="theme-surface theme-hover-surface mt-3 min-h-11 w-full rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {openingFolder ? "Opening folder…" : "Open image save location"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
