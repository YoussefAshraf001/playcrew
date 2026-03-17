"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { createPortal } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiPlus,
  FiSearch,
  FiX,
} from "react-icons/fi";

import { db } from "@/app/lib/firebase";
import { getRecentGameActionSummary } from "@/app/lib/recentGameActions";
import { useUser } from "@/app/context/UserContext";
import { useGames } from "@/app/context/GameContext";
import GameTrackingModal from "./GameTrackingModal";
import { useRouter } from "next/navigation";
import { CategoryRatings, TrackedGame } from "../types/trackedGame";
import { IoCloseCircle } from "react-icons/io5";

type SearchGame = {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  version_parent?: number;
};

const DEFAULT_CATEGORIES: CategoryRatings = {
  graphics: null,
  gameplay: null,
  story: null,
  ost: null,
  cinematics: null,
  voiceActing: null,
};

const buildCoverUrl = (game?: SearchGame | null) => {
  if (!game?.cover?.url) return "/placeholder-game.jpg";
  return `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`;
};

const getReleaseDate = (game?: SearchGame | null) => {
  if (!game?.first_release_date) return null;
  return new Date(game.first_release_date * 1000);
};

const mapStoredGameToEditable = (stored: any): TrackedGame => ({
  _docId: String(stored._docId ?? stored.igdb?.id ?? stored.id),
  name: stored.name ?? stored.igdb?.name ?? "Unknown game",
  playtime: stored.playtime ?? 0,
  my_rating: typeof stored.my_rating === "number" ? stored.my_rating : 0,
  status: stored.status ?? "Want To Play",
  progress: stored.progress ?? 0,
  notes: stored.notes ?? "",
  categoryRatings: stored.categoryRatings ?? DEFAULT_CATEGORIES,
  favorite: stored.favorite ?? false,
  favoriteAllTime: stored.favoriteAllTime ?? false,
  notInterested: stored.notInterested ?? false,
  lastUpdated: stored.lastUpdated,
  recentActionSummary: stored.recentActionSummary,
  igdb: {
    id: Number(stored.igdb?.id ?? stored.id ?? 0),
    name: stored.igdb?.name ?? stored.name ?? "Unknown game",
    cover: stored.igdb?.cover,
    rating: stored.igdb?.rating,
    genres: stored.igdb?.genres,
    releaseDate: stored.igdb?.releaseDate
      ? typeof stored.igdb.releaseDate?.toDate === "function"
        ? stored.igdb.releaseDate.toDate()
        : new Date(stored.igdb.releaseDate)
      : undefined,
  },
});

const mapSearchGameToEditable = (game: SearchGame): TrackedGame => ({
  _docId: String(game.id),
  name: game.name,
  playtime: 0,
  my_rating: null,
  status: "Want To Play",
  progress: 0,
  notes: "",
  categoryRatings: DEFAULT_CATEGORIES,
  favorite: false,
  favoriteAllTime: false,
  notInterested: false,
  igdb: {
    id: game.id,
    name: game.name,
    cover: buildCoverUrl(game),
    releaseDate: getReleaseDate(game) ?? undefined,
  },
});

export default function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { games: trackedGames } = useGames();
  const uid = user?.uid;
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<TrackedGame | null>(null);
  const [trackingSaving, setTrackingSaving] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const trackedById = useMemo(() => {
    const map = new Map<number, any>();
    trackedGames.forEach((entry) => {
      const igdbId = Number((entry as any).igdb?.id ?? entry.id);
      if (!Number.isNaN(igdbId)) {
        map.set(igdbId, entry);
      }
    });
    return map;
  }, [trackedGames]);

  const selectedIndex = useMemo(
    () => results.findIndex((game) => game.id === selectedGameId),
    [results, selectedGameId],
  );

  const selectedGame = useMemo(() => {
    if (!results.length) return null;
    return (
      results.find((game) => game.id === selectedGameId) ?? results[0] ?? null
    );
  }, [results, selectedGameId]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
    setSelectedGameId(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen || trackingOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (trackingOpen) {
          setTrackingOpen(false);
          return;
        }
        onClose();
        return;
      }

      if (!results.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex =
          selectedIndex < results.length - 1 ? selectedIndex + 1 : 0;
        setSelectedGameId(results[nextIndex].id);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex =
          selectedIndex > 0 ? selectedIndex - 1 : results.length - 1;
        setSelectedGameId(results[nextIndex].id);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, results, selectedIndex, trackingOpen]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSelectedGameId(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/igdb/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });

        if (!res.ok) {
          throw new Error("Search request failed");
        }

        const data = await res.json();
        const withCovers = (data as SearchGame[]).filter(
          (game) => game.cover && game.cover.url,
        );

        setResults(withCovers);
        setSelectedGameId(withCovers[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        setResults([]);
        setSelectedGameId(null);
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!resultsRef.current || selectedGameId === null) return;

    const el = resultsRef.current.querySelector(
      `[data-game-id="${selectedGameId}"]`,
    ) as HTMLElement | null;

    if (el) {
      el.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedGameId]);

  const openTracking = async (game: SearchGame) => {
    if (!uid) {
      toast.error("You must be logged in to track games.");
      return;
    }

    setEditingGame(mapSearchGameToEditable(game));
    setTrackingOpen(true);
    setTrackingLoading(true);

    try {
      const gameRef = doc(db, "users", uid, "games_igdb", String(game.id));

      const snap = await getDoc(gameRef);

      if (snap.exists()) {
        setEditingGame(
          mapStoredGameToEditable({
            ...snap.data(),
            _docId: String(game.id),
          }),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleSaveTracking = async (
    notes: string,
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
    playedSessions: NonNullable<TrackedGame["playedSessions"]>,
  ) => {
    if (!uid || !editingGame || trackingSaving) return;

    setTrackingSaving(true);

    try {
      const docId = String(editingGame.igdb.id);
      const gameRef = doc(db, "users", uid, "games_igdb", docId);
      const existing = trackedById.get(editingGame.igdb.id);
      const releaseDate = editingGame.igdb.releaseDate ?? null;

      const recentActionSummary = getRecentGameActionSummary(
        existing,
        {
          my_rating: rating,
          playtime,
          progress,
          notes,
          status,
          favorite,
        },
        {
          defaultSummary: "Updated from Search",
        },
      );

      await setDoc(
        gameRef,
        {
          name: editingGame.name,
          igdb: {
            id: editingGame.igdb.id,
            name: editingGame.name,
            cover: editingGame.igdb.cover ?? "/placeholder-game.jpg",
            releaseDate,
          },
          my_rating: rating,
          playtime,
          progress,
          notes,
          status,
          favorite,
          notInterested,
          categoryRatings,
          playedSessions,
          recentActionSummary,
          lastUpdated: new Date(),
        },
        { merge: true },
      );

      toast.success(
        <span>
          <span className="font-bold pr-1">{editingGame.name}</span>
          <span className="text-black">
            {existing ? "updated from search" : "added to library"}
          </span>
        </span>,
      );

      setTrackingOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save game.");
    } finally {
      setTrackingSaving(false);
    }
  };

  if (!isOpen || typeof window === "undefined") return null;

  const resultCountLabel = loading
    ? "Searching..."
    : results.length > 0
      ? `${results.length} result${results.length === 1 ? "" : "s"}`
      : query.trim().length >= 2
        ? "No matches"
        : "Start typing to search";

  const modal = (
    <motion.div
      className="fixed inset-0 z-120 bg-black/78 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="flex min-h-dvh items-start justify-center p-2 sm:p-4 md:items-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-[min(92dvh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,#14253a,transparent_32%),linear-gradient(180deg,#090c12_0%,#050608_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.72)]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(34,211,238,0.06),transparent_28%,transparent_72%,rgba(250,204,21,0.08))]" />
          <div className="relative z-10 flex items-center gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.16)]">
              <FiSearch size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                Search Library
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3">
                <FiSearch className="shrink-0 text-white/35" size={16} />
                <input
                  autoFocus
                  ref={inputRef}
                  className="h-12 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
                  placeholder="Search games, editions, remasters..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Clear search"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-11 items-center border border-white/10 justify-center rounded-full px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/72 transition hover:text-red-500 cursor-pointer"
            >
              <IoCloseCircle size={25} />
            </button>
          </div>

          <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="flex min-h-0 flex-col border-b border-white/10 md:border-b-0 md:border-r md:border-white/10">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-sm font-semibold text-white">Results</p>
                  <p className="text-xs text-white/45">{resultCountLabel}</p>
                </div>
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/45 sm:block">
                  Arrow keys to move
                </div>
              </div>

              <div
                ref={resultsRef}
                className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
              >
                {loading ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5"
                      >
                        <div className="h-18 w-14 rounded-xl bg-white/10" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-white/10" />
                          <div className="h-3 w-1/3 rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/55">
                    <p className="text-base font-semibold text-white/75">
                      Search failed
                    </p>
                    <p className="text-sm">{error}</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white/35">
                      <FiSearch size={24} />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white/75">
                        {query.trim().length >= 2
                          ? "No games found"
                          : "Search for a game"}
                      </p>
                      <p className="mt-1 text-sm text-white/40">
                        {query.trim().length >= 2
                          ? "Try another name or a simpler search term."
                          : "Results will appear here with quick add and preview actions."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {results.map((game) => {
                      const releaseDate = getReleaseDate(game);
                      const isSelected = selectedGame?.id === game.id;
                      const existing = trackedById.get(game.id);

                      return (
                        <div
                          key={game.id}
                          data-game-id={game.id}
                          onClick={() => setSelectedGameId(game.id)}
                          className={`group rounded-2xl border transition ${
                            isSelected
                              ? "border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                              : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                            <img
                              src={buildCoverUrl(game)}
                              alt={game.name}
                              className="h-18 w-14 shrink-0 rounded-xl border border-white/10 object-cover shadow-lg"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white sm:text-[15px]">
                                    {game.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                                    {releaseDate && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                        <FiCalendar size={11} />
                                        {releaseDate.getFullYear()}
                                      </span>
                                    )}
                                    {/* {game.version_parent && (
                                      <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-amber-100/85">
                                        Variant edition
                                      </span>
                                    )} */}
                                    {existing?.status && (
                                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-100/85">
                                        {existing.status}
                                      </span>
                                    )}
                                  </div>
                                  {/* Mobile actions */}
                                  <div className="mt-3 flex gap-2 md:hidden">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedGameId(game.id);
                                      }}
                                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                                    >
                                      Preview
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTracking(game);
                                      }}
                                      className={`flex-1 rounded-lg border px-3 py-0.5 md:py-1.5 text-xs font-semibold ${
                                        trackedById.has(game.id)
                                          ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                                          : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                                      }`}
                                    >
                                      {trackedById.has(game.id)
                                        ? "Edit"
                                        : "Quick Add"}
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                        router.push(`/game/${game.id}`);
                                      }}
                                      className="flex-1 text-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                                    >
                                      Open
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </section>

            <aside className="hidden min-h-0 flex-col md:flex">
              <div className="border-b border-white/10 px-5 py-3">
                <p className="text-sm font-semibold text-white">
                  Quick Preview
                </p>
                <p className="text-xs text-white/45">
                  Inspect the selected game before opening its page.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  {selectedGame ? (
                    <motion.div
                      key={selectedGame.id}
                      className="space-y-4"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div className="overflow-hidden mx-auto rounded-[26px] lg:w-[360px] border border-white/10 bg-white/4">
                        <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_48%),linear-gradient(180deg,rgba(8,10,14,0.96),rgba(4,5,8,1))]">
                          <motion.img
                            className="max-h-[480px] w-full object-contain"
                            key={selectedGame.id}
                            src={buildCoverUrl(selectedGame)}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/45 to-transparent px-4 pb-4 pt-16">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                              Selected Result
                            </p>
                            <h3 className="mt-2 text-2xl font-bold text-white">
                              {selectedGame.name}
                            </h3>
                          </div>
                        </div>
                        <div className="grid gap-3 p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                                Release
                              </p>
                              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                                <FiClock
                                  size={14}
                                  className="text-cyan-200/70"
                                />
                                {getReleaseDate(selectedGame)
                                  ? getReleaseDate(
                                      selectedGame,
                                    )?.toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "Unknown"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                                Library
                              </p>
                              <p className="mt-2 text-sm font-semibold text-white">
                                {trackedById.has(selectedGame.id)
                                  ? "Already tracked"
                                  : "Not tracked yet"}
                              </p>
                            </div>
                          </div>

                          {selectedGame.version_parent && (
                            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-3 text-sm text-amber-50/90">
                              This result looks like a variant edition. If you
                              only want original releases, compare it before
                              adding.
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openTracking(selectedGame)}
                              disabled={!uid}
                              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition ${
                                uid
                                  ? trackedById.has(selectedGame.id)
                                    ? "border border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                                    : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                                  : "cursor-not-allowed border border-white/10 bg-white/5 text-white/30"
                              }`}
                            >
                              {trackedById.has(selectedGame.id) ? (
                                <FiEdit3 size={15} />
                              ) : (
                                <FiPlus size={15} />
                              )}
                              {trackedById.has(selectedGame.id)
                                ? "Edit Tracking"
                                : "Add Tracking"}
                            </button>
                            <Link
                              href={`/game/${selectedGame.id}`}
                              onClick={onClose}
                              className="inline-flex h-10 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                            >
                              Open Game Page
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-white/40">
                      Select a result to preview it here.
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>

      {editingGame && (
        <div className="relative">
          <GameTrackingModal
            loading={trackingLoading}
            open={trackingOpen}
            onClose={() => setTrackingOpen(false)}
            onHeaderClose={() => setTrackingOpen(false)}
            onSave={handleSaveTracking}
            game={editingGame}
            initialNotes={editingGame.notes ?? ""}
            initialRating={editingGame.my_rating ?? null}
            initialCategoryRatings={
              editingGame.categoryRatings ?? DEFAULT_CATEGORIES
            }
            initialProgress={editingGame.progress ?? 0}
            initialPlaytime={editingGame.playtime ?? 0}
            initialPlayedSessions={editingGame.playedSessions ?? []}
            initialStatus={editingGame.status ?? "Want To Play"}
            initialFavorite={editingGame.favorite ?? false}
            showStatus
            showFavorite
            saving={trackingSaving}
          />
        </div>
      )}
    </motion.div>
  );

  return createPortal(modal, document.body);
}




