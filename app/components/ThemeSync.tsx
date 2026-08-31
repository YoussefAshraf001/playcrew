"use client";

import { useEffect } from "react";

import { useUser } from "@/app/context/UserContext";

import {
  DEFAULT_FONT_PRESET,
  DEFAULT_THEME_PRESET,
  FONT_PRESETS,
  isThemePreset,
} from "@/app/lib/themes";

const THEME_STORAGE_KEY = "playcrew-theme-preset";

export default function ThemeSync() {
  const { profile } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;

    /* Local storage provides the pre-profile startup cache. */
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    const profileTheme = profile?.themePreset;

    const nextTheme = isThemePreset(profileTheme)
      ? profileTheme
      : isThemePreset(storedTheme)
        ? storedTheme
        : DEFAULT_THEME_PRESET;

    // Font customization is temporarily disabled. Keep the saved preference
    // untouched so it can be restored when this feature is re-enabled.
    const nextFont = DEFAULT_FONT_PRESET;

    const selectedFont =
      FONT_PRESETS.find((font) => font.id === nextFont) ?? FONT_PRESETS[0];

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    // window.localStorage.setItem(FONT_STORAGE_KEY, nextFont);

    /* APPLY THEME */
    document.documentElement.dataset.appTheme = nextTheme;
    document.documentElement.dataset.appFont = nextFont;

    /* APPLY FONT */
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
  }, [profile]);

  return null;
}
