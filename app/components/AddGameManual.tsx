"use client";

import { useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast from "react-hot-toast";

interface ManualGame {
  name: string;
  released?: string;
  background_image?: string;
  rating?: number;
}

interface AddGameProps {
  userId: string;
  trackedGames: Record<string, any>;
  onAdd?: () => void;
}

export default function AddGameManual({
  userId,
  trackedGames,
  onAdd,
}: AddGameProps) {
  const [open, setOpen] = useState(false);
  const [gameData, setGameData] = useState<ManualGame>({ name: "" });
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!gameData.name.trim()) return toast.error("Game name is required");
    setLoading(true);

    try {
      const ref = doc(db, "users", userId);
      const snap = await getDoc(ref);
      const currentGames = snap.exists() ? snap.data().trackedGames || {} : {};

      const id = Date.now(); // simple unique id
      const newGame = {
        id,
        name: gameData.name,
        released: gameData.released || "TBA",
        background_image: gameData.background_image || "/placeholder-game.jpg",
        rating: gameData.rating || 0,
      };

      await updateDoc(ref, {
        trackedGames: {
          ...currentGames,
          [String(id)]: newGame,
        },
      });

      toast.success(`${gameData.name} added!`);
      setOpen(false);
      setGameData({ name: "" });
      onAdd?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add game.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 rounded-lg font-semibold"
      >
        Add Game
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md space-y-4 text-white">
            <h2 className="text-xl font-bold">Add Game Manually</h2>

            <input
              type="text"
              placeholder="Game Name"
              value={gameData.name}
              onChange={(e) =>
                setGameData({ ...gameData, name: e.target.value })
              }
              className="w-full px-3 py-2 rounded border border-zinc-700 bg-zinc-800 text-white"
            />

            <input
              type="text"
              placeholder="Release Date (optional)"
              value={gameData.released || ""}
              onChange={(e) =>
                setGameData({ ...gameData, released: e.target.value })
              }
              className="w-full px-3 py-2 rounded border border-zinc-700 bg-zinc-800 text-white"
            />

            <input
              type="text"
              placeholder="Background Image URL (optional)"
              value={gameData.background_image || ""}
              onChange={(e) =>
                setGameData({ ...gameData, background_image: e.target.value })
              }
              className="w-full px-3 py-2 rounded border border-zinc-700 bg-zinc-800 text-white"
            />

            <input
              type="number"
              placeholder="Rating (0-10)"
              min={0}
              max={10}
              value={gameData.rating || 0}
              onChange={(e) =>
                setGameData({ ...gameData, rating: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded border border-zinc-700 bg-zinc-800 text-white"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 rounded"
              >
                {loading ? "Adding..." : "Add Game"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
