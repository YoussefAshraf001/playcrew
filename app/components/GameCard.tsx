"use client";

import Link from "next/link";
import { useState } from "react";
import GameActionsDropdown from "./GameActionsDropdown";
export default function GameCard({
  game,
  openEditModal,
  openConfirmModal,
}: any) {
  const [loaded, setLoaded] = useState(false);

  const getReleaseDate = () => {
    const d = game?.igdb?.releaseDate;
    if (!d) return null;

    // Firestore Timestamp
    if (typeof d === "object" && "seconds" in d) {
      return new Date(d.seconds * 1000);
    }

    // Already a Date
    if (d instanceof Date) {
      return d;
    }

    // Unix timestamp
    if (typeof d === "number") {
      return new Date(d < 1e12 ? d * 1000 : d);
    }

    // ISO string
    if (typeof d === "string") {
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  const releaseDate = getReleaseDate();

  const isReleased =
    releaseDate instanceof Date &&
    !isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() <= Date.now();

  return (
    <div
      className="
    group
    relative
    bg-zinc-900/80
    rounded-xl
    overflow-hidden
    shadow-md
    hover:shadow-xl
    transition-all
    duration-300
  "
    >
      {/* Actions */}
      <div className="absolute right-0 z-20">
        <GameActionsDropdown
          game={game}
          openEditModal={openEditModal}
          openConfirmModal={openConfirmModal}
        />
      </div>

      {/* Cover */}
      <Link href={`/game/${game.igdb.id}`} prefetch={false}>
        <div className="relative w-full aspect-3/4 overflow-hidden">
          {!loaded && (
            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
          )}

          <img
            src={game.igdb.cover || "/placeholder-game.jpg"}
            alt={game.name}
            onLoad={() => setLoaded(true)}
            className={`
          w-full h-full object-cover
          transition-all duration-500
          ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"}
          group-hover:scale-[1.10]
        `}
          />

          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/20 to-transparent" />
        </div>
      </Link>

      {/* Info */}
      <div className="px-3 pt-2 h-[50px] flex flex-col justify-center">
        {isReleased ? (
          <>
            {/* Rating + Time */}
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-zinc-300">
                {Math.floor(game.playtime ?? 0)}h{" "}
                {Math.round(((game.playtime ?? 0) % 1) * 60)}m
              </span>

              <span className="text-yellow-400 font-medium">
                ★ {game.my_rating ?? "Not Rated Yet"}
              </span>
            </div>

            {/* Progress */}
            <div className="w-full h-[5px] bg-white/10 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${game.progress ?? 0}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center pb-2">
            <span className={`text-sm text-zinc-300`}>
              {releaseDate
                ? releaseDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "TBA"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// import { motion } from "framer-motion";
// import GameActionsDropdown from "./GameActionsDropdown";
// import Link from "next/link";
// import { useState } from "react";

// export default function GameCard({
//   game,
//   openEditModal,
//   openConfirmModal,
// }: any) {
//   const [loaded, setLoaded] = useState(false);

//   const getReleaseDate = () => {
//     const d = game?.igdb?.releaseDate;
//     if (!d) return null;

//     // Firestore Timestamp
//     if (typeof d === "object" && "seconds" in d) {
//       return new Date(d.seconds * 1000);
//     }

//     // Already a Date
//     if (d instanceof Date) {
//       return d;
//     }

//     // Unix timestamp
//     if (typeof d === "number") {
//       return new Date(d < 1e12 ? d * 1000 : d);
//     }

//     // ISO string
//     if (typeof d === "string") {
//       const parsed = new Date(d);
//       return isNaN(parsed.getTime()) ? null : parsed;
//     }

//     return null;
//   };

//   const releaseDate = getReleaseDate();

//   const isReleased =
//     releaseDate !== null && releaseDate.getTime() <= Date.now();

//   const hours = Math.floor(game.playtime ?? 0);
//   const minutes = Math.round(((game.playtime ?? 0) % 1) * 60);

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ duration: 0.35, ease: "easeOut" }}
//       className="
//   group relative rounded-lg overflow-hidden
//   bg-zinc-900
//   hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]
//   transition-all duration-300
// "
//     >
//       <GameActionsDropdown
//         game={game}
//         openEditModal={openEditModal}
//         openConfirmModal={openConfirmModal}
//       />

//       <Link href={`/game/${game.igdb.id}`} prefetch={false}>
//         <div className="relative w-full overflow-hidden">
//           {/* Skeleton */}
//           {!loaded && (
//             <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
//           )}

//           {/* Image */}
//           <img
//             src={game.igdb.cover || "/placeholder-game.jpg"}
//             alt={game.name}
//             className={`
//     w-full h-full object-contain
//     transition-transform duration-500 ease-out
//     group-hover:scale-105
//     ${loaded ? "opacity-100" : "opacity-0"}
//   `}
//             onLoad={() => setLoaded(true)}
//             loading="lazy"
//           />

//           {/* Gradient */}
//           <div className="absolute bottom-0 inset-x-0 h-20 bg-linear-to-t from-black/90 to-transparent" />

//           {/* Info */}
//           <div
//             className="
//   absolute bottom-0 w-full px-2 pb-2 text-white
//   transition-opacity duration-300
//   group-hover:opacity-100
// "
//           >
//             {/* <h3 className="text-[13px] font-semibold truncate">{game.name}</h3> */}
//             {isReleased ? (
//               <div className="flex items-center justify-between text-zinc-300 px-1">
//                 <span className="text-[13px]">
//                   {hours}h {minutes}m
//                 </span>
//                 <span className="text-yellow-400 text-[12px]">
//                   ★ {game.my_rating ?? "Not Rated Yet"}
//                 </span>
//               </div>
//             ) : (
//               <span className="text-xs text-zinc-300">
//                 {releaseDate
//                   ? releaseDate.toLocaleDateString("en-US", {
//                       month: "short",
//                       day: "numeric",
//                       year: "numeric",
//                     })
//                   : "TBA"}
//               </span>
//             )}
//           </div>
//         </div>
//       </Link>
//     </motion.div>
//   );
// }
