"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { FiImage, FiTrash2 } from "react-icons/fi";
import { Area } from "react-easy-crop";
import { FaSave } from "react-icons/fa";
import { MdAdd } from "react-icons/md";

import { useUser } from "@/app/context/UserContext";
import { useUI } from "@/app/context/UIContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import getCroppedImg from "@/app/lib/getCroppedImg";

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
import CropModal from "@/app/components/CropModal";
import { IoIosCloudUpload } from "react-icons/io";

type CropData = {
  x: number;
  y: number;
  zoom: number;
};

type MediaValue =
  | { type: "image"; data: string; name?: string }
  | { type: "gif"; data: string; crop: CropData; name?: string };

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
  const { navbarLayout, setNavbarLayout } = useUI();
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState<"wallpaper" | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [pendingWallpaper, setPendingWallpaper] = useState<MediaValue | null>(
    null,
  );
  const [savingWallpaper, setSavingWallpaper] = useState(false);

  const [gamesBgBlur, setGamesBgBlur] = useState(
    () => getStoredPageSettings().bgBlur,
  );

  const [gamesBgOverlay, setGamesBgOverlay] = useState(
    () => getStoredPageSettings().bgOverlay,
  );

  const [wallpaperPreview, setWallpaperPreview] = useState(false);

  const previewVariants = {
    visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
    hidden: { opacity: 0.08, y: 0, transition: { duration: 0.18 } },
  };

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

  const activeWallpaper = pendingWallpaper ?? profile?.wallpaper ?? null;
  const activeWallpaperName = activeWallpaper?.name?.trim() || "Wallpaper";
  const hasSavedWallpaper = Boolean(profile?.wallpaper?.data);
  const hasPendingWallpaper = Boolean(pendingWallpaper);
  const hasWallpaper = hasSavedWallpaper || hasPendingWallpaper;

  const uploadWallpaperToCloudinary = async (media: MediaValue) => {
    if (!user?.uid) throw new Error("Missing user");
    if (!media.data.startsWith("data:")) return media;

    const publicId = `playcrew/users/${user.uid}/wallpaper`;
    const assetFolder = `playcrew/users/${user.uid}/profile`;

    const signRes = await fetch("/api/cloudinary/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, assetFolder }),
    });

    if (!signRes.ok) {
      throw new Error("Signature request failed");
    }

    const {
      cloudName,
      apiKey,
      timestamp,
      signature,
      publicId: signedPublicId,
      assetFolder: signedAssetFolder,
    } = (await signRes.json()) as {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      publicId: string;
      assetFolder?: string | null;
    };

    const blob = await fetch(media.data).then((response) => response.blob());
    const ext = (blob.type.split("/")[1] || "bin").split(";")[0];

    const form = new FormData();
    form.append("file", blob, `wallpaper.${ext}`);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("public_id", signedPublicId);
    if (signedAssetFolder) form.append("asset_folder", signedAssetFolder);
    form.append("overwrite", "true");
    form.append("invalidate", "true");

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
      },
    );

    const uploadJson = (await uploadRes.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!uploadRes.ok || !uploadJson.secure_url) {
      throw new Error(uploadJson.error?.message || "Upload failed");
    }

    return { ...media, data: uploadJson.secure_url };
  };

  const saveWallpaper = async () => {
    if (!user || !profile || !pendingWallpaper || savingWallpaper) return;

    setSavingWallpaper(true);

    try {
      const savedWallpaper =
        await uploadWallpaperToCloudinary(pendingWallpaper);

      await updateDoc(doc(db, "users", user.uid), {
        wallpaper: savedWallpaper,
      });

      setProfile({
        ...profile,
        wallpaper: savedWallpaper,
      });

      setPendingWallpaper(null);
      toast.success("Wallpaper saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save wallpaper");
    } finally {
      setSavingWallpaper(false);
    }
  };

  const removeWallpaper = async () => {
    if (!user || !profile) return;

    if (pendingWallpaper) {
      setPendingWallpaper(null);
      toast.success("Wallpaper changes discarded");
      return;
    }

    if (!profile.wallpaper?.data) return;

    try {
      await fetch("/api/cloudinary/destroy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicId: `playcrew/users/${user.uid}/wallpaper`,
        }),
      });

      await updateDoc(doc(db, "users", user.uid), {
        wallpaper: deleteField(),
      });

      setProfile({
        ...profile,
        wallpaper: undefined,
      });

      toast.success("Wallpaper removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove wallpaper");
    }
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
        className={`relative min-h-screen overflow-hidden bg-[var(--theme-bg)] px-4 sm:px-6 ${
          navbarLayout === "sidebar" ? "pt-5" : "pt-20"
          // navbarLayout === "sidebar" ? "pt-14" : "pt-20"
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* WALLPAPER */}
        {activeWallpaper?.data && (
          <div className="absolute inset-0 bg-black">
            <img
              src={activeWallpaper.data}
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
          {/* LAYOUT */}
          <div className="grid gap-5 xl:grid-cols-[1.6fr_0.75fr]">
            {/* THEMES */}
            <motion.section
              className="theme-panel-strong rounded-2xl border p-6"
              initial={false}
              animate={wallpaperPreview ? "hidden" : "visible"}
              variants={previewVariants}
              style={{ pointerEvents: wallpaperPreview ? "none" : "auto" }}
            >
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
                  className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 `}
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
                        className={`relative min-h-[115px] overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 ${
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
              </div>

              <div className="mx-auto my-6 h-px w-1/2 bg-[rgba(var(--theme-accent-rgb),0.35)]" />
              <div className="mb-4">
                <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                  Customization
                </p>

                <h2 className="theme-text text-lg font-semibold">Fonts</h2>
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
                      className={`relative rounded-xl border px-3 py-1.5 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                          : "theme-surface theme-hover-surface"
                      }`}
                    >
                      <p
                        className={`theme-text text-lg font-bold`}
                        style={{ fontFamily: font.fontFamily }}
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
            </motion.section>
            <section>
              {/* SIDEBAR */}
              <div>
                <motion.section
                  className="theme-panel-strong rounded-2xl border p-4"
                  initial={false}
                  animate={wallpaperPreview ? "hidden" : "visible"}
                  variants={previewVariants}
                  style={{ pointerEvents: wallpaperPreview ? "none" : "auto" }}
                >
                  <div className="mb-4">
                    <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                      Navigation
                    </p>

                    <h2 className="theme-text text-lg font-semibold">
                      Navbar Layout
                    </h2>

                    <p className="theme-text-muted mt-1 text-sm">
                      Choose between the classic top bar and the pill sidebar.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: "sidebar",
                          name: "Gaming Pill",
                          description: "Vertical pill navigation on the left.",
                          locked: false,
                        },
                        {
                          id: "top",
                          name: "Classic",
                          description: "Horizontal navigation across the top.",
                          locked: false,
                        },
                      ] as const
                    ).map((option) => {
                      const isSelected = navbarLayout === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={option.locked}
                          onClick={() => {
                            if (!option.locked) {
                              void setNavbarLayout(option.id);
                            }
                          }}
                          className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                              : "theme-surface theme-hover-surface"
                          } ${option.locked ? "cursor-not-allowed" : ""}`}
                        >
                          {/* LOCK OVERLAY ONLY FOR GAMING PILL */}
                          {option.locked && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm bg-black/55">
                              <p className="theme-text text-xs font-bold tracking-[0.2em]">
                                COMING SOON
                              </p>
                              <p className="theme-text text-[10px]">
                                Building in progress
                              </p>
                            </div>
                          )}

                          <p className="theme-text text-sm font-semibold">
                            {option.name}
                          </p>

                          <p className="theme-text-muted mt-1 text-[11px] leading-4">
                            {option.description}
                          </p>

                          {isSelected && !option.locked && (
                            <span className="absolute right-2 top-2 theme-accent-soft-bg inline-flex h-5 w-5 items-center justify-center rounded-full border">
                              <FiCheck size={11} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              </div>

              <section className="theme-panel-strong mt-2 rounded-2xl border p-6">
                <div className="mb-6">
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                    Appearance
                  </p>

                  <h2 className="theme-text text-lg font-semibold">
                    Wallpaper Studio
                  </h2>

                  <p className="theme-text-muted text-sm">
                    Personalize PlayCrew with your own wallpaper.
                  </p>
                </div>

                {/* STATUS */}
                <div className="theme-surface mb-5 rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="theme-text font-semibold">
                        Wallpaper Status
                      </h3>

                      <p className="theme-text-muted text-sm">
                        {hasPendingWallpaper
                          ? `${activeWallpaperName} is staged and ready to save`
                          : hasSavedWallpaper
                            ? activeWallpaperName
                            : "No wallpaper selected"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        hasPendingWallpaper
                          ? "theme-accent-soft-bg"
                          : hasSavedWallpaper
                            ? "theme-accent-soft-bg"
                            : "theme-surface"
                      }`}
                    >
                      {hasPendingWallpaper
                        ? "PENDING"
                        : hasSavedWallpaper
                          ? "ACTIVE"
                          : "NONE"}
                    </span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="theme-accent-bg flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition hover:scale-[1.02]"
                  >
                    {hasSavedWallpaper || hasPendingWallpaper ? (
                      <FiImage size={22} />
                    ) : (
                      <MdAdd size={22} />
                    )}

                    <span className="font-semibold">
                      {hasSavedWallpaper || hasPendingWallpaper
                        ? "Change"
                        : "Add"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!hasPendingWallpaper && !hasSavedWallpaper}
                    onClick={removeWallpaper}
                    className="theme-surface theme-hover-surface flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    <FiTrash2 size={22} />
                    <span className="font-semibold">
                      {hasPendingWallpaper ? "Discard" : "Remove"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!hasPendingWallpaper || savingWallpaper}
                    onClick={saveWallpaper}
                    className={`
                      flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center
                      transition-all duration-300 hover:scale-[1.02]
                      ${
                        hasPendingWallpaper
                          ? "theme-accent-soft-bg animate-pulse shadow-[0_0_25px_rgba(var(--theme-accent-rgb),0.45)] border-[rgba(var(--theme-accent-rgb),0.5)]"
                          : "theme-surface theme-hover-surface opacity-20"
                      }
                    `}
                  >
                    <span className="font-semibold">
                      {savingWallpaper ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <IoIosCloudUpload size={22} />
                          <div className="flex items-center">
                            <span>Uploading</span>
                            <span className="loading loading-dots loading-xs relative top-1 ml-1"></span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FaSave size={22} />
                          <span>Confirm</span>
                        </div>
                      )}
                    </span>
                  </button>
                </div>

                <div className="my-6 border-t border-[var(--theme-border)]" />

                {/* BLUR */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="theme-text text-sm font-semibold">
                      Background Blur
                    </span>

                    <span className="theme-accent-soft-bg rounded-full border px-2 py-1 text-xs font-bold">
                      {gamesBgBlur}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="1"
                    value={gamesBgBlur}
                    disabled={!hasWallpaper}
                    onChange={(event) =>
                      setGamesBgBlur(
                        clampGamesBgBlur(Number(event.target.value)),
                      )
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                {/* OVERLAY */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="theme-text text-sm font-semibold">
                      Dark Overlay
                    </span>

                    <span className="theme-accent-soft-bg rounded-full border px-2 py-1 text-xs font-bold">
                      {gamesBgOverlay}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="85"
                    step="1"
                    value={gamesBgOverlay}
                    disabled={!hasWallpaper}
                    onChange={(event) =>
                      setGamesBgOverlay(
                        clampGamesBgOverlay(Number(event.target.value)),
                      )
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                <div className="my-6 border-t border-[var(--theme-border)]" />

                {/* FOOTER ACTIONS */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={resetGamesPageSettings}
                    disabled={!hasWallpaper}
                    className="theme-surface theme-hover-surface h-11 rounded-xl border font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset Settings
                  </button>

                  <button
                    type="button"
                    disabled={!hasWallpaper}
                    onClick={() => setWallpaperPreview((v) => !v)}
                    className={`h-11 rounded-xl font-semibold transition ${
                      !hasWallpaper
                        ? "theme-surface border opacity-50"
                        : wallpaperPreview
                          ? "theme-surface border"
                          : "theme-accent-bg"
                    }`}
                  >
                    {hasWallpaper
                      ? wallpaperPreview
                        ? "Close Preview"
                        : "Preview Wallpaper"
                      : "No Wallpaper"}
                  </button>
                </div>

                <input
                  ref={wallpaperInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (!file) return;

                    if (file.type === "image/gif") {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setPendingWallpaper({
                          type: "gif",
                          data: reader.result as string,
                          crop: { x: 0, y: 0, zoom: 1 },
                          name: file.name,
                        });
                        toast.success(
                          "GIF wallpaper staged. Save it when ready.",
                        );
                      };
                      reader.readAsDataURL(file);
                      e.currentTarget.value = "";
                      return;
                    }

                    setSelectedFile(file);
                    setCropType("wallpaper");
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                />
              </section>
            </section>
          </div>
        </div>
      </motion.main>

      <AnimatePresence>
        {cropType && selectedFile && (
          <CropModal
            file={selectedFile}
            crop={crop}
            zoom={zoom}
            setCrop={setCrop}
            setZoom={setZoom}
            aspect={16 / 9}
            onComplete={setCroppedPixels}
            onSave={async () => {
              const base64 = await getCroppedImg(
                URL.createObjectURL(selectedFile),
                croppedPixels!,
                3840,
                0.92,
                1920,
                1080,
              );

              setPendingWallpaper({
                type: "image",
                data: base64,
                name: selectedFile.name,
              });

              toast.success("Wallpaper staged. Save it when ready.");

              setCropType(null);
              setSelectedFile(null);
            }}
            onCancel={() => {
              setCropType(null);
              setSelectedFile(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
