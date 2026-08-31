"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { RiShieldKeyholeFill } from "react-icons/ri";

import { db } from "@/app/lib/firebase";
import { GAME_STICKERS } from "../lib/gameStickers";
import type {
  PlaySession,
  PreReleaseAccess,
  RefreshBlockField,
} from "@/app/types/trackedGame";
import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";

interface Props {
  userId: string;
  game: { _docId: string };
  onClose: () => void;
}

interface GameData {
  name: string;
  igdb: {
    id: number;
    name: string;
    cover?: string;
    genres?: string[];
    platforms?: string[];
    releaseDate?: unknown;
    releaseDatePrecision?: ReleaseDatePrecision | null;
    rating?: number;
  };
  playtime?: number;
  progress?: number;
  status?: string;
  favorite?: boolean;
  favoriteOrder?: number | null;
  favoriteAllTime?: boolean;
  wantToPlayOrder?: number | null;
  notInterested?: boolean;
  review?: {
    text?: string;
    sticker?: string | null;
  };
  my_rating?: number | null;
  playedSessions?: PlaySession[];
  recentActionSummary?: string;
  preReleaseAccess?: PreReleaseAccess | null;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;
  lastUpdated?: unknown;
}

const DEV_KEY = "dev_unlock";
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD!;
const DEV_UNLOCK_DURATION_MS = 60 * 60 * 1000;
const STATUS_OPTIONS = [
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Online",
  "Want To Play",
];
const REFRESH_BLOCK_OPTIONS: Array<{
  id: RefreshBlockField;
  label: string;
}> = [
  { id: "name", label: "Name" },
  { id: "cover", label: "Cover" },
  { id: "genres", label: "Genres" },
  { id: "rating", label: "Rating" },
  { id: "platforms", label: "Platforms" },
  { id: "released", label: "Release date" },
];

export default function DevGameEditor({ userId, game, onClose }: Props) {
  const [pin, setPin] = useState<string[]>(Array(4).fill(""));
  const [unlocked, setUnlocked] = useState(false);
  const [wrongPin, setWrongPin] = useState(false);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [visible, setVisible] = useState(true);
  const isClosingRef = useRef(false);
  const [genresInput, setGenresInput] = useState("");
  const [platformsInput, setPlatformsInput] = useState("");
  const [playedSessionsInput, setPlayedSessionsInput] = useState("[]");

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
    if (stored && Date.now() - Number(stored) < DEV_UNLOCK_DURATION_MS) {
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
    setPlayedSessionsInput(
      JSON.stringify(gameData.playedSessions ?? [], null, 2),
    );
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

  const selectedSticker = GAME_STICKERS.find(
    (s) => s.id === gameData?.review?.sticker,
  );

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

  const parseDateValue = (value: unknown): Date | null => {
    if (!value) return null;

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      const t = new Date(value);
      return Number.isNaN(t.getTime()) ? null : t;
    }

    return null;
  };

  const toLocalDateInput = (value: unknown) => {
    const d = parseDateValue(value);
    if (!d) return "";

    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };

  const toLocalDateTimeInput = (value: unknown) => {
    const d = parseDateValue(value);
    if (!d) return "";

    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const setReleaseDateFromInput = (value: string) => {
    updateIGDB("releaseDate", value ? new Date(value) : null);
  };

  const setLastUpdatedFromInput = (value: string) => {
    updateField("lastUpdated", value ? new Date(value) : null);
  };

  const saveChanges = async () => {
    if (!gameData) return;
    setSaving(true);

    try {
      const playedSessions = JSON.parse(playedSessionsInput);
      if (!Array.isArray(playedSessions)) {
        throw new Error("Play sessions must be a JSON array.");
      }

      await updateDoc(doc(db, "users", userId, "games_igdb", game._docId), {
        ...gameData,
        playedSessions,
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
        lastUpdated: parseDateValue(gameData.lastUpdated) ?? new Date(),
      });
      toast.success(
        <span>
          <span className="font-bold pr-1">
            {gameData.igdb?.name ?? "Game"}
          </span>
          <span className="text-black">updated successfully</span>
        </span>,
      );
      requestClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save game data.",
      );
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
              <div className="relative h-full w-full flex flex-col items-center justify-center gap-8 p-6">
                <div className="absolute right-6 top-6">
                  <button
                    onClick={requestClose}
                    className="mt-2 text-sm font-medium text-zinc-400 transition hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
                  <RiShieldKeyholeFill className="text-5xl text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Developer Access
                </h2>

                <p className="max-w-sm text-center text-sm text-zinc-400">
                  Enter your 4-digit developer PIN to unlock the editor.
                </p>
                <div className="flex gap-3">
                  <motion.div
                    className="flex gap-3"
                    animate={wrongPin ? { x: [-8, 8, -8, 8, 0] } : {}}
                    transition={{ duration: 0.35 }}
                  >
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
                        className="
                        w-14
                        h-14
                        rounded-xl
                        bg-zinc-800/80
                        border
                        border-white/10
                        text-center
                        text-2xl
                        font-bold
                        text-white
                        transition-all
                        duration-200

                        focus:border-cyan-400
                        focus:ring-4
                        focus:ring-cyan-500/20
                        focus:scale-105
                      "
                        style={pinStyle}
                        value={pin[i]}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          if (!v) return;

                          const next = [...pin];
                          next[i] = v;
                          setPin(next);
                          if (i < 3) inputsRef.current[i + 1]?.focus();
                          if (next.every((d) => d !== "")) {
                            if (next.join("") === DEV_PASSWORD) {
                              handleCorrectPin();
                            } else {
                              setWrongPin(true);

                              setTimeout(() => {
                                setWrongPin(false);
                              }, 500);

                              setPin(Array(4).fill(""));

                              setTimeout(() => {
                                inputsRef.current[0]?.focus();
                              }, 50);
                            }
                          }
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
                  </motion.div>
                </div>
                <AnimatePresence>
                  {wrongPin && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium text-red-400"
                    >
                      Incorrect PIN
                    </motion.p>
                  )}
                </AnimatePresence>
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
                  <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
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

                      <div className="grid grid-cols-2 gap-3 md:col-span-2 sm:grid-cols-4">
                        {[
                          ["favorite", "Favorite"],
                          ["favoriteAllTime", "All-time favorite"],
                          ["notInterested", "Not interested"],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/70 p-2.5 text-sm text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={!!gameData[key as keyof GameData]}
                              onChange={(e) =>
                                updateField(
                                  key as
                                    | "favorite"
                                    | "favoriteAllTime"
                                    | "notInterested",
                                  e.target.checked,
                                )
                              }
                              className="checkbox checkbox-sm"
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      {[
                        ["favoriteOrder", "Favorite order"],
                        ["wantToPlayOrder", "Want-to-play order"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-400">{label}</span>
                          <input
                            type="number"
                            className="bg-zinc-800 p-2.5 rounded border border-white/10"
                            value={
                              (gameData[key as keyof GameData] as number) ?? ""
                            }
                            onChange={(e) =>
                              updateField(
                                key as "favoriteOrder" | "wantToPlayOrder",
                                e.target.value === ""
                                  ? null
                                  : parseNumber(e.target.value),
                              )
                            }
                          />
                        </label>
                      ))}

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-zinc-400">
                          Last Updated
                        </span>
                        <input
                          type="datetime-local"
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={toLocalDateTimeInput(gameData.lastUpdated)}
                          onChange={(e) =>
                            setLastUpdatedFromInput(e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                          IGDB Data
                        </h4>
                        <p className="mt-1 text-xs text-zinc-500">
                          Control external metadata and refresh behavior.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-3">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-red-100">
                          Block refresh fields
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          Enabled fields are protected from automatic updates.
                          Manual refreshes require an explicit override.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {REFRESH_BLOCK_OPTIONS.map((option) => {
                          const blocked =
                            gameData.refreshExcluded === true ||
                            gameData.refreshBlockedFields?.[option.id] === true;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="switch"
                              aria-checked={blocked}
                              onClick={() => {
                                const legacyBlocks = Object.fromEntries(
                                  REFRESH_BLOCK_OPTIONS.map(({ id }) => [
                                    id,
                                    true,
                                  ]),
                                ) as Record<RefreshBlockField, boolean>;
                                setGameData((current) =>
                                  current
                                    ? {
                                        ...current,
                                        refreshExcluded: false,
                                        refreshBlockedFields: {
                                          ...(current.refreshExcluded
                                            ? legacyBlocks
                                            : current.refreshBlockedFields),
                                          [option.id]: !blocked,
                                        },
                                      }
                                    : current,
                                );
                              }}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                                blocked
                                  ? "border-red-400/50 bg-red-500/15 text-red-100"
                                  : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20"
                              }`}
                            >
                              <span>{option.label}</span>
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  blocked ? "bg-red-400" : "bg-zinc-600"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={
                          gameData.protectCustomCoverFromRefresh === true
                        }
                        onClick={() =>
                          updateField(
                            "protectCustomCoverFromRefresh",
                            !gameData.protectCustomCoverFromRefresh,
                          )
                        }
                        className={`mt-3 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                          gameData.protectCustomCoverFromRefresh
                            ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                            : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20"
                        }`}
                      >
                        <span>
                          <span className="block text-xs font-semibold">
                            Protect custom cover
                          </span>
                          <span className="mt-0.5 block text-[10px] opacity-70">
                            Lock the current cover against automatic refreshes
                          </span>
                        </span>
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            gameData.protectCustomCoverFromRefresh
                              ? "bg-amber-400"
                              : "bg-zinc-600"
                          }`}
                        />
                      </button>
                    </div>
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
                        <span className="text-xs text-zinc-400">
                          Release Precision
                        </span>
                        <select
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.igdb.releaseDatePrecision ?? ""}
                          onChange={(e) =>
                            updateIGDB(
                              "releaseDatePrecision",
                              (e.target.value ||
                                null) as ReleaseDatePrecision | null,
                            )
                          }
                        >
                          <option value="">Auto</option>
                          <option value="year">Year</option>
                          <option value="quarter">Quarter</option>
                          <option value="month">Month</option>
                          <option value="day">Exact day</option>
                        </select>
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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                          Play Sessions
                        </h4>
                        <p className="mt-1 text-xs text-zinc-500">
                          Add, change, reorder, or remove session records.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const sessions = JSON.parse(playedSessionsInput);
                            setPlayedSessionsInput(
                              JSON.stringify(
                                [
                                  ...(Array.isArray(sessions) ? sessions : []),
                                  {
                                    playedAt: new Date().toISOString(),
                                    durationHours: 1,
                                  },
                                ],
                                null,
                                2,
                              ),
                            );
                          } catch {
                            toast.error(
                              "Fix the sessions JSON before adding one.",
                            );
                          }
                        }}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                      >
                        + Add session
                      </button>
                    </div>

                    <div className="grid gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Played sessions
                        </span>
                        <textarea
                          spellCheck={false}
                          className="min-h-56 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-3 font-mono text-xs leading-relaxed text-cyan-50 focus:border-cyan-400/40 focus:outline-none"
                          value={playedSessionsInput}
                          onChange={(e) =>
                            setPlayedSessionsInput(e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                      Access & Activity
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Access type
                        </span>
                        <select
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.preReleaseAccess?.type ?? ""}
                          onChange={(e) =>
                            updateField(
                              "preReleaseAccess",
                              e.target.value
                                ? {
                                    type: e.target
                                      .value as PreReleaseAccess["type"],
                                    unlockedAt:
                                      parseDateValue(
                                        gameData.preReleaseAccess?.unlockedAt,
                                      ) ?? new Date(),
                                    dateSource:
                                      gameData.preReleaseAccess?.dateSource ??
                                      "official",
                                  }
                                : null,
                            )
                          }
                        >
                          <option value="">None</option>
                          <option value="early-access">Early Access</option>
                          <option value="advanced-access">
                            Advanced Access
                          </option>
                          <option value="leaked">Leaked</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Access date
                        </span>
                        <input
                          type="datetime-local"
                          disabled={!gameData.preReleaseAccess}
                          className="bg-zinc-800 p-2.5 rounded border border-white/10 disabled:opacity-40"
                          value={toLocalDateTimeInput(
                            gameData.preReleaseAccess?.unlockedAt,
                          )}
                          onChange={(e) =>
                            gameData.preReleaseAccess &&
                            updateField("preReleaseAccess", {
                              ...gameData.preReleaseAccess,
                              unlockedAt: new Date(e.target.value),
                            })
                          }
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">
                          Date source
                        </span>
                        <select
                          disabled={!gameData.preReleaseAccess}
                          className="bg-zinc-800 p-2.5 rounded border border-white/10 disabled:opacity-40"
                          value={
                            gameData.preReleaseAccess?.dateSource ?? "official"
                          }
                          onChange={(e) =>
                            gameData.preReleaseAccess &&
                            updateField("preReleaseAccess", {
                              ...gameData.preReleaseAccess,
                              dateSource: e.target.value as
                                | "unlock"
                                | "official",
                            })
                          }
                        >
                          <option value="official">Official</option>
                          <option value="unlock">Unlock date</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-3">
                        <span className="text-xs text-zinc-400">
                          Recent action summary
                        </span>
                        <input
                          className="bg-zinc-800 p-2.5 rounded border border-white/10"
                          value={gameData.recentActionSummary ?? ""}
                          onChange={(e) =>
                            updateField("recentActionSummary", e.target.value)
                          }
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
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            className="w-full bg-zinc-800 p-2.5 rounded border border-white/10"
                            value={gameData.my_rating ?? ""}
                            placeholder="Not rated"
                            onChange={(e) =>
                              updateField(
                                "my_rating",
                                e.target.value === ""
                                  ? null
                                  : parseNumber(e.target.value, 0),
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => updateField("my_rating", null)}
                            className="rounded border border-white/10 bg-zinc-800 px-3 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            Clear
                          </button>
                        </div>
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                      Review
                    </h4>

                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                      <div className="rounded-xl border border-white/10 bg-zinc-800 p-4">
                        {gameData.review?.sticker ? (
                          <img
                            src={selectedSticker?.image}
                            alt={selectedSticker?.label}
                            className="mx-auto h-50 w-50 object-contain"
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center text-zinc-500">
                            No Sticker
                          </div>
                        )}
                        <select
                          className="mt-3 w-full rounded border border-white/10 bg-zinc-900 p-2 text-sm"
                          value={gameData.review?.sticker ?? ""}
                          onChange={(e) =>
                            updateField("review", {
                              ...(gameData.review ?? {}),
                              sticker: e.target.value || null,
                            })
                          }
                        >
                          <option value="">No sticker</option>
                          {GAME_STICKERS.map((sticker) => (
                            <option key={sticker.id} value={sticker.id}>
                              {sticker.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <textarea
                          className="w-full h-full bg-zinc-800 p-3 rounded border border-white/10 min-h-[150px] placeholder:text-zinc-500 focus:outline-none"
                          value={gameData.review?.text ?? ""}
                          onChange={(e) =>
                            updateField("review", {
                              ...(gameData.review ?? {}),
                              text: e.target.value,
                            })
                          }
                          placeholder="Write a review..."
                        />
                      </div>
                    </div>
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
