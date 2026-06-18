import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";

export type RefreshableGame = {
  name?: string;
  igdb: {
    id: number;
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: unknown;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };
};

type RefreshDiff = Record<string, { old: unknown; new: unknown }>;

const toComparableDate = (value: unknown): number | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate().getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const hasMeaningfulChange = (nextValue: unknown, previousValue: unknown) => {
  if (nextValue == null && previousValue == null) {
    return false;
  }

  const nextDate = toComparableDate(nextValue);
  const previousDate = toComparableDate(previousValue);

  if (nextDate !== null || previousDate !== null) {
    return nextDate !== previousDate;
  }

  return nextValue !== previousValue;
};

export async function refreshGameData(
  userId: string,
  game: RefreshableGame,
  fields: Record<string, boolean>,
  firestoreDocId: string,
) {
  const res = await fetch(`/api/igdb/${game.igdb.id}`);

  if (!res.ok) {
    throw new Error("IGDB fetch failed");
  }

  const igdb = (await res.json()) as {
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: number | null;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };

  const update: Record<string, unknown> = {};
  const diff: RefreshDiff = {};

  const maybeUpdate = (key: string, newVal: unknown, oldVal: unknown) => {
    if (newVal !== undefined && hasMeaningfulChange(newVal, oldVal)) {
      update[key] = newVal;
      diff[key] = {
        old: oldVal,
        new: newVal,
      };
    }
  };

  if (fields.name) {
    maybeUpdate("igdb.name", igdb.name, game.igdb.name);
    maybeUpdate("name", igdb.name, game.name);
  }

  if (fields.cover) {
    maybeUpdate("igdb.cover", igdb.cover, game.igdb.cover);
  }

  if (fields.genres) {
    maybeUpdate("igdb.genres", igdb.genres, game.igdb.genres);
  }

  if (fields.rating) {
    maybeUpdate("igdb.aggregated_rating", igdb.rating, game.igdb.rating);
  }

  if (fields.platforms) {
    maybeUpdate("igdb.platforms", igdb.platforms, game.igdb.platforms);
  }

  if (fields.released) {
    const nextReleaseDate =
      typeof igdb.releaseDate === "number"
        ? new Date(igdb.releaseDate * 1000)
        : null;

    maybeUpdate(
      "igdb.releaseDate",
      nextReleaseDate,
      game.igdb.releaseDate ?? null,
    );

    maybeUpdate(
      "igdb.releaseDatePrecision",
      igdb.releaseDatePrecision ?? null,
      game.igdb.releaseDatePrecision ?? null,
    );
  }

  const changedFields = Object.keys(diff);

  if (!changedFields.length) {
    return {
      update: {},
      diff: {},
      summary: null,
    };
  }

  const labels: Record<string, string> = {
    name: "Display Name",
    "igdb.name": "Title",
    "igdb.cover": "Cover",
    "igdb.genres": "Genres",
    "igdb.aggregated_rating": "Rating",
    "igdb.platforms": "Platforms",
    "igdb.releaseDate": "Release Date",
  };

  let summary: string;

  if (changedFields.length === 1) {
    summary = `${labels[changedFields[0]] ?? changedFields[0]} Updated`;
  } else if (changedFields.length === 2) {
    summary = `${labels[changedFields[0]] ?? changedFields[0]} & ${
      labels[changedFields[1]] ?? changedFields[1]
    } Updated`;
  } else {
    summary = `${changedFields.length} Fields Updated`;
  }

  update.lastUpdated = serverTimestamp();
  update.recentActionSummary = summary;

  await updateDoc(
    doc(db, "users", userId, "games_igdb", firestoreDocId),
    update,
  );

  return {
    update,
    diff,
    summary,
  };
}
