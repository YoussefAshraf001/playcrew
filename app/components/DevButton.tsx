"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface Props {
  userId: string;
  game: { _docId: string };
  onClose: () => void;
}

interface GameData {
  categoryRatings?: { [key: string]: number };
  name: string;
  igdb: {
    id: number;
    name: string;
    cover?: string;
    genres?: string[];
    platforms?: string[];
    releaseDate?: any;
    rating?: number;
  };
  playtime?: number;
  status?: string;
  favorite?: boolean;
  notes?: string;
  my_rating?: number;
}

const DEV_KEY = "dev_unlock";
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD!;

export default function DevGameEditor({ userId, game, onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState<string[]>(Array(4).fill(""));
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingSavingChanges, setLoadingSavingChanges] = useState(false);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [visible, setVisible] = useState(true);

  /* ------------------ UNLOCK ------------------ */
  useEffect(() => {
    const stored = localStorage.getItem(DEV_KEY);
    if (stored && Date.now() - Number(stored) < 10 * 60 * 1000) {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) {
      const t = setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 50);

      return () => clearTimeout(t);
    }
  }, [unlocked]);

  /* ------------------ LOAD GAME ------------------ */
  useEffect(() => {
    if (!unlocked) return;

    (async () => {
      const snap = await getDoc(
        doc(db, "users", userId, "games_igdb", game._docId),
      );
      if (snap.exists()) {
        setGameData(snap.data() as GameData);
        setLoading(false);
      }
    })();
  }, [unlocked, game._docId]);

  /* ------------------ HELPERS ------------------ */
  const handleCorrectPin = () => {
    localStorage.setItem(DEV_KEY, String(Date.now()));
    setUnlocked(true);
  };

  const updateField = (key: keyof GameData, value: any) => {
    setGameData((p) => (p ? { ...p, [key]: value } : p));
  };

  const updateIGDB = (key: keyof GameData["igdb"], value: any) => {
    setGameData((p) => (p ? { ...p, igdb: { ...p.igdb, [key]: value } } : p));
  };

  const saveChanges = async () => {
    if (!gameData) return;

    setLoadingSavingChanges(true);

    try {
      await updateDoc(doc(db, "users", userId, "games_igdb", game._docId), {
        ...gameData,
        igdb: {
          ...gameData.igdb,
          releaseDate: gameData.igdb.releaseDate ?? null,
        },
        lastUpdated: new Date(),
      });

      toast.success(`Updated ${gameData?.igdb?.name ?? "game"} successfully`);
    } finally {
      setLoadingSavingChanges(false);
      onClose();
    }
  };

  const toLocalDateInput = (value: any) => {
    if (!value) return "";
    let d: Date | null = null;
    if (value?.toDate) d = value.toDate();
    else if (value instanceof Date) d = value;
    else if (typeof value === "number") d = new Date(value * 1000);
    else if (typeof value === "string") {
      const t = new Date(value);
      if (!isNaN(t.getTime())) d = t;
    }
    if (!d) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loadingSavingChanges) {
        setVisible(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadingSavingChanges]);

  /* ------------------ UI ------------------ */

  const pinStyle = {
    WebkitTextSecurity: "disc",
  } as React.CSSProperties & {
    WebkitTextSecurity: string;
  };

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-9999 bg-black/80 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onAnimationComplete={() => {
            if (!visible) onClose();
          }}
        >
          <motion.div
            className="bg-zinc-900 rounded-xl w-full max-w-[760px] p-6"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* PIN */}
            {!unlocked && (
              <div className="relative w-full flex flex-col items-center gap-6">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute right-0 top-0 text-zinc-400 hover:text-white text-3xl transition"
                >
                  ✕
                </button>

                {/* Title */}
                <h2 className="text-xl font-bold text-white">
                  Enter Developer PIN
                </h2>

                {/* PIN Inputs */}
                <div className="flex gap-3">
                  {pin.map((_, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputsRef.current[i] = el!;
                      }}
                      type="text"
                      inputMode="text"
                      autoComplete="new-password"
                      name={`pin-${i}-${Math.random()}`}
                      maxLength={1}
                      className="w-12 h-12 text-center bg-zinc-800 text-white text-xl rounded tracking-widest"
                      style={pinStyle}
                      value={pin[i]}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        if (!v) return;

                        const next = [...pin];
                        next[i] = v;
                        setPin(next);

                        if (i < 3) inputsRef.current[i + 1]?.focus();

                        if (next.join("") === DEV_PASSWORD) handleCorrectPin();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace") {
                          e.preventDefault();

                          const next = [...pin];

                          if (next[i]) {
                            next[i] = "";
                            setPin(next);
                          } else if (i > 0) {
                            next[i - 1] = "";
                            setPin(next);
                            inputsRef.current[i - 1]?.focus();
                          }
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* LOADING */}
            {unlocked && loading && (
              <div className="flex justify-center items-center gap-2 w-[760px]">
                <span className="loading loading-spinner loading-xs" />
              </div>
            )}

            {/* EDITOR */}
            {unlocked && gameData && (
              <>
                {/* GAME INFO */}

                <hr className="w-full py-2 text-zinc-700" />

                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Game Info
                </h3>

                <div className="grid grid-cols-[200px_1fr] gap-6">
                  <div className="bg-zinc-800 rounded overflow-hidden">
                    {gameData.igdb.cover ? (
                      <img
                        src={gameData.igdb.cover}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-500">
                        No Cover
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-400">Title</span>
                      <input
                        className="bg-zinc-800 p-2 rounded"
                        value={gameData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-400">IGDB ID</span>
                      <input
                        className="bg-zinc-800 p-2 rounded"
                        value={gameData.igdb.id}
                        onChange={(e) => updateIGDB("id", e.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-400">Cover URL</span>
                      <input
                        className="bg-zinc-800 p-2 rounded"
                        value={gameData.igdb.cover || ""}
                        onChange={(e) => updateIGDB("cover", e.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-400">
                        Release Date
                      </span>
                      <input
                        type="date"
                        className="bg-zinc-800 p-2 rounded"
                        value={toLocalDateInput(gameData.igdb.releaseDate)}
                        onChange={(e) =>
                          updateIGDB(
                            "releaseDate",
                            e.target.value ? new Date(e.target.value) : null,
                          )
                        }
                      />
                    </label>
                  </div>
                </div>

                <hr className="w-full py-2 mt-5 text-zinc-700" />

                {/* RATINGS */}
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Ratings
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400">IGDB Rating</span>
                    <input
                      className="bg-zinc-800 p-2 rounded"
                      value={gameData.igdb.rating ?? ""}
                      placeholder="N/A"
                      onChange={(e) =>
                        updateIGDB("rating", Number(e.target.value))
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400">My Rating</span>
                    <input
                      className="bg-zinc-800 p-2 rounded"
                      value={gameData.my_rating ?? ""}
                      onChange={(e) =>
                        updateField(
                          "my_rating",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                </div>

                <hr className="w-full py-2 mt-5 text-zinc-700" />

                {/* CATEGORY RATINGS */}
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Category Ratings
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(gameData.categoryRatings || {}).map(
                    ([k, v]) => (
                      <label key={k} className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400 capitalize">
                          {k}
                        </span>
                        <input
                          className="bg-zinc-800 p-2 rounded"
                          value={v}
                          onChange={(e) =>
                            setGameData((p) =>
                              p
                                ? {
                                    ...p,
                                    categoryRatings: {
                                      ...p.categoryRatings,
                                      [k]: Number(e.target.value),
                                    },
                                  }
                                : p,
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>

                <hr className="w-full py-2 mt-5 text-zinc-700" />

                {/* NOTES */}
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Notes
                </h3>

                <textarea
                  className="w-full bg-zinc-800 p-3 rounded min-h-[120px] placeholder:text-zinc-500 focus:outline-none focus:ring-0"
                  value={gameData.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Penny for your thoughts?"
                />

                {/* ACTIONS */}
                <div className="flex justify-center gap-3 mt-6">
                  <button
                    onClick={onClose}
                    disabled={loadingSavingChanges}
                    className="bg-zinc-700 px-4 py-2 rounded-full"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveChanges}
                    disabled={loadingSavingChanges}
                    className="bg-cyan-500 text-black rounded-full w-24 h-10 flex items-center justify-center"
                  >
                    {loadingSavingChanges ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
