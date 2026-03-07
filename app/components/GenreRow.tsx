"use client";

import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import GameModal from "./GameModal";
import { GrView } from "react-icons/gr";
import { useRouter } from "next/navigation";
import { FaStar } from "react-icons/fa";

export default function GenreRow({
  title,
  user,
  games,
  savedGames,
  setSavedGames,
  hideHeader = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  title: string;
  games: any[];
  user?: any;
  savedGames: Record<string, any>;
  setSavedGames: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  hideHeader?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => Promise<void> | void;
}) {
  const BATCH_SIZE = 15;
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [displayCount, setDisplayCount] = useState(games.length);
  const restoreScrollLeftRef = useRef<number | null>(null);
  const prevCountRef = useRef(games.length);
  const prevHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHoldTriggeredRef = useRef(false);
  const suppressPrevClickRef = useRef(false);

  const updateScrollState = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  const scroll = (dir: number) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir * 420, behavior: "smooth" });
    setTimeout(updateScrollState, 260);
  };

  const beginPrevHold = () => {
    prevHoldTriggeredRef.current = false;
    if (prevHoldTimerRef.current) clearTimeout(prevHoldTimerRef.current);

    prevHoldTimerRef.current = setTimeout(() => {
      if (!rowRef.current) return;
      rowRef.current.scrollTo({ left: 0, behavior: "smooth" });
      prevHoldTriggeredRef.current = true;
      suppressPrevClickRef.current = true;
      setTimeout(updateScrollState, 320);
    }, 430);
  };

  const endPrevHold = () => {
    if (prevHoldTimerRef.current) {
      clearTimeout(prevHoldTimerRef.current);
      prevHoldTimerRef.current = null;
    }
  };

  useEffect(() => {
    updateScrollState();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    return () => el.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    return () => {
      if (prevHoldTimerRef.current) clearTimeout(prevHoldTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    restoreScrollLeftRef.current = null;
    if (!rowRef.current) return;
    rowRef.current.scrollLeft = 0;
    updateScrollState();
  }, [title]);

  useEffect(() => {
    if (!rowRef.current) return;
    rowRef.current.scrollLeft = 0;
    updateScrollState();
  }, []);

  useEffect(() => {
    const start = prevCountRef.current;
    const end = games.length;
    prevCountRef.current = end;

    if (start === end) {
      setDisplayCount(end);
      return;
    }

    const delta = Math.abs(end - start);
    const duration = Math.min(1200, Math.max(700, 450 + delta * 16));
    const startTime = performance.now();
    let rafId = 0;
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(t);
      const value = Math.round(start + (end - start) * eased);
      setDisplayCount(value);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [games.length]);

  useEffect(() => {
    if (restoreScrollLeftRef.current == null) return;
    if (!rowRef.current) return;

    const targetLeft = restoreScrollLeftRef.current;
    requestAnimationFrame(() => {
      if (!rowRef.current) return;
      rowRef.current.scrollLeft = targetLeft;
      restoreScrollLeftRef.current = null;
      updateScrollState();
    });
  }, [visibleCount, games.length]);

  const visibleGames = games.slice(0, visibleCount);
  const hasBufferedMore = visibleCount < games.length;
  const canLoadMore = hasBufferedMore || hasMore;

  return (
    <section className="relative mb-14 sm:mb-16">
      {!hideHeader && (
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-wide text-white sm:text-2xl">
              {title}
            </h2>
            {/* <span className="mt-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
              {displayCount}
            </span> */}
          </div>

          <div className="flex gap-2">
            <div className="group relative">
              <button
                onMouseDown={beginPrevHold}
                onMouseUp={endPrevHold}
                onMouseLeave={endPrevHold}
                onTouchStart={beginPrevHold}
                onTouchEnd={endPrevHold}
                onTouchCancel={endPrevHold}
                onClick={() => {
                  if (suppressPrevClickRef.current) {
                    suppressPrevClickRef.current = false;
                    return;
                  }
                  scroll(-1);
                }}
                disabled={!canScrollLeft}
                className={`rounded-full border p-2.5 transition ${
                  canScrollLeft
                    ? "border-white/20 bg-black/35 text-white hover:scale-105 hover:border-cyan-300/50 hover:bg-cyan-500/15"
                    : "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                }`}
              >
                <FiArrowLeft />
              </button>
              {canScrollLeft && (
                <div className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[10px] font-medium tracking-wide text-zinc-200 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  Hold to jump to start
                </div>
              )}
            </div>

            <button
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className={`rounded-full border p-2.5 transition ${
                canScrollRight
                  ? "border-white/20 bg-black/35 text-white hover:scale-105 hover:border-cyan-300/50 hover:bg-cyan-500/15"
                  : "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
              }`}
            >
              <FiArrowRight />
            </button>
          </div>
        </div>
      )}

      <div
        ref={rowRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scrollbar-hide sm:gap-5"
      >
        {visibleGames.map((game) => {
          const openGamePage = () => {
            router.push(`/game/${game.id}`);
          };

          const releaseDate = game.first_release_date
            ? new Date(game.first_release_date * 1000)
            : null;
          const isUpcoming = releaseDate ? releaseDate > new Date() : false;
          const releaseText = releaseDate
            ? `${isUpcoming ? "Releases" : "Released"} ${releaseDate.toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}`
            : "Release TBA";

          return (
            <motion.div
              key={game.id}
              className="group pt-2 relative w-[210px] shrink-0 snap-start cursor-pointer sm:w-[230px] lg:w-[245px]"
              onClick={openGamePage}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openGamePage();
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`Open ${game.name}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 shadow-[0_18px_35px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300/45 group-hover:shadow-[0_26px_55px_rgba(0,0,0,0.5)]">
                <img
                  src={
                    game.cover?.url
                      ? `https:${game.cover.url.replace(
                          "t_thumb",
                          "t_cover_big_2x",
                        )}`
                      : "/images/placeholder-cover.jpg"
                  }
                  alt={game.name}
                  className="h-[300px] w-full object-cover transition-transform duration-500 group-hover:scale-110 sm:h-[325px] lg:h-[345px]"
                />

                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                  <FaStar className="text-[10px] text-yellow-300" />
                  {typeof game.rating === "number" && game.rating > 0
                    ? `${(game.rating / 10).toFixed(1)}/10`
                    : "Not Rated"}
                </div>

                <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-12 transition-all duration-300 group-hover:pb-10">
                  <p className="truncate text-sm font-semibold text-white sm:text-base">
                    {game.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-300/90">
                    {releaseText}
                  </p>
                </div>

                {game.videos?.[0]?.video_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGame(game);
                    }}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 translate-y-2 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:border-cyan-300/60 hover:bg-cyan-500/20"
                  >
                    <GrView className="text-[12px]" />
                    Quick View
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}

        {canLoadMore && (
          <div className="w-[210px] shrink-0 snap-start sm:w-[230px] lg:w-[245px]">
            <button
              type="button"
              disabled={loadingMore}
              onClick={async () => {
                restoreScrollLeftRef.current = rowRef.current?.scrollLeft ?? 0;

                if (hasBufferedMore) {
                  setVisibleCount((prev) => prev + BATCH_SIZE);
                  return;
                }

                if (!onLoadMore || loadingMore) return;
                await onLoadMore();
                setVisibleCount((prev) => prev + BATCH_SIZE);
              }}
              className={`group flex h-full min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-500/8 px-4 text-center text-cyan-100 transition sm:min-h-[325px] lg:min-h-[345px] ${
                loadingMore
                  ? "cursor-wait opacity-70"
                  : "hover:border-cyan-300 hover:bg-cyan-500/16"
              }`}
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2 text-lg font-bold uppercase tracking-[0.08em]">
                  <span className="loading loading-infinity loading-lg scale-200" />
                </span>
              ) : (
                <>
                  <span className="mb-2 text-lg font-bold uppercase tracking-[0.08em]">
                    Load More
                  </span>
                  <span className="text-xs text-cyan-200/85">
                    {hasBufferedMore
                      ? `Show next ${Math.min(BATCH_SIZE, games.length - visibleCount)} games`
                      : `Fetch next ${BATCH_SIZE} games`}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedGame && (
          <GameModal
            key={selectedGame.id}
            game={selectedGame}
            user={user}
            savedGames={savedGames}
            setSavedGames={setSavedGames}
            onClose={() => setSelectedGame(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
