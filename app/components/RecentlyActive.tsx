"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import PosterImage from "./PosterImages";
import { Game } from "../types/game";
import CollapsiblePanel from "./CollapsiblePanel";
import { motion } from "framer-motion";

interface RecentlyActiveProps {
  userId: string;
  limit?: number;
}

interface TrackedGame extends Game {
  status?: string;
  lastUpdated?: any;
}

export default function RecentlyActive({
  userId,
  limit = 10,
}: RecentlyActiveProps) {
  const [games, setGames] = useState<TrackedGame[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function fetchRecentlyActive() {
      if (!userId) return;
      const snap = await getDoc(doc(db, "users", userId));
      const trackedGames: Record<string, TrackedGame> =
        snap.data()?.trackedGames || {};
      const recent = Object.values(trackedGames)
        .filter((g) => g.status === "Playing" || g.lastUpdated)
        .sort(
          (a, b) =>
            (b.lastUpdated?.seconds || 0) - (a.lastUpdated?.seconds || 0)
        )
        .slice(0, limit);

      setGames(recent);
    }

    fetchRecentlyActive();
  }, [userId, limit]);

  if (!games.length) return null;

  return (
    <CollapsiblePanel
      title="Recently Active"
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      defaultWidth={320}
      collapsedWidth={56}
    >
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 pl-2">
        {games.map((game) => (
          <motion.div
            key={game.id}
            whileHover={{ scale: 1.05, y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="min-w-[140px] sm:min-w-40 md:min-w-[180px] h-[200px] relative rounded-lg overflow-hidden shadow-lg cursor-pointer"
          >
            <PosterImage
              src={game.background_image || "/placeholder-game.jpg"}
              alt={game.name}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 text-white flex flex-col">
              <h3 className="text-sm font-semibold truncate">{game.name}</h3>
              {game.status && (
                <p className="text-xs text-cyan-400 mt-1">{game.status}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
