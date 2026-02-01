"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";

export default function CoverQualityDevPage() {
  const { user } = useUser();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchGames = async () => {
      const snap = await getDocs(
        collection(db, "users", user.uid, "games_igdb"),
      );

      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setGames(list);
      setLoading(false);
    };

    fetchGames();
  }, [user]);

  const updateAll = async (mode: "720p" | "cover") => {
    if (!user) return;

    setProcessing(true);

    const updates = games.map(async (game) => {
      const cover = game?.igdb?.cover;
      if (!cover) return;

      const updated =
        mode === "720p"
          ? cover.replace(/t_[^/]+/, "t_720p")
          : cover.replace(/t_[^/]+/, "t_cover_big");

      await updateDoc(doc(db, "users", user.uid, "games_igdb", game.id), {
        "igdb.cover": updated,
      });

      return {
        ...game,
        igdb: { ...game.igdb, cover: updated },
      };
    });

    const updatedGames = await Promise.all(updates);
    setGames(updatedGames.filter(Boolean));

    setProcessing(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Login required
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading games…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-4">Cover Quality Manager</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => updateAll("720p")}
          disabled={processing}
          className="px-5 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-semibold disabled:opacity-50"
        >
          Apply ALL → t_720p
        </button>

        <button
          onClick={() => updateAll("cover")}
          disabled={processing}
          className="px-5 py-2 rounded bg-zinc-700 hover:bg-zinc-600 font-semibold disabled:opacity-50"
        >
          Revert ALL → t_cover_big
        </button>

        {processing && (
          <span className="text-zinc-400 text-sm self-center">Updating…</span>
        )}
      </div>

      <div className="space-y-4">
        {games.map((game) => {
          const is720p = game.igdb?.cover?.includes("t_720p");

          return (
            <div
              key={game.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-white/10"
            >
              <img
                src={game.igdb?.cover}
                className="w-20 h-28 object-contain rounded bg-black"
                alt={game.name}
              />

              <div className="flex-1">
                <div className="font-semibold">{game.name}</div>
                <div className="text-sm text-zinc-400">
                  {is720p ? "t_720p" : "t_cover_big"}
                </div>
              </div>

              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  is720p
                    ? "bg-green-600/20 text-green-400"
                    : "bg-yellow-600/20 text-yellow-400"
                }`}
              >
                {is720p ? "HQ" : "Default"}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
