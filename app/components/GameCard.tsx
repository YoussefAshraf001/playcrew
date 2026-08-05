"use client";

import Link from "next/link";
import { useState } from "react";
import GameActionsDropdown from "./GameActionsDropdown";
import { MdBlock } from "react-icons/md";
import { FaClock, FaExclamation, FaStar } from "react-icons/fa";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";
import { PiDotsNineLight } from "react-icons/pi";

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

export default function GameCard({
  game,
  openEditModal,
  openConfirmModal,
  selectedStatus,
  releaseFilter,
  reorderMode,
  sortBy,
  showActions = true,
}: any) {
  const [loaded, setLoaded] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const releaseDate = parseReleaseDate(game?.igdb?.releaseDate);

  const isReleased =
    releaseDate instanceof Date &&
    !isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() <= Date.now();

  const showComingSoonOverlay =
    selectedStatus === "Want To Play" &&
    releaseFilter === "Unreleased" &&
    !isReleased;

  const formattedReleaseDate = formatReleaseDate(
    game?.igdb?.releaseDate,
    game?.igdb?.releaseDatePrecision,
  );

  const formatPlaytime = (playtime?: number | null) => {
    if (!playtime) return "0h";

    const hours = Math.floor(playtime);
    const minutes = Math.round((playtime % 1) * 60);

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const isNotInterested =
    game?.notInterested === true || game?.status === "Not Interested";

  const showNotInterestedOverlay = isNotInterested && selectedStatus === "All";

  const hasRating =
    game?.my_rating !== null &&
    game?.my_rating !== undefined &&
    Number.isFinite(game.my_rating);

  const sortBadge = (() => {
    switch (sortBy) {
      case "tier":
        if (game.notInterested) {
          return "🚫 Not Interested";
        }

        return hasRating
          ? `⭐ ${formatRating(game.my_rating)}/10`
          : "☆ Unrated";

      case "playtime":
        return formatPlaytime(game.playtime);

      case "progress":
        return `${game.progress ?? 0}% Complete`;

      case "release":
        return formattedReleaseDate;

      case "priority":
        if (game.wantToPlayOrder == null) return null;
        return game.wantToPlayOrder === 0
          ? "Up Next"
          : `#${game.wantToPlayOrder + 1}`;

      default:
        return null;
    }
  })();

  return (
    <div
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      className={`
        group
        relative
        w-[225px]
        max-w-none
        transition-all
        duration-300
        ${!reorderMode ? "hover:z-50 hover:scale-[1.005] hover:-translate-y-1" : "brightness-90"}
      `}
    >
      {reorderMode ? (
        <div
          className="
            absolute
            inset-0
            z-20
            flex
            flex-col
            items-center
            justify-center
            rounded-xl
            bg-black/60
            backdrop-blur-[1px]
            pointer-events-none
          "
        >
          <PiDotsNineLight className="mb-3 text-5xl text-white" />

          <span className="text-lg font-bold text-white">Drag To Reorder</span>
        </div>
      ) : showActions ? (
        <div
          className="
            absolute
            right-0
            z-[60]
            opacity-0
            scale-75
            transition-all
            duration-300
            ease-out
            group-hover:opacity-100
            group-hover:scale-100
            pointer-events-none
            group-hover:pointer-events-auto
          "
        >
          <GameActionsDropdown
            game={game}
            openEditModal={openEditModal}
            openConfirmModal={openConfirmModal}
            isHovered={isCardHovered}
          />
        </div>
      ) : null}
      <div
        className="
          relative
          bg-zinc-900/80
          rounded-xl
          overflow-hidden
          shadow-md
          transition-all
          duration-300
        hover:border-cyan-300/45
          hover:shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.45),0_0_32px_rgba(var(--theme-accent-rgb),0.35),0_18px_36px_rgba(0,0,0,0.5)]
        "
      >
        {reorderMode ? (
          <div className="relative h-[330px] w-full overflow-hidden">
            {!loaded && (
              <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
            )}

            <img
              src={game.igdb.cover || "/placeholder-game.jpg"}
              alt={game.name}
              onLoad={() => setLoaded(true)}
              className={`
                h-full
                w-full
                object-cover
                transition-all
                duration-500
                ${loaded ? "opacity-100" : "opacity-0"}
              `}
            />
          </div>
        ) : (
          <Link href={`/game/${game.igdb.id}`} prefetch={false}>
            <div className="relative h-[330px] w-full overflow-hidden">
              {!loaded && (
                <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
              )}

              <img
                src={game.igdb.cover || "/placeholder-game.jpg"}
                alt={game.name}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onLoad={() => setLoaded(true)}
                className={`
                  h-full
                  w-full
                  object-cover
                  transition-all
                  duration-500
                  ${loaded ? "opacity-100" : "opacity-0"}
                `}
              />

              {/* {sortBadge && !reorderMode && (
                <div
                  className={`
                    absolute
                    bottom-0
                    left-1/2
                    -translate-x-1/2
                    z-10
                    flex
                    h-7
                    items-center
                    justify-center
                    rounded-t-lg
                    border
                    border-zinc-400/10
                    bg-zinc-600/75
                    ${sortBy === "tier" ? "px-1" : "px-2"}
                    backdrop-blur-md
                    shadow-lg
                    transition-all
                    duration-300
                    ease-out
                    group-hover:translate-y-8
                    group-hover:opacity-0
                  `}
                >
                  <span className="text-xs font-medium leading-none text-white">
                    {sortBadge}
                  </span>
                </div>
              )} */}

              {/* Dark Overlay */}
              <div
                className={`
                  absolute inset-0
                  transition-opacity duration-300
                  opacity-0 group-hover:opacity-100
                  ${
                    showNotInterestedOverlay
                      ? "bg-black/85"
                      : showComingSoonOverlay
                        ? "bg-cyan-950/80"
                        : "bg-black/75"
                  }
                `}
              />

              {/* Hover Content */}
              <div
                className="
                absolute inset-0
                opacity-0
                transition-all duration-300
                group-hover:opacity-100
              "
              >
                {showNotInterestedOverlay ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <div
                      className="
                      flex h-20 w-20 items-center justify-center
                      rounded-full
                      border border-red-500/30
                      bg-red-500/15
                      backdrop-blur-sm
                      shadow-[0_0_30px_rgba(239,68,68,0.15)]
                    "
                    >
                      <MdBlock size={36} className="text-red-400" />
                    </div>

                    <h3 className="mt-5 text-lg font-semibold text-white">
                      Not Interested
                    </h3>
                  </div>
                ) : showComingSoonOverlay ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <div
                      className="
                      rounded-full
                      border border-cyan-500/30
                      bg-cyan-500/10
                      px-4 py-1.5
                      backdrop-blur-sm
                    "
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                        Coming Soon
                      </span>
                    </div>

                    <div className="mt-6 text-2xl font-bold text-white">
                      {formattedReleaseDate}
                    </div>
                  </div>
                ) : (
                  <div
                    className="
                    absolute inset-x-0 bottom-0
                    p-3
                    translate-y-4
                    transition-all duration-300
                    group-hover:translate-y-0
                  "
                  >
                    <h3 className="line-clamp-2 text-base font-bold text-white">
                      {game.name}
                    </h3>

                    <div className="mt-1 flex items-center gap-4 text-xs">
                      {hasRating ? (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <FaStar size={12} />
                          {formatRating(game.my_rating)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-300">
                          <FaExclamation size={10} />
                          Not Rated
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-zinc-300">
                        <FaClock size={11} />
                        {formatPlaytime(game.playtime)}
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-cyan-500"
                          style={{
                            width: `${game.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
