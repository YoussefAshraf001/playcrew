"use client";

import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { AnimatePresence } from "framer-motion";
import GameModal from "./GameModal";
import Link from "next/link";
import { GoArrowRight } from "react-icons/go";
import { GrView } from "react-icons/gr";

export default function GenreRow({
  title,
  user,
  games,
  savedGames,
  setSavedGames,
}: {
  title: string;
  games: any[];
  user?: any;
  savedGames: Record<string, any>;
  setSavedGames: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  const scroll = (dir: number) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir * 400, behavior: "smooth" });
    setTimeout(updateScrollState, 300);
  };

  useEffect(() => {
    updateScrollState();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    return () => el.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <section className="relative mb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{title}</h2>

        <div className="flex gap-3">
          <button
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            className={`p-3 rounded-full transition ${
              canScrollLeft
                ? "bg-white/10 hover:bg-cyan-400/20 hover:scale-110"
                : "bg-white/5 opacity-30 cursor-not-allowed"
            }`}
          >
            <FiArrowLeft />
          </button>

          <button
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            className={`p-3 rounded-full transition ${
              canScrollRight
                ? "bg-white/10 hover:bg-cyan-400/20 hover:scale-110"
                : "bg-white/5 opacity-30 cursor-not-allowed"
            }`}
          >
            <FiArrowRight />
          </button>
        </div>
      </div>

      {/* ROW */}
      <div
        ref={rowRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
      >
        {games.map((game) => {
          return (
            <div key={game.id} className="group snap-start min-w-60">
              {/* IMAGE */}
              <div className="relative rounded-2xl overflow-hidden">
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
                  className="
                    h-[330px] w-full object-cover
                    transition-transform duration-500
                    group-hover:scale-105
                  "
                />

                {/* BUTTONS (ONLY THING THAT HOVERS) */}
                <div
                  className="
                    absolute inset-0 flex items-end justify-center pb-4
                    opacity-0 group-hover:opacity-100
                    transition
                  "
                >
                  <div className="flex gap-3">
                    {game.videos?.[0]?.video_id && (
                      <button
                        onClick={() => setSelectedGame(game)}
                        className="
                          inline-flex items-center gap-2
                          px-3 py-1.5 rounded-full
                          bg-black/70 hover:bg-zinc-700/90
                          text-sm font-semibold cursor-pointer duration-300 ease-in-out transition-all
                        "
                      >
                        <GrView />
                        Quick View
                      </button>
                    )}

                    <Link href={`/game/${game.id}`} prefetch={false}>
                      <button
                        className="
                          inline-flex items-center gap-2
                          px-3 py-1.5 rounded-full
                          bg-black/70 hover:bg-zinc-700/90
                          text-sm font-semibold cursor-pointer duration-300 ease-in-out transition-all
                        "
                      >
                        <GoArrowRight />
                        Go
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* TEXT ALWAYS VISIBLE */}
              <div className="mt-2 px-1">
                <p className="text-sm font-semibold text-white truncate">
                  {game.name}
                </p>

                {/* RATING */}
                {game.first_release_date &&
                new Date(game.first_release_date * 1000) > new Date() ? (
                  <p className="text-xs text-yellow-400">
                    ⭐ Not out yet — no rating
                  </p>
                ) : typeof game.rating === "number" && game.rating > 0 ? (
                  <p className="text-xs text-yellow-400 font-bold">
                    ⭐ {Math.round(game.rating)}/100
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">Not rated</p>
                )}

                {/* RELEASE DATE */}
                <p className="text-[12px] text-gray-300">
                  {game.first_release_date
                    ? (() => {
                        const releaseDate = new Date(
                          game.first_release_date * 1000,
                        );
                        const now = new Date();

                        const label =
                          releaseDate > now ? "Releases on" : "Released on";

                        return `${label}: ${releaseDate.toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}`;
                      })()
                    : "Release: TBA"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
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
