"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import HeroSection from "@/app/components/HeroSection";
import GenreRow from "@/app/components/GenreRow";
import SearchBar from "@/app/components/SearchBar";
import LoadingSpinner from "@/app/components/LoadingSpinner";

import { Game } from "@/app/types/game";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

const GENRES = [
  "action",
  "shooter",
  "casual",
  "adventure",
  "indie",
  "massively-multiplayer",
  "fighting",
];

export default function ExplorePage() {
  const [trending, setTrending] = useState<Game[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [sections, setSections] = useState<Record<string, Game[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      try {
        if (!API_KEY) throw new Error("Missing NEXT_PUBLIC_RAWG_API_KEY");

        // Trending list
        const trendingRes = await fetch(
          `https://api.rawg.io/api/games/lists/popular?key=${API_KEY}&page_size=10`
        );
        const trendingData = await trendingRes.json();

        // Trending with details
        const trendingFull = await Promise.all(
          trendingData.results.map(async (game: any) => {
            const detailRes = await fetch(
              `https://api.rawg.io/api/games/${game.id}?key=${API_KEY}`
            );
            const details = await detailRes.json();
            return { ...game, details };
          })
        );

        setTrending(trendingFull);

        // Genre sections
        const genreSections: Record<string, any[]> = {};
        for (const genre of GENRES) {
          const res = await fetch(
            `https://api.rawg.io/api/games?key=${API_KEY}&genres=${genre}&page_size=30`
          );
          const data = await res.json();

          const detailedGames = await Promise.all(
            data.results.map(async (game: any) => {
              const detailRes = await fetch(
                `https://api.rawg.io/api/games/${game.id}?key=${API_KEY}`
              );
              const details = await detailRes.json();
              return { ...game, details };
            })
          );

          genreSections[genre] = detailedGames;
        }

        setSections(genreSections);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <motion.main
      className="min-h-screen bg-black text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🔎 Top Search Bar */}
      <div className="w-full flex py-6 justify-center pl-32 border-b border-[#333]">
        <SearchBar />
      </div>

      {/* Main layout */}
      <div className="flex w-full gap-8 max-w-screen overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto space-y-16 pb-20">
          {/* HERO */}
          {trending.length > 0 && (
            <HeroSection
              trending={trending}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />
          )}

          {/* GENRE ROWS */}
          {Object.entries(sections).map(([genre, games]) => (
            <GenreRow key={genre} title={genre} games={games} />
          ))}
        </div>
      </div>
    </motion.main>
  );
}

// "use client";

// import { useEffect, useState } from "react";
// import { motion } from "framer-motion";
// import toast from "react-hot-toast";

// import HeroSection from "../../components/HeroSection";
// import LoadingSpinner from "@/app/components/LoadingSpinner";
// import GenreRow from "@/app/components/GenreRow";
// import RecentlyActive from "@/app/components/RecentlyActive";
// import FriendsPanel from "@/app/components/FriendsPanel";
// import { useUser } from "@/app/context/UserContext";
// import { Game } from "@/app/types/game";

// const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

// const GENRES = [
//   "action",
//   "shooter",
//   "casual",
//   "adventure",
//   "indie",
//   "massively-multiplayer",
//   "fighting",
// ];

// export default function ExplorePage() {
//   const { user } = useUser();

//   const [trending, setTrending] = useState<Game[]>([]);
//   const [activeIndex, setActiveIndex] = useState<number>(0);
//   const [sections, setSections] = useState<Record<string, Game[]>>({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     async function loadGames() {
//       try {
//         if (!API_KEY) throw new Error("Missing NEXT_PUBLIC_RAWG_API_KEY");

//         // -------------------------
//         // 1. Fetch Trending List
//         // -------------------------
//         const trendingRes = await fetch(
//           `https://api.rawg.io/api/games/lists/popular?key=${API_KEY}&page_size=10`
//         );

//         if (!trendingRes.ok) throw new Error("Failed to fetch trending");
//         const trendingData = await trendingRes.json();

//         // Fetch FULL DETAILS for each trending game
//         const trendingWithDetails = await Promise.all(
//           trendingData.results.map(async (game: any) => {
//             const detailRes = await fetch(
//               `https://api.rawg.io/api/games/${game.id}?key=${API_KEY}`
//             );
//             const details = await detailRes.json();
//             return { ...game, details };
//           })
//         );

//         setTrending(trendingWithDetails);

//         // -------------------------
//         // 2. Fetch Games by Genre
//         // -------------------------
//         const genreSections: Record<string, any[]> = {};

//         for (const genre of GENRES) {
//           const res = await fetch(
//             `https://api.rawg.io/api/games?key=${API_KEY}&genres=${genre}&page_size=30`
//           );
//           if (!res.ok) continue;

//           const listData = await res.json();

//           // Fetch FULL DETAILS for each game in that genre
//           const detailedGames = await Promise.all(
//             listData.results.map(async (game: any) => {
//               const detailRes = await fetch(
//                 `https://api.rawg.io/api/games/${game.id}?key=${API_KEY}`
//               );
//               const details = await detailRes.json();
//               return { ...game, details };
//             })
//           );

//           genreSections[genre] = detailedGames;
//         }

//         setSections(genreSections);
//       } catch (err: any) {
//         setError(err.message);
//         toast.error(err.message);
//       } finally {
//         setLoading(false);
//       }
//     }

//     loadGames();
//   }, []);

//   if (loading) return <LoadingSpinner />;

//   return (
//     <motion.main
//       className="min-h-screen bg-black text-white overflow-hidden"
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       transition={{ duration: 0.8 }}
//     >
//       {/* Top Navbar */}
//       <div className="w-full flex py-6 justify-center pl-32 border-b border-[#333]">
//         <input
//           type="text"
//           placeholder="Search games..."
//           className="bg-[#2a2a2a] text-white rounded-lg px-4 py-2 w-1/3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
//         />
//       </div>

//       {/* Main Content: Left + Right */}
//       <div className="flex w-full gap-8 max-w-screen overflow-hidden">
//         {/* Left Column */}
//         <div className="flex-1 min-w-0 overflow-y-auto space-y-12">
//           {trending.length > 0 && (
//             <HeroSection
//               trending={trending}
//               activeIndex={activeIndex}
//               setActiveIndex={setActiveIndex}
//             />
//           )}

//           {Object.entries(sections).map(([genre, games]) => (
//             <GenreRow key={genre} title={genre} games={games} />
//           ))}
//         </div>
//       </div>
//     </motion.main>
//   );
// }
