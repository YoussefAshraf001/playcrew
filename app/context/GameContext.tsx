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

const GameContext = createContext<Game[]>([]);

export const useGames = () => useContext(GameContext);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "games_igdb");

    const unsub = onSnapshot(ref, (snap) => {
      const list: Game[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as any) }));
      setGames(list);
    });

    return () => unsub();
  }, [user]);

  return <GameContext.Provider value={games}>{children}</GameContext.Provider>;
}
