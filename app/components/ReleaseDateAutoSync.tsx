"use client";

import { useEffect, useRef } from "react";
import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";
import { useSync } from "../context/SyncContext";
import type { RefreshBlockField } from "@/app/types/trackedGame";

type SyncGame = {
  id: string;
  status?: string;
  preReleaseAccess?: unknown;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;
  igdb?: {
    id?: number;
    name?: string;
    cover?: string;
    genres?: unknown;
    rating?: number | null;
    platforms?: unknown;
    releaseDate?: unknown;
  };
};

const isRefreshableGame = (
  game: SyncGame,
): game is SyncGame & RefreshableGame => {
  return typeof game.igdb?.id === "number";
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

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
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

const RELEASE_SYNC_INTERVAL_KEY = "playcrew-release-sync-interval-hours";
const RELEASE_SYNC_LAST_RUN_KEY = "playcrew-release-sync-last-run";
const RELEASE_SYNC_INTERVAL_OPTIONS = [8, 12, 24, 48] as const;
const DEFAULT_RELEASE_SYNC_HOURS = 48;

const getReleaseSyncInterval = () => {
  if (typeof window === "undefined") {
    return DEFAULT_RELEASE_SYNC_HOURS;
  }

  const stored = Number(window.localStorage.getItem(RELEASE_SYNC_INTERVAL_KEY));

  return RELEASE_SYNC_INTERVAL_OPTIONS.includes(
    stored as (typeof RELEASE_SYNC_INTERVAL_OPTIONS)[number],
  )
    ? stored
    : DEFAULT_RELEASE_SYNC_HOURS;
};

const shouldRunReleaseSync = () => {
  if (typeof window === "undefined") return false;

  const intervalHours = getReleaseSyncInterval();
  const lastRun = Number(
    window.localStorage.getItem(RELEASE_SYNC_LAST_RUN_KEY),
  );

  if (!lastRun || Number.isNaN(lastRun)) {
    return true;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  return Date.now() - lastRun >= intervalMs;
};

const markReleaseSyncCompleted = () => {
  localStorage.setItem(RELEASE_SYNC_LAST_RUN_KEY, String(Date.now()));
};

export default function ReleaseDateAutoSync() {
  const { user } = useUser();
  const {
    setIsSyncingReleaseDates,
    setSyncCurrent,
    setSyncTotal,
    setCurrentGameName,
    releaseSyncRequest,
  } = useSync();
  const { games, gamesLoading } = useGames();
  const uid = user?.uid;
  const runningForUidRef = useRef<string | null>(null);
  const handledForceRequestRef = useRef(0);

  useEffect(() => {
    if (!uid || gamesLoading || !games.length) return;
    const isForcedSync = releaseSyncRequest > handledForceRequestRef.current;
    if (runningForUidRef.current === uid && !isForcedSync) return;
    if (!isForcedSync && !shouldRunReleaseSync()) return;

    const today = new Date();
    if (isForcedSync) {
      handledForceRequestRef.current = releaseSyncRequest;
    }
    today.setHours(0, 0, 0, 0);

    const candidates = (games as SyncGame[]).filter(
      (game): game is SyncGame & RefreshableGame => {
        if (game.refreshExcluded) return false;
        if (game.status !== "Want To Play" && !game.preReleaseAccess) {
          return false;
        }
        if (!isRefreshableGame(game)) return false;

        const releaseDate = toDate(game.igdb.releaseDate);

        // TBA / unknown release date = Unreleased
        if (!releaseDate) return true;

        releaseDate.setHours(0, 0, 0, 0);

        // Only future releases are still Unreleased.
        return releaseDate.getTime() > today.getTime();
      },
    );

    if (!candidates.length) {
      markReleaseSyncCompleted();
      runningForUidRef.current = uid;
      return;
    }
    runningForUidRef.current = uid;

    const sync = async () => {
      setIsSyncingReleaseDates(true);
      setSyncCurrent(0);
      setSyncTotal(candidates.length);

      let current = 0;

      try {
        for (const game of candidates) {
          current++;
          setSyncCurrent(current);

          try {
            setCurrentGameName(game.igdb?.name ?? "Unknown Game");
            await refreshGameData(
              uid,
              game,
              {
                name: true,
                cover: true,
                genres: false,
                rating: true,
                platforms: true,
                released: true,
              },
              game.id,
            );
          } catch (err) {
            console.error("Failed to refresh release date", {
              gameId: game.id,
              gameName: game.igdb?.name,
              err,
            });
          }
        }

        markReleaseSyncCompleted();
      } finally {
        setIsSyncingReleaseDates(false);
        setCurrentGameName("");
      }
    };

    sync();
  }, [games, gamesLoading, uid, releaseSyncRequest]);

  return null;
}

// "use client";

// import { useEffect, useRef } from "react";
// import { useGames } from "@/app/context/GameContext";
// import { useUser } from "@/app/context/UserContext";
// import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";

// type SyncGame = {
//   id: string;
//   status?: string;
//   igdb?: {
//     id?: number;
//     name?: string;
//     cover?: string;
//     genres?: unknown;
//     rating?: number | null;
//     platforms?: unknown;
//     releaseDate?: unknown;
//   };
// };

// const isRefreshableGame = (
//   game: SyncGame,
// ): game is SyncGame & RefreshableGame => {
//   return typeof game.igdb?.id === "number";
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

//   if (
//     typeof value === "object" &&
//     value !== null &&
//     "seconds" in value &&
//     typeof (value as { seconds: unknown }).seconds === "number"
//   ) {
//     return new Date((value as { seconds: number }).seconds * 1000);
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

// export default function ReleaseDateAutoSync() {
//   const { user } = useUser();
//   const { games, gamesLoading } = useGames();
//   const uid = user?.uid;
//   const runningForUidRef = useRef<string | null>(null);

//   useEffect(() => {
//     if (!uid || gamesLoading || !games.length) return;
//     if (runningForUidRef.current === uid) return;

//     const now = new Date();
//     const candidates = (games as SyncGame[]).filter(
//       (game): game is SyncGame & RefreshableGame => {
//         if (!isRefreshableGame(game)) return false;
//         if (game.status === "Completed" || game.status === "Dropped") {
//           return false;
//         }

//         const releaseDate = toDate(game.igdb.releaseDate);
//         if (!releaseDate) return true;

//         return releaseDate.getTime() >= now.getTime();
//       },
//     );

//     if (!candidates.length) {
//       runningForUidRef.current = uid;
//       return;
//     }

//     runningForUidRef.current = uid;
//     let cancelled = false;

//     const sync = async () => {
//       for (const game of candidates) {
//         if (cancelled) return;

//         try {
//           await refreshGameData(
//             uid,
//             game,
//             {
//               name: false,
//               cover: false,
//               genres: false,
//               rating: false,
//               platforms: false,
//               released: true,
//             },
//             game.id,
//           );
//         } catch (err) {
//           console.error("Failed to auto-sync release date", {
//             gameId: game.id,
//             igdbId: game.igdb?.id,
//             err,
//           });
//         }
//       }
//     };

//     sync();

//     return () => {
//       cancelled = true;
//     };
//   }, [games, gamesLoading, uid]);

//   return null;
// }

// "use client";

// import { useEffect, useRef } from "react";
// import { useGames } from "@/app/context/GameContext";
// import { useUser } from "@/app/context/UserContext";
// import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";

// type SyncGame = {
//   id: string;
//   status?: string;
//   igdb?: {
//     id?: number;
//     name?: string;
//     cover?: string;
//     genres?: unknown;
//     rating?: number | null;
//     platforms?: unknown;
//     releaseDate?: unknown;
//   };
// };

// const isRefreshableGame = (
//   game: SyncGame,
// ): game is SyncGame & RefreshableGame => {
//   return typeof game.igdb?.id === "number";
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

//   if (
//     typeof value === "object" &&
//     value !== null &&
//     "seconds" in value &&
//     typeof (value as { seconds: unknown }).seconds === "number"
//   ) {
//     return new Date((value as { seconds: number }).seconds * 1000);
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

// export default function ReleaseDateAutoSync() {
//   const { user } = useUser();
//   const { games, gamesLoading } = useGames();
//   const uid = user?.uid;
//   const runningForUidRef = useRef<string | null>(null);

//   useEffect(() => {
//     if (!uid || gamesLoading || !games.length) return;
//     if (runningForUidRef.current === uid) return;

//     const now = new Date();
//     const candidates = (games as SyncGame[]).filter(
//       (game): game is SyncGame & RefreshableGame => {
//         if (!isRefreshableGame(game)) return false;
//         if (game.status === "Completed" || game.status === "Dropped") {
//           return false;
//         }

//         const releaseDate = toDate(game.igdb.releaseDate);
//         if (!releaseDate) return true;

//         return releaseDate.getTime() >= now.getTime();
//       },
//     );

//     if (!candidates.length) {
//       runningForUidRef.current = uid;
//       return;
//     }

//     runningForUidRef.current = uid;
//     let cancelled = false;

//     const sync = async () => {
//       for (const game of candidates) {
//         if (cancelled) return;

//         try {
//           await refreshGameData(
//             uid,
//             game,
//             {
//               name: false,
//               cover: false,
//               genres: false,
//               rating: false,
//               platforms: false,
//               released: true,
//             },
//             game.id,
//           );
//         } catch (err) {
//           console.error("Failed to auto-sync release date", {
//             gameId: game.id,
//             igdbId: game.igdb?.id,
//             err,
//           });
//         }
//       }
//     };

//     sync();

//     return () => {
//       cancelled = true;
//     };
//   }, [games, gamesLoading, uid]);

//   return null;
// }

// "use client";

// import { useEffect, useRef } from "react";
// import { useGames } from "@/app/context/GameContext";
// import { useUser } from "@/app/context/UserContext";
// import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";
// import { useSync } from "../context/SyncContext";

// type SyncGame = {
//   id: string;
//   status?: string;
//   igdb?: {
//     id?: number;
//     name?: string;
//     cover?: string;
//     genres?: unknown;
//     rating?: number | null;
//     platforms?: unknown;
//     releaseDate?: unknown;
//   };
// };

// const isRefreshableGame = (
//   game: SyncGame,
// ): game is SyncGame & RefreshableGame => {
//   return typeof game.igdb?.id === "number";
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

//   if (
//     typeof value === "object" &&
//     value !== null &&
//     "seconds" in value &&
//     typeof (value as { seconds: unknown }).seconds === "number"
//   ) {
//     return new Date((value as { seconds: number }).seconds * 1000);
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

// const RELEASE_SYNC_INTERVAL_KEY = "playcrew-release-sync-interval-hours";
// const DEFAULT_SYNC_INTERVAL_HOURS = 48;
// const RELEASE_SYNC_INTERVAL_OPTIONS = [8, 12, 24, 48] as const;

// const readReleaseSyncInterval = () => {
//   if (typeof window === "undefined") return DEFAULT_SYNC_INTERVAL_HOURS;
//   const stored = window.localStorage.getItem(RELEASE_SYNC_INTERVAL_KEY);
//   const parsed = Number(stored);
//   return RELEASE_SYNC_INTERVAL_OPTIONS.includes(
//     parsed as (typeof RELEASE_SYNC_INTERVAL_OPTIONS)[number],
//   )
//     ? parsed
//     : DEFAULT_SYNC_INTERVAL_HOURS;
// };

// export default function ReleaseDateAutoSync() {
//   const { user } = useUser();
//   const {
//     setIsSyncingReleaseDates,
//     setSyncCurrent,
//     setSyncTotal,
//     setCurrentGameName,
//   } = useSync();
//   const { games, gamesLoading } = useGames();
//   const uid = user?.uid;
//   const runningForUidRef = useRef<string | null>(null);

//   useEffect(() => {
//     if (!uid || gamesLoading || !games.length) return;
//     if (runningForUidRef.current === uid) return;

//     const now = new Date();
//     const candidates = (games as SyncGame[]).filter(
//       (game): game is SyncGame & RefreshableGame => {
//         if (!isRefreshableGame(game)) return false;
//         if (game.status === "Completed" || game.status === "Dropped") {
//           return false;
//         }

//         const releaseDate = toDate(game.igdb.releaseDate);
//         if (!releaseDate) return true;

//         return releaseDate.getTime() >= now.getTime();
//       },
//     );

//     if (!candidates.length) {
//       runningForUidRef.current = uid;
//       return;
//     }

//     const LAST_SYNC_KEY = `release-date-sync-${uid}`;
//     const lastSync = localStorage.getItem(LAST_SYNC_KEY);
//     const syncIntervalHours = readReleaseSyncInterval();

//     if (lastSync) {
//       const hoursSinceSync = (Date.now() - Number(lastSync)) / (1000 * 60 * 60);

//       if (hoursSinceSync < syncIntervalHours) {
//         runningForUidRef.current = uid;
//         return;
//       }
//     }

//     runningForUidRef.current = uid;
//     let cancelled = false;

//     const sync = async () => {
//       setIsSyncingReleaseDates(true);
//       setSyncCurrent(0);
//       setSyncTotal(candidates.length);

//       let failedCount = 0;
//       let current = 0;

//       try {
//         for (const game of candidates) {
//           if (cancelled) return;

//           current++;
//           setSyncCurrent(current);

//           try {
//             setCurrentGameName(game.igdb?.name ?? "Unknown Game");
//             await refreshGameData(
//               uid,
//               game,
//               {
//                 name: false,
//                 cover: false,
//                 genres: false,
//                 rating: false,
//                 platforms: false,
//                 released: true,
//               },
//               game.id,
//             );
//           } catch (err) {
//             failedCount++;
//             console.error("Failed to refresh a release date", {
//               gameId: game.id,
//               gameName: game.igdb?.name,
//               err,
//             });
//           }
//         }
//       } finally {
//         if (!cancelled) {
//           localStorage.setItem(
//             `release-date-sync-${uid}`,
//             Date.now().toString(),
//           );
//         }

//         setIsSyncingReleaseDates(false);
//         setCurrentGameName("");
//       }
//     };

//     sync();

//     return () => {
//       cancelled = true;
//     };
//   }, [games, gamesLoading, uid]);

//   return null;
// }

// // "use client";

// // import { useEffect, useRef } from "react";
// // import { useGames } from "@/app/context/GameContext";
// // import { useUser } from "@/app/context/UserContext";
// // import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";

// // type SyncGame = {
// //   id: string;
// //   status?: string;
// //   igdb?: {
// //     id?: number;
// //     name?: string;
// //     cover?: string;
// //     genres?: unknown;
// //     rating?: number | null;
// //     platforms?: unknown;
// //     releaseDate?: unknown;
// //   };
// // };

// // const isRefreshableGame = (
// //   game: SyncGame,
// // ): game is SyncGame & RefreshableGame => {
// //   return typeof game.igdb?.id === "number";
// // };

// // const toDate = (value: unknown): Date | null => {
// //   if (!value) return null;

// //   if (
// //     typeof value === "object" &&
// //     value !== null &&
// //     "toDate" in value &&
// //     typeof (value as { toDate: unknown }).toDate === "function"
// //   ) {
// //     return (value as { toDate: () => Date }).toDate();
// //   }

// //   if (value instanceof Date) {
// //     return Number.isNaN(value.getTime()) ? null : value;
// //   }

// //   if (
// //     typeof value === "object" &&
// //     value !== null &&
// //     "seconds" in value &&
// //     typeof (value as { seconds: unknown }).seconds === "number"
// //   ) {
// //     return new Date((value as { seconds: number }).seconds * 1000);
// //   }

// //   if (typeof value === "number") {
// //     const parsed = new Date(value < 1e12 ? value * 1000 : value);
// //     return Number.isNaN(parsed.getTime()) ? null : parsed;
// //   }

// //   if (typeof value === "string") {
// //     const parsed = new Date(value);
// //     return Number.isNaN(parsed.getTime()) ? null : parsed;
// //   }

// //   return null;
// // };

// // export default function ReleaseDateAutoSync() {
// //   const { user } = useUser();
// //   const { games, gamesLoading } = useGames();
// //   const uid = user?.uid;
// //   const runningForUidRef = useRef<string | null>(null);

// //   useEffect(() => {
// //     if (!uid || gamesLoading || !games.length) return;
// //     if (runningForUidRef.current === uid) return;

// //     const now = new Date();
// //     const candidates = (games as SyncGame[]).filter(
// //       (game): game is SyncGame & RefreshableGame => {
// //         if (!isRefreshableGame(game)) return false;
// //         if (game.status === "Completed" || game.status === "Dropped") {
// //           return false;
// //         }

// //         const releaseDate = toDate(game.igdb.releaseDate);
// //         if (!releaseDate) return true;

// //         return releaseDate.getTime() >= now.getTime();
// //       },
// //     );

// //     if (!candidates.length) {
// //       runningForUidRef.current = uid;
// //       return;
// //     }

// //     runningForUidRef.current = uid;
// //     let cancelled = false;

// //     const sync = async () => {
// //       for (const game of candidates) {
// //         if (cancelled) return;

// //         try {
// //           await refreshGameData(
// //             uid,
// //             game,
// //             {
// //               name: false,
// //               cover: false,
// //               genres: false,
// //               rating: false,
// //               platforms: false,
// //               released: true,
// //             },
// //             game.id,
// //           );
// //         } catch (err) {
// //           console.error("Failed to auto-sync release date", {
// //             gameId: game.id,
// //             igdbId: game.igdb?.id,
// //             err,
// //           });
// //         }
// //       }
// //     };

// //     sync();

// //     return () => {
// //       cancelled = true;
// //     };
// //   }, [games, gamesLoading, uid]);

// //   return null;
// // }
