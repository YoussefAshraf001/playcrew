"use client";

import { useEffect } from "react";

import { useUser } from "@/app/context/UserContext";

import {
  DEFAULT_FONT_PRESET,
  DEFAULT_THEME_PRESET,
  FONT_PRESETS,
  isFontPreset,
  isThemePreset,
} from "@/app/lib/themes";

const THEME_STORAGE_KEY = "playcrew-theme-preset";
const FONT_STORAGE_KEY = "playcrew-font-preset";

export default function ThemeSync() {
  const { profile } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;

    /* LOCAL STORAGE IS SOURCE OF TRUTH */
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    const storedFont = window.localStorage.getItem(FONT_STORAGE_KEY);

    const profileTheme = profile?.themePreset;
    const profileFont = profile?.fontPreset;

    const nextTheme = isThemePreset(storedTheme)
      ? storedTheme
      : isThemePreset(profileTheme)
        ? profileTheme
        : DEFAULT_THEME_PRESET;

    const nextFont = isFontPreset(storedFont)
      ? storedFont
      : isFontPreset(profileFont)
        ? profileFont
        : DEFAULT_FONT_PRESET;

    const selectedFont =
      FONT_PRESETS.find((font) => font.id === nextFont) ?? FONT_PRESETS[0];

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.localStorage.setItem(FONT_STORAGE_KEY, nextFont);

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
