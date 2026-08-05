"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { createPortal } from "react-dom";
import { doc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { FiCalendar, FiClock, FiSearch, FiX } from "react-icons/fi";

import { db } from "@/app/lib/firebase";
import { searchUsersByUsername } from "@/app/lib/social";
import ProfileCard from "@/app/components/ProfileCard";
import { useUser } from "@/app/context/UserContext";
import { useGames } from "@/app/context/GameContext";
import { useRouter } from "next/navigation";
import { IoCloseCircle } from "react-icons/io5";

type SearchGame = {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  version_parent?: number;
};

const buildCoverUrl = (game?: SearchGame | null) => {
  if (!game?.cover?.url) return "/placeholder-game.jpg";
  return `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`;
};

const getReleaseDate = (game?: SearchGame | null) => {
  if (!game?.first_release_date) return null;
  return new Date(game.first_release_date * 1000);
};

export default function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, profile } = useUser();
  const { games: trackedGames } = useGames();
  const uid = user?.uid;
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loadedUserImages, setLoadedUserImages] = useState<
    Record<string, boolean>
  >({});

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

  const mixedResults = useMemo(() => {
    const users = userResults.map((u) => ({
      type: "user",
      id: `u_${u.id}`,
      data: u,
    }));
    const games = results.map((g) => ({
      type: "game",
      id: `g_${g.id}`,
      data: g,
    }));
    return [...users, ...games];
  }, [userResults, results]);

  const selectedIndex = useMemo(
    () => mixedResults.findIndex((r) => r.id === selectedResultId),
    [mixedResults, selectedResultId],
  );

  const selectedMixed = useMemo(() => {
    if (!mixedResults.length) return null;
    return (
      mixedResults.find((r) => r.id === selectedResultId) ??
      mixedResults[0] ??
      null
    );
  }, [mixedResults, selectedResultId]);

  const selectedGame = useMemo(() => {
    if (!results.length) return null;
    return (
      results.find((game) => game.id === selectedGameId) ?? results[0] ?? null
    );
  }, [results, selectedGameId]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setUserResults([]);
    setError(null);
    setLoading(false);
    setSelectedGameId(null);
    setSelectedResultId(null);
    setLoadedUserImages({});
    inputRef.current?.focus();
  };

  const handleCloseModal = () => {
    handleClear();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseModal();
        return;
      }

      if (!mixedResults.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex =
          selectedIndex < mixedResults.length - 1 ? selectedIndex + 1 : 0;
        const next = mixedResults[nextIndex];
        setSelectedResultId(next?.id ?? null);
        if (next?.type === "game") setSelectedGameId((next.data as any).id);
        else setSelectedGameId(null);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex =
          selectedIndex > 0 ? selectedIndex - 1 : mixedResults.length - 1;
        const next = mixedResults[nextIndex];
        setSelectedResultId(next?.id ?? null);
        if (next?.type === "game") setSelectedGameId((next.data as any).id);
        else setSelectedGameId(null);
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
  }, [isOpen, onClose, mixedResults, selectedIndex]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setUserResults([]);
      setLoading(false);
      setError(null);
      setSelectedGameId(null);
      setSelectedResultId(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const [igdbRes, users] = await Promise.all([
          fetch("/api/igdb/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() }),
          }),
          searchUsersByUsername(query.trim(), 20, profile?.username),
        ]);

        if (!igdbRes.ok) throw new Error("Search request failed");

        const data = await igdbRes.json();
        const withCovers = (data as SearchGame[]).filter(
          (game) => game.cover && game.cover.url,
        );

        setResults(withCovers);
        setUserResults(users || []);

        setSelectedGameId(withCovers[0]?.id ?? null);
        setSelectedResultId(
          users?.[0]
            ? `u_${users[0].id}`
            : withCovers[0]
              ? `g_${withCovers[0].id}`
              : null,
        );
      } catch (err) {
        console.error(err);
        setResults([]);
        setUserResults([]);
        setSelectedGameId(null);
        setSelectedResultId(null);
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profile?.username, query]);

  useEffect(() => {
    setLoadedUserImages({});
  }, [userResults]);

  useEffect(() => {
    if (!resultsRef.current || !selectedResultId) return;

    const el = resultsRef.current.querySelector(
      `[data-mixed-id="${selectedResultId}"]`,
    ) as HTMLElement | null;

    if (el) {
      el.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedResultId]);

  const handleQuickAdd = async (game: SearchGame) => {
    if (!uid) {
      toast.error("You must be logged in to track games.");
      return;
    }

    const existing = trackedById.get(game.id);

    if (existing) {
      handleClear();
      router.push(`/game/${game.id}`);
      return;
    }

    try {
      const gameRef = doc(db, "users", uid, "games_igdb", String(game.id));

      await setDoc(gameRef, {
        name: game.name,

        igdb: {
          id: game.id,
          name: game.name,
          cover: buildCoverUrl(game),
          releaseDate: getReleaseDate(game),
        },

        my_rating: null,
        playtime: 0,
        progress: 0,

        review: {
          text: "",
          sticker: null,
        },

        status: "Want To Play",
        favorite: false,
        notInterested: false,
        playedSessions: [],

        recentActionSummary: "Added to My Collection",

        lastUpdated: new Date(),
      });

      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name}</span>
          <span className="text-black">added to collection</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to add game.");
    }
  };

  const activeCount = mixedResults.length;
  const resultCountLabel = loading
    ? "Searching..."
    : activeCount > 0
      ? `${activeCount} result${activeCount === 1 ? "" : "s"}`
      : query.trim().length >= 2
        ? "No matches"
        : "Start typing to search";

  const modal = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="theme-modal-backdrop fixed inset-0 z-120"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <div className="flex min-h-dvh items-start justify-center p-2 sm:p-4 md:items-center">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="theme-panel relative flex h-[min(92dvh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border shadow-[0_30px_120px_rgba(0,0,0,0.42)]"
            >
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(var(--theme-accent-rgb),0.06),transparent_28%,transparent_72%,rgba(var(--theme-accent-rgb),0.08))]" />
              <div className="relative z-10 flex items-center gap-3 border-b border-[var(--theme-border)] px-4 py-4 sm:px-5">
                <div className="theme-accent-soft-bg flex h-11 w-11 items-center justify-center rounded-2xl border shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.16)]">
                  <FiSearch size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="theme-accent-soft-text text-[11px] font-semibold uppercase tracking-[0.28em]">
                    Search Library
                  </p>
                  <div className="theme-surface-alt mt-2 flex items-center gap-2 rounded-2xl border px-3">
                    <FiSearch className="theme-text-muted shrink-0" size={16} />
                    <input
                      autoFocus
                      ref={inputRef}
                      className="theme-text h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-[color:var(--theme-text-muted)]"
                      placeholder="Search games, editions, remasters..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="theme-surface theme-hover-surface theme-text-muted inline-flex h-8 w-8 items-center justify-center rounded-full border transition"
                        aria-label="Clear search"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="theme-surface theme-hover-surface theme-text-muted mt-6 h-11 items-center justify-center rounded-full border px-5 text-xs font-semibold uppercase tracking-[0.18em] transition hover:text-red-500 cursor-pointer"
                >
                  <IoCloseCircle size={25} />
                </button>
              </div>

              <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <section className="flex min-h-0 flex-col border-b border-[var(--theme-border)] md:border-b-0 md:border-r">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-3 sm:px-5">
                    <div>
                      <p className="theme-text text-sm font-semibold">
                        Results
                      </p>
                      <p className="theme-text-muted text-xs">
                        {resultCountLabel}
                      </p>
                    </div>
                    <div className="theme-surface hidden rounded-full border px-3 py-1 text-[11px] theme-text-muted sm:block">
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
                            className="theme-surface flex items-center gap-3 rounded-2xl border p-3"
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
                      <div className="theme-text-muted flex h-full flex-col items-center justify-center gap-2 text-center">
                        <p className="theme-text text-base font-semibold">
                          Search failed
                        </p>
                        <p className="text-sm">{error}</p>
                      </div>
                    ) : mixedResults.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="theme-surface theme-text-muted flex h-16 w-16 items-center justify-center rounded-3xl border">
                          <FiSearch size={24} />
                        </div>
                        <div>
                          <p className="theme-text text-base font-semibold">
                            {query.trim().length >= 2
                              ? "No results found"
                              : "Search for users or games"}
                          </p>
                          <p className="theme-text-muted mt-1 text-sm">
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
                        {mixedResults.map((item) => {
                          if (item.type === "game") {
                            const game: SearchGame = item.data;
                            const releaseDate = getReleaseDate(game);
                            const isSelected =
                              selectedResultId === `g_${game.id}`;
                            const existing = trackedById.get(game.id);

                            return (
                              <div
                                key={`g_${game.id}`}
                                data-mixed-id={`g_${game.id}`}
                                onClick={() => {
                                  setSelectedResultId(`g_${game.id}`);
                                  setSelectedGameId(game.id);
                                }}
                                className={`group rounded-2xl border transition ${
                                  isSelected
                                    ? "border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                                    : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)] hover:border-white/15 hover:bg-white/5"
                                }`}
                              >
                                <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                                  <img
                                    src={buildCoverUrl(game)}
                                    alt={game.name}
                                    className="h-18 w-14 shrink-0 rounded-xl border border-[var(--theme-border)] object-cover shadow-lg"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="theme-text truncate text-sm font-semibold sm:text-[15px]">
                                          {game.name}
                                          <span className="ml-2 inline-block rounded-full bg-cyan-600/8 px-2 py-0.5 text-[11px] text-cyan-200">
                                            Game
                                          </span>
                                        </p>
                                        <div className="theme-text-muted mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                          {releaseDate && (
                                            <span className="theme-surface inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                                              <FiCalendar size={11} />
                                              {releaseDate.getFullYear()}
                                            </span>
                                          )}
                                          {existing?.status && (
                                            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-100/85">
                                              {existing.status}
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-3 flex gap-2 md:hidden">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedResultId(
                                                `g_${game.id}`,
                                              );
                                              setSelectedGameId(game.id);
                                            }}
                                            className="theme-surface theme-hover-surface theme-text flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                                          >
                                            Preview
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleClear();
                                              handleQuickAdd(game);
                                            }}
                                            className={`flex-1 rounded-lg border px-3 py-0.5 md:py-1.5 text-xs font-semibold ${
                                              trackedById.has(game.id)
                                                ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                                                : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                                            }`}
                                          >
                                            {trackedById.has(game.id)
                                              ? "Open"
                                              : "Add"}
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onClose();
                                              router.push(`/game/${game.id}`);
                                            }}
                                            className="theme-surface theme-hover-surface theme-text flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-center"
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
                          }

                          // user item
                          const u = item.data;
                          const isSelectedUser =
                            selectedResultId === `u_${u.id}`;

                          return (
                            <div
                              key={`u_${u.id}`}
                              data-mixed-id={`u_${u.id}`}
                              onClick={() => setSelectedResultId(`u_${u.id}`)}
                              className={`group rounded-2xl border transition ${
                                isSelectedUser
                                  ? "border-rose-300/30 bg-rose-400/6 shadow-[0_0_18px_rgba(244,63,94,0.06)]"
                                  : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)] hover:border-white/15 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                                <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden">
                                  {u.avatar?.data ? (
                                    <div className="relative h-14 w-14">
                                      {!loadedUserImages[u.id] && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                          <span className="loading loading-spinner loading-sm text-cyan-300" />
                                        </div>
                                      )}
                                      <img
                                        src={u.avatar.data}
                                        alt=""
                                        aria-hidden="true"
                                        className={`h-14 w-14 object-cover transition-opacity duration-300 ${
                                          loadedUserImages[u.id]
                                            ? "opacity-100"
                                            : "opacity-0"
                                        }`}
                                        onLoad={() =>
                                          setLoadedUserImages((prev) => ({
                                            ...prev,
                                            [u.id]: true,
                                          }))
                                        }
                                      />
                                    </div>
                                  ) : (
                                    <div className="h-14 w-14 rounded-xl bg-zinc-800 flex items-center justify-center text-lg">
                                      {u.username?.[0]?.toUpperCase()}
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="theme-text truncate text-sm font-semibold sm:text-[15px]">
                                        {u.displayName || u.username}
                                        <span className="ml-2 inline-block rounded-full bg-rose-600/12 px-2 py-0.5 text-[11px] text-rose-300">
                                          User
                                        </span>
                                      </p>
                                      <div className="theme-text-muted mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                        <span className="text-xs text-zinc-400">
                                          {u.bio}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex gap-2 md:hidden">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedResultId(`u_${u.id}`);
                                      }}
                                      className="theme-surface theme-hover-surface theme-text flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                                    >
                                      Preview
                                    </button>

                                    <Link
                                      href={`/users/${u.username}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-1 rounded-lg border px-3 py-0.5 md:py-1.5 text-xs font-semibold border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                                    >
                                      View Profile
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}{" "}
                      </motion.div>
                    )}
                  </div>
                </section>

                <aside className="hidden min-h-0 flex-col md:flex">
                  <div className="border-b border-[var(--theme-border)] px-5 py-3">
                    <p className="theme-text text-sm font-semibold">
                      Quick Preview
                    </p>
                    <p className="theme-text-muted text-xs">
                      Inspect the selected game before opening its page.
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <AnimatePresence mode="wait">
                      {selectedMixed ? (
                        selectedMixed.type === "game" ? (
                          <motion.div
                            key={(selectedMixed.data as SearchGame).id}
                            className="space-y-4"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            {(() => {
                              const selectedGameObj =
                                selectedMixed.data as SearchGame;
                              return (
                                <div className="theme-surface overflow-hidden mx-auto rounded-[26px] lg:w-[360px] border">
                                  <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(var(--theme-accent-rgb),0.12),transparent_48%),linear-gradient(180deg,rgba(var(--theme-bg-rgb),0.72),rgba(var(--theme-bg-rgb),0.95))]">
                                    <motion.img
                                      className="max-h-[480px] w-full object-contain"
                                      key={selectedGameObj.id}
                                      src={buildCoverUrl(selectedGameObj)}
                                      initial={{ opacity: 0, scale: 0.96 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.2 }}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/45 to-transparent px-4 pb-4 pt-16">
                                      <p className="theme-accent-soft-text text-[11px] font-semibold uppercase tracking-[0.24em]">
                                        Selected Result
                                      </p>
                                      <h3 className="theme-text mt-2 text-2xl font-bold">
                                        {selectedGameObj.name}
                                      </h3>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="theme-surface-alt rounded-2xl border p-3">
                                        <p className="theme-text-muted text-[11px] uppercase tracking-[0.18em]">
                                          Release
                                        </p>
                                        <p className="theme-text mt-2 flex items-center gap-2 text-sm font-semibold">
                                          <FiClock
                                            size={14}
                                            className="text-cyan-200/70"
                                          />
                                          {getReleaseDate(selectedGameObj)
                                            ? getReleaseDate(
                                                selectedGameObj,
                                              )?.toLocaleDateString(undefined, {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                              })
                                            : "Unknown"}
                                        </p>
                                      </div>
                                      <div className="theme-surface-alt rounded-2xl border p-3">
                                        <p className="theme-text-muted text-[11px] uppercase tracking-[0.18em]">
                                          Library
                                        </p>
                                        <p className="theme-text mt-2 text-sm font-semibold">
                                          {trackedById.has(selectedGameObj.id)
                                            ? "Already tracked"
                                            : "Not tracked yet"}
                                        </p>
                                      </div>
                                    </div>

                                    {selectedGameObj.version_parent && (
                                      <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-3 text-sm text-amber-50/90">
                                        This result looks like a variant
                                        edition. If you only want original
                                        releases, compare it before adding.
                                      </div>
                                    )}

                                    <div className="flex gap-2">
                                      {!trackedById.has(selectedGameObj.id) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleQuickAdd(selectedGameObj)
                                          }
                                          disabled={!uid}
                                          className={`inline-flex h-10 flex-1 items-center justify-center rounded-2xl text-sm font-semibold transition ${
                                            uid
                                              ? trackedById.has(
                                                  selectedGameObj.id,
                                                )
                                                ? "border border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                                                : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                                              : "cursor-not-allowed border border-[var(--theme-border)] bg-[var(--theme-panel-alt)] text-[color:var(--theme-text-muted)] opacity-60"
                                          }`}
                                        >
                                          {trackedById.has(selectedGameObj.id)
                                            ? "Open Game"
                                            : "Add to Collection"}
                                        </button>
                                      )}
                                      <Link
                                        href={`/game/${selectedGameObj.id}`}
                                        onClick={onClose}
                                        className="theme-surface theme-hover-surface theme-text inline-flex h-10 flex-1 items-center justify-center rounded-2xl border text-sm font-semibold transition"
                                      >
                                        Go To Game Page
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`user-${selectedMixed.data.id}`}
                            className="space-y-4"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <div className="mx-auto lg:w-[360px]">
                              <ProfileCard
                                profile={{
                                  uid: selectedMixed.data.id,
                                  ...(selectedMixed.data as any),
                                }}
                              />

                              <div className="mt-3 flex gap-2">
                                <Link
                                  href={`/users/${(selectedMixed.data as any).username}`}
                                  onClick={onClose}
                                  className="theme-surface theme-hover-surface theme-text inline-flex h-10 flex-1 items-center justify-center rounded-2xl border text-sm font-semibold transition"
                                >
                                  View Profile
                                </Link>
                              </div>
                            </div>
                          </motion.div>
                        )
                      ) : (
                        <div className="theme-text-muted flex h-full items-center justify-center text-center">
                          Select a result to preview it here.
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </aside>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}
