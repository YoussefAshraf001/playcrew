import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

const ARABIC_TO_ROMAN: Record<string, string> = {
  "1": "i",
  "2": "ii",
  "3": "iii",
  "4": "iv",
  "5": "v",
  "6": "vi",
  "7": "vii",
  "8": "viii",
  "9": "ix",
  "10": "x",
};

const ROMAN_TO_ARABIC = Object.fromEntries(
  Object.entries(ARABIC_TO_ROMAN).map(([arabic, roman]) => [roman, arabic]),
) as Record<string, string>;

const escapeQueryValue = (value: string) => value.replace(/"/g, '\\"');

const swapStandaloneNumerals = (
  value: string,
  dictionary: Record<string, string>,
) =>
  value.replace(/\b([a-z0-9]+)\b/gi, (token) => {
    const replacement = dictionary[token.toLowerCase()];
    return replacement ?? token;
  });

const buildSearchPatterns = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return Array.from(
    new Set([
      trimmed,
      swapStandaloneNumerals(trimmed, ARABIC_TO_ROMAN),
      swapStandaloneNumerals(trimmed, ROMAN_TO_ARABIC),
    ]),
  );
};

const PACKAGE_NAME_PATTERN =
  /\b(bundle|edition|pack|collection|anthology|complete\s+edition|definitive\s+edition|collector'?s\s+edition|premium\s+bundle|deluxe\s+edition|ultimate\s+edition|gold\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition|season\s+pass|cloud\s+version)\b/i;

const isPackageLikeTitle = (game: { name?: string | null }) =>
  !!game.name && PACKAGE_NAME_PATTERN.test(game.name);

const filterAwardSearchResults = <T extends { name?: string | null }>(games: T[]) =>
  games.filter((game) => !isPackageLikeTitle(game));

export async function POST(req: Request) {
  try {
    const { query, year, includeUnreleased, includeAdjacentYear, adjacentYearCount, adjacentYearDirection, category } = await req.json();

    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    const normalizedCategory =
      typeof category === "string" ? category.trim().toLowerCase() : "";
    const isMostAnticipated = normalizedCategory === "most anticipated game";
    const parsedYear = Number(year);
    const hasYear = Number.isFinite(parsedYear) && parsedYear >= 1970;
    const allowTbaForMostAnticipated =
      isMostAnticipated && Boolean(includeUnreleased);
    const sortClause = isMostAnticipated
      ? "first_release_date asc"
      : "total_rating desc";
    const limit = 500;
    const hasAdjacentYear = hasYear && Boolean(includeAdjacentYear);
    const adjacentOffset = adjacentYearDirection === "next" ? 1 : -1;
    const resolvedAdjacentYearCount = Math.max(
      0,
      Math.min(2, Number(adjacentYearCount) || 0),
    );
    const adjacentYears = hasAdjacentYear
      ? Array.from({ length: resolvedAdjacentYearCount }, (_, index) => parsedYear + adjacentOffset * (index + 1))
      : [];
    const startOfYear = hasYear
      ? Math.floor(new Date(parsedYear, 0, 1).getTime() / 1000)
      : null;
    const endOfYear = hasYear
      ? Math.floor(new Date(parsedYear, 11, 31, 23, 59, 59).getTime() / 1000)
      : null;
    const adjacentYearClauses = adjacentYears.map((adjacentYear) => {
      const start = Math.floor(new Date(adjacentYear, 0, 1).getTime() / 1000);
      const end = Math.floor(
        new Date(adjacentYear, 11, 31, 23, 59, 59).getTime() / 1000,
      );
      return `(first_release_date >= ${start} & first_release_date <= ${end})`;
    });

    if (!normalizedQuery && !hasYear) {
      return NextResponse.json([]);
    }

    const whereParts = ["cover != null"];

    if (!isMostAnticipated) {
      whereParts.push(
        "(game_type = 0 | game_type = 1 | game_type = 2 | game_type = 4 | game_type = 8 | game_type = 9)",
      );
    }

    if (hasYear && startOfYear && endOfYear) {
      const primaryYearClause = isMostAnticipated
        ? allowTbaForMostAnticipated
          ? `((first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}) | first_release_date = null)`
          : `first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}`
        : includeUnreleased
          ? `((first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}) | first_release_date = null)`
          : `first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}`;

      if (adjacentYearClauses.length > 0) {
        whereParts.push(
          `(${[primaryYearClause, ...adjacentYearClauses].join(" | ")})`,
        );
      } else {
        whereParts.push(primaryYearClause);
      }
    }

    if (!isMostAnticipated && hasYear && !includeUnreleased) {
      const now = Math.floor(Date.now() / 1000);
      whereParts.push(`first_release_date <= ${now}`);
    }

    if (normalizedQuery) {
      const searchPatterns = buildSearchPatterns(normalizedQuery).map(
        (pattern) => `name ~ *"${escapeQueryValue(pattern)}"*`,
      );
      whereParts.push(
        searchPatterns.length === 1
          ? searchPatterns[0]
          : `(${searchPatterns.join(" | ")})`,
      );
    }

    const baseQuery = [
      "fields",
      "  id,",
      "  name,",
      "  cover.url,",
      "  first_release_date,",
      "  hypes,",
      "  rating,",
      "  total_rating,",
      "  version_parent,",
      "  game_type;",
      `where ${whereParts.join(" & ")};`,
      `sort ${sortClause};`,
    ].join("\n");

    const shouldPageYearResults = !normalizedQuery && !isMostAnticipated;

    if (!shouldPageYearResults) {
      const games = await igdbGamesQuery(`
${baseQuery}
limit ${limit};
`);
      return NextResponse.json(
        Array.isArray(games) ? filterAwardSearchResults(games) : [],
      );
    }

    const batches = await Promise.all(
      [0, 500, 1000].map((offset) =>
        igdbGamesQuery(`
${baseQuery}
limit 500;
offset ${offset};
`),
      ),
    );

    const merged = batches.flat();
    const deduped = Array.from(
      new Map(
        merged
          .filter((game) => game && typeof game === "object")
          .map((game) => [String((game as { id?: number }).id), game]),
      ).values(),
    );

    return NextResponse.json(filterAwardSearchResults(deduped));
  } catch (err) {
    console.error("IGDB AWARDS SEARCH ERROR:", err);
    return NextResponse.json([]);
  }
}
// import { igdbGamesQuery } from "@/app/lib/igdb";
// import { NextResponse } from "next/server";

// const ARABIC_TO_ROMAN: Record<string, string> = {
//   "1": "i",
//   "2": "ii",
//   "3": "iii",
//   "4": "iv",
//   "5": "v",
//   "6": "vi",
//   "7": "vii",
//   "8": "viii",
//   "9": "ix",
//   "10": "x",
// };

// const ROMAN_TO_ARABIC = Object.fromEntries(
//   Object.entries(ARABIC_TO_ROMAN).map(([arabic, roman]) => [roman, arabic]),
// ) as Record<string, string>;

// const escapeQueryValue = (value: string) => value.replace(/"/g, '\\"');

// const swapStandaloneNumerals = (
//   value: string,
//   dictionary: Record<string, string>,
// ) =>
//   value.replace(/\b([a-z0-9]+)\b/gi, (token) => {
//     const replacement = dictionary[token.toLowerCase()];
//     return replacement ?? token;
//   });

// const buildSearchPatterns = (value: string) => {
//   const trimmed = value.trim();
//   if (!trimmed) return [];

//   return Array.from(
//     new Set([
//       trimmed,
//       swapStandaloneNumerals(trimmed, ARABIC_TO_ROMAN),
//       swapStandaloneNumerals(trimmed, ROMAN_TO_ARABIC),
//     ]),
//   );
// };

// export async function POST(req: Request) {
//   try {
//     const { query, year, includeUnreleased, category } = await req.json();

//     const normalizedQuery = typeof query === "string" ? query.trim() : "";
//     const normalizedCategory =
//       typeof category === "string" ? category.trim().toLowerCase() : "";
//     const isMostAnticipated = normalizedCategory === "most anticipated game";
//     const parsedYear = Number(year);
//     const hasYear = Number.isFinite(parsedYear) && parsedYear >= 1970;
//     const allowTbaForMostAnticipated =
//       isMostAnticipated && Boolean(includeUnreleased);
//     const sortClause = isMostAnticipated
//       ? allowTbaForMostAnticipated
//         ? "hypes desc"
//         : "total_rating desc"
//       : "total_rating desc";
//     const limit = 500;
//     const startOfYear = hasYear
//       ? Math.floor(new Date(parsedYear, 0, 1).getTime() / 1000)
//       : null;
//     const endOfYear = hasYear
//       ? Math.floor(new Date(parsedYear, 11, 31, 23, 59, 59).getTime() / 1000)
//       : null;

//     if (!normalizedQuery && !hasYear) {
//       return NextResponse.json([]);
//     }

//     const whereParts = ["cover != null", "version_parent = null"];

//     if (!isMostAnticipated) {
//       whereParts.push("(game_type = 0 | game_type = 8 | game_type = 9)");
//     }

//     if (hasYear && startOfYear && endOfYear) {
//       if (isMostAnticipated) {
//         whereParts.push(
//           allowTbaForMostAnticipated
//             ? `((first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}) | first_release_date = null)`
//             : `first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}`,
//         );
//       } else if (includeUnreleased) {
//         whereParts.push(
//           `((first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}) | first_release_date = null)`,
//         );
//       } else {
//         whereParts.push(
//           `first_release_date >= ${startOfYear} & first_release_date <= ${endOfYear}`,
//         );
//       }
//     }

//     if (!isMostAnticipated && hasYear && !includeUnreleased) {
//       const now = Math.floor(Date.now() / 1000);
//       whereParts.push(`first_release_date <= ${now}`);
//     }

//     if (normalizedQuery) {
//       const searchPatterns = buildSearchPatterns(normalizedQuery).map(
//         (pattern) => `name ~ *"${escapeQueryValue(pattern)}"*`,
//       );
//       whereParts.push(
//         searchPatterns.length === 1
//           ? searchPatterns[0]
//           : `(${searchPatterns.join(" | ")})`,
//       );
//     }

//     const baseQuery = [
//       "fields",
//       "  id,",
//       "  name,",
//       "  cover.url,",
//       "  first_release_date,",
//       "  hypes,",
//       "  rating,",
//       "  total_rating,",
//       "  version_parent,",
//       "  game_type;",
//       `where ${whereParts.join(" & ")};`,
//       `sort ${sortClause};`,
//     ].join("\n");

//     const shouldPageYearResults = !normalizedQuery && !isMostAnticipated;

//     if (!shouldPageYearResults) {
//       const games = await igdbGamesQuery(`
// ${baseQuery}
// limit ${limit};
// `);
//       return NextResponse.json(Array.isArray(games) ? games : []);
//     }

//     const batches = await Promise.all(
//       [0, 500, 1000].map((offset) =>
//         igdbGamesQuery(`
// ${baseQuery}
// limit 500;
// offset ${offset};
// `),
//       ),
//     );

//     const merged = batches.flat();
//     const deduped = Array.from(
//       new Map(
//         merged
//           .filter((game) => game && typeof game === "object")
//           .map((game) => [String((game as { id?: number }).id), game]),
//       ).values(),
//     );

//     return NextResponse.json(deduped);
//   } catch (err) {
//     console.error("IGDB AWARDS SEARCH ERROR:", err);
//     return NextResponse.json([]);
//   }
// }
