"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "./UserContext";

type Game = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: any;
  };
  status?: string;
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
  const uid = user?.uid as string | undefined;

  useEffect(() => {
    if (!uid) {
      setGames([]);
      setGamesLoading(false);
      return;
    }

    setGamesLoading(true);
    const ref = collection(db, "users", uid, "games_igdb");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: Game[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as any) }));
        setGames(list);
        setGamesLoading(false);
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
