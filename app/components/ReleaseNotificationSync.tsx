"use client";

import { useEffect, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import {
  formatReleaseDate,
  hasConfirmedReleaseDay,
  type ReleaseDatePrecision,
} from "@/app/lib/releaseDates";

type Game = {
  id: string;
  name: string;
  status?: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };
};

type ReleaseStateDoc = {
  releaseDateKey?: unknown;
  lastNotifiedTransitionKey?: unknown;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dateFromKey = (value: string | null | undefined) => {
  if (!value) return null;

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;

  const parsed = new Date(y, m - 1, d);
  parsed.setHours(0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatReleaseLabel = (value: Date | null) => {
  if (!value) return "TBA";

  return formatReleaseDate(value, null);
};

export default function ReleaseNotificationSync() {
  const { user } = useUser();
  const { games, gamesLoading } = useGames();
  const uid = user?.uid;
  const previousReleaseKeysRef = useRef<Map<string, string | null> | null>(
    null,
  );
  const previousUidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousUidRef.current !== uid) {
      previousUidRef.current = uid;
      previousReleaseKeysRef.current = null;
    }
  }, [uid]);

  useEffect(() => {
    if (!uid || gamesLoading) return;

    let cancelled = false;

    const syncReleaseNotifications = async () => {
      const releaseStateRef = collection(
        db,
        "users",
        uid,
        "notificationReleaseState",
      );
      const releaseStateSnap = await getDocs(releaseStateRef);
      const persistedReleaseState = new Map<
        string,
        {
          releaseDateKey: string | null;
          lastNotifiedTransitionKey: string | null;
        }
      >();

      for (const docSnap of releaseStateSnap.docs) {
        const data = docSnap.data() as ReleaseStateDoc;
        persistedReleaseState.set(docSnap.id, {
          releaseDateKey:
            typeof data.releaseDateKey === "string"
              ? data.releaseDateKey
              : null,
          lastNotifiedTransitionKey:
            typeof data.lastNotifiedTransitionKey === "string"
              ? data.lastNotifiedTransitionKey
              : null,
        });
      }

      const previousReleaseKeys = previousReleaseKeysRef.current;
      const useInMemoryBaseline = previousReleaseKeys !== null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const todayKey = dateKey(today);
      const tomorrowKey = dateKey(tomorrow);
      const dayMs = 24 * 60 * 60 * 1000;

      const writes: Array<{
        id: string;
        type: "game_release" | "game_release_change";
        gameId: string;
        gameName: string;
        gameCover?: string;
        releaseDate: Date | null;
        message: string;
      }> = [];
      const currentReleaseKeys = new Map<string, string | null>();
      const stateUpdates = new Map<
        string,
        { releaseDateKey: string | null; lastNotifiedTransitionKey?: string }
      >();
      const trackedGameIds = new Set<string>();

      for (const game of games as Game[]) {
        if (game.status !== "Want To Play") continue;

        const gameId = String(game.id);
        trackedGameIds.add(gameId);

        const parsedRelease = toDate(game.igdb?.releaseDate);
        const normalizedRelease = parsedRelease
          ? new Date(parsedRelease)
          : null;
        if (normalizedRelease) {
          normalizedRelease.setHours(0, 0, 0, 0);
        }

        const releaseKey = normalizedRelease
          ? dateKey(normalizedRelease)
          : null;
        currentReleaseKeys.set(gameId, releaseKey);

        const persistedState = persistedReleaseState.get(gameId) ?? {
          releaseDateKey: null,
          lastNotifiedTransitionKey: null,
        };
        const previousReleaseKey = useInMemoryBaseline
          ? previousReleaseKeys.get(gameId)
          : persistedState.releaseDateKey;
        const hasKnownPrevious = useInMemoryBaseline
          ? previousReleaseKeys.has(gameId)
          : persistedReleaseState.has(gameId);

        let nextLastNotifiedTransitionKey =
          persistedState.lastNotifiedTransitionKey;

        if (previousReleaseKey !== releaseKey && hasKnownPrevious) {
          const previousReleaseDate = dateFromKey(previousReleaseKey);
          const transitionKey = `${previousReleaseKey ?? "tba"}->${releaseKey ?? "tba"}`;
          let message: string | null = null;
          const hasConfirmedPreviousDay =
            hasConfirmedReleaseDay(previousReleaseDate);
          const hasConfirmedCurrentDay = hasConfirmedReleaseDay(
            normalizedRelease,
            game.igdb?.releaseDatePrecision,
          );

          if (previousReleaseKey === null && normalizedRelease) {
            message = `Release date announced: ${formatReleaseLabel(normalizedRelease)}.`;
          } else if (
            previousReleaseDate &&
            normalizedRelease &&
            !hasConfirmedPreviousDay &&
            hasConfirmedCurrentDay
          ) {
            message = `Release date announced: ${formatReleaseLabel(normalizedRelease)}.`;
          } else if (previousReleaseDate && normalizedRelease) {
            if (normalizedRelease.getTime() < previousReleaseDate.getTime()) {
              message = `Release date moved up from ${formatReleaseLabel(previousReleaseDate)} to ${formatReleaseLabel(normalizedRelease)}.`;
            } else if (
              normalizedRelease.getTime() > previousReleaseDate.getTime()
            ) {
              message = `Release date moved down from ${formatReleaseLabel(previousReleaseDate)} to ${formatReleaseLabel(normalizedRelease)}.`;
            }
          }

          if (
            message &&
            persistedState.lastNotifiedTransitionKey !== transitionKey
          ) {
            const notificationId = `release-change-${gameId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            writes.push({
              id: notificationId,
              type: "game_release_change",
              gameId,
              gameName: game.name,
              gameCover: game.igdb?.cover,
              releaseDate: normalizedRelease
                ? new Date(normalizedRelease)
                : null,
              message,
            });
            nextLastNotifiedTransitionKey = transitionKey;
          }
        }

        if (
          persistedState.releaseDateKey !== releaseKey ||
          persistedState.lastNotifiedTransitionKey !==
            nextLastNotifiedTransitionKey ||
          !persistedReleaseState.has(gameId)
        ) {
          stateUpdates.set(gameId, {
            releaseDateKey: releaseKey,
            lastNotifiedTransitionKey:
              nextLastNotifiedTransitionKey ?? undefined,
          });
        }

        if (!normalizedRelease) {
          continue;
        }

        const diffDays = Math.floor(
          (normalizedRelease.getTime() - today.getTime()) / dayMs,
        );

        if (diffDays < 0) continue;

        if (releaseKey === todayKey && diffDays === 0) {
          writes.push({
            id: `release-${gameId}-${todayKey}`,
            type: "game_release",
            gameId,
            gameName: game.name,
            gameCover: game.igdb?.cover,
            releaseDate: new Date(normalizedRelease),
            message: "Releases today.",
          });
        }

        if (releaseKey === tomorrowKey || diffDays === 1) {
          writes.push({
            id: `release-soon-${gameId}-${releaseKey}`,
            type: "game_release",
            gameId,
            gameName: game.name,
            gameCover: game.igdb?.cover,
            releaseDate: new Date(normalizedRelease),
            message: "Releases tomorrow.",
          });
        }
      }

      const stateDeletes = releaseStateSnap.docs
        .map((docSnap) => docSnap.id)
        .filter((gameId) => !trackedGameIds.has(gameId));

      const dedupedWrites: typeof writes = [];

      for (const entry of writes) {
        if (entry.type === "game_release") {
          const notificationRef = doc(
            db,
            "users",
            uid,
            "notifications",
            entry.id,
          );
          const existing = await getDoc(notificationRef);
          if (existing.exists()) {
            continue;
          }
        }

        dedupedWrites.push(entry);
      }

      if (cancelled) return;

      previousReleaseKeysRef.current = currentReleaseKeys;

      if (!dedupedWrites.length && !stateUpdates.size && !stateDeletes.length)
        return;

      const batch = writeBatch(db);

      for (const entry of dedupedWrites) {
        const notificationRef = doc(
          db,
          "users",
          uid,
          "notifications",
          entry.id,
        );
        batch.set(notificationRef, {
          type: entry.type,
          gameId: entry.gameId,
          gameName: entry.gameName,
          gameCover: entry.gameCover ?? null,
          message: entry.message,
          releaseDate: entry.releaseDate
            ? Timestamp.fromDate(entry.releaseDate)
            : null,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      for (const [gameId, state] of stateUpdates) {
        const stateRef = doc(releaseStateRef, gameId);
        batch.set(stateRef, {
          gameId,
          releaseDateKey: state.releaseDateKey,
          lastNotifiedTransitionKey: state.lastNotifiedTransitionKey ?? null,
          updatedAt: serverTimestamp(),
        });
      }

      for (const gameId of stateDeletes) {
        batch.delete(doc(releaseStateRef, gameId));
      }

      await batch.commit();
    };

    syncReleaseNotifications().catch((err) => {
      if (!cancelled) {
        console.error("Failed to sync release notifications", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [games, gamesLoading, uid]);

  return null;
}

// "use client";

// import { useEffect, useRef } from "react";
// import {
//   collection,
//   doc,
//   getDoc,
//   getDocs,
//   serverTimestamp,
//   Timestamp,
//   writeBatch,
// } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";
// import { useGames } from "@/app/context/GameContext";
// import { useUser } from "@/app/context/UserContext";
// import {
//   formatReleaseDate,
//   hasConfirmedReleaseDay,
//   type ReleaseDatePrecision,
// } from "@/app/lib/releaseDates";

// type Game = {
//   id: string;
//   name: string;
//   status?: string;
//   igdb?: {
//     cover?: string;
//     releaseDate?: unknown;
//     releaseDatePrecision?: ReleaseDatePrecision | null;
//   };
// };

// type ReleaseStateDoc = {
//   releaseDateKey?: unknown;
//   lastNotifiedTransitionKey?: unknown;
// };

// const toDate = (value: unknown): Date | null => {
//   if (!value) return null;

//   if (
//     typeof value === "object" &&
//     value !== null &&
//     "toDate" in value &&
//     typeof (value as { toDate: unknown }).toDate === "function"
//   ) {
//     return (value as { toDate: () => Date }).toDate();
//   }

//   if (value instanceof Date) {
//     return Number.isNaN(value.getTime()) ? null : value;
//   }

//   if (typeof value === "number") {
//     const parsed = new Date(value < 1e12 ? value * 1000 : value);
//     return Number.isNaN(parsed.getTime()) ? null : parsed;
//   }

//   if (typeof value === "string") {
//     const parsed = new Date(value);
//     return Number.isNaN(parsed.getTime()) ? null : parsed;
//   }

//   return null;
// };

// const dateKey = (d: Date) => {
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const day = String(d.getDate()).padStart(2, "0");
//   return `${y}-${m}-${day}`;
// };

// const dateFromKey = (value: string | null | undefined) => {
//   if (!value) return null;

//   const [y, m, d] = value.split("-").map(Number);
//   if (!y || !m || !d) return null;

//   const parsed = new Date(y, m - 1, d);
//   parsed.setHours(0, 0, 0, 0);
//   return Number.isNaN(parsed.getTime()) ? null : parsed;
// };

// const formatReleaseLabel = (value: Date | null) => {
//   if (!value) return "TBA";

//   return formatReleaseDate(value, null);
// };

// export default function ReleaseNotificationSync() {
//   const { user } = useUser();
//   const { games, gamesLoading } = useGames();
//   const uid = user?.uid;
//   const previousReleaseKeysRef = useRef<Map<string, string | null> | null>(
//     null,
//   );
//   const previousUidRef = useRef<string | undefined>(undefined);

//   useEffect(() => {
//     if (previousUidRef.current !== uid) {
//       previousUidRef.current = uid;
//       previousReleaseKeysRef.current = null;
//     }
//   }, [uid]);

//   useEffect(() => {
//     if (!uid || gamesLoading) return;

//     let cancelled = false;

//     const syncReleaseNotifications = async () => {
//       const releaseStateRef = collection(
//         db,
//         "users",
//         uid,
//         "notificationReleaseState",
//       );
//       const releaseStateSnap = await getDocs(releaseStateRef);
//       const persistedReleaseState = new Map<
//         string,
//         {
//           releaseDateKey: string | null;
//           lastNotifiedTransitionKey: string | null;
//         }
//       >();

//       for (const docSnap of releaseStateSnap.docs) {
//         const data = docSnap.data() as ReleaseStateDoc;
//         persistedReleaseState.set(docSnap.id, {
//           releaseDateKey:
//             typeof data.releaseDateKey === "string"
//               ? data.releaseDateKey
//               : null,
//           lastNotifiedTransitionKey:
//             typeof data.lastNotifiedTransitionKey === "string"
//               ? data.lastNotifiedTransitionKey
//               : null,
//         });
//       }

//       const previousReleaseKeys = previousReleaseKeysRef.current;
//       const useInMemoryBaseline = previousReleaseKeys !== null;

//       const today = new Date();
//       today.setHours(0, 0, 0, 0);

//       const tomorrow = new Date(today);
//       tomorrow.setDate(today.getDate() + 1);

//       const todayKey = dateKey(today);
//       const tomorrowKey = dateKey(tomorrow);
//       const dayMs = 24 * 60 * 60 * 1000;

//       const writes: Array<{
//         id: string;
//         type: "game_release" | "game_release_change";
//         gameId: string;
//         gameName: string;
//         gameCover?: string;
//         releaseDate: Date | null;
//         message: string;
//       }> = [];
//       const currentReleaseKeys = new Map<string, string | null>();
//       const stateUpdates = new Map<
//         string,
//         { releaseDateKey: string | null; lastNotifiedTransitionKey?: string }
//       >();
//       const trackedGameIds = new Set<string>();

//       for (const game of games as Game[]) {
//         if (game.status !== "Want To Play") continue;

//         const gameId = String(game.id);
//         trackedGameIds.add(gameId);

//         const parsedRelease = toDate(game.igdb?.releaseDate);
//         const normalizedRelease = parsedRelease
//           ? new Date(parsedRelease)
//           : null;
//         if (normalizedRelease) {
//           normalizedRelease.setHours(0, 0, 0, 0);
//         }

//         const releaseKey = normalizedRelease
//           ? dateKey(normalizedRelease)
//           : null;
//         currentReleaseKeys.set(gameId, releaseKey);

//         const persistedState = persistedReleaseState.get(gameId) ?? {
//           releaseDateKey: null,
//           lastNotifiedTransitionKey: null,
//         };
//         const previousReleaseKey = useInMemoryBaseline
//           ? previousReleaseKeys.get(gameId)
//           : persistedState.releaseDateKey;
//         let nextLastNotifiedTransitionKey =
//           persistedState.lastNotifiedTransitionKey;

//         if (previousReleaseKey !== releaseKey) {
//           const previousReleaseDate = dateFromKey(previousReleaseKey);
//           const transitionKey = `${previousReleaseKey ?? "tba"}->${releaseKey ?? "tba"}`;
//           let message: string | null = null;
//           const hasConfirmedPreviousDay =
//             hasConfirmedReleaseDay(previousReleaseDate);
//           const hasConfirmedCurrentDay = hasConfirmedReleaseDay(
//             normalizedRelease,
//             game.igdb?.releaseDatePrecision,
//           );

//           if (previousReleaseKey === null && normalizedRelease) {
//             message = `Release date announced: ${formatReleaseLabel(normalizedRelease)}.`;
//           } else if (
//             previousReleaseDate &&
//             normalizedRelease &&
//             !hasConfirmedPreviousDay &&
//             hasConfirmedCurrentDay
//           ) {
//             message = `Release date announced: ${formatReleaseLabel(normalizedRelease)}.`;
//           } else if (previousReleaseDate && normalizedRelease) {
//             if (normalizedRelease.getTime() < previousReleaseDate.getTime()) {
//               message = `Release date moved up from ${formatReleaseLabel(previousReleaseDate)} to ${formatReleaseLabel(normalizedRelease)}.`;
//             } else if (
//               normalizedRelease.getTime() > previousReleaseDate.getTime()
//             ) {
//               message = `Release date moved down from ${formatReleaseLabel(previousReleaseDate)} to ${formatReleaseLabel(normalizedRelease)}.`;
//             }
//           }

//           if (
//             message &&
//             persistedState.lastNotifiedTransitionKey !== transitionKey
//           ) {
//             const notificationId = `release-change-${gameId}-${previousReleaseKey ?? "tba"}-to-${releaseKey ?? "tba"}`;
//             writes.push({
//               id: notificationId,
//               type: "game_release_change",
//               gameId,
//               gameName: game.name,
//               gameCover: game.igdb?.cover,
//               releaseDate: normalizedRelease
//                 ? new Date(normalizedRelease)
//                 : null,
//               message,
//             });
//             nextLastNotifiedTransitionKey = transitionKey;
//           }
//         }

//         if (
//           persistedState.releaseDateKey !== releaseKey ||
//           persistedState.lastNotifiedTransitionKey !==
//             nextLastNotifiedTransitionKey ||
//           !persistedReleaseState.has(gameId)
//         ) {
//           stateUpdates.set(gameId, {
//             releaseDateKey: releaseKey,
//             lastNotifiedTransitionKey:
//               nextLastNotifiedTransitionKey ?? undefined,
//           });
//         }

//         if (!normalizedRelease) {
//           continue;
//         }

//         const diffDays = Math.floor(
//           (normalizedRelease.getTime() - today.getTime()) / dayMs,
//         );

//         if (diffDays < 0) continue;

//         if (releaseKey === todayKey && diffDays === 0) {
//           writes.push({
//             id: `release-${gameId}-${todayKey}`,
//             type: "game_release",
//             gameId,
//             gameName: game.name,
//             gameCover: game.igdb?.cover,
//             releaseDate: new Date(normalizedRelease),
//             message: "Releases today.",
//           });
//         }

//         if (releaseKey === tomorrowKey || diffDays === 1) {
//           writes.push({
//             id: `release-soon-${gameId}-${releaseKey}`,
//             type: "game_release",
//             gameId,
//             gameName: game.name,
//             gameCover: game.igdb?.cover,
//             releaseDate: new Date(normalizedRelease),
//             message: "Releases tomorrow.",
//           });
//         }
//       }

//       const stateDeletes = releaseStateSnap.docs
//         .map((docSnap) => docSnap.id)
//         .filter((gameId) => !trackedGameIds.has(gameId));

//       const dedupedWrites: typeof writes = [];

//       for (const entry of writes) {
//         const notificationRef = doc(
//           db,
//           "users",
//           uid,
//           "notifications",
//           entry.id,
//         );
//         const existing = await getDoc(notificationRef);
//         if (existing.exists()) {
//           continue;
//         }

//         dedupedWrites.push(entry);
//       }

//       if (cancelled) return;

//       previousReleaseKeysRef.current = currentReleaseKeys;

//       if (!dedupedWrites.length && !stateUpdates.size && !stateDeletes.length)
//         return;

//       const batch = writeBatch(db);

//       for (const entry of dedupedWrites) {
//         const notificationRef = doc(
//           db,
//           "users",
//           uid,
//           "notifications",
//           entry.id,
//         );
//         batch.set(notificationRef, {
//           type: entry.type,
//           gameId: entry.gameId,
//           gameName: entry.gameName,
//           gameCover: entry.gameCover ?? null,
//           message: entry.message,
//           releaseDate: entry.releaseDate
//             ? Timestamp.fromDate(entry.releaseDate)
//             : null,
//           read: false,
//           createdAt: serverTimestamp(),
//         });
//       }

//       for (const [gameId, state] of stateUpdates) {
//         const stateRef = doc(releaseStateRef, gameId);
//         batch.set(stateRef, {
//           gameId,
//           releaseDateKey: state.releaseDateKey,
//           lastNotifiedTransitionKey: state.lastNotifiedTransitionKey ?? null,
//           updatedAt: serverTimestamp(),
//         });
//       }

//       for (const gameId of stateDeletes) {
//         batch.delete(doc(releaseStateRef, gameId));
//       }

//       await batch.commit();
//     };

//     syncReleaseNotifications().catch((err) => {
//       if (!cancelled) {
//         console.error("Failed to sync release notifications", err);
//       }
//     });

//     return () => {
//       cancelled = true;
//     };
//   }, [games, gamesLoading, uid]);

//   return null;
// }
