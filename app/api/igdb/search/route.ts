import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";
import {
  resolveIgdbReleasePhases,
  type IgdbReleaseEntry,
} from "@/app/lib/igdbReleasePhases";

type IgdbSearchGame = {
  id: number;
  name?: string;
  total_rating_count?: number;
  follows?: number;
  hypes?: number;
  version_parent?: number;
  first_release_date?: number;
  release_dates?: IgdbReleaseEntry[];
  [key: string]: unknown;
};

const SEARCH_FIELDS = `
  id,
  name,
  cover.url,
  first_release_date,
  release_dates.date,
  release_dates.human,
  release_dates.status.name,
  total_rating_count,
  follows,
  hypes,
  version_parent
`;

const escapeApicalypseString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function relevanceScore(game: IgdbSearchGame, rawQuery: string) {
  const query = normalize(rawQuery);
  const name = normalize(game.name ?? "");
  if (!query || !name) return Number.NEGATIVE_INFINITY;

  const queryTokens = query.split(" ").filter(Boolean);
  const nameTokens = name.split(" ").filter(Boolean);
  const phraseIndex = name.indexOf(query);
  const matchedTokens = queryTokens.filter((token) =>
    nameTokens.some((nameToken) => nameToken.startsWith(token)),
  ).length;

  let score = 0;
  if (name === query) score += 20_000;
  else if (name.startsWith(`${query} `)) score += 14_000;
  else if (phraseIndex >= 0) score += 10_000 - Math.min(phraseIndex, 100);

  score += (matchedTokens / Math.max(queryTokens.length, 1)) * 5_000;
  if (matchedTokens === queryTokens.length) score += 2_000;
  if (game.version_parent == null) score += 500;

  // Popular titles win ties without overpowering textual relevance.
  const popularity =
    (game.total_rating_count ?? 0) +
    (game.follows ?? 0) * 0.5 +
    (game.hypes ?? 0) * 0.25;
  score += Math.log10(popularity + 1) * 100;
  score -= Math.max(name.length - query.length, 0) * 2;

  return score;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const searchTerm = typeof query === "string" ? query.trim() : "";

    if (searchTerm.length < 2) {
      return NextResponse.json([]);
    }

    const escapedTerm = escapeApicalypseString(searchTerm);
    const searches = await Promise.allSettled([
      igdbGamesQuery(`
        fields ${SEARCH_FIELDS};
        where name ~ *"${escapedTerm}"*;
        limit 200;
      `),
      igdbGamesQuery(`
        search "${escapedTerm}";
        fields ${SEARCH_FIELDS};
        limit 200;
      `),
    ]);

    const merged = new Map<number, IgdbSearchGame>();
    searches.forEach((result) => {
      if (result.status !== "fulfilled" || !Array.isArray(result.value)) return;
      result.value.forEach((game: IgdbSearchGame) => merged.set(game.id, game));
    });

    const games = [...merged.values()]
      .sort(
        (a, b) =>
          relevanceScore(b, searchTerm) - relevanceScore(a, searchTerm) ||
          String(a.name ?? "").localeCompare(String(b.name ?? "")),
      )
      .slice(0, 200)
      .map((game) => {
        const phases = resolveIgdbReleasePhases(
          game.release_dates ?? [],
          game.first_release_date,
        );
        return {
          ...game,
          earlyAccessDate: phases.earlyAccessDate,
          earlyAccessDatePrecision: phases.earlyAccessDatePrecision,
          fullReleaseDate: phases.fullReleaseDate,
          fullReleaseDatePrecision: phases.fullReleaseDatePrecision,
          releaseDate: phases.releaseDate,
          releaseDateKind: phases.releaseDateKind,
        };
      });

    return NextResponse.json(games);
  } catch (err) {
    console.error("IGDB SEARCH ERROR:", err);
    return NextResponse.json([]);
  }
}
