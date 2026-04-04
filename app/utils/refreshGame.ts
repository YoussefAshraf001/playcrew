import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

type RefreshableGame = {
  name?: string;
  igdb: {
    id: number;
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: unknown;
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
  if (!res.ok) throw new Error("IGDB fetch failed");

  const igdb = (await res.json()) as {
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: number | null;
  };

  const update: Record<string, unknown> = {};
  const diff: RefreshDiff = {};

  const maybeUpdate = (key: string, newVal: unknown, oldVal: unknown) => {
    if (newVal !== undefined && hasMeaningfulChange(newVal, oldVal)) {
      update[key] = newVal;
      diff[key] = { old: oldVal, new: newVal };
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

    maybeUpdate("igdb.releaseDate", nextReleaseDate, game.igdb.releaseDate ?? null);
  }

  if (!Object.keys(update).length) {
    return { update, diff };
  }

  update.lastUpdated = serverTimestamp();
  if (fields.released && update["igdb.releaseDate"] !== undefined) {
    update.recentActionSummary = "Release Date Updated";
  }

  await updateDoc(
    doc(db, "users", userId, "games_igdb", firestoreDocId),
    update,
  );

  return { update, diff };
}
