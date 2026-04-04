"use client";

import { useEffect, useRef } from "react";
import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";

type SyncGame = {
  id: string;
  status?: string;
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

export default function ReleaseDateAutoSync() {
  const { user } = useUser();
  const { games, gamesLoading } = useGames();
  const uid = user?.uid;
  const runningForUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || gamesLoading || !games.length) return;
    if (runningForUidRef.current === uid) return;

    const now = new Date();
    const candidates = (games as SyncGame[]).filter(
      (game): game is SyncGame & RefreshableGame => {
        if (!isRefreshableGame(game)) return false;
        if (game.status === "Completed" || game.status === "Dropped") {
          return false;
        }

        const releaseDate = toDate(game.igdb.releaseDate);
        if (!releaseDate) return true;

        return releaseDate.getTime() >= now.getTime();
      },
    );

    if (!candidates.length) {
      runningForUidRef.current = uid;
      return;
    }

    runningForUidRef.current = uid;
    let cancelled = false;

    const sync = async () => {
      for (const game of candidates) {
        if (cancelled) return;

        try {
          await refreshGameData(
            uid,
            game,
            {
              name: false,
              cover: false,
              genres: false,
              rating: false,
              platforms: false,
              released: true,
            },
            game.id,
          );
        } catch (err) {
          console.error("Failed to auto-sync release date", {
            gameId: game.id,
            igdbId: game.igdb?.id,
            err,
          });
        }
      }
    };

    sync();

    return () => {
      cancelled = true;
    };
  }, [games, gamesLoading, uid]);

  return null;
}
