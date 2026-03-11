"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaStar } from "react-icons/fa";

interface SimilarGame {
  id: number;
  name: string;
  cover?: string;
  rating?: number;
  released?: number | null;
}

interface SimilarGamesGridProps {
  games: SimilarGame[];
  maxItems?: number;
}

export default function SimilarGamesGrid({
  games,
  maxItems = 20,
}: SimilarGamesGridProps) {
  const visibleGames = Array.isArray(games) ? games.slice(0, maxItems) : [];
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const container = carouselRef.current;
    if (!container) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const epsilon = 2;

    setCanScrollLeft(container.scrollLeft > epsilon);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - epsilon);
  };

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    updateScrollState();

    const onScroll = () => updateScrollState();
    const onResize = () => updateScrollState();

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [visibleGames.length]);

  const scrollCarousel = (direction: -1 | 1) => {
    const container = carouselRef.current;
    if (!container) return;
    const amount =
      typeof window !== "undefined" && window.innerWidth >= 1024
        ? container.clientWidth
        : Math.max(220, Math.floor(container.clientWidth * 0.7));
    container.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  if (visibleGames.length === 0) {
    return (
      <div className="w-full lg:w-[1360px] h-48 mx-auto flex items-center justify-center">
        <p className="text-sm text-white/60">No similar games found.</p>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[1360px] h-48 mx-auto">
      <div className="relative w-full h-full">
        <button
          type="button"
          onClick={() => scrollCarousel(-1)}
          disabled={!canScrollLeft}
          aria-label="Scroll similar games left"
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border backdrop-blur-sm shadow-md transition ${
            canScrollLeft
              ? "border-white/35 bg-zinc-900/85 text-white hover:bg-zinc-800 cursor-pointer"
              : "border-white/15 bg-zinc-900/45 text-white/35 cursor-not-allowed"
          }`}
        >
          {"<"}
        </button>

        <div
          ref={carouselRef}
          className="flex gap-4 lg:gap-3 overflow-x-auto hide-scrollbar h-full scroll-smooth"
        >
          {visibleGames.map((similar) => {
            const releasedUnix =
              typeof similar.released === "number" ? similar.released : null;
            const hasReleaseDate = releasedUnix !== null;
            const isUpcoming =
              releasedUnix !== null && releasedUnix * 1000 > Date.now();

            return (
              <Link
                key={similar.id}
                href={`/game/${similar.id}`}
                className="group relative overflow-hidden rounded-lg shrink-0 w-[336px] lg:w-[140px] h-full"
              >
                <img
                  src={similar.cover || "/placeholder-game.jpg"}
                  alt={similar.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="text-xs font-semibold text-white line-clamp-2">
                    {similar.name}
                  </p>
                  <div className="mt-1 text-xs text-white/80">
                    {!hasReleaseDate ? (
                      "TBA"
                    ) : isUpcoming ? (
                      "Upcoming"
                    ) : similar.rating ? (
                      <div className="flex items-center gap-1 text-xs font-semibold">
                        <FaStar size={12} className="text-amber-300" />
                        <span>{Math.round(similar.rating)}</span>
                      </div>
                    ) : (
                      "Not Rated"
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCarousel(1)}
          disabled={!canScrollRight}
          aria-label="Scroll similar games right"
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border backdrop-blur-sm shadow-md transition ${
            canScrollRight
              ? "border-white/35 bg-zinc-900/85 text-white hover:bg-zinc-800 cursor-pointer"
              : "border-white/15 bg-zinc-900/45 text-white/35 cursor-not-allowed"
          }`}
        >
          {">"}
        </button>
      </div>
    </div>
  );
}
