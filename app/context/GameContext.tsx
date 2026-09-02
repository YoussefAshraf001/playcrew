"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  collection,
  deleteField,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "./UserContext";
import type { PlayedOnPlatform } from "@/app/types/trackedGame";
import type { RefreshBlockField } from "@/app/types/trackedGame";
import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";

type Game = {
  id: string;
  name: string;
  igdb?: {
    id?: number;
    name?: string;
    cover?: string;
    releaseDate?: any;
    earlyAccessDate?: unknown;
    earlyAccessDatePrecision?: ReleaseDatePrecision | null;
    fullReleaseDate?: unknown;
    fullReleaseDatePrecision?: ReleaseDatePrecision | null;
    releaseDateKind?: "early-access" | "full-release" | "unknown" | null;
  };
  status?: string;
  playtime?: number | null;
  playedOn?: PlayedOnPlatform | PlayedOnPlatform[] | null;
  notInterested?: boolean;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;
  calendarPrimary?: boolean;
  customReleaseTime?: {
    releasesAt?: unknown;
    timeZone?: string;
    sourceTimeZone?: string;
  } | null;
  review?: { text?: string | null } | null;
};

type GameContextValue = {
  games: Game[];
  gamesLoading: boolean;
};

const GameContext = createContext<GameContextValue>({
  games: [],
  gamesLoading: true,
});

export const useGames = () => useContext(GameContext);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const saveDataCleanupStartedRef = useRef(false);
  const uid = user?.uid as string | undefined;

  useEffect(() => {
    if (!uid) {
      setGames([]);
      setGamesLoading(false);
      return;
    }

    setGamesLoading(true);
    saveDataCleanupStartedRef.current = false;
    const ref = collection(db, "users", uid, "games_igdb");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: Game[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as any) }));
        setGames(list);
        setGamesLoading(false);

        const cleanupKey = `playcrew-save-data-cleanup-v1:${uid}`;
        if (
          !saveDataCleanupStartedRef.current &&
          window.localStorage.getItem(cleanupKey) !== "done"
        ) {
          saveDataCleanupStartedRef.current = true;
          const docsWithSaveData = snap.docs.filter((gameDoc) => {
            const data = gameDoc.data();
            return (
              Object.prototype.hasOwnProperty.call(data, "save") ||
              Object.prototype.hasOwnProperty.call(data, "saveUploads")
            );
          });

          const cleanup = async () => {
            for (let index = 0; index < docsWithSaveData.length; index += 450) {
              const batch = writeBatch(db);
              docsWithSaveData.slice(index, index + 450).forEach((gameDoc) => {
                batch.update(gameDoc.ref, {
                  save: deleteField(),
                  saveUploads: deleteField(),
                });
              });
              await batch.commit();
            }
            window.localStorage.setItem(cleanupKey, "done");
          };

          void cleanup().catch((error) => {
            saveDataCleanupStartedRef.current = false;
            console.error("Failed to remove legacy save-game data", error);
          });
        }
      },
      () => {
        setGames([]);
        setGamesLoading(false);
      },
    );

    return () => unsub();
  }, [uid]);

  return (
    <GameContext.Provider value={{ games, gamesLoading }}>
      {children}
    </GameContext.Provider>
  );
}
