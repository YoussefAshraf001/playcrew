export const AWARD_CATEGORIES = [
  "Game of the Year",
  "Best Narrative",
  "Best Art Direction",
  "Best Score and Music",
  "Best Performance",
  "Best World / Atmosphere",
  "Best Gameplay",
  "Best Action / Adventure",
  "Best RPG",
  "Most Anticipated Game",
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export const getAwardCategoryDocId = (category: AwardCategory) =>
  category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getAwardCategoryFromDocId = (docId: string) =>
  AWARD_CATEGORIES.find(
    (category) => getAwardCategoryDocId(category) === docId,
  ) ?? null;

export const AWARD_CATEGORY_DESCRIPTIONS: Record<AwardCategory, string> = {
  "Game of the Year":
    "Recognizing a game that delivers the absolute best experience across all creative and technical fields.",
  "Best Narrative":
    "For outstanding storytelling and narrative development in a game.",
  "Best Art Direction":
    "For outstanding creative and/or technical achievement in artistic design and animation.",
  "Best Score and Music":
    "For outstanding music, inclusive of score, original song and/or licensed soundtrack.",
  "Best Performance":
    "Awarded to an individual for voice-over acting, motion and/or performance capture.",
  "Best World / Atmosphere":
    "Awarded to the game that creates the most immersive world, mood, and sense of place through its environments, tone, and overall feel.",
  "Best Gameplay":
    "Awarded to the game with the most engaging, refined, and satisfying moment-to-moment play.",
  "Best Action / Adventure":
    "For the best action/adventure game, combining combat with traversal and puzzle solving.",
  "Best RPG":
    "For the best game designed with rich player character customization and progression, including massively multiplayer experiences.",
  "Most Anticipated Game":
    "Recognizing an announced game with the most excitement and anticipation.",
};

export const getAwardYears = () => {
  const currentYear = new Date().getFullYear();
  return Array.from(
    { length: currentYear - 2014 + 1 },
    (_, index) => 2014 + index,
  );
};

export const isAwardCategory = (value: string): value is AwardCategory =>
  (AWARD_CATEGORIES as readonly string[]).includes(value);

export const getAwardDocId = (year: number, category: AwardCategory) =>
  `${year}__${category}`;

export const parseAwardDocId = (value: string) => {
  const separatorIndex = value.indexOf("__");
  if (separatorIndex === -1) return null;

  const year = Number(value.slice(0, separatorIndex));
  const category = value.slice(separatorIndex + 2);

  if (!Number.isFinite(year) || !isAwardCategory(category)) {
    return null;
  }

  return { year, category };
};
