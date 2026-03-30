"use client";

import Link from "next/link";
import { useState } from "react";
import GameActionsDropdown from "./GameActionsDropdown";
import { MdBlock } from "react-icons/md";
import { FaClock, FaExclamation, FaStar } from "react-icons/fa";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
export default function GameCard({
  game,
  openEditModal,
  openConfirmModal,
}: any) {
  const [loaded, setLoaded] = useState(false);

  const releaseDate = parseReleaseDate(game?.igdb?.releaseDate);
  const isReleased =
    releaseDate instanceof Date &&
    !isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() <= Date.now();
  const formattedReleaseDate = formatReleaseDate(
    game?.igdb?.releaseDate,
    game?.igdb?.releaseDatePrecision,
  );

  const isNotInterested = game?.notInterested === true;
  const hasRating =
    game?.my_rating !== null &&
    game?.my_rating !== undefined &&
    Number.isFinite(game.my_rating);

  return (
    <div
      className="
          group
          relative
          w-53
          max-w-none
          bg-zinc-900/80
          rounded-xl
          overflow-visible
        shadow-md
        hover:shadow-xl
        transition-all
        duration-300
        "
    >
      <div className="absolute right-0 z-20">
        <GameActionsDropdown
          game={game}
          openEditModal={openEditModal}
          openConfirmModal={openConfirmModal}
        />
      </div>

      <Link href={`/game/${game.igdb.id}`} prefetch={false}>
        <div className="relative h-[280px] w-full overflow-hidden rounded-t-xl">
          {!loaded && (
            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
          )}

          <img
            src={game.igdb.cover || "/placeholder-game.jpg"}
            alt={game.name}
            onLoad={() => setLoaded(true)}
            className={`
              w-full h-full object-cover
              transform-gpu scale-[1.001]
              transition-transform duration-500
              ${loaded ? "opacity-100" : "opacity-0"}
              group-hover:scale-[1.10]
            `}
          />
        </div>
      </Link>

      <div className="h-[41px] px-3 py-2 flex flex-col justify-center">
        {isReleased ? (
          <>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="flex items-center gap-0.5 text-zinc-300">
                <FaClock size={7} />
                {Math.floor(game.playtime ?? 0)}h{" "}
                {Math.round(((game.playtime ?? 0) % 1) * 60)}m
              </span>

              <span
                className={`font-medium ${
                  isNotInterested ? "text-red-300" : "text-yellow-400"
                }`}
              >
                {isNotInterested ? (
                  <div className="flex items-center gap-1">
                    <MdBlock />
                    Not Interested
                  </div>
                ) : hasRating ? (
                  <div className="flex items-center gap-1">
                    <FaStar size={7} />

                    {formatRating(game.my_rating)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <FaExclamation size={10} />
                    Not Rated Yet
                  </div>
                )}
              </span>
            </div>

            <div className="w-full h-[5px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${game.progress ?? 0}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/75">
              Release Date
            </span>
            <span className="text-[12px] font-semibold text-white">
              {formattedReleaseDate}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
