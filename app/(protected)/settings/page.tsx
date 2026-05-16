"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiCheck } from "react-icons/fi";
import { Helmet } from "react-helmet-async";

import { useUser } from "@/app/context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";

import {
  DEFAULT_FONT_PRESET,
  DEFAULT_THEME_PRESET,
  FONT_PRESETS,
  THEME_PRESETS,
  FontPreset,
  ThemePreset,
} from "@/app/lib/themes";

import {
  clampGamesBgBlur,
  clampGamesBgOverlay,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  PAGE_SETTINGS_STORAGE_KEY,
} from "@/app/lib/gamesPageSettings";

/* ---------------- STORAGE ---------------- */

const THEME_STORAGE_KEY = "playcrew-theme-preset";
const FONT_STORAGE_KEY = "playcrew-font-preset";

const getStoredPageSettings = () => {
  if (typeof window === "undefined") {
    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
    };
  }

  const stored = window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY);

  if (!stored) {
    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
    };
  }

  try {
    const parsed = JSON.parse(stored) as {
      bgBlur?: number;
      bgOverlay?: number;
    };

    return {
      bgBlur: clampGamesBgBlur(parsed.bgBlur ?? DEFAULT_BG_BLUR),
      bgOverlay: clampGamesBgOverlay(parsed.bgOverlay ?? DEFAULT_BG_OVERLAY),
    };
  } catch (error) {
    console.warn("Failed to parse page settings:", error);

    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
    };
  }
};

/* ---------------- COMPONENT ---------------- */

export default function SiteSettingsPage() {
  const { user, profile, setProfile, loading } = useUser();

  const [gamesBgBlur, setGamesBgBlur] = useState(() => getStoredPageSettings().bgBlur);

  const [gamesBgOverlay, setGamesBgOverlay] = useState(
    () => getStoredPageSettings().bgOverlay,
  );

  const [activeThemePreset, setActiveThemePreset] =
    useState<ThemePreset>(DEFAULT_THEME_PRESET);

  const [activeFontPreset, setActiveFontPreset] =
    useState<FontPreset>(DEFAULT_FONT_PRESET);

  const [themeModeOverride, setThemeModeOverride] = useState<
    "dark" | "light" | null
  >(null);

  useEffect(() => {
    document.title = "Theme Forge • PlayCrew";
  }, []);

  const storedTheme =
    typeof window !== "undefined"
      ? (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreset | null)
      : null;

  const storedFont =
    typeof window !== "undefined"
      ? (localStorage.getItem(FONT_STORAGE_KEY) as FontPreset | null)
      : null;

  const resolvedThemePreset =
    (storedTheme &&
      THEME_PRESETS.some((theme) => theme.id === storedTheme) &&
      storedTheme) ||
    (profile?.themePreset &&
      THEME_PRESETS.some((theme) => theme.id === profile.themePreset) &&
      profile.themePreset) ||
    activeThemePreset;

  const resolvedFontPreset =
    (storedFont &&
      FONT_PRESETS.some((font) => font.id === storedFont) &&
      storedFont) ||
    (profile?.fontPreset &&
      FONT_PRESETS.some((font) => font.id === profile.fontPreset) &&
      profile.fontPreset) ||
    activeFontPreset;

  const themeMode =
    themeModeOverride ??
    THEME_PRESETS.find((preset) => preset.id === resolvedThemePreset)?.mode ??
    "dark";

  /* ---------------- APPLY FONT + THEME ---------------- */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const selectedFont =
      FONT_PRESETS.find((font) => font.id === resolvedFontPreset) ??
      FONT_PRESETS[0];

    document.documentElement.dataset.appTheme = resolvedThemePreset;
    document.documentElement.dataset.appFont = resolvedFontPreset;

    document.documentElement.style.setProperty(
      "--app-font",
      selectedFont.fontFamily,
    );
    document.documentElement.style.setProperty(
      "--app-button-font-scale",
      selectedFont.buttonScale,
    );
    document.documentElement.style.setProperty(
      "--app-button-letter-spacing",
      selectedFont.buttonLetterSpacing,
    );
    document.documentElement.style.setProperty(
      "--app-button-line-height",
      selectedFont.buttonLineHeight,
    );

    localStorage.setItem(THEME_STORAGE_KEY, resolvedThemePreset);

    localStorage.setItem(FONT_STORAGE_KEY, resolvedFontPreset);
  }, [resolvedThemePreset, resolvedFontPreset]);

  /* ---------------- SAVE BG SETTINGS ---------------- */

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.documentElement.style.setProperty(
      "--games-bg-blur",
      `${gamesBgBlur}px`,
    );

    document.documentElement.style.setProperty(
      "--games-bg-overlay",
      `${gamesBgOverlay / 100}`,
    );

    const timeout = setTimeout(() => {
      localStorage.setItem(
        PAGE_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          bgBlur: gamesBgBlur,
          bgOverlay: gamesBgOverlay,
        }),
      );
    }, 200);

    return () => clearTimeout(timeout);
  }, [gamesBgBlur, gamesBgOverlay]);

  /* ---------------- HANDLERS ---------------- */

  const handleThemePresetChange = async (themePreset: ThemePreset) => {
    if (!user || !profile) return;

    try {
      /* SAVE IMMEDIATELY */
      localStorage.setItem(THEME_STORAGE_KEY, themePreset);

      setActiveThemePreset(themePreset);
      setThemeModeOverride(
        THEME_PRESETS.find((theme) => theme.id === themePreset)?.mode ?? "dark",
      );

      await fetch("/api/save-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          action: "update",
          data: { themePreset },
        }),
      });

      setProfile({
        ...profile,
        themePreset,
      });
    } catch (error) {
      console.error("Failed to update theme preset:", error);
    }
  };

  const handleFontPresetChange = async (fontPreset: FontPreset) => {
    if (!user || !profile) return;

    try {
      /* SAVE IMMEDIATELY */
      localStorage.setItem(FONT_STORAGE_KEY, fontPreset);

      setActiveFontPreset(fontPreset);

      await fetch("/api/save-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          action: "update",
          data: { fontPreset },
        }),
      });

      setProfile({
        ...profile,
        fontPreset,
      });
    } catch (error) {
      console.error("Failed to update font preset:", error);
    }
  };

  const resetGamesPageSettings = () => {
    setGamesBgBlur(DEFAULT_BG_BLUR);
    setGamesBgOverlay(DEFAULT_BG_OVERLAY);
  };

  /* ---------------- LOADING ---------------- */

  if (loading || !profile) {
    return <LoadingSpinner />;
  }

  /* ---------------- RENDER ---------------- */

  return (
    <>
      <Helmet>
        <title>Theme Forge • PlayCrew</title>
      </Helmet>

      <motion.main
        className="relative min-h-screen overflow-hidden bg-[var(--theme-bg)] px-4 pt-20 pb-5 sm:px-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* WALLPAPER */}
        {profile?.wallpaper?.data && (
          <div className="absolute inset-0 bg-black">
            <img
              src={profile.wallpaper.data}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45"
              style={{
                filter: "blur(var(--games-bg-blur, 14px))",
              }}
            />

            <div
              className="absolute inset-0 bg-black"
              style={{
                opacity: "var(--games-bg-overlay, 0.45)",
              }}
            />
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="mb-5">
            <h1 className="text-3xl font-bold theme-text">Site Settings</h1>

            <p className="theme-text-muted mt-1 text-sm">
              Customize your PlayCrew experience
            </p>
          </div>

          {/* LAYOUT */}
          <div className="grid gap-5 xl:grid-cols-[1.6fr_0.75fr]">
            {/* THEMES */}
            <section className="theme-panel-strong rounded-2xl border p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                    Themes
                  </p>

                  <h2 className="theme-text text-lg font-semibold">
                    Website Appearance
                  </h2>

                  <p className="theme-text-muted text-sm">
                    Customize the overall look and feel of PlayCrew.
                  </p>
                </div>

                {/* TOGGLE */}
                <div className="inline-flex rounded-full border border-[var(--theme-border)] bg-[var(--theme-panel-alt)] p-1">
                  {(["dark", "light"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setThemeModeOverride(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        themeMode === mode
                          ? "bg-[var(--theme-accent)] text-black"
                          : "theme-text/70 hover:theme-text"
                      }`}
                    >
                      {mode === "dark" ? "Dark" : "Light"}
                    </button>
                  ))}
                </div>
              </div>

              {/* THEMES GRID */}
              <div className="relative">
                <div
                  className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 ${
                    themeMode === "light"
                      ? "pointer-events-none select-none opacity-60"
                      : ""
                  }`}
                >
                  {THEME_PRESETS.filter(
                    (theme) => theme.mode === themeMode,
                  ).map((theme) => {
                    const isSelected = resolvedThemePreset === theme.id;

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemePresetChange(theme.id)}
                        className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                            : "theme-surface theme-hover-surface"
                        } cursor-pointer`}
                      >
                        {/* SWATCHES */}
                        <div className="mb-3 flex items-center gap-2">
                          {theme.swatches.map((swatch) => (
                            <span
                              key={`${theme.id}-${swatch}`}
                              className="h-5 w-5 rounded-full border border-white/10"
                              style={{
                                backgroundColor: swatch,
                              }}
                            />
                          ))}
                        </div>

                        {/* CONTENT */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold theme-text">
                              {theme.name}
                            </p>

                            <p className="theme-text-muted mt-1 text-[11px] leading-4">
                              {theme.description}
                            </p>
                          </div>

                          {isSelected && (
                            <span className="theme-accent-soft-bg inline-flex h-7 w-7 items-center justify-center rounded-full border">
                              <FiCheck size={14} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* LIGHT MODE OVERLAY */}
                {themeMode === "light" && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/65 backdrop-blur-[4px]">
                    <div className="flex items-end gap-2">
                      <div className="h-10 w-5 animate-[build_1.2s_ease-in-out_infinite] rounded-t-md bg-white/90" />

                      <div className="h-16 w-5 animate-[build_1.2s_ease-in-out_0.15s_infinite] rounded-t-md bg-white/90" />

                      <div className="h-24 w-5 animate-[build_1.2s_ease-in-out_0.3s_infinite] rounded-t-md bg-white/90" />

                      <div className="h-14 w-5 animate-[build_1.2s_ease-in-out_0.45s_infinite] rounded-t-md bg-white/90" />

                      <div className="h-20 w-5 animate-[build_1.2s_ease-in-out_0.6s_infinite] rounded-t-md bg-white/90" />
                    </div>

                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.35em] text-white">
                      Light Themes Coming Soon
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* SIDEBAR */}
            <div className="space-y-4">
              <section className="theme-panel-strong rounded-2xl border p-4">
                <div className="mb-4">
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                    Customization
                  </p>

                  <h2 className="theme-text text-lg font-semibold">
                    Fonts & Background
                  </h2>
                </div>

                {/* FONT GRID */}
                <div className="grid grid-cols-2 gap-2">
                  {FONT_PRESETS.map((font) => {
                    const isSelected = resolvedFontPreset === font.id;

                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => handleFontPresetChange(font.id)}
                        className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                            : "theme-surface theme-hover-surface"
                        }`}
                      >
                        <p
                          className="theme-text text-lg font-bold"
                          style={{
                            fontFamily: font.fontFamily,
                          }}
                        >
                          Aa
                        </p>

                        <p className="mt-1 text-xs font-semibold theme-text">
                          {font.name}
                        </p>

                        {isSelected && (
                          <span className="absolute right-2 top-2 theme-accent-soft-bg inline-flex h-5 w-5 items-center justify-center rounded-full border">
                            <FiCheck size={11} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* DIVIDER */}
                <div className="my-4 h-px bg-white/10" />

                {/* BG SETTINGS */}
                <div className="space-y-3">
                  {/* BLUR */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide theme-text">
                        Blur
                      </p>

                      <span className="theme-accent-soft-bg rounded-full border px-2 py-0.5 text-[10px] font-bold">
                        {gamesBgBlur}px
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="1"
                      value={gamesBgBlur}
                      onChange={(event) =>
                        setGamesBgBlur(
                          clampGamesBgBlur(Number(event.target.value)),
                        )
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                    />
                  </div>

                  {/* OVERLAY */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide theme-text">
                        Overlay
                      </p>

                      <span className="theme-accent-soft-bg rounded-full border px-2 py-0.5 text-[10px] font-bold">
                        {gamesBgOverlay}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="85"
                      step="1"
                      value={gamesBgOverlay}
                      onChange={(event) =>
                        setGamesBgOverlay(
                          clampGamesBgOverlay(Number(event.target.value)),
                        )
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetGamesPageSettings}
                  className="theme-surface theme-hover-surface mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold theme-text/85 transition"
                >
                  Reset Background
                </button>
              </section>
            </div>
          </div>
        </div>
      </motion.main>
    </>
  );
}
