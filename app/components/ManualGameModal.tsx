"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface TrackedGame {
  id?: number | string;
  name?: string;
  released?: string;
  genres?: { name: string }[];
  platforms?: { name: string }[];
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
}

if (!process.env.NEXT_PUBLIC_DEV_PASSWORD) {
  throw new Error("Missing env var NEXT_PUBLIC_DEV_PASSWORD");
}
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD;

export default function ManualGameModal({ userId }: Props) {
  const [pin, setPin] = useState<string[]>(Array(DEV_PASSWORD.length).fill(""));
  const [unlocked, setUnlocked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [gameData, setGameData] = useState<TrackedGame>({
    name: "",
    id: "",
    background_image: "",
    released: "",
    genres: [],
    platforms: [],
    publishers: [],
  });

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handlePinChange = (val: string, index: number) => {
    if (!/^[0-9]?$/.test(val)) return;
    const newPin = [...pin];
    newPin[index] = val;
    setPin(newPin);

    if (val && index < newPin.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newPin.join("") === DEV_PASSWORD) {
      setUnlocked(true);
      toast.success("Unlocked!");
    } else if (newPin.join("").length === DEV_PASSWORD.length) {
      toast.error("Wrong code!");
      setPin(Array(DEV_PASSWORD.length).fill(""));
      inputsRef.current[0]?.focus();
    }
  };

  const handleAddGame = async () => {
    if (!gameData.name) {
      toast.error("Game Name is required!");
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", userId));
      const trackedGames = snap.exists() ? snap.data().trackedGames || {} : {};

      const newId = gameData.id || gameData.name;

      await updateDoc(doc(db, "users", userId), {
        [`trackedGames.${newId}`]: gameData,
      });

      toast.success("Game added successfully!");
      setGameData({
        name: "",
        id: "",
        background_image: "",
        released: "",
        genres: [],
        platforms: [],
        publishers: [],
      });
      setUnlocked(false);
      setPin(Array(DEV_PASSWORD.length).fill(""));
      setIsVisible(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add game");
    }
  };

  return (
    <>
      <Toaster containerStyle={{ zIndex: 10001 }} />
      <button
        onClick={() => setIsVisible(true)}
        className="px-4 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400 text-black font-semibold"
      >
        Add Manual Game
      </button>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVisible && (
              <motion.div
                key="modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex justify-center items-center bg-black/80 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
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
                            onChange={(e) => handlePinChange(e.target.value, i)}
                            className="w-12 h-12 text-center text-white bg-zinc-700 rounded-lg focus:outline-none text-xl"
                          />
                        ))}
                      </div>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setIsVisible(false)}
                          className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-white mb-4">
                        Add Manual Game
                      </h2>

                      <input
                        type="text"
                        placeholder="Game Name"
                        value={gameData.name}
                        onChange={(e) =>
                          setGameData({ ...gameData, name: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-zinc-700 text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Game ID (optional)"
                        value={gameData.id}
                        onChange={(e) =>
                          setGameData({ ...gameData, id: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-zinc-700 text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Background Image URL"
                        value={gameData.background_image}
                        onChange={(e) =>
                          setGameData({
                            ...gameData,
                            background_image: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded bg-zinc-700 text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Released Date"
                        value={gameData.released}
                        onChange={(e) =>
                          setGameData({ ...gameData, released: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-zinc-700 text-white focus:outline-none"
                      />

                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          onClick={() => setUnlocked(false)}
                          className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddGame}
                          className="px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400"
                        >
                          Add Game
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
