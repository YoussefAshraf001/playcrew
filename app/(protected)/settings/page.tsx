"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiSearch, FiUpload, FiX } from "react-icons/fi";
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
import { useSync } from "@/app/context/SyncContext";
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
  clampIdleWallpaperFadeSeconds,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  DEFAULT_IDLE_WALLPAPER_ENABLED,
  DEFAULT_IDLE_WALLPAPER_FADE_SECONDS,
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
  | { type: "image"; data: string; name?: string; size?: number }
  | { type: "gif"; data: string; crop: CropData; name?: string; size?: number };

type GiphyWallpaper = {
  id: string;
  title: string;
  previewUrl: string;
  imageUrl: string;
  size?: number | null;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

/* ---------------- STORAGE ---------------- */

const THEME_STORAGE_KEY = "playcrew-theme-preset";
const FONT_STORAGE_KEY = "playcrew-font-preset";
const RELEASE_SYNC_INTERVAL_KEY = "playcrew-release-sync-interval-hours";
const RELEASE_SYNC_INTERVAL_OPTIONS = [8, 12, 24, 48] as const;
const DEFAULT_RELEASE_SYNC_HOURS = 48;

const formatFadeDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;

  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes}m` : `${minutes.toFixed(1)}m`;
};

const getStoredReleaseSyncInterval = () => {
  if (typeof window === "undefined") return DEFAULT_RELEASE_SYNC_HOURS;
  const stored = window.localStorage.getItem(RELEASE_SYNC_INTERVAL_KEY);
  const parsed = Number(stored);
  return RELEASE_SYNC_INTERVAL_OPTIONS.includes(
    parsed as (typeof RELEASE_SYNC_INTERVAL_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_RELEASE_SYNC_HOURS;
};

const getStoredPageSettings = () => {
  if (typeof window === "undefined") {
    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
      idleWallpaperEnabled: DEFAULT_IDLE_WALLPAPER_ENABLED,
      idleWallpaperFadeSeconds: DEFAULT_IDLE_WALLPAPER_FADE_SECONDS,
    };
  }

  const stored = window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY);

  if (!stored) {
    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
      idleWallpaperEnabled: DEFAULT_IDLE_WALLPAPER_ENABLED,
      idleWallpaperFadeSeconds: DEFAULT_IDLE_WALLPAPER_FADE_SECONDS,
    };
  }

  try {
    const parsed = JSON.parse(stored) as {
      bgBlur?: number;
      bgOverlay?: number;
      idleWallpaperEnabled?: boolean;
      idleWallpaperFadeSeconds?: number;
    };

    return {
      bgBlur: clampGamesBgBlur(parsed.bgBlur ?? DEFAULT_BG_BLUR),
      bgOverlay: clampGamesBgOverlay(parsed.bgOverlay ?? DEFAULT_BG_OVERLAY),
      idleWallpaperEnabled:
        parsed.idleWallpaperEnabled ?? DEFAULT_IDLE_WALLPAPER_ENABLED,
      idleWallpaperFadeSeconds: clampIdleWallpaperFadeSeconds(
        parsed.idleWallpaperFadeSeconds ?? DEFAULT_IDLE_WALLPAPER_FADE_SECONDS,
      ),
    };
  } catch (error) {
    console.warn("Failed to parse page settings:", error);

    return {
      bgBlur: DEFAULT_BG_BLUR,
      bgOverlay: DEFAULT_BG_OVERLAY,
      idleWallpaperEnabled: DEFAULT_IDLE_WALLPAPER_ENABLED,
      idleWallpaperFadeSeconds: DEFAULT_IDLE_WALLPAPER_FADE_SECONDS,
    };
  }
};

/* ---------------- COMPONENT ---------------- */

export default function SiteSettingsPage() {
  const { user, profile, setProfile, loading, isAdmin } = useUser();
  const { navbarLayout, setNavbarLayout } = useUI();
  const { isSyncingReleaseDates, syncCurrent, syncTotal, requestReleaseSync } =
    useSync();
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState<"wallpaper" | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [pendingWallpaper, setPendingWallpaper] = useState<MediaValue | null>(
    null,
  );
  const [gifCropMedia, setGifCropMedia] = useState<MediaValue | null>(null);
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const [wallpaperSourceOpen, setWallpaperSourceOpen] = useState(false);
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyWallpapers, setGiphyWallpapers] = useState<GiphyWallpaper[]>([]);
  const [selectedGiphyWallpaper, setSelectedGiphyWallpaper] =
    useState<GiphyWallpaper | null>(null);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [giphyError, setGiphyError] = useState<string | null>(null);

  const [gamesBgBlur, setGamesBgBlur] = useState(
    () => getStoredPageSettings().bgBlur,
  );

  const [gamesBgOverlay, setGamesBgOverlay] = useState(
    () => getStoredPageSettings().bgOverlay,
  );

  const [idleWallpaperEnabled, setIdleWallpaperEnabled] = useState(
    () => getStoredPageSettings().idleWallpaperEnabled,
  );

  const [idleWallpaperFadeSeconds, setIdleWallpaperFadeSeconds] = useState(
    () => getStoredPageSettings().idleWallpaperFadeSeconds,
  );

  const [releaseSyncInterval, setReleaseSyncInterval] = useState(() =>
    getStoredReleaseSyncInterval(),
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

  const storedTheme =
    typeof window !== "undefined"
      ? (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreset | null)
      : null;

  const storedFont =
    typeof window !== "undefined"
      ? (localStorage.getItem(FONT_STORAGE_KEY) as FontPreset | null)
      : null;

  const resolvedThemePreset =
    (profile?.themePreset &&
      THEME_PRESETS.some((theme) => theme.id === profile.themePreset) &&
      profile.themePreset) ||
    (storedTheme &&
      THEME_PRESETS.some((theme) => theme.id === storedTheme) &&
      storedTheme) ||
    activeThemePreset;

  const resolvedFontPreset =
    (profile?.fontPreset &&
      FONT_PRESETS.some((font) => font.id === profile.fontPreset) &&
      profile.fontPreset) ||
    (storedFont &&
      FONT_PRESETS.some((font) => font.id === storedFont) &&
      storedFont) ||
    activeFontPreset;

  const themeMode =
    themeModeOverride ??
    THEME_PRESETS.find((preset) => preset.id === resolvedThemePreset)?.mode ??
    "dark";

  /* ---------------- APPLY FONT + THEME ---------------- */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const selectedFont =
      // Font customization is temporarily disabled.
      FONT_PRESETS.find((font) => font.id === DEFAULT_FONT_PRESET) ??
      FONT_PRESETS[0];

    document.documentElement.dataset.appTheme = resolvedThemePreset;
    document.documentElement.dataset.appFont = DEFAULT_FONT_PRESET;

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

    // Preserve the saved font preference for when customization returns.
    // localStorage.setItem(FONT_STORAGE_KEY, resolvedFontPreset);
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
          idleWallpaperEnabled,
          idleWallpaperFadeSeconds,
        }),
      );
    }, 200);

    return () => clearTimeout(timeout);
  }, [
    gamesBgBlur,
    gamesBgOverlay,
    idleWallpaperEnabled,
    idleWallpaperFadeSeconds,
  ]);

  /* ---------------- HANDLERS ---------------- */

  const handleThemePresetChange = async (themePreset: ThemePreset) => {
    if (!user || !profile) return;

    const previousThemePreset = resolvedThemePreset;

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

      await updateDoc(doc(db, "users", user.uid), { themePreset });
    } catch (error) {
      localStorage.setItem(THEME_STORAGE_KEY, previousThemePreset);
      setActiveThemePreset(previousThemePreset);
      setProfile({
        ...profile,
        themePreset: previousThemePreset,
      });
      console.error("Failed to update theme preset:", error);
      toast.error("Could not save your theme.");
    }
  };

  const handleFontPresetChange = async (fontPreset: FontPreset) => {
    if (!user || !profile) return;

    const previousFontPreset = resolvedFontPreset;

    try {
      /* SAVE IMMEDIATELY */
      localStorage.setItem(FONT_STORAGE_KEY, fontPreset);

      setActiveFontPreset(fontPreset);

      setProfile({
        ...profile,
        fontPreset,
      });

      await updateDoc(doc(db, "users", user.uid), { fontPreset });
    } catch (error) {
      localStorage.setItem(FONT_STORAGE_KEY, previousFontPreset);
      setActiveFontPreset(previousFontPreset);
      setProfile({
        ...profile,
        fontPreset: previousFontPreset,
      });
      console.error("Failed to update font preset:", error);
      toast.error("Could not save your font.");
    }
  };

  const resetGamesPageSettings = () => {
    setGamesBgBlur(DEFAULT_BG_BLUR);
    setGamesBgOverlay(DEFAULT_BG_OVERLAY);
    setIdleWallpaperEnabled(DEFAULT_IDLE_WALLPAPER_ENABLED);
    setIdleWallpaperFadeSeconds(DEFAULT_IDLE_WALLPAPER_FADE_SECONDS);
  };

  const handleReleaseSyncIntervalChange = (hours: number) => {
    setReleaseSyncInterval(hours);
    if (typeof window !== "undefined") {
      localStorage.setItem(RELEASE_SYNC_INTERVAL_KEY, String(hours));
    }
  };

  const loadGiphyWallpapers = async (query = "") => {
    setGiphyLoading(true);
    setGiphyError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const suffix = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`/api/giphy/wallpapers${suffix}`);
      const payload = (await response.json().catch(() => null)) as {
        wallpapers?: GiphyWallpaper[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Could not load GIPHY wallpapers");
      }

      setGiphyWallpapers(payload?.wallpapers ?? []);
    } catch (error) {
      setGiphyWallpapers([]);
      setGiphyError(getErrorMessage(error, "Could not load GIPHY wallpapers"));
    } finally {
      setGiphyLoading(false);
    }
  };

  const openGiphyPicker = () => {
    setWallpaperSourceOpen(false);
    setGiphyPickerOpen(true);
    setSelectedGiphyWallpaper(null);
    void loadGiphyWallpapers();
  };

  const stageSelectedGiphyWallpaper = () => {
    if (!selectedGiphyWallpaper) return;

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setGifCropMedia({
      type: "gif",
      data: selectedGiphyWallpaper.imageUrl,
      crop: { x: 0, y: 0, zoom: 1 },
      name: selectedGiphyWallpaper.title,
      size: selectedGiphyWallpaper.size ?? undefined,
    });
    setGiphyPickerOpen(false);
  };

  const getWallpaperCropStyle = (media: MediaValue | null) =>
    media?.type === "gif" && media.crop
      ? {
          transform: `translate(${media.crop.x}px, ${media.crop.y}px) scale(${media.crop.zoom})`,
        }
      : undefined;

  const activeWallpaper = pendingWallpaper ?? profile?.wallpaper ?? null;
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
      const signError = (await signRes.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(signError?.error || "Signature request failed");
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
      toast.success(
        savedWallpaper.type === "gif" && savedWallpaper.size
          ? `GIF wallpaper saved • ${formatFileSize(savedWallpaper.size)}`
          : "Wallpaper saved",
      );
    } catch (error) {
      console.error(error);
      toast.error(
        `Failed to save wallpaper: ${getErrorMessage(error, "Unknown error")}`,
      );
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
      <motion.main
        className={`relative min-h-screen overflow-hidden bg-[var(--theme-bg)] px-4 sm:px-6 ${
          navbarLayout === "sidebar" ? "pt-16 lg:pl-24 lg:pt-8" : "pt-20"
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
                ...getWallpaperCropStyle(activeWallpaper),
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

        <div className="relative z-10 mx-auto w-full max-w-[1900px] xl:h-[calc(100svh-4rem)]">
          {/* LAYOUT */}
          <div className="grid gap-3 xl:h-full xl:grid-cols-3 xl:items-start">
            {/* THEMES */}
            <motion.section
              className="theme-panel-strong rounded-xl border p-3 xl:order-1 xl:max-h-full xl:overflow-y-auto"
              initial={false}
              animate={wallpaperPreview ? "hidden" : "visible"}
              variants={previewVariants}
              style={{ pointerEvents: wallpaperPreview ? "none" : "auto" }}
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                    Appearance
                  </p>

                  <h2 className="theme-text text-base font-semibold">
                    Website Appearance
                  </h2>

                  <p className="theme-text-muted text-xs">
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
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {THEME_PRESETS.filter(
                    (theme) =>
                      theme.mode === themeMode &&
                      theme.id !== "spider-suit-black",
                  ).map((theme) => {
                    const isCrimsonSpider = theme.id === "spider-suit";
                    const isSelected = isCrimsonSpider
                      ? resolvedThemePreset === "spider-suit" ||
                        resolvedThemePreset === "spider-suit-black"
                      : resolvedThemePreset === theme.id;
                    const selectedCrimsonVariant =
                      resolvedThemePreset === "spider-suit-black"
                        ? "spider-suit-black"
                        : "spider-suit";

                    return (
                      <div
                        key={theme.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleThemePresetChange(
                            isCrimsonSpider ? selectedCrimsonVariant : theme.id,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          void handleThemePresetChange(
                            isCrimsonSpider ? selectedCrimsonVariant : theme.id,
                          );
                        }}
                        className={`relative min-h-[78px] overflow-hidden rounded-lg border p-3.5 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                            : "theme-surface theme-hover-surface"
                        } cursor-pointer`}
                      >
                        {isCrimsonSpider && (
                          <div
                            className="absolute right-1.5 top-1.5 z-10 inline-flex rounded-full border border-white/10 bg-black/60 backdrop-blur-sm text-[12px] font-black leading-3 text-white"
                            aria-label="Crimson Spider variant"
                          >
                            {(
                              [
                                ["V1", "spider-suit"],
                                ["V2", "spider-suit-black"],
                              ] as const
                            ).map(([label, preset]) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleThemePresetChange(preset);
                                }}
                                className={`rounded-full px-2 py-1 transition ${
                                  resolvedThemePreset === preset
                                    ? "bg-red-700 text-white shadow-sm px-2.5"
                                    : "text-zinc-400 hover:bg-white/10 hover:text-white"
                                }`}
                                aria-pressed={resolvedThemePreset === preset}
                                title={
                                  preset === "spider-suit"
                                    ? "V1: dark grey and black"
                                    : "V2: true black"
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* SWATCHES */}
                        <div
                          className={`mb-2 flex items-center gap-1.5 ${
                            isCrimsonSpider ? "pr-10" : ""
                          }`}
                        >
                          {theme.swatches.map((swatch) => (
                            <span
                              key={`${theme.id}-${swatch}`}
                              className="h-4 w-4 rounded-full border border-white/10"
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temporarily disabled: font customization controls. */}
              {false && (
                <>
                  <div className="mx-auto my-3 h-px w-1/2 bg-[rgba(var(--theme-accent-rgb),0.35)]" />
                  <div className="mb-2">
                    <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                      Customization
                    </p>

                    <h2 className="theme-text text-base font-semibold">
                      Fonts
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
                          className={`relative rounded-lg border px-2.5 py-1 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                              : "theme-surface theme-hover-surface"
                          }`}
                        >
                          <p
                            className="theme-text text-base font-bold"
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
                </>
              )}
            </motion.section>
            <section className="contents">
              {/* SIDEBAR */}
              <div className="space-y-3 xl:order-3 xl:max-h-full xl:overflow-y-auto">
                <motion.section
                  className="theme-panel-strong rounded-xl border p-3"
                  initial={false}
                  animate={wallpaperPreview ? "hidden" : "visible"}
                  variants={previewVariants}
                  style={{ pointerEvents: wallpaperPreview ? "none" : "auto" }}
                >
                  <div className="mb-3">
                    <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                      System
                    </p>

                    <h2 className="theme-text text-base font-semibold">
                      Navbar Layout
                    </h2>

                    <p className="theme-text-muted mt-1 text-xs">
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
                          locked: !isAdmin,
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
                          className={`relative overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                              : "theme-surface theme-hover-surface"
                          } ${option.locked ? "cursor-not-allowed" : ""}`}
                        >
                          {/* LOCK OVERLAY ONLY FOR GAMING PILL */}
                          {option.locked && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/70 backdrop-blur-sm">
                              <p className="theme-text text-xs font-bold tracking-[0.2em]">
                                COMING SOON
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
                <div className="theme-panel-strong rounded-xl border p-3">
                  <div className="mb-4">
                    <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                      Logic
                    </p>

                    <h2 className="theme-text text-lg font-semibold">
                      Release Sync Interval
                    </h2>

                    <p className="theme-text-muted mt-1 text-sm">
                      Choose how often PlayCrew rechecks release dates.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {RELEASE_SYNC_INTERVAL_OPTIONS.map((hours) => {
                      const isSelected = releaseSyncInterval === hours;
                      return (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => handleReleaseSyncIntervalChange(hours)}
                          className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                            isSelected
                              ? "border-[var(--theme-accent)] bg-[rgba(var(--theme-accent-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22)]"
                              : "theme-surface theme-hover-surface"
                          }`}
                        >
                          {hours}h
                        </button>
                      );
                    })}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isSyncingReleaseDates}
                      onClick={() => {
                        requestReleaseSync();
                        toast.success("Release refresh started");
                      }}
                      className="theme-accent-soft-bg mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isSyncingReleaseDates ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Refreshing {syncCurrent}/{syncTotal || "..."}
                        </>
                      ) : (
                        "Force refresh now"
                      )}
                    </button>
                  )}
                </div>
              </div>

              <section className="theme-panel-strong rounded-xl border p-3 xl:order-2 xl:max-h-full xl:overflow-y-auto">
                <div className="mb-3">
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                    Appearance
                  </p>

                  <h2 className="theme-text text-base font-semibold">
                    Wallpaper Studio
                  </h2>

                  <p className="theme-text-muted text-xs">
                    Personalize PlayCrew with your own wallpaper.
                  </p>
                </div>

                {/* STATUS */}
                <div className="theme-surface mb-3 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="theme-text font-semibold">
                        Wallpaper Status
                      </h3>

                      <p className="theme-text-muted mt-1 text-xs">
                        {hasPendingWallpaper
                          ? "A new wallpaper is ready to be saved."
                          : hasSavedWallpaper
                            ? "Your wallpaper is active."
                            : "No wallpaper selected."}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
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
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setWallpaperSourceOpen(true)}
                    className="theme-accent-bg flex flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 text-center text-sm transition hover:scale-[1.02]"
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
                    className="theme-surface theme-hover-surface flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center text-sm transition hover:scale-[1.02] disabled:opacity-50"
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

                <div className="my-4 border-t border-[var(--theme-border)]" />

                {/* BLUR */}
                <div className="mb-4">
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
                <div className="mb-4">
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

                {isAdmin && (
                  <div className="theme-surface mb-4 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="theme-text text-sm font-semibold">
                            Idle Wallpaper
                          </p>
                          <span className="theme-accent-soft-bg rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]">
                            Library page only
                          </span>
                        </div>
                        <p className="theme-text-muted mt-1 text-xs leading-4">
                          Fade the Library page into your wallpaper after a
                          period without activity. This feature only works on
                          the Library page.
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={idleWallpaperEnabled}
                        disabled={!hasWallpaper}
                        onClick={() =>
                          setIdleWallpaperEnabled((current) => !current)
                        }
                        className={`relative h-7 w-12 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          idleWallpaperEnabled
                            ? "border-[var(--theme-accent)] bg-[var(--theme-accent)]"
                            : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)]"
                        }`}
                      >
                        <span
                          className={`absolute left-1 top-1 h-[18px] w-[18px] rounded-full bg-[var(--theme-accent-contrast)] shadow-sm transition-transform ${
                            idleWallpaperEnabled
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                        <span className="sr-only">
                          {idleWallpaperEnabled
                            ? "Disable idle wallpaper"
                            : "Enable idle wallpaper"}
                        </span>
                      </button>
                    </div>

                    {!hasWallpaper && (
                      <p className="theme-text-muted mt-2 text-[11px]">
                        Add a wallpaper to enable this option.
                      </p>
                    )}

                    <div className="mt-4 border-t border-[var(--theme-border)] pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label
                          htmlFor="idle-wallpaper-fade-speed"
                          className="theme-text text-xs font-semibold"
                        >
                          Fade After
                        </label>
                        <span className="theme-accent-soft-bg rounded-full border px-2 py-1 text-[11px] font-bold">
                          {formatFadeDuration(idleWallpaperFadeSeconds)}
                        </span>
                      </div>
                      <input
                        id="idle-wallpaper-fade-speed"
                        type="range"
                        min="5"
                        max="300"
                        step="5"
                        value={idleWallpaperFadeSeconds}
                        disabled={!hasWallpaper || !idleWallpaperEnabled}
                        onChange={(event) =>
                          setIdleWallpaperFadeSeconds(
                            clampIdleWallpaperFadeSeconds(
                              Number(event.target.value),
                            ),
                          )
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      <p className="theme-text-muted mt-2 text-[11px]">
                        Controls how long the Library page waits before fading
                        to the wallpaper.
                      </p>
                    </div>
                  </div>
                )}

                <div className="my-4 border-t border-[var(--theme-border)]" />

                {/* FOOTER ACTIONS */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={resetGamesPageSettings}
                    disabled={!hasWallpaper}
                    className="theme-surface theme-hover-surface h-9 rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset Settings
                  </button>

                  <button
                    type="button"
                    disabled={!hasWallpaper}
                    onClick={() => setWallpaperPreview((v) => !v)}
                    className={`h-9 rounded-lg text-sm font-semibold transition ${
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
                        setCrop({ x: 0, y: 0 });
                        setZoom(1);
                        setGifCropMedia({
                          type: "gif",
                          data: reader.result as string,
                          crop: { x: 0, y: 0, zoom: 1 },
                          name: file.name,
                          size: file.size,
                        });
                      };
                      reader.onerror = () => {
                        toast.error(
                          `Could not read GIF: ${reader.error?.message || "FileReader failed"}`,
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
        {wallpaperSourceOpen && (
          <motion.div
            className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWallpaperSourceOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallpaper-source-title"
              className="theme-panel-strong relative w-full max-w-lg rounded-2xl border p-5 shadow-2xl"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close wallpaper source chooser"
                onClick={() => setWallpaperSourceOpen(false)}
                className="theme-surface theme-hover-surface absolute right-4 top-4 rounded-lg border p-2"
              >
                <FiX />
              </button>

              <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                Wallpaper source
              </p>
              <h2
                id="wallpaper-source-title"
                className="theme-text mt-1 text-xl font-bold"
              >
                Choose your wallpaper
              </h2>
              <p className="theme-text-muted mt-1 max-w-md text-sm">
                Upload your own image or GIF, or find an animated wallpaper on
                GIPHY.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setWallpaperSourceOpen(false);
                    wallpaperInputRef.current?.click();
                  }}
                  className="theme-surface theme-hover-surface rounded-xl border p-4 text-left transition hover:-translate-y-0.5"
                >
                  <FiUpload className="theme-accent-soft-text mb-3" size={24} />
                  <span className="theme-text block font-semibold">
                    Browse file
                  </span>
                  <span className="theme-text-muted mt-1 block text-xs leading-5">
                    Choose a JPG, PNG, WebP, or animated GIF from this device.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={openGiphyPicker}
                  className="theme-accent-soft-bg rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  <FiSearch className="mb-3" size={24} />
                  <span className="block font-semibold">Use GIPHY</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Search GIPHY and stage an animated wallpaper before saving.
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {giphyPickerOpen && (
          <motion.div
            className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-md sm:px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGiphyPickerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="giphy-wallpaper-title"
              className="theme-panel-strong flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-[var(--theme-border)] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.2em]">
                      Animated wallpapers
                    </p>
                    <h2
                      id="giphy-wallpaper-title"
                      className="theme-text mt-1 text-xl font-bold"
                    >
                      Search GIPHY
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close GIPHY wallpaper picker"
                    onClick={() => setGiphyPickerOpen(false)}
                    className="theme-surface theme-hover-surface rounded-lg border p-2"
                  >
                    <FiX />
                  </button>
                </div>

                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadGiphyWallpapers(giphyQuery);
                  }}
                >
                  <div className="theme-surface flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3">
                    <FiSearch className="theme-text-muted shrink-0" />
                    <input
                      value={giphyQuery}
                      onChange={(event) => setGiphyQuery(event.target.value)}
                      placeholder="Search cinematic, fantasy, space..."
                      maxLength={80}
                      className="theme-text h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--theme-text-muted)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={giphyLoading}
                    className="theme-accent-bg rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {giphyLoading ? (
                  <div className="flex min-h-64 items-center justify-center">
                    <span className="loading loading-spinner loading-lg text-[var(--theme-accent)]" />
                  </div>
                ) : giphyError ? (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <p className="text-sm font-semibold text-red-300">
                      {giphyError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadGiphyWallpapers(giphyQuery)}
                      className="theme-surface theme-hover-surface mt-3 rounded-lg border px-4 py-2 text-sm"
                    >
                      Try again
                    </button>
                  </div>
                ) : giphyWallpapers.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {giphyWallpapers.map((wallpaper) => {
                      const selected =
                        selectedGiphyWallpaper?.id === wallpaper.id;
                      return (
                        <button
                          key={wallpaper.id}
                          type="button"
                          onClick={() => setSelectedGiphyWallpaper(wallpaper)}
                          className={`group relative aspect-video overflow-hidden rounded-xl border bg-black transition ${
                            selected
                              ? "border-[var(--theme-accent-strong)] ring-2 ring-[var(--theme-accent)]"
                              : "border-[var(--theme-border)] hover:border-[var(--theme-border-strong)]"
                          }`}
                        >
                          <img
                            src={wallpaper.previewUrl}
                            alt={wallpaper.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/95 to-transparent px-2 pb-2 pt-7 text-left text-[11px] text-white">
                            {wallpaper.title}
                          </span>
                          {selected && (
                            <span className="theme-accent-bg absolute right-2 top-2 rounded-full p-1.5">
                              <FiCheck size={13} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="theme-text-muted flex min-h-64 items-center justify-center text-sm">
                    No GIFs found. Try a different search.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--theme-border)] p-4">
                <p className="theme-text-muted text-xs">Powered by GIPHY</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGiphyPickerOpen(false)}
                    className="theme-surface theme-hover-surface rounded-lg border px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedGiphyWallpaper}
                    onClick={stageSelectedGiphyWallpaper}
                    className="theme-accent-bg rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Crop wallpaper
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wallpaperPreview && activeWallpaper?.data && (
          <motion.div
            className="fixed inset-0 z-[10000] overflow-hidden bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
          >
            <motion.img
              src={activeWallpaper.data}
              alt="Wallpaper preview"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                ...getWallpaperCropStyle(activeWallpaper),
                filter: `blur(${gamesBgBlur}px)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: gamesBgOverlay / 100 }}
            />

            <motion.button
              type="button"
              onClick={() => setWallpaperPreview(false)}
              className="theme-panel-strong absolute right-5 top-5 z-10 rounded-xl border px-4 py-2 text-sm font-semibold shadow-2xl backdrop-blur-xl transition hover:border-[var(--theme-accent)] hover:bg-[rgba(var(--theme-accent-rgb),0.14)] sm:right-7 sm:top-7"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.16, duration: 0.22 }}
            >
              Close Preview
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gifCropMedia?.type === "gif" && (
          <CropModal
            image={gifCropMedia.data}
            crop={crop}
            zoom={zoom}
            setCrop={setCrop}
            setZoom={setZoom}
            aspect={16 / 9}
            onComplete={() => undefined}
            onSave={() => {
              const croppedGif: MediaValue = {
                ...gifCropMedia,
                crop: { x: crop.x, y: crop.y, zoom },
              };
              setPendingWallpaper(croppedGif);
              setGifCropMedia(null);
              toast.success(
                croppedGif.size
                  ? `GIF wallpaper cropped and staged • ${formatFileSize(croppedGif.size)}`
                  : "GIF wallpaper cropped and staged. Save it when ready.",
              );
            }}
            onCancel={() => setGifCropMedia(null)}
          />
        )}
      </AnimatePresence>

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
