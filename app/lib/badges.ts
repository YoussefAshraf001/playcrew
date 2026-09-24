import achievementData from "@/app/achievements.json";

export type BadgeFamily =
  | "completed"
  | "playtime"
  | "reviews"
  | "collection"
  | "replays"
  | "ratings"
  | "perfected"
  | "genres"
  | "platforms"
  | "sessions";

export type BadgeDefinition = {
  id: string;
  family: BadgeFamily;
  title: string;
  description: string;
  threshold: number;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
};

export type BadgeGame = {
  status?: string;
  playtime?: number | null;
  notInterested?: boolean;
  review?: { text?: string | null } | null;
  favorite?: boolean;
  runHistory?: unknown[] | null;
  my_rating?: number | null;
  progress?: number | null;
  playedSessions?: unknown[] | null;
  igdb?: {
    genres?: string[] | null;
    platforms?: string[] | null;
  } | null;
};

export type BadgeStats = Record<BadgeFamily, number>;

export const BADGES = achievementData as BadgeDefinition[];

export const calculateBadgeStats = (games: BadgeGame[]): BadgeStats => {
  const eligibleGames = games.filter(
    (game) =>
      !game.notInterested &&
      game.status !== "Not Interested" &&
      game.status !== "Lost Interest",
  );

  return {
    completed: eligibleGames.filter((game) => game.status === "Completed").length,
    playtime:
      Math.round(
        eligibleGames.reduce(
          (total, game) => total + Math.max(0, game.playtime ?? 0),
          0,
        ) * 10,
      ) / 10,
    reviews: eligibleGames.filter((game) => Boolean(game.review?.text?.trim()))
      .length,
    collection: eligibleGames.length,
    replays: eligibleGames.reduce(
      (total, game) => total + (game.runHistory?.length ?? 0),
      0,
    ),
    ratings: eligibleGames.filter(
      (game) => typeof game.my_rating === "number" && game.my_rating > 0,
    ).length,
    perfected: eligibleGames.filter((game) => (game.progress ?? 0) >= 100).length,
    genres: new Set(
      eligibleGames.flatMap((game) =>
        (game.igdb?.genres ?? []).map((genre) => genre.trim()).filter(Boolean),
      ),
    ).size,
    platforms: new Set(
      eligibleGames.flatMap((game) =>
        (game.igdb?.platforms ?? [])
          .map((platform) => platform.trim())
          .filter(Boolean),
      ),
    ).size,
    sessions: eligibleGames.reduce(
      (total, game) => total + (game.playedSessions?.length ?? 0),
      0,
    ),
  };
};

export const getEarnedBadgeIds = (stats: BadgeStats) =>
  BADGES.filter((badge) => stats[badge.family] >= badge.threshold).map(
    (badge) => badge.id,
  );

export const getBadgeProgress = (
  badge: BadgeDefinition,
  stats: BadgeStats,
) => {
  const value = stats[badge.family];
  return {
    value,
    percent: Math.min(100, Math.round((value / badge.threshold) * 100)),
  };
};
