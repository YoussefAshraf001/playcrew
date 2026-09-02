import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import {
  formatReleaseChangeMessage,
  type ReleaseDatePrecision,
} from "@/app/lib/releaseDates";
import type { RefreshBlockField } from "@/app/types/trackedGame";
import type { IgdbReleaseDateKind } from "@/app/lib/igdbReleasePhases";

export type RefreshableGame = {
  name?: string;
  preReleaseAccess?: unknown;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;
  igdb: {
    id: number;
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: unknown;
    earlyAccessDate?: unknown;
    earlyAccessDatePrecision?: ReleaseDatePrecision | null;
    fullReleaseDate?: unknown;
    fullReleaseDatePrecision?: ReleaseDatePrecision | null;
    releaseDateKind?: IgdbReleaseDateKind | null;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };
};

type RefreshDiff = Record<string, { old: unknown; new: unknown }>;

export const getBlockedRefreshFields = (game: RefreshableGame) => {
  const blocked = new Set<RefreshBlockField>();
  const fields: RefreshBlockField[] = [
    "name",
    "cover",
    "genres",
    "rating",
    "platforms",
    "released",
  ];

  if (game.refreshExcluded) {
    fields.forEach((field) => blocked.add(field));
  } else {
    fields.forEach((field) => {
      if (game.refreshBlockedFields?.[field]) blocked.add(field);
    });
  }

  // This is an explicit cover lock. URL-based detection is unreliable because
  // a user may deliberately choose an alternate image that is still hosted by
  // IGDB, which is custom for their library even though the hostname matches.
  if (game.protectCustomCoverFromRefresh) {
    blocked.add("cover");
  }

  return blocked;
};

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

  if (Array.isArray(nextValue) && Array.isArray(previousValue)) {
    const normalize = (values: unknown[]) =>
      values.map((value) => JSON.stringify(value)).sort();
    const nextValues = normalize(nextValue);
    const previousValues = normalize(previousValue);

    return (
      nextValues.length !== previousValues.length ||
      nextValues.some((value, index) => value !== previousValues[index])
    );
  }

  return nextValue !== previousValue;
};

const normalizeTitleForComparison = (value: unknown) =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : value;

const hasMeaningfulTitleChange = (
  nextValue: unknown,
  previousValue: unknown,
) =>
  normalizeTitleForComparison(nextValue) !==
  normalizeTitleForComparison(previousValue);

const formatList = (values: string[]) => {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const formatRating = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const getStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export async function refreshGameData(
  userId: string,
  game: RefreshableGame,
  fields: Record<string, boolean>,
  firestoreDocId: string,
  options?: { overrideBlockedFields?: boolean },
) {
  const blockedFields = getBlockedRefreshFields(game);
  const effectiveFields = Object.fromEntries(
    Object.entries(fields).map(([field, enabled]) => [
      field,
      enabled &&
        (options?.overrideBlockedFields === true ||
          !blockedFields.has(field as RefreshBlockField)),
    ]),
  );

  if (!Object.values(effectiveFields).some(Boolean)) {
    return { update: {}, diff: {}, summary: null };
  }

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
    earlyAccessDate?: number | null;
    earlyAccessDatePrecision?: ReleaseDatePrecision | null;
    fullReleaseDate?: number | null;
    fullReleaseDatePrecision?: ReleaseDatePrecision | null;
    releaseDateKind?: IgdbReleaseDateKind | null;
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

  const maybeUpdateTitle = (
    key: "name" | "igdb.name",
    newVal: unknown,
    oldVal: unknown,
  ) => {
    if (newVal === undefined || !hasMeaningfulTitleChange(newVal, oldVal)) {
      return;
    }

    update[key] = newVal;

    const normalizedNewTitle = normalizeTitleForComparison(newVal);
    const normalizedOldTitle = normalizeTitleForComparison(oldVal);
    const isCapitalizationOnlyChange =
      typeof normalizedNewTitle === "string" &&
      typeof normalizedOldTitle === "string" &&
      normalizedNewTitle.toLowerCase() === normalizedOldTitle.toLowerCase();

    if (!isCapitalizationOnlyChange) {
      diff[key] = {
        old: oldVal,
        new: newVal,
      };
    }
  };

  if (effectiveFields.name) {
    maybeUpdateTitle("igdb.name", igdb.name, game.igdb.name);
    maybeUpdateTitle("name", igdb.name, game.name);
  }

  if (effectiveFields.cover) {
    maybeUpdate("igdb.cover", igdb.cover, game.igdb.cover);
  }

  if (effectiveFields.genres) {
    maybeUpdate("igdb.genres", igdb.genres, game.igdb.genres);
  }

  if (effectiveFields.rating) {
    // IGDB commonly omits ratings for unreleased or sparsely rated games.
    // Treat a missing rating as unavailable refresh data, not as a deletion of
    // the last known rating saved in the user's library.
    if (typeof igdb.rating === "number" && Number.isFinite(igdb.rating)) {
      maybeUpdate("igdb.rating", igdb.rating, game.igdb.rating);
    }
  }

  if (effectiveFields.platforms) {
    maybeUpdate("igdb.platforms", igdb.platforms, game.igdb.platforms);
  }

  if (effectiveFields.released) {
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

    const nextEarlyAccessDate =
      typeof igdb.earlyAccessDate === "number"
        ? new Date(igdb.earlyAccessDate * 1000)
        : null;
    const nextFullReleaseDate =
      typeof igdb.fullReleaseDate === "number"
        ? new Date(igdb.fullReleaseDate * 1000)
        : null;

    maybeUpdate(
      "igdb.earlyAccessDate",
      nextEarlyAccessDate,
      game.igdb.earlyAccessDate ?? null,
    );
    maybeUpdate(
      "igdb.earlyAccessDatePrecision",
      igdb.earlyAccessDatePrecision ?? null,
      game.igdb.earlyAccessDatePrecision ?? null,
    );
    maybeUpdate(
      "igdb.fullReleaseDate",
      nextFullReleaseDate,
      game.igdb.fullReleaseDate ?? null,
    );
    maybeUpdate(
      "igdb.fullReleaseDatePrecision",
      igdb.fullReleaseDatePrecision ?? null,
      game.igdb.fullReleaseDatePrecision ?? null,
    );
    maybeUpdate(
      "igdb.releaseDateKind",
      igdb.releaseDateKind ?? null,
      game.igdb.releaseDateKind ?? null,
    );
  }

  const changedFields = Object.keys(diff);

  if (!changedFields.length) {
    if (Object.keys(update).length) {
      await updateDoc(
        doc(db, "users", userId, "games_igdb", firestoreDocId),
        update,
      );
    }

    return {
      update,
      diff: {},
      summary: null,
    };
  }

  const normalizedChangedFields = changedFields.filter(
    (field) => field !== "igdb.releaseDatePrecision",
  );

  if (!normalizedChangedFields.length) {
    await updateDoc(
      doc(db, "users", userId, "games_igdb", firestoreDocId),
      update,
    );

    return {
      update,
      diff,
      summary: null,
    };
  }

  const messages: string[] = [];
  const titleChange = diff["igdb.name"] ?? diff.name;
  const nextGameTitle =
    (typeof igdb.name === "string" && igdb.name) ||
    game.name ||
    game.igdb.name ||
    "This game";
  const latestReleaseDate =
    igdb.releaseDate != null
      ? toComparableDate(igdb.releaseDate)
      : toComparableDate(game.igdb.releaseDate);
  const isPlayableRelease =
    Boolean(game.preReleaseAccess) ||
    (latestReleaseDate !== null && latestReleaseDate <= Date.now());

  if (titleChange) {
    const previousTitle = String(titleChange.old ?? "Unknown title");
    const nextTitle = String(titleChange.new ?? nextGameTitle);
    messages.push(`Title changed from “${previousTitle}” to “${nextTitle}”.`);
  }

  if (diff["igdb.cover"]) {
    messages.push(
      diff["igdb.cover"].new
        ? "New cover art is available."
        : "Cover art is no longer available.",
    );
  }

  const ratingChange = diff["igdb.rating"];
  if (ratingChange) {
    const previousRating = formatRating(ratingChange.old);
    const nextRating = formatRating(ratingChange.new);
    messages.push(
      previousRating && nextRating
        ? `IGDB rating changed from ${previousRating} to ${nextRating}.`
        : nextRating
          ? `IGDB rating is now ${nextRating}.`
          : "IGDB rating is no longer available.",
    );
  }

  const platformChange = diff["igdb.platforms"];
  if (platformChange && Array.isArray(platformChange.old)) {
    const previousPlatforms = new Set(
      getStringArray(platformChange.old).map((platform) =>
        platform.toLocaleLowerCase(),
      ),
    );
    const newPlatforms = getStringArray(platformChange.new).filter(
      (platform) => !previousPlatforms.has(platform.toLocaleLowerCase()),
    );
    messages.push(
      newPlatforms.length
        ? isPlayableRelease
          ? `${nextGameTitle} is now available on ${formatList(newPlatforms)}.`
          : `${nextGameTitle} has been announced for ${formatList(newPlatforms)}.`
        : "Platform availability was updated.",
    );
  }

  if (diff["igdb.genres"] && Array.isArray(diff["igdb.genres"].old)) {
    messages.push("Genre information was updated.");
  }

  const releaseChangeMessage =
    "igdb.releaseDate" in diff
      ? formatReleaseChangeMessage({
          gameName: nextGameTitle,
          previousValue: game.igdb.releaseDate,
          nextValue: igdb.releaseDate ?? null,
          previousPrecision: game.igdb.releaseDatePrecision,
          nextPrecision: igdb.releaseDatePrecision ?? null,
        })
      : null;

  if (releaseChangeMessage) messages.push(releaseChangeMessage);

  const summary = messages.join(" ") || "Game information was refreshed.";

  update.lastUpdated = serverTimestamp();
  update.recentActionSummary = summary;
  update.recentActionSource = "refresh";

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

// import {
//   collection,
//   doc,
//   serverTimestamp,
//   setDoc,
//   updateDoc,
// } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";
// import {
//   formatReleaseDate,
//   parseReleaseDate,
//   type ReleaseDatePrecision,
// } from "@/app/lib/releaseDates";

// export type RefreshableGame = {
//   name?: string;
//   igdb: {
//     id: number;
//     name?: string;
//     cover?: string;
//     genres?: unknown;
//     rating?: number | null;
//     platforms?: unknown;
//     releaseDate?: unknown;
//     releaseDatePrecision?: ReleaseDatePrecision | null;
//   };
// };

// type RefreshDiff = Record<string, { old: unknown; new: unknown }>;

// const toComparableDate = (value: unknown): number | null => {
//   if (!value) return null;

//   if (
//     typeof value === "object" &&
//     value !== null &&
//     "toDate" in value &&
//     typeof (value as { toDate: unknown }).toDate === "function"
//   ) {
//     const parsed = (value as { toDate: () => Date }).toDate().getTime();
//     return Number.isNaN(parsed) ? null : parsed;
//   }

//   if (value instanceof Date) {
//     return Number.isNaN(value.getTime()) ? null : value.getTime();
//   }

//   if (typeof value === "number") {
//     const parsed = new Date(value < 1e12 ? value * 1000 : value).getTime();
//     return Number.isNaN(parsed) ? null : parsed;
//   }

//   if (typeof value === "string") {
//     const parsed = new Date(value).getTime();
//     return Number.isNaN(parsed) ? null : parsed;
//   }

//   return null;
// };

// const hasMeaningfulChange = (nextValue: unknown, previousValue: unknown) => {
//   if (nextValue == null && previousValue == null) {
//     return false;
//   }

//   const nextDate = toComparableDate(nextValue);
//   const previousDate = toComparableDate(previousValue);

//   if (nextDate !== null || previousDate !== null) {
//     return nextDate !== previousDate;
//   }

//   return nextValue !== previousValue;
// };

// const getReleaseChangeMessage = (
//   previousValue: unknown,
//   nextValue: unknown,
//   previousPrecision?: ReleaseDatePrecision | null,
//   nextPrecision?: ReleaseDatePrecision | null,
// ) => {
//   const previous = parseReleaseDate(previousValue);
//   const next = parseReleaseDate(nextValue);

//   if (!previous || !next || previous.getTime() === next.getTime()) {
//     return null;
//   }

//   const from = formatReleaseDate(previous, previousPrecision);
//   const to = formatReleaseDate(next, nextPrecision);

//   return next.getTime() < previous.getTime()
//     ? `Release date was pushed up from ${from} to ${to}.`
//     : `Release date was pushed down from ${from} to ${to}.`;
// };

// export async function refreshGameData(
//   userId: string,
//   game: RefreshableGame,
//   fields: Record<string, boolean>,
//   firestoreDocId: string,
// ) {
//   const res = await fetch(`/api/igdb/${game.igdb.id}`);

//   if (!res.ok) {
//     throw new Error("IGDB fetch failed");
//   }

//   const igdb = (await res.json()) as {
//     name?: string;
//     cover?: string;
//     genres?: unknown;
//     rating?: number | null;
//     platforms?: unknown;
//     releaseDate?: number | null;
//     releaseDatePrecision?: ReleaseDatePrecision | null;
//   };

//   const update: Record<string, unknown> = {};
//   const diff: RefreshDiff = {};

//   const maybeUpdate = (key: string, newVal: unknown, oldVal: unknown) => {
//     if (newVal !== undefined && hasMeaningfulChange(newVal, oldVal)) {
//       update[key] = newVal;
//       diff[key] = {
//         old: oldVal,
//         new: newVal,
//       };
//     }
//   };

//   if (fields.name) {
//     maybeUpdate("igdb.name", igdb.name, game.igdb.name);
//     maybeUpdate("name", igdb.name, game.name);
//   }

//   if (fields.cover) {
//     maybeUpdate("igdb.cover", igdb.cover, game.igdb.cover);
//   }

//   if (fields.genres) {
//     maybeUpdate("igdb.genres", igdb.genres, game.igdb.genres);
//   }

//   if (fields.rating) {
//     maybeUpdate("igdb.aggregated_rating", igdb.rating, game.igdb.rating);
//   }

//   if (fields.platforms) {
//     maybeUpdate("igdb.platforms", igdb.platforms, game.igdb.platforms);
//   }

//   if (fields.released) {
//     const nextReleaseDate =
//       typeof igdb.releaseDate === "number"
//         ? new Date(igdb.releaseDate * 1000)
//         : null;

//     maybeUpdate(
//       "igdb.releaseDate",
//       nextReleaseDate,
//       game.igdb.releaseDate ?? null,
//     );

//     maybeUpdate(
//       "igdb.releaseDatePrecision",
//       igdb.releaseDatePrecision ?? null,
//       game.igdb.releaseDatePrecision ?? null,
//     );
//   }

//   const changedFields = Object.keys(diff);

//   if (!changedFields.length) {
//     return {
//       update: {},
//       diff: {},
//       summary: null,
//     };
//   }

//   const normalizedChangedFields =
//     changedFields.includes("igdb.releaseDate") &&
//     changedFields.includes("igdb.releaseDatePrecision")
//       ? changedFields.filter((field) => field !== "igdb.releaseDatePrecision")
//       : changedFields;

//   const labels: Record<string, string> = {
//     name: "Display Name",
//     "igdb.name": "Title",
//     "igdb.cover": "Cover",
//     "igdb.genres": "Genres",
//     "igdb.aggregated_rating": "Rating",
//     "igdb.platforms": "Platforms",
//     "igdb.releaseDate": "Release Date",
//     "igdb.releaseDatePrecision": "Release Date",
//   };

//   let summary: string;

//   if (normalizedChangedFields.length === 1) {
//     summary = `${labels[normalizedChangedFields[0]] ?? normalizedChangedFields[0]} Updated`;
//   } else if (normalizedChangedFields.length === 2) {
//     summary = `${labels[normalizedChangedFields[0]] ?? normalizedChangedFields[0]} & ${
//       labels[normalizedChangedFields[1]] ?? normalizedChangedFields[1]
//     } Updated`;
//   } else {
//     summary = `${normalizedChangedFields.length} Fields Updated`;
//   }

//   const releaseChangeMessage =
//     "igdb.releaseDate" in diff
//       ? getReleaseChangeMessage(
//           game.igdb.releaseDate,
//           igdb.releaseDate ?? null,
//           game.igdb.releaseDatePrecision,
//           igdb.releaseDatePrecision ?? null,
//         )
//       : null;

//   if (releaseChangeMessage) {
//     summary = releaseChangeMessage;
//   }

//   update.lastUpdated = serverTimestamp();
//   update.recentActionSummary = summary;

//   await updateDoc(
//     doc(db, "users", userId, "games_igdb", firestoreDocId),
//     update,
//   );

//   if (releaseChangeMessage) {
//     try {
//       await setDoc(doc(collection(db, "users", userId, "notifications")), {
//         type: "game_release_change",
//         gameId: firestoreDocId,
//         gameName: game.name ?? game.igdb.name ?? "Unknown game",
//         gameCover: game.igdb.cover ?? null,
//         message: releaseChangeMessage,
//         releaseDate: parseReleaseDate(igdb.releaseDate ?? null),
//         read: false,
//         createdAt: serverTimestamp(),
//       });
//     } catch (err) {
//       console.error("Failed to create release-change notification", {
//         gameId: firestoreDocId,
//         gameName: game.name ?? game.igdb.name,
//         err,
//       });
//     }
//   }

//   return {
//     update,
//     diff,
//     summary,
//   };
// }
