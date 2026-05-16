export const THEME_PRESETS = [
  //////////////////////////////// DARK THEMES
  {
    id: "neo-cyan",
    mode: "dark",
    name: "PlayCrew Classic",
    description: "The current PlayCrew look with icy cyan accents.",
    swatches: ["#020617", "#0f172a", "#22d3ee", "#67e8f9"],
  },
  {
    id: "spider-suit",
    mode: "dark",
    name: "Crimson Spider",
    description: "Black and red with comic-book energy.",
    swatches: ["#020202", "#111111", "#b3001b", "#ff3b30"],
  },
  {
    id: "emerald-night",
    mode: "dark",
    name: "Forest Whisper",
    description: "Deep forest glass with mint highlights.",
    swatches: ["#03120f", "#0b1f1a", "#22c55e", "#6ee7b7"],
  },
  {
    id: "void-signal",
    mode: "dark",
    name: "Void Signal",
    description: "Deep-space purple with neon cosmic glow.",
    swatches: ["#050816", "#111827", "#8b5cf6", "#c084fc"],
  },
  {
    id: "dune",
    mode: "dark",
    name: "Dune",
    description: "Ancient sandstorms, spice dust, and imperial bronze.",
    swatches: ["#1c1611", "#3b2d22", "#caa472", "#e8d2a8"],
  },
  {
    id: "steam",
    mode: "dark",
    name: "Steam",
    description: "Inspired by the official Steam desktop and store UI.",
    swatches: ["#171d25", "#1b2838", "#2a475e", "#66c0f4"],
  },

  //////////////////////////////// LIGHT THEMES
  {
    id: "ocean-eyes",
    mode: "light",
    name: "Ocean Eyes",
    description: "Soft misty blues with clean bright accents.",
    swatches: ["#f8fafc", "#e2e8f0", "#60a5fa", "#a5b4fc"],
  },
  {
    id: "solar-flare",
    mode: "light",
    name: "Solar Bloom",
    description: "Warm apricot light with rosy shimmer.",
    swatches: ["#fff7ed", "#ffedd5", "#fb923c", "#fde68a"],
  },
  {
    id: "violet-grid",
    mode: "light",
    name: "Violet Dream",
    description: "Soft lavender with pastel neon highlights.",
    swatches: ["#f8f0ff", "#ede9fe", "#c084fc", "#f9a8d4"],
  },
  {
    id: "coral-reef",
    mode: "light",
    name: "Coral Reef",
    description: "Vibrant coral and turquoise with ocean energy.",
    swatches: ["#fff7ed", "#fed7aa", "#f97316", "#06b6d4"],
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"];

export const DEFAULT_THEME_PRESET: ThemePreset = "neo-cyan";

export const isThemePreset = (value: unknown): value is ThemePreset =>
  typeof value === "string" &&
  THEME_PRESETS.some((theme) => theme.id === value);

export const FONT_PRESETS = [
  {
    id: "modern-sans",
    name: "PlayCrew Classic",
    description: "Clean, modern text for a polished look.",
    fontFamily: "Inter, system-ui, sans-serif",
    buttonScale: "1",
    buttonLetterSpacing: "normal",
    buttonLineHeight: "1.1",
  },
  {
    id: "gamify",
    name: "RDR2",
    description: "A rough-hewn western display face with fiery swagger.",
    fontFamily: '"Rye", serif',
    buttonScale: "0.88",
    buttonLetterSpacing: "0.015em",
    buttonLineHeight: "1",
  },
  {
    id: "solo-leveling",
    name: "Runes of Dawn",
    description: "Ancient storybook lettering with a mystical edge.",
    fontFamily: '"Uncial Antiqua", serif',
    buttonScale: "0.94",
    buttonLetterSpacing: "0.01em",
    buttonLineHeight: "1.02",
  },
  {
    id: "clair-obscur",
    name: "Clair Obscur: Expedition 33",
    description: "Bold supernatural heading style.",
    fontFamily: '"ClairObscurExpedition33", sans-serif',
    buttonScale: "0.9",
    buttonLetterSpacing: "-0.02em",
    buttonLineHeight: "0.98",
  },
  {
    id: "game-of-thrones",
    name: "Game of Thrones",
    description: "Epic medieval serif with regal flair.",
    fontFamily: '"GameofThrones", serif',
    buttonScale: "0.88",
    buttonLetterSpacing: "-0.03em",
    buttonLineHeight: "0.95",
  },
  {
    id: "vampire-diaries",
    name: "Midnight Velvet",
    description: "A dramatic gothic display face with elegant horror flair.",
    fontFamily: '"TheVampireDiaries", serif',
    buttonScale: "0.9",
    buttonLetterSpacing: "-0.015em",
    buttonLineHeight: "0.98",
  },
] as const;

export type FontPreset = (typeof FONT_PRESETS)[number]["id"];

export const DEFAULT_FONT_PRESET: FontPreset = "gamify";

export const isFontPreset = (value: unknown): value is FontPreset =>
  typeof value === "string" && FONT_PRESETS.some((font) => font.id === value);
