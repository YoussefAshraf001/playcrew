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
  selectedStatus,
  releaseFilter,
}: any) {
  const [loaded, setLoaded] = useState(false);

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
        w-[225px]
        max-w-none
        transition-all
        duration-300
        hover:z-50
        hover:scale-[1.005]
        hover:-translate-y-1
      "
    >
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
        />
      </div>
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
        <Link href={`/game/${game.igdb.id}`} prefetch={false}>
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

            {/* Dark Overlay */}
            <div
              className={`
                absolute inset-0
                transition-opacity duration-300
                opacity-0 group-hover:opacity-100
                ${
                  isNotInterested
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
              {isNotInterested ? (
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

                  <p className="mt-2 text-sm text-zinc-400">
                    You've dismissed this game.
                  </p>
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

                    {/* <div className="mt-2 flex items-center justify-center text-xs">
                      <span className="text-zinc-400">Progress</span>
                      <span className="font-medium text-cyan-300">
                        {game.progress ?? 0}% Complete
                      </span>
                    </div> */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

// "use client";

// import Link from "next/link";
// import { useState } from "react";
// import GameActionsDropdown from "./GameActionsDropdown";
// import { MdBlock } from "react-icons/md";
// import { FaClock, FaExclamation, FaStar } from "react-icons/fa";
// import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";

// const formatRating = (rating: number) =>
//   Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
// export default function GameCard({
//   game,
//   openEditModal,
//   openConfirmModal,
// }: any) {
//   const [loaded, setLoaded] = useState(false);

//   const releaseDate = parseReleaseDate(game?.igdb?.releaseDate);
//   const isReleased =
//     releaseDate instanceof Date &&
//     !isNaN(releaseDate.getTime()) &&
//     releaseDate.getTime() <= Date.now();
//   const formattedReleaseDate = formatReleaseDate(
//     game?.igdb?.releaseDate,
//     game?.igdb?.releaseDatePrecision,
//   );

//   const isNotInterested = game?.notInterested === true;
//   const hasRating =
//     game?.my_rating !== null &&
//     game?.my_rating !== undefined &&
//     Number.isFinite(game.my_rating);

//   return (
//     <div
//       className="
//           group
//           relative
//           w-53
//           max-w-none
//           bg-zinc-900/80
//           border border-[var(--theme-border)]
//           rounded-xl
//           overflow-visible
//         shadow-md
//         hover:border-cyan-300/45
//         hover:shadow-[0_0_0_1px_rgba(34,211,238,0.24),0_0_24px_rgba(var(--theme-accent-rgb),0.22),0_18px_36px_rgba(0,0,0,0.38)]
//         transition-all
//         duration-300
//         "
//     >
//       <div className="absolute right-0 z-20">
//         <GameActionsDropdown
//           game={game}
//           openEditModal={openEditModal}
//           openConfirmModal={openConfirmModal}
//         />
//       </div>

//       <Link href={`/game/${game.igdb.id}`} prefetch={false}>
//         <div className="relative h-[280px] w-full overflow-hidden rounded-t-xl">
//           {!loaded && (
//             <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
//           )}

//           <img
//             src={game.igdb.cover || "/placeholder-game.jpg"}
//             alt={game.name}
//             onLoad={() => setLoaded(true)}
//             className={`
//               w-full h-full object-cover
//               transform-gpu scale-[1.001]
//               transition-transform duration-500
//               ${loaded ? "opacity-100" : "opacity-0"}
//               group-hover:scale-[1.021]
//             `}
//           />
//         </div>
//       </Link>

//       <div className="h-[41px] px-3 py-2 flex flex-col justify-center">
//         {isReleased ? (
//           <>
//             <div className="flex items-center justify-between text-[10px] mb-1">
//               <span className="flex items-center gap-0.5 text-zinc-300">
//                 <FaClock size={7} />
//                 {Math.floor(game.playtime ?? 0)}h{" "}
//                 {Math.round(((game.playtime ?? 0) % 1) * 60)}m
//               </span>

//               <span
//                 className={`font-medium ${
//                   isNotInterested ? "text-red-300" : "text-yellow-400"
//                 }`}
//               >
//                 {isNotInterested ? (
//                   <div className="flex items-center gap-1">
//                     <MdBlock />
//                     Not Interested
//                   </div>
//                 ) : hasRating ? (
//                   <div className="flex items-center gap-1">
//                     <FaStar size={7} />

//                     {formatRating(game.my_rating)}
//                   </div>
//                 ) : (
//                   <div className="flex items-center gap-1">
//                     <FaExclamation size={10} />
//                     Not Rated Yet
//                   </div>
//                 )}
//               </span>
//             </div>

//             <div className="w-full h-[5px] bg-white/10 rounded-full overflow-hidden">
//               <div
//                 className="h-full bg-cyan-500 transition-all duration-500"
//                 style={{ width: `${game.progress ?? 0}%` }}
//               />
//             </div>
//           </>
//         ) : (
//           <div className="flex flex-col items-center justify-center text-center">
//             <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/75">
//               Release Date
//             </span>
//             <span className="text-[12px] font-semibold text-white">
//               {formattedReleaseDate}
//             </span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
