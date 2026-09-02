import type { IgdbReleaseDateKind } from "@/app/lib/igdbReleasePhases";

type CanonicalIgdbGame = {
  id: number;
  name?: string;
  cover?: string | null;
  genres?: string[];
  rating?: number | null;
  platforms?: string[];
  releaseDate?: number | null;
  earlyAccessDate?: number | null;
  earlyAccessDatePrecision?: "year" | "quarter" | "month" | "day" | null;
  fullReleaseDate?: number | null;
  fullReleaseDatePrecision?: "year" | "quarter" | "month" | "day" | null;
  releaseDateKind?: IgdbReleaseDateKind | null;
  releaseDatePrecision?: "year" | "quarter" | "month" | "day" | null;
};

const fromUnixSeconds = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000)
    : null;

export async function buildCanonicalTrackedGamePayload(
  igdbId: number,
  fallbackName = "Game",
) {
  const response = await fetch(`/api/igdb/${igdbId}`);
  if (!response.ok) {
    throw new Error("Could not load complete IGDB game metadata.");
  }

  const game = (await response.json()) as CanonicalIgdbGame;
  const name = game.name?.trim() || fallbackName;

  return {
    name,
    igdb: {
      id: game.id ?? igdbId,
      name,
      cover: game.cover || "/placeholder-game.jpg",
      rating: game.rating ?? 0,
      genres: Array.isArray(game.genres) ? game.genres : [],
      platforms: Array.isArray(game.platforms) ? game.platforms : [],
      releaseDate: fromUnixSeconds(game.releaseDate),
      earlyAccessDate: fromUnixSeconds(game.earlyAccessDate),
      earlyAccessDatePrecision: game.earlyAccessDatePrecision ?? null,
      fullReleaseDate: fromUnixSeconds(game.fullReleaseDate),
      fullReleaseDatePrecision: game.fullReleaseDatePrecision ?? null,
      releaseDateKind: game.releaseDateKind ?? null,
      releaseDatePrecision: game.releaseDatePrecision ?? null,
    },
    my_rating: null,
    playtime: 0,
    progress: 0,
    review: {
      text: "",
      sticker: null,
    },
    status: "Want To Play",
    favorite: false,
    notInterested: false,
    playedSessions: [],
    playedOn: [],
    preReleaseAccess: null,
    recentActionSummary: "Added to My Collection",
    recentActionSource: "user" as const,
    lastUpdated: new Date(),
  };
}
