"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight, FaStar } from "react-icons/fa";

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
  const scrollPositionRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loadedCovers, setLoadedCovers] = useState<Record<string, boolean>>({});

  const markCoverLoaded = (key: string) => {
    setLoadedCovers((current) =>
      current[key] ? current : { ...current, [key]: true },
    );
  };

  useEffect(() => {
    const container = carouselRef.current;
    if (!container || visibleGames.length < 2) return;

    let animationFrame = 0;
    const speed = 0.35;

    const rotate = () => {
      if (!isPaused) {
        const loopWidth = container.scrollWidth / 2;
        scrollPositionRef.current += speed;
        if (scrollPositionRef.current >= loopWidth) {
          scrollPositionRef.current -= loopWidth;
        }
        container.scrollLeft = scrollPositionRef.current;
      }
      animationFrame = window.requestAnimationFrame(rotate);
    };

    animationFrame = window.requestAnimationFrame(rotate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isPaused, visibleGames.length]);

  const scrollCarousel = (direction: -1 | 1) => {
    const container = carouselRef.current;
    if (!container) return;
    const loopWidth = container.scrollWidth / 2;
    const amount = Math.max(220, Math.floor(container.clientWidth * 0.75));

    if (direction < 0 && container.scrollLeft <= 2) {
      container.scrollLeft = loopWidth;
    } else if (direction > 0 && container.scrollLeft >= loopWidth - 2) {
      container.scrollLeft = 0;
    }

    container.scrollBy({ left: direction * amount, behavior: "smooth" });
    window.setTimeout(() => {
      scrollPositionRef.current = container.scrollLeft;
    }, 450);
  };

  const carouselGames =
    visibleGames.length > 1 ? [...visibleGames, ...visibleGames] : visibleGames;

  if (visibleGames.length === 0) {
    return (
      <div className="w-full lg:w-[1360px] h-48 mx-auto flex items-center justify-center">
        <p className="text-sm text-white/60">No similar games found.</p>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[1360px] h-48 mx-auto">
      <div
        className="group/carousel relative h-full w-full"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsPaused(false);
          }
        }}
      >
        <button
          type="button"
          onClick={() => scrollCarousel(-1)}
          disabled={visibleGames.length < 2}
          aria-label="Scroll similar games left"
          className="absolute left-2 top-1/2 z-20 grid h-10 w-10 -translate-x-2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/65 text-white opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-[var(--theme-accent)] hover:bg-black/80 focus:translate-x-0 focus:opacity-100 focus:outline-none disabled:hidden group-hover/carousel:translate-x-0 group-hover/carousel:opacity-100"
        >
          <FaChevronLeft size={14} aria-hidden="true" />
        </button>

        <div
          ref={carouselRef}
          onScroll={(event) => {
            if (isPaused) scrollPositionRef.current = event.currentTarget.scrollLeft;
          }}
          className="hide-scrollbar flex h-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth lg:gap-3"
        >
          {carouselGames.map((similar, index) => {
            const releasedUnix =
              typeof similar.released === "number" ? similar.released : null;
            const hasReleaseDate = releasedUnix !== null;
            const isUpcoming =
              releasedUnix !== null && releasedUnix * 1000 > Date.now();
            const coverKey = `${similar.id}:${similar.cover ?? "placeholder"}`;
            const coverLoaded = Boolean(loadedCovers[coverKey]);

            return (
              <Link
                key={`${similar.id}-${index}`}
                href={`/game/${similar.id}`}
                aria-label={`Open ${similar.name}`}
                className="group relative h-full w-[336px] shrink-0 snap-start overflow-hidden rounded-lg lg:w-[140px]"
              >
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 bg-white/[0.07] transition-opacity duration-300 ${
                    coverLoaded ? "opacity-0" : "animate-pulse opacity-100"
                  }`}
                />
                <img
                  src={similar.cover || "/placeholder-game.jpg"}
                  alt=""
                  onLoad={() => markCoverLoaded(coverKey)}
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (!image.src.endsWith("/placeholder-game.jpg")) {
                      image.src = "/placeholder-game.jpg";
                      return;
                    }
                    markCoverLoaded(coverKey);
                  }}
                  className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-105 ${
                    coverLoaded ? "opacity-100" : "opacity-0"
                  }`}
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
          disabled={visibleGames.length < 2}
          aria-label="Scroll similar games right"
          className="absolute right-2 top-1/2 z-20 grid h-10 w-10 translate-x-2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/65 text-white opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-[var(--theme-accent)] hover:bg-black/80 focus:translate-x-0 focus:opacity-100 focus:outline-none disabled:hidden group-hover/carousel:translate-x-0 group-hover/carousel:opacity-100"
        >
          <FaChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
