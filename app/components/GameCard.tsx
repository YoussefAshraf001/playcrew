"use client";

import Link from "next/link";
import { useState } from "react";
import GameActionsDropdown from "./GameActionsDropdown";
import { MdBlock } from "react-icons/md";
import { FaClock, FaExclamation, FaStar } from "react-icons/fa";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";
import { PiDotsNineLight } from "react-icons/pi";
import PreReleaseBadge from "./PreReleaseBadge";

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

function DecodedGameCover({
  src,
  alt,
  lazy = false,
}: {
  src: string;
  alt: string;
  lazy?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [displayedSrc, setDisplayedSrc] = useState(src);

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 bg-zinc-800 transition-opacity duration-500 ${
          ready ? "opacity-0" : "animate-pulse opacity-100"
        }`}
      />
      <img
        src={displayedSrc}
        alt={alt}
        loading={lazy ? "lazy" : "eager"}
        decoding="async"
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onLoad={async (event) => {
          const image = event.currentTarget;
          try {
            await image.decode();
          } catch {
            // Reveal after load when explicit decoding is unavailable.
          }
          setReady(true);
        }}
        onError={() => {
          if (displayedSrc !== "/placeholder-game.jpg") {
            setDisplayedSrc("/placeholder-game.jpg");
            return;
          }
          setReady(true);
        }}
        className={`h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-out ${
          ready ? "opacity-100" : ""
        }`}
      />
    </>
  );
}

export default function GameCard({
  game,
  openEditModal,
  openConfirmModal,
  selectedStatus,
  releaseFilter,
  reorderMode,
  sortBy,
  showActions = true,
  posterLayout = false,
  onOpenSteamAssets,
}: any) {
  const [isCardHovered, setIsCardHovered] = useState(false);

  const releaseDate = parseReleaseDate(game?.igdb?.releaseDate);
  const coverSrc = game?.igdb?.cover || "/placeholder-game.jpg";

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
  const accessRibbon = (() => {
    switch (game?.preReleaseAccess?.type) {
      case "early-access":
        return "EARLY ACCESS";
      case "advanced-access":
        return "ADVANCED ACCESS";
      case "leaked":
        return "LEAKED BUILD";
      default:
        return null;
    }
  })();

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
    game?.notInterested === true ||
    game?.status === "Not Interested" ||
    game?.status === "Lost Interest";

  const showNotInterestedOverlay = isNotInterested;

  const hasRating =
    game?.my_rating !== null &&
    game?.my_rating !== undefined &&
    Number.isFinite(game.my_rating);

  const sortBadge = (() => {
    switch (sortBy) {
      case "tier":
        if (game.notInterested) {
          return "🚫 Lost Interest";
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
        ${posterLayout ? "w-full max-w-full" : "w-[225px] max-w-none"}
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
        {accessRibbon && game.preReleaseAccess?.type && (
          <div className="pointer-events-none absolute left-2 top-2 z-50 max-w-[calc(100%-3.5rem)] -translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            <PreReleaseBadge
              type={game.preReleaseAccess.type}
              label={accessRibbon}
            />
          </div>
        )}
        {reorderMode ? (
          <div className="relative h-[330px] w-full overflow-hidden">
            <DecodedGameCover key={coverSrc} src={coverSrc} alt={game.name} />
          </div>
        ) : (
          <Link href={`/game/${game.igdb.id}`} prefetch={false}>
            <div
              onContextMenu={(event) => {
                if (!onOpenSteamAssets) return;
                event.preventDefault();
                event.stopPropagation();
                onOpenSteamAssets(event, game);
              }}
              className={`relative w-full overflow-hidden ${
                posterLayout ? "aspect-[2/3] h-auto" : "h-[330px]"
              }`}
            >
              <DecodedGameCover
                key={coverSrc}
                src={coverSrc}
                alt={game.name}
                lazy
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
                className={`
                absolute inset-0
                transition-all duration-300
                opacity-0 group-hover:opacity-100
              `}
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
                      Lost Interest
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
                        <span
                          className="flex items-center gap-1"
                          style={{ color: "#fcd34d" }}
                        >
                          <FaStar
                            size={12}
                            style={{
                              color: "#fcd34d",
                              filter:
                                "drop-shadow(0 0 6px rgba(252, 211, 77, 0.8))",
                            }}
                          />
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
