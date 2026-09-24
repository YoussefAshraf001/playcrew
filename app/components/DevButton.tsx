"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { RiShieldKeyholeFill } from "react-icons/ri";
import { SiSteam } from "react-icons/si";
import { FaBan, FaHeart } from "react-icons/fa";

import { db } from "@/app/lib/firebase";
import { GAME_STICKERS } from "../lib/gameStickers";
import type {
  PlaySession,
  PreReleaseAccess,
  RefreshBlockField,
} from "@/app/types/trackedGame";
import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";
import SteamAssetsModal, { type SteamAsset } from "./SteamAssetsModal";

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
  lostInterestMessage?: string;
  review?: {
    text?: string;
    sticker?: string | null;
  };
  my_rating?: number | null;
  playedSessions?: PlaySession[];
  recentActionSummary?: string;
  preReleaseAccess?: PreReleaseAccess | null;
  customReleaseTime?: {
    releasesAt: unknown;
    timeZone: string;
    sourceTimeZone?: string;
  } | null;
  customReleaseNotificationFor?: number | null;
  customReleaseNotificationDocumentFor?: number | null;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;
  lastUpdated?: unknown;
}

const DEV_KEY = "dev_unlock";
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD!;
const DEV_UNLOCK_DURATION_MS = 60 * 60 * 1000;
const PLAY_SESSIONS_PER_PAGE = 1;
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
  const [sessionPage, setSessionPage] = useState(0);
  const [posterMenuPosition, setPosterMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [steamAssetsOpen, setSteamAssetsOpen] = useState(false);
  const sessionsTopRef = useRef<HTMLDivElement | null>(null);

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
  const playSessions = gameData?.playedSessions ?? [];
  const sessionPageCount = Math.max(
    1,
    Math.ceil(playSessions.length / PLAY_SESSIONS_PER_PAGE),
  );
  const visibleSessionPage = Math.min(sessionPage, sessionPageCount - 1);
  const visiblePlaySessions = playSessions.slice(
    visibleSessionPage * PLAY_SESSIONS_PER_PAGE,
    (visibleSessionPage + 1) * PLAY_SESSIONS_PER_PAGE,
  );

  const goToSessionPage = (nextPage: number) => {
    setSessionPage(Math.max(0, Math.min(sessionPageCount - 1, nextPage)));
    requestAnimationFrame(() =>
      sessionsTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

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

  const openPosterMenu = (event: MouseEvent<HTMLImageElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPosterMenuPosition({
      x: Math.min(event.clientX, window.innerWidth - 230),
      y: Math.min(event.clientY, window.innerHeight - 70),
    });
  };

  const useSteamAssetAsCover = (asset: SteamAsset) => {
    updateIGDB("cover", asset.url);
    updateField("protectCustomCoverFromRefresh", true);
    toast.success(`${asset.label} selected. Save changes to apply it.`);
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

    if (
      typeof value === "object" &&
      value !== null &&
      (("seconds" in value &&
        typeof (value as { seconds?: unknown }).seconds === "number") ||
        ("_seconds" in value &&
          typeof (value as { _seconds?: unknown })._seconds === "number"))
    ) {
      const seconds =
        "seconds" in value
          ? (value as { seconds: number }).seconds
          : (value as { _seconds: number })._seconds;
      const nanoseconds =
        "nanoseconds" in value
          ? Number((value as { nanoseconds?: unknown }).nanoseconds) || 0
          : "_nanoseconds" in value
            ? Number((value as { _nanoseconds?: unknown })._nanoseconds) || 0
            : 0;
      return new Date(seconds * 1000 + nanoseconds / 1_000_000);
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

  const setCustomReleaseTimeFromInput = (value: string) => {
    updateField("customReleaseNotificationFor", null);
    updateField("customReleaseNotificationDocumentFor", null);
    if (!value) {
      updateField("customReleaseTime", null);
      return;
    }

    const current = gameData?.customReleaseTime;
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    updateField("customReleaseTime", {
      releasesAt: new Date(value),
      timeZone: current?.timeZone || browserTimeZone,
      sourceTimeZone: current?.sourceTimeZone || browserTimeZone,
    });
  };

  const preserveTimestampType = (original: unknown, date: Date) => {
    if (
      typeof original === "object" &&
      original !== null &&
      "toDate" in original &&
      typeof (original as { toDate?: unknown }).toDate === "function"
    ) {
      return Timestamp.fromDate(date);
    }
    if (original instanceof Date) return date;
    if (
      typeof original === "object" &&
      original !== null &&
      ("seconds" in original || "_seconds" in original)
    ) {
      const next = {
        ...original,
      };
      const seconds = Math.floor(date.getTime() / 1000);
      const nanoseconds = (date.getTime() % 1000) * 1_000_000;
      if ("_seconds" in original) {
        return { ...next, _seconds: seconds, _nanoseconds: nanoseconds };
      }
      return { ...next, seconds, nanoseconds };
    }
    if (typeof original === "string") return date.toISOString();
    if (typeof original === "number") return date.getTime();
    return Timestamp.fromDate(date);
  };

  const updatePlaySession = (
    index: number,
    update: (session: PlaySession) => PlaySession,
  ) => {
    setGameData((current) => {
      if (!current) return current;
      const sessions = [...(current.playedSessions ?? [])];
      const session = sessions[index];
      if (!session) return current;
      sessions[index] = update(session);
      return { ...current, playedSessions: sessions };
    });
  };

  const removePlaySession = (index: number) => {
    if (!gameData) return;
    const nextSessions = (gameData.playedSessions ?? []).filter(
      (_, sessionIndex) => sessionIndex !== index,
    );
    setGameData({ ...gameData, playedSessions: nextSessions });
    setSessionPage((page) =>
      Math.min(
        page,
        Math.max(
          0,
          Math.ceil(nextSessions.length / PLAY_SESSIONS_PER_PAGE) - 1,
        ),
      ),
    );
  };

  const addPlaySession = () => {
    if (!gameData) return;
    const nextSessions = [
      ...(gameData.playedSessions ?? []),
      { playedAt: Timestamp.now(), durationHours: 1 },
    ];
    setGameData({ ...gameData, playedSessions: nextSessions });
    setSessionPage(
      Math.max(0, Math.ceil(nextSessions.length / PLAY_SESSIONS_PER_PAGE) - 1),
    );
    requestAnimationFrame(() =>
      sessionsTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  const saveChanges = async () => {
    if (!gameData) return;
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", userId, "games_igdb", game._docId), {
        ...gameData,
        lostInterestMessage: gameData.notInterested
          ? (gameData.lostInterestMessage ?? "").trim()
          : "",
        playedSessions: gameData.playedSessions ?? [],
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
            className="relative h-[92dvh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[#090b10] shadow-[0_35px_120px_rgba(0,0,0,0.72),0_0_50px_rgba(6,182,212,0.06)]"
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
                <div className="relative overflow-hidden border-b border-white/10 px-5 py-4 sm:px-7">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(6,182,212,0.16),transparent_42%)]" />
                  <div className="relative flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                      <RiShieldKeyholeFill className="text-xl text-cyan-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">Game editor</p>
                      <h3 className="truncate text-lg font-bold text-white">{gameData.name}</h3>
                    </div>
                  </div>
                  <button
                    onClick={requestClose}
                    aria-label="Close developer editor"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                    disabled={saving}
                  >
                    ×
                  </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-6 [scrollbar-color:rgba(6,182,212,.35)_transparent]">
                  <section className="grid grid-cols-1 gap-5 rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5 lg:grid-cols-[280px_1fr]">
                    <div className="aspect-[2/3] w-full self-start overflow-hidden rounded-2xl border border-white/10 bg-zinc-800 shadow-2xl">
                      {gameData.igdb.cover ? (
                        <img
                          src={gameData.igdb.cover}
                          alt={gameData.igdb.name || gameData.name}
                          onContextMenu={openPosterMenu}
                          title="Right-click for SteamDB cover options"
                          className="h-full w-full object-cover"
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

                      <div className="grid gap-3 md:col-span-2 sm:grid-cols-2">
                        <button
                          type="button"
                          aria-pressed={!!gameData.favorite}
                          onClick={() => updateField("favorite", !gameData.favorite)}
                          className={`group flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                            gameData.favorite
                              ? "border-rose-400/35 bg-rose-500/12 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.08)]"
                              : "border-white/10 bg-white/[0.035] text-zinc-300 hover:border-rose-400/25 hover:bg-rose-500/5"
                          }`}
                        >
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${gameData.favorite ? "bg-rose-500 text-white" : "bg-white/5 text-zinc-500 group-hover:text-rose-300"}`}>
                            <FaHeart size={16} />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Favorite</span>
                            <span className="mt-0.5 block text-[11px] opacity-55">Keep this game in your favorites</span>
                          </span>
                          <span className={`ml-auto h-2.5 w-2.5 rounded-full ${gameData.favorite ? "bg-rose-400" : "bg-zinc-700"}`} />
                        </button>

                        <button
                          type="button"
                          aria-pressed={!!gameData.notInterested}
                          onClick={() => {
                            const next = !gameData.notInterested;
                            updateField("notInterested", next);
                            if (!next) updateField("lostInterestMessage", "");
                          }}
                          className={`group flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                            gameData.notInterested
                              ? "border-red-400/35 bg-red-500/12 text-red-100 shadow-[0_0_24px_rgba(239,68,68,0.08)]"
                              : "border-white/10 bg-white/[0.035] text-zinc-300 hover:border-red-400/25 hover:bg-red-500/5"
                          }`}
                        >
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${gameData.notInterested ? "bg-red-500 text-white" : "bg-white/5 text-zinc-500 group-hover:text-red-300"}`}>
                            <FaBan size={16} />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">Lost interest</span>
                            <span className="mt-0.5 block text-[11px] opacity-55">Mark this game as no longer for you</span>
                          </span>
                          <span className={`ml-auto h-2.5 w-2.5 rounded-full ${gameData.notInterested ? "bg-red-400" : "bg-zinc-700"}`} />
                        </button>
                      </div>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="flex justify-between text-xs text-zinc-400"><span>Lost-interest message</span><span>{(gameData.lostInterestMessage ?? "").length}/90</span></span>
                        <input
                          maxLength={90}
                          disabled={!gameData.notInterested}
                          className="rounded-xl border border-white/10 bg-zinc-800 p-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                          value={gameData.lostInterestMessage ?? ""}
                          onChange={(e) => updateField("lostInterestMessage", e.target.value)}
                          placeholder="Optional reason shown on the game card"
                        />
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="text-xs text-zinc-400">Favorite order</span>
                        <input
                          type="number"
                          className="rounded border border-white/10 bg-zinc-800 p-2.5"
                          value={gameData.favoriteOrder ?? ""}
                          onChange={(e) =>
                            updateField(
                              "favoriteOrder",
                              e.target.value === ""
                                ? null
                                : parseNumber(e.target.value),
                            )
                          }
                        />
                      </label>

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

                      <div className="space-y-3 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4 md:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Custom release time</p>
                            <p className="mt-1 text-[11px] text-zinc-500">Overrides the official release date and countdown for this entry.</p>
                          </div>
                          {gameData.customReleaseTime && (
                            <button
                              type="button"
                              onClick={() => {
                                updateField("customReleaseTime", null);
                                updateField("customReleaseNotificationFor", null);
                                updateField("customReleaseNotificationDocumentFor", null);
                              }}
                              className="rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/10"
                            >
                              Clear override
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-zinc-400">Date and time</span>
                            <input
                              type="datetime-local"
                              className="rounded-xl border border-white/10 bg-zinc-800 p-2.5"
                              value={toLocalDateTimeInput(
                                gameData.customReleaseTime?.releasesAt ??
                                  gameData.igdb.releaseDate,
                              )}
                              onChange={(e) => setCustomReleaseTimeFromInput(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-zinc-400">Announced timezone</span>
                            <input
                              disabled={!gameData.customReleaseTime}
                              className="rounded-xl border border-white/10 bg-zinc-800 p-2.5 disabled:opacity-40"
                              value={gameData.customReleaseTime?.sourceTimeZone ?? ""}
                              onChange={(e) =>
                                gameData.customReleaseTime &&
                                updateField("customReleaseTime", {
                                  ...gameData.customReleaseTime,
                                  sourceTimeZone: e.target.value,
                                })
                              }
                              placeholder="e.g. America/New_York"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
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

                  <section
                    ref={sessionsTopRef}
                    className="scroll-mt-4 space-y-4 rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5"
                  >
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
                        onClick={addPlaySession}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                      >
                        + Add session
                      </button>
                    </div>

                    {(gameData.playedSessions ?? []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
                        No play sessions recorded.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {visiblePlaySessions.map((session, pageIndex) => {
                          const index =
                            visibleSessionPage * PLAY_SESSIONS_PER_PAGE +
                            pageIndex;
                          const duration = getPlaytimeParts(
                            session.durationHours,
                          );
                          const playedAt = parseDateValue(session.playedAt);

                          return (
                            <div
                              key={index}
                              className="rounded-xl border border-white/10 bg-zinc-800/65 p-4 shadow-sm"
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-100">
                                    Session {index + 1}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-zinc-500">
                                    {playedAt
                                      ? playedAt.toLocaleString()
                                      : "No valid play date"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePlaySession(index)}
                                  className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-500/20"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(90px,0.5fr)_minmax(90px,0.5fr)]">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-zinc-400">
                                    Played at
                                  </span>
                                  <input
                                    type="datetime-local"
                                    className="rounded-lg border border-white/10 bg-zinc-900 p-2.5 text-sm text-zinc-100"
                                    value={toLocalDateTimeInput(
                                      session.playedAt,
                                    )}
                                    onChange={(event) => {
                                      if (!event.target.value) return;
                                      const date = new Date(event.target.value);
                                      updatePlaySession(index, (current) => ({
                                        ...current,
                                        playedAt: preserveTimestampType(
                                          current.playedAt,
                                          date,
                                        ),
                                      }));
                                    }}
                                  />
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-zinc-400">
                                    Hours
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    className="rounded-lg border border-white/10 bg-zinc-900 p-2.5 text-sm text-zinc-100"
                                    value={duration.hours}
                                    onChange={(event) => {
                                      const hours = Math.max(
                                        0,
                                        Math.floor(
                                          parseNumber(event.target.value),
                                        ),
                                      );
                                      updatePlaySession(index, (current) => ({
                                        ...current,
                                        durationHours:
                                          hours + duration.minutes / 60,
                                      }));
                                    }}
                                  />
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-zinc-400">
                                    Minutes
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    className="rounded-lg border border-white/10 bg-zinc-900 p-2.5 text-sm text-zinc-100"
                                    value={duration.minutes}
                                    onChange={(event) => {
                                      const minutes = Math.max(
                                        0,
                                        Math.min(
                                          59,
                                          Math.floor(
                                            parseNumber(event.target.value),
                                          ),
                                        ),
                                      );
                                      updatePlaySession(index, (current) => ({
                                        ...current,
                                        durationHours:
                                          duration.hours + minutes / 60,
                                      }));
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {sessionPageCount > 1 && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-2">
                        <button
                          type="button"
                          disabled={visibleSessionPage === 0}
                          onClick={() =>
                            goToSessionPage(visibleSessionPage - 1)
                          }
                          className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Previous
                        </button>
                        <span className="text-xs font-medium tabular-nums text-zinc-400">
                          Page {visibleSessionPage + 1} of {sessionPageCount}
                        </span>
                        <button
                          type="button"
                          disabled={visibleSessionPage >= sessionPageCount - 1}
                          onClick={() =>
                            goToSessionPage(visibleSessionPage + 1)
                          }
                          className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Next
                        </button>
                      </div>
                    )}
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

                <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/25 px-5 py-4 sm:px-7">
                  <p className="hidden text-xs text-zinc-500 sm:block">Changes are written directly to this library entry.</p>
                  <div className="ml-auto flex gap-3">
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

                <AnimatePresence>
                  {posterMenuPosition && (
                    <>
                      <button
                        type="button"
                        aria-label="Close poster menu"
                        onClick={() => setPosterMenuPosition(null)}
                        className="fixed inset-0 z-[10040] cursor-default"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        style={{ left: posterMenuPosition.x, top: posterMenuPosition.y }}
                        className="fixed z-[10050] w-56 overflow-hidden rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPosterMenuPosition(null);
                            setSteamAssetsOpen(true);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <SiSteam className="text-lg text-[#66c0f4]" />
                          Use SteamDB images
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <SteamAssetsModal
                  open={steamAssetsOpen}
                  igdbId={gameData.igdb.id}
                  gameName={gameData.name}
                  currentCoverUrl={gameData.igdb.cover}
                  onClose={() => setSteamAssetsOpen(false)}
                  onUseAsset={useSteamAssetAsCover}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
