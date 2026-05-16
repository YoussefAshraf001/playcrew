export const PAGE_SETTINGS_STORAGE_KEY = "games.pageSettings";
export const DEFAULT_BG_BLUR = 12;
export const DEFAULT_BG_OVERLAY = 50;

export const clampGamesBgBlur = (value: number) =>
  Math.min(24, Math.max(0, value));

export const clampGamesBgOverlay = (value: number) =>
  Math.min(85, Math.max(0, value));
