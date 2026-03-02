"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import { db } from "@/app/lib/firebase";

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
    releaseDate?: unknown;
    rating?: number;
  };
  playtime?: number;
  progress?: number;
  status?: string;
  favorite?: boolean;
  notes?: string;
  my_rating?: number;
}

const DEV_KEY = "dev_unlock";
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD!;
const DEFAULT_CATEGORY_KEYS = [
  "graphics",
  "gameplay",
  "story",
  "ost",
  "cinematics",
  "voiceActing",
];
const STATUS_OPTIONS = [
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Online",
  "Want To Play",
];

export default function DevGameEditor({ userId, game, onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState<string[]>(Array(4).fill(""));
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [visible, setVisible] = useState(true);
  const isClosingRef = useRef(false);
  const [genresInput, setGenresInput] = useState("");
  const [platformsInput, setPlatformsInput] = useState("");

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 230);
  }, [onClose]);

  useEffect(() => {
    const stored = localStorage.getItem(DEV_KEY);
    if (stored && Date.now() - Number(stored) < 10 * 60 * 1000) {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) {
      const t = setTimeout(() => inputsRef.current[0]?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;

    (async () => {
      const snap = await getDoc(
        doc(db, "users", userId, "games_igdb", game._docId),
      );
      if (snap.exists()) {
        setGameData(snap.data() as GameData);
      }
      setLoading(false);
    })();
  }, [unlocked, userId, game._docId]);

  useEffect(() => {
    if (!gameData) return;
    setGenresInput((gameData.igdb.genres || []).join(", "));
    setPlatformsInput((gameData.igdb.platforms || []).join(", "));
  }, [gameData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        requestClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, requestClose]);

  const categoryKeys = useMemo(() => {
    const currentKeys = Object.keys(gameData?.categoryRatings || {});
    const merged = new Set([...DEFAULT_CATEGORY_KEYS, ...currentKeys]);
    return Array.from(merged);
  }, [gameData?.categoryRatings]);

  const handleCorrectPin = () => {
    localStorage.setItem(DEV_KEY, String(Date.now()));
    setUnlocked(true);
  };

  const updateField = <K extends keyof GameData>(
    key: K,
    value: GameData[K],
  ) => {
    setGameData((p) => (p ? { ...p, [key]: value } : p));
  };

  const updateIGDB = <K extends keyof GameData["igdb"]>(
    key: K,
    value: GameData["igdb"][K],
  ) => {
    setGameData((p) => (p ? { ...p, igdb: { ...p.igdb, [key]: value } } : p));
  };

  const updateCategory = (key: string, value: number) => {
    const bounded = Math.min(10, Math.max(0, Math.round(value)));
    setGameData((p) =>
      p
        ? {
            ...p,
            categoryRatings: {
              ...(p.categoryRatings || {}),
              [key]: bounded,
            },
          }
        : p,
    );
  };

  const parseNumber = (value: string, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getPlaytimeParts = (playtime: number | undefined) => {
    const totalMinutes = Math.max(0, Math.round((playtime || 0) * 60));
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  };

  const updatePlaytimeFromParts = (hours: number, minutes: number) => {
    const safeHours = Math.max(0, Math.floor(hours));
    const safeMinutes = Math.max(0, Math.min(59, Math.floor(minutes)));
    updateField("playtime", safeHours + safeMinutes / 60);
  };

  const toLocalDateInput = (value: unknown) => {
    if (!value) return "";
    let d: Date | null = null;

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      d = (value as { toDate: () => Date }).toDate();
    } else if (value instanceof Date) {
      d = value;
    } else if (typeof value === "number") {
      d = new Date(value * 1000);
    } else if (typeof value === "string") {
      const t = new Date(value);
      if (!isNaN(t.getTime())) d = t;
    }

    if (!d) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };

  const setReleaseDateFromInput = (value: string) => {
    updateIGDB("releaseDate", value ? new Date(value) : null);
  };

  const saveChanges = async () => {
    if (!gameData) return;
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", userId, "games_igdb", game._docId), {
        ...gameData,
        igdb: {
          ...gameData.igdb,
          releaseDate: gameData.igdb.releaseDate ?? null,
          genres: genresInput
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          platforms: platformsInput
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        },
        lastUpdated: new Date(),
      });
      toast.success(`Updated ${gameData.igdb?.name ?? "game"} successfully`);
      requestClose();
    } finally {
      setSaving(false);
    }
  };

  const pinStyle: CSSProperties & { WebkitTextSecurity: string } = {
    WebkitTextSecurity: "disc",
  };

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-5xl h-[88vh] overflow-hidden shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {!unlocked && (
              <div className="relative h-full w-full flex flex-col items-center justify-center gap-6 p-6">
                <button
                  onClick={requestClose}
                  className="absolute right-4 top-4 text-zinc-400 hover:text-white text-2xl transition"
                >
                  x
                </button>
                <h2 className="text-xl font-bold text-white">
                  Enter Developer PIN
                </h2>
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
                      name={`pin-${i}`}
                      maxLength={1}
                      className="w-12 h-12 text-center bg-zinc-800 text-white text-xl rounded tracking-widest border border-white/10"
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

            {unlocked && loading && (
              <div className="h-full flex items-center justify-center">
                <span className="loading loading-dots loading-md" />
              </div>
            )}

            {unlocked && gameData && (
              <div className="h-full flex flex-col">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Developer Editor
                    </h3>
                    <p className="text-xs text-zinc-400">{gameData.name}</p>
                  </div>
                  <button
                    onClick={requestClose}
                    className="text-zinc-400 hover:text-white text-xl transition"
                    disabled={saving}
                  >
                    x
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <section className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
                    <div className="bg-zinc-800 rounded-xl overflow-hidden border border-white/10 min-h-[280px]">
                      {gameData.igdb.cover ? (
                        <img
                          src={gameData.igdb.cover}
                          alt={gameData.igdb.name || gameData.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-zinc-500">
                          No Cover
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">Title</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.name}
                          onChange={(e) => updateField("name", e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">Status</span>
                        <select
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.status ?? ""}
                          onChange={(e) =>
                            updateField("status", e.target.value)
                          }
                        >
                          <option value="">None</option>
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Progress (%)
                        </span>
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            className="range range-info range-sm w-full"
                            value={Math.max(
                              0,
                              Math.min(100, gameData.progress ?? 0),
                            )}
                            onChange={(e) =>
                              updateField(
                                "progress",
                                parseNumber(e.target.value, 0),
                              )
                            }
                          />
                          <div className="text-xs text-zinc-300 text-right">
                            {Math.max(0, Math.min(100, gameData.progress ?? 0))}
                            %
                          </div>
                        </div>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Playtime (hours)
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={0}
                            className="bg-zinc-800 p-2.5 rounded border border-white/10"
                            value={getPlaytimeParts(gameData.playtime).hours}
                            onChange={(e) =>
                              updatePlaytimeFromParts(
                                parseNumber(e.target.value, 0),
                                getPlaytimeParts(gameData.playtime).minutes,
                              )
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            max={59}
                            className="bg-zinc-800 p-2.5 rounded border border-white/10"
                            value={getPlaytimeParts(gameData.playtime).minutes}
                            onChange={(e) =>
                              updatePlaytimeFromParts(
                                getPlaytimeParts(gameData.playtime).hours,
                                parseNumber(e.target.value, 0),
                              )
                            }
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-zinc-500 px-1">
                          <span>Hours</span>
                          <span>Minutes</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={!!gameData.favorite}
                          onChange={(e) =>
                            updateField("favorite", e.target.checked)
                          }
                          className="checkbox checkbox-sm"
                        />
                        Favorite
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                      IGDB Data
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">IGDB ID</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.igdb.id}
                          onChange={(e) =>
                            updateIGDB("id", parseNumber(e.target.value, 0))
                          }
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">IGDB Name</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.igdb.name ?? ""}
                          onChange={(e) => updateIGDB("name", e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-zinc-400">Cover URL</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
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
                          className="bg-zinc-800 p-2.5 rounded border border-white/10 w-full"
                          value={toLocalDateInput(gameData.igdb.releaseDate)}
                          onChange={(e) =>
                            setReleaseDateFromInput(e.target.value)
                          }
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          IGDB Rating
                        </span>
                        <input
                          type="number"
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.igdb.rating ?? 0}
                          onChange={(e) =>
                            updateIGDB("rating", parseNumber(e.target.value, 0))
                          }
                        />
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-zinc-400">Genres</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={genresInput}
                          onChange={(e) => setGenresInput(e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-zinc-400">Platforms</span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={platformsInput}
                          onChange={(e) => setPlatformsInput(e.target.value)}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                        User Ratings
                      </h4>
                    </div>

                    <div className="w-full">
                      <label className="flex flex-col gap-1 w-full">
                        <span className="text-xs text-zinc-400">My Rating</span>
                        <input
                          type="number"
                          className="w-full bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.my_rating ?? 0}
                          onChange={(e) =>
                            updateField(
                              "my_rating",
                              parseNumber(e.target.value, 0),
                            )
                          }
                        />
                      </label>
                    </div>

                    <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Category Ratings
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {categoryKeys.map((key) => (
                        <label key={key} className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400 capitalize">
                            {key}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            className="bg-zinc-800 p-2.5 rounded border border-white/10"
                            value={gameData.categoryRatings?.[key] ?? 0}
                            onChange={(e) =>
                              updateCategory(
                                key,
                                parseNumber(e.target.value, 0),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                      Notes
                    </h4>
                    <textarea
                      className="w-full bg-zinc-800 p-3 rounded border border-white/10 min-h-[150px] placeholder:text-zinc-500 focus:outline-none"
                      value={gameData.notes || ""}
                      onChange={(e) => updateField("notes", e.target.value)}
                      placeholder="Developer notes..."
                    />
                  </section>
                </div>

                <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
                  <button
                    onClick={requestClose}
                    disabled={saving}
                    className="bg-zinc-700 hover:bg-zinc-600 transition px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-2 rounded-lg min-w-[110px] flex items-center justify-center"
                  >
                    {saving ? (
                      <span className="loading loading-dots loading-sm" />
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

