"use client";

import { useEffect, useState } from "react";

type CloseBehavior = "tray" | "quit";
declare global {
  interface Window {
    playcrewDesktop?: {
      getCloseBehavior: () => Promise<CloseBehavior>;
      setCloseBehavior: (value: CloseBehavior) => Promise<CloseBehavior>;
    };
  }
}

export default function DesktopSettings() {
  const [available, setAvailable] = useState(false);
  const [behavior, setBehavior] = useState<CloseBehavior | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const desktop = window.playcrewDesktop;
    if (!desktop) return;
    let active = true;
    setAvailable(true);
    desktop.getCloseBehavior().then((value) => {
      if (active) setBehavior(value);
    }).catch(() => { if (active) setError("Could not load desktop settings. Reopen Settings to try again."); });
    return () => { active = false; };
  }, []);

  if (!available) return null;
  return (
    <section className="theme-panel-strong rounded-xl border p-3" aria-labelledby="desktop-settings-heading">
      <h2 id="desktop-settings-heading" className="theme-text text-base font-semibold">Desktop App</h2>
      <label htmlFor="desktop-close-behavior" className="theme-text mt-3 block text-sm">When I close PlayCrew</label>
      <select
        id="desktop-close-behavior"
        className="theme-panel-strong theme-text mt-2 min-h-11 w-full rounded-lg border px-3 py-2 text-sm"
        value={behavior ?? ""}
        disabled={saving || behavior === null}
        onChange={async (event) => {
          const value = event.target.value as CloseBehavior;
          setSaving(true);
          setError("");
          try {
            const saved = await window.playcrewDesktop!.setCloseBehavior(value);
            setBehavior(saved);
          } catch { setError("Could not save this setting. Please try again."); }
          finally { setSaving(false); }
        }}
      >
        {behavior === null && <option value="">Loading…</option>}
        <option value="tray">Minimize to tray</option>
        <option value="quit">Close PlayCrew</option>
      </select>
      <p className="theme-text-muted mt-2 text-xs leading-relaxed">{behavior === "quit" ? "Exit completely and stop background playback." : "Keep PlayCrew running in the system tray, including music playback."} This setting is saved on this computer.</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
