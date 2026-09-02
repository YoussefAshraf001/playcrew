export const THEME_PRESETS = [
  //////////////////////////////// DARK THEMES
  {
    id: "neo-cyan",
    mode: "dark",
    name: "PlayCrew Classic",
    description: "True black with electric neon-cyan accents.",
    swatches: ["#000000", "#020c0e", "#00e5ff", "#67e8f9"],
  },
  {
    id: "spider-suit",
    mode: "dark",
    name: "Crimson Spider",
    description: "Black and red with comic-book energy.",
    swatches: ["#020202", "#111111", "#6f0000", "#b80000"],
  },
  {
    id: "spider-suit-black",
    mode: "dark",
    name: "Crimson Spider — Black",
    description: "The same crimson style with true-black surfaces.",
    swatches: ["#000000", "#030303", "#6f0000", "#b80000"],
  },
  {
    id: "obsidian-ember",
    mode: "dark",
    name: "Smoke",
    description: "Pure grayscale black mode with steel shadows and no color accents.",
    swatches: ["#020202", "#0b0b0b", "#171717", "#f5f5f5"],
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
    name: "Azkaban Nocturne",
    description: "A dark, muted Azkaban palette of cold cyan, stone, and shadow.",
    swatches: ["#0c1314", "#152b32", "#324a4f", "#536b6d"],
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
  {
    id: "ember-circuit",
    mode: "dark",
    name: "Ember Circuit",
    description: "Graphite machinery lit by high-voltage orange.",
    swatches: ["#08090b", "#17191d", "#ff6b00", "#ffb000"],
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
  {
    id: "lemon-ink",
    mode: "light",
    name: "Lemon Ink",
    description: "Soft butter paper marked with deep indigo ink.",
    swatches: ["#fffbea", "#fff3b8", "#3730a3", "#f4c430"],
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"];

export const DEFAULT_THEME_PRESET: ThemePreset = "obsidian-ember";

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

] as const;

export type FontPreset = (typeof FONT_PRESETS)[number]["id"];

export const DEFAULT_FONT_PRESET: FontPreset = "playcrew-classic";

export const isFontPreset = (value: unknown): value is FontPreset =>
  typeof value === "string" && FONT_PRESETS.some((font) => font.id === value);
