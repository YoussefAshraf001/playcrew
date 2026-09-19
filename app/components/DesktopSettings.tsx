"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_DESKTOP_IMAGE_STORAGE,
  type DesktopImageCategory,
  type DesktopImageStorageSettings,
} from "@/app/lib/desktopImageStorage";

type CloseBehavior = "tray" | "quit";

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
  useEffect(() => {
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    let active = true;
    setAvailable(true);
    desktop.getCloseBehavior().then((value) => {
      if (active) setBehavior(value);
    }).catch(() => { if (active) setError("Could not load desktop settings. Reopen Settings to try again."); });
    if (isAdmin) {
      desktop.getImageStorageSettings().then((value) => {
        if (active) setImageStorage({ ...DEFAULT_DESKTOP_IMAGE_STORAGE, ...value });
      }).catch(() => { if (active) setError("Could not load desktop image settings."); });
    }
    return () => { active = false; };
  }, [isAdmin]);

  if (!available) return null;
  return (
    <section className="mt-4 border-t border-[var(--theme-border)] pt-4" aria-labelledby="desktop-settings-heading">
      <h2 id="desktop-settings-heading" className="theme-text text-base font-semibold">Desktop App</h2>
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
      {isAdmin && imageStorage && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="theme-text text-sm font-semibold">Save images locally</h3>
          <p className="theme-text-muted mt-1 text-xs leading-relaxed">Enabled image types stay on this computer and are not uploaded to Cloudinary. They will not be available on the website or another device.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {imageOptions.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={imageStorage[key]}
                disabled={saving}
                onClick={async () => {
                  const next = { ...imageStorage, [key]: !imageStorage[key] };
                  setSaving(true);
                  setError("");
                  try { setImageStorage(await window.playcrewDesktop!.setImageStorageSettings(next)); }
                  catch { setError("Could not save image storage settings."); }
                  finally { setSaving(false); }
                }}
                className="theme-panel flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60"
              >
                <span className="theme-text">{label}</span>
                <span className={`relative h-6 w-11 rounded-full transition ${imageStorage[key] ? "bg-emerald-500" : "bg-zinc-600"}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${imageStorage[key] ? "translate-x-6" : "translate-x-1"}`} />
                </span>
              </button>
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
