// "use client";

// import { useRef } from "react";
// import { motion } from "framer-motion";
// import Image from "next/image";
// import Link from "next/link";

// interface GenreRowProps {
//   title: string;
//   games: any[];
// }

// export default function GenreRow({ title, games }: GenreRowProps) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);

//   const scroll = (dir: "left" | "right") => {
//     if (!scrollRef.current) return;
//     const amount = 350;
//     scrollRef.current.scrollBy({
//       left: dir === "left" ? -amount : amount,
//       behavior: "smooth",
//     });
//   };

//   return (
//     <section className="w-full px-10 mt-4">
//       {/* Header */}
//       <div className="flex justify-between items-center mb-4 pr-4">
//         <h2 className="text-2xl font-bold capitalize">{title}</h2>

//         {/* Arrows */}
//         <div className="flex gap-3">
//           <button
//             onClick={() => scroll("left")}
//             className="p-2 bg-white/10 hover:bg-white/20 rounded-full"
//           >
//             ◀
//           </button>
//           <button
//             onClick={() => scroll("right")}
//             className="p-2 bg-white/10 hover:bg-white/20 rounded-full"
//           >
//             ▶
//           </button>
//         </div>
//       </div>

//       {/* Card Row */}
//       <div
//         ref={scrollRef}
//         className="flex gap-5 overflow-x-auto no-scrollbar pb-6"
//       >
//         {games.map((game) => (
//           <Link
//             key={game.id}
//             href={`/game/${game.id}`}
//             className="min-w-[180px] max-w-[180px] rounded-xl overflow-hidden bg-[#1a1a1a] hover:scale-[1.04] transition"
//           >
//             <div className="relative w-full h-[250px]">
//               <Image
//                 src={game.background_image}
//                 alt={game.name}
//                 fill
//                 className="object-cover"
//               />
//             </div>

//             <div className="p-2">
//               <h3 className="text-sm font-semibold line-clamp-2">
//                 {game.name}
//               </h3>
//             </div>
//           </Link>
//         ))}
//       </div>
//     </section>
//   );
// }

"use client";

import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import GameCard from "./GameCard";
import { Game } from "../types/game";

interface GenreRowProps {
  title: string;
  games: Game[];
}

export default function GenreRow({ title, games }: GenreRowProps) {
  const scroll = (dir: "left" | "right") => {
    const row = document.getElementById(`row-${title}`);
    if (!row) return;
    const { scrollLeft, clientWidth } = row;
    const amount = dir === "left" ? -clientWidth / 1.2 : clientWidth / 1.2;
    row.scrollTo({ left: scrollLeft + amount, behavior: "smooth" });
  };

  return (
    <div className="relative max-w-[1860px] mx-auto px-4 sm:px-8">
      <h2 className="text-3xl font-bold capitalize mb-6 text-cyan-400">
        {title} Games
      </h2>

      {/* Scroll Arrows */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/60 rounded-full hover:bg-black transition"
      >
        <FaChevronLeft className="w-5 h-5 text-cyan-400" />
      </button>

      <button
        onClick={() => scroll("right")}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/60 rounded-full hover:bg-black transition"
      >
        <FaChevronRight className="w-5 h-5 text-cyan-400" />
      </button>

      {/* Horizontal Games Row */}
      <div
        id={`row-${title}`}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory scroll-smooth"
      >
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
