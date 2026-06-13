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
    id: "obsidian-ember",
    mode: "dark",
    name: "Obsidian Ember",
    description: "Smoldering embers beneath volcanic glass.",
    swatches: ["#0a0a0a", "#1a1a1a", "#ff6b35", "#ffb088"],
  },
  {
    id: "void-signal",
    mode: "dark",
    name: "Void Signal",
    description: "Deep-space purple with neon cosmic glow.",
    swatches: ["#050816", "#111827", "#8b5cf6", "#c084fc"],
  },
  {
    id: "sands-of-time",
    mode: "dark",
    name: "Sands of Time",
    description: "Ancient sandstorms, spice dust, and imperial bronze.",
    swatches: ["#1c1611", "#3b2d22", "#caa472", "#e8d2a8"],
  },
  {
    id: "winter-is-coming",
    mode: "dark",
    name: "Winter is Coming",
    description: "Cold stone walls, northern winds, and endless snowfall.",
    swatches: ["#171d25", "#1b2838", "#2a475e", "#66c0f4"],
  },
  {
    id: "rose-and-ash",
    mode: "dark",
    name: "Rose & Ash",
    description: "Black velvet, crimson roses, and silver moonlight.",
    swatches: ["#000000", "#1a1a1a", "#cb2957", "#dddddd"],
  },
  {
    id: "neon-forest",
    mode: "dark",
    name: "Neon Forest",
    description: "Retro-futuristic CRT glow with classic hacker aesthetics.",
    swatches: ["#020503", "#08140d", "#00ff7f", "#7dffb5"],
  },
  {
    id: "eternal-sovereign",
    mode: "dark",
    name: "Eternal Sovereign",
    description: "Molten gold flowing across obsidian stone. Built for kings.",
    swatches: ["#060606", "#151515", "#d4af37", "#ffd86b"],
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
    id: "lorekeeper",
    mode: "light",
    name: "Lorekeeper",
    description:
      "Aged parchment, leather bindings, and shelves filled with forgotten adventures.",
    swatches: ["#d9c4a1", "#e7d8bc", "#6b4f2a", "#9b7a4c"],
  },
  {
    id: "moonlight-silver",
    mode: "light",
    name: "Moonlight Silver",
    description: "Premium silver glass with a clean futuristic feel.",
    swatches: ["#eef2f7", "#ffffff", "#64748b", "#94a3b8"],
  },
  {
    id: "sakura-blossom",
    mode: "light",
    name: "Sakura Blossom",
    description: "Soft cherry blossom petals with elegant spring colors.",
    swatches: ["#fff7fb", "#ffe4ef", "#ec4899", "#f9a8d4"],
  },
  {
    id: "matcha-garden",
    mode: "light",
    name: "Matcha Garden",
    description: "Calm tea houses, bamboo paths, and fresh spring leaves.",
    swatches: ["#f7fbf3", "#e7f5df", "#65a30d", "#a3e635"],
  },
  {
    id: "ivory-royal",
    mode: "light",
    name: "Ivory Royal",
    description: "Warm ivory parchment with luxurious golden accents.",
    swatches: ["#fffdf7", "#f8f2df", "#c9a227", "#e9c46a"],
  },
  {
    id: "arctic-crystal",
    mode: "light",
    name: "Arctic Crystal",
    description: "Frozen glass, fresh snow, and crystalline mint light.",
    swatches: ["#fbffff", "#edfdfd", "#14b8a6", "#99f6e4"],
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"];

export const DEFAULT_THEME_PRESET: ThemePreset = "neo-cyan";

export const isThemePreset = (value: unknown): value is ThemePreset =>
  typeof value === "string" &&
  THEME_PRESETS.some((theme) => theme.id === value);

export const FONT_PRESETS = [
  {
    id: "playcrew-classic",
    name: "PlayCrew Classic",
    description: "Clean, modern UI designed for everyday use.",
    fontFamily: "Inter, system-ui, sans-serif",
    buttonScale: "1",
    buttonLetterSpacing: "normal",
    buttonLineHeight: "1.1",
  },

  {
    id: "velvet-nocturne",
    name: "Velvet Nocturne",
    description: "Refined gothic elegance with dramatic flair.",
    fontFamily: '"Cormorant Garamond", serif',
    buttonScale: "0.94",
    buttonLetterSpacing: "0.01em",
    buttonLineHeight: "1",
  },

  {
    id: "neon-grid",
    name: "Neon Grid",
    description: "Futuristic cyberpunk display typography.",
    fontFamily: '"Orbitron", sans-serif',
    buttonScale: "0.88",
    buttonLetterSpacing: "0.04em",
    buttonLineHeight: "1",
  },

  {
    id: "arcane-chronicle",
    name: "Arcane Chronicle",
    description: "Ancient fantasy manuscript styling.",
    fontFamily: '"Marcellus SC", serif',
    buttonScale: "0.92",
    buttonLetterSpacing: "0.015em",
    buttonLineHeight: "1",
  },

  {
    id: "terminal-core",
    name: "Terminal Core",
    description: "Retro computing and command-line aesthetics.",
    fontFamily: '"JetBrains Mono", monospace',
    buttonScale: "0.92",
    buttonLetterSpacing: "0.01em",
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
    id: "gamify",
    name: "Dead Red",
    description: "A rough-hewn western display face with fiery swagger.",
    fontFamily: '"Rye", serif',
    buttonScale: "0.88",
    buttonLetterSpacing: "0.015em",
    buttonLineHeight: "1",
  },
] as const;

export type FontPreset = (typeof FONT_PRESETS)[number]["id"];

export const DEFAULT_FONT_PRESET: FontPreset = "playcrew-classic";

export const isFontPreset = (value: unknown): value is FontPreset =>
  typeof value === "string" && FONT_PRESETS.some((font) => font.id === value);
