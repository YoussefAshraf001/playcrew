"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface TrackedGame {
  id: number;
  name?: string;
  released?: string;
  genres?: { name: string }[];
  platforms?: { name: string; platform?: { name: string } }[];
  publishers?: { name: string }[];
  background_image?: string;
  notes?: string;
  progress?: number;
  status?: string;
  playtime?: number;
  my_rating?: number;
  favorite?: boolean;
  [key: string]: any;
}

interface Props {
  userId: string;
  game: TrackedGame;
  onClose: () => void;
}

type EditableTrackedGameKey = keyof TrackedGame & string;

const FIELDS: { key: EditableTrackedGameKey; label: string }[] = [
  { key: "id", label: "Game Id" },
  { key: "name", label: "Game Name" },
  { key: "background_image", label: "Poster Image" },
  { key: "slug", label: "Game Slug" },
  { key: "released", label: "Release Date" },
  { key: "genres", label: "Genres" },
  { key: "platforms", label: "Platforms" },
  { key: "publishers", label: "Publishers" },
  { key: "metacritic", label: "Metacritic" },
];

const DEV_PASSWORD = "2411";

export default function DevGameEditor({ userId, game, onClose }: Props) {
  const [pin, setPin] = useState<string[]>(Array(DEV_PASSWORD.length).fill(""));
  const [unlocked, setUnlocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [gameData, setGameData] = useState<TrackedGame | null>(null);

  const [tempGenres, setTempGenres] = useState("");
  const [tempPlatforms, setTempPlatforms] = useState("");
  const [tempPublishers, setTempPublishers] = useState("");

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

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

  // Populate temp fields after gameData is loaded
  useEffect(() => {
    if (!gameData) return;

    setTempGenres((gameData.genres || []).map((g) => g.name).join(", "));
    setTempPlatforms(
      (gameData.platforms || [])
        .map((p: any) => p.platform?.name || p.name)
        .join(", ")
    );
    setTempPublishers(
      (gameData.publishers || []).map((p) => p.name).join(", ")
    );
  }, [gameData]);

  if (!gameData) return null;

  const updateField = (field: EditableTrackedGameKey, value: any) => {
    setGameData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveChanges = async () => {
    if (!gameData) return;

    const updatedGameData: TrackedGame = {
      ...gameData,
      genres: tempGenres.split(",").map((s) => ({ name: s.trim() })),
      platforms: tempPlatforms.split(",").map((s) => ({ name: s.trim() })),
      publishers: tempPublishers.split(",").map((s) => ({ name: s.trim() })),
    };

    await updateDoc(doc(db, "users", userId), {
      [`trackedGames.${game.id}`]: updatedGameData,
    });

    setGameData(updatedGameData); // update local state
    handleClose();
    toast.success("Game Updated!");
  };

  const handleClose = () => setIsVisible(false);

  return createPortal(
    <>
      <Toaster containerStyle={{ zIndex: 10001 }} />
      <AnimatePresence
        onExitComplete={() => {
          if (!isVisible) onClose();
        }}
      >
        {isVisible && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex justify-center items-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-zinc-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
            >
              {!unlocked ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-4">
                    Enter DEV PIN
                  </h2>
                  <div className="flex gap-2 justify-center mb-4">
                    {pin.map((p, i) => (
                      <input
                        key={i}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={p ? "*" : ""}
                        ref={(el) => {
                          inputsRef.current[i] = el;
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!/^[0-9]?$/.test(val)) return; // only digits
                          const newPin = [...pin];
                          newPin[i] = val;
                          setPin(newPin);

                          if (val && i < newPin.length - 1) {
                            inputsRef.current[i + 1]?.focus();
                          }

                          if (newPin.join("").length === DEV_PASSWORD.length) {
                            if (newPin.join("") === DEV_PASSWORD) {
                              setUnlocked(true);
                              toast.success("Unlocked!");
                            } else {
                              toast.error("Wrong code!");
                              setPin(Array(DEV_PASSWORD.length).fill(""));
                              inputsRef.current[0]?.focus();
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !pin[i] && i > 0) {
                            inputsRef.current[i - 1]?.focus();
                          }
                        }}
                        className="w-12 h-12 text-center text-white bg-zinc-700 rounded-lg focus:outline-none text-xl"
                        autoComplete="off"
                      />
                    ))}
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <h2 className="text-xl font-bold mb-4 text-white">
                    Developer Mode For - {gameData.name}
                  </h2>

                  {FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex gap-2 items-center mb-2">
                      <span className="text-white w-32">{label}:</span>

                      {key === "favorite" ? (
                        <input
                          type="checkbox"
                          checked={!!gameData[key]}
                          onChange={(e) => updateField(key, e.target.checked)}
                          className="accent-cyan-500"
                        />
                      ) : key === "genres" ? (
                        <input
                          type="text"
                          value={tempGenres}
                          onChange={(e) => setTempGenres(e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-zinc-700 text-white focus:outline-none"
                        />
                      ) : key === "platforms" ? (
                        <input
                          type="text"
                          value={tempPlatforms}
                          onChange={(e) => setTempPlatforms(e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-zinc-700 text-white focus:outline-none"
                        />
                      ) : key === "publishers" ? (
                        <input
                          type="text"
                          value={tempPublishers}
                          onChange={(e) => setTempPublishers(e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-zinc-700 text-white focus:outline-none"
                        />
                      ) : (
                        <input
                          type={
                            typeof gameData[key] === "number"
                              ? "number"
                              : "text"
                          }
                          value={gameData[key] ?? ""}
                          onChange={(e) =>
                            updateField(
                              key,
                              typeof gameData[key] === "number"
                                ? Number(e.target.value)
                                : e.target.value
                            )
                          }
                          className="flex-1 px-2 py-1 rounded bg-zinc-700 text-white focus:outline-none"
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={handleClose}
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
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
