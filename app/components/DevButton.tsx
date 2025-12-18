"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast from "react-hot-toast";

interface TrackedGame {
  id: number;
  [key: string]: any;
}

interface Props {
  userId: string;
  game: TrackedGame;
  onClose: () => void;
  onUnlock?: () => void;
}

const DEV_PATTERN = ["ArrowUp", "ArrowDown", "ArrowUp", "ArrowUp"];

export default function DevGameEditor({
  userId,
  game,
  onClose,
  onUnlock,
}: Props) {
  const [buffer, setBuffer] = useState<string[]>([]);
  const [gameData, setGameData] = useState<TrackedGame | null>(null);

  // Listen for pattern unlock
  useEffect(() => {
    if (!onUnlock) return;
    const onKeyDown = (e: KeyboardEvent) => {
      setBuffer((prev) => {
        const next = [...prev, e.key].slice(-DEV_PATTERN.length);
        if (next.every((k, i) => k === DEV_PATTERN[i])) {
          onUnlock();
          return [];
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onUnlock]);

  // Fetch game data
  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) return;
      const trackedGames = snap.data().trackedGames || {};
      setGameData(trackedGames[String(game.id)]);
    };
    fetchData();
  }, [game.id, userId]);

  if (!gameData) return null;

  const saveChanges = async () => {
    await updateDoc(doc(db, "users", userId), {
      [`trackedGames.${game.id}`]: gameData,
    });
    onClose();
    toast.success("Game Updated!");
  };

  const updateField = (field: string, value: any) => {
    setGameData({ ...gameData, [field]: value });
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex justify-center items-center bg-black/80 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <h2 className="text-xl font-bold mb-4 text-white">
          DEV Editor - {gameData.name}
        </h2>

        {Object.entries(gameData).map(([field, value]) => {
          if (field === "id") return null;
          return (
            <div key={field} className="flex gap-2 items-center">
              <span className="text-white w-24">{field}:</span>
              {typeof value === "boolean" ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updateField(field, e.target.checked)}
                  className="accent-cyan-500"
                />
              ) : (
                <input
                  type={typeof value === "number" ? "number" : "text"}
                  value={value ?? ""}
                  onChange={(e) =>
                    updateField(
                      field,
                      typeof value === "number"
                        ? Number(e.target.value)
                        : e.target.value
                    )
                  }
                  className="flex-1 px-2 py-1 rounded bg-zinc-700 text-white focus:outline-none"
                />
              )}
            </div>
          );
        })}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={saveChanges}
            className="px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
