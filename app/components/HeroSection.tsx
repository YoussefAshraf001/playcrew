"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface Game {
  id: number;
  name: string;
  background_image: string;
  details?: {
    description_raw?: string;
    metacritic?: number;
    genres?: { name: string }[];
    clip?: {
      clip: string; // sometimes RAWG provides this, but often not
    };
    trailers?: { data: { max: string } }[]; // in case future support
    youtube?: string; // <-- You can store YouTube ID in your trending array
  };
}

interface HeroSectionProps {
  trending: Game[];
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function HeroSection({
  trending,
  activeIndex,
  setActiveIndex,
}: HeroSectionProps) {
  const intervalRef = useRef<number | null>(null);

  // -------------------------------------------------------------
  // Auto carousel cycle
  // -------------------------------------------------------------
  useEffect(() => {
    if (trending.length === 0) return;

    intervalRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % trending.length);
    }, 7000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [trending]);

  const handleSetActiveIndex = (i: number) => {
    setActiveIndex(i);

    // reset timer after manual click
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % trending.length);
    }, 7000);
  };

  const activeGame = trending[activeIndex];
  if (!activeGame) return null;

  // -------------------------------------------------------------
  // Prefer YouTube trailer -> RAWG clip -> fallback image
  // -------------------------------------------------------------
  const youtubeId = activeGame.details?.youtube;
  const rawgClip = activeGame.details?.clip?.clip;

  return (
    <section className="relative w-full h-[55vh] rounded-2xl overflow-hidden mb-20">
      {/* Background Video */}
      {youtubeId ? (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${youtubeId}`}
          className="absolute inset-0 w-full h-full object-cover"
          allow="autoplay; encrypted-media"
        />
      ) : rawgClip ? (
        <video
          src={rawgClip}
          autoPlay
          muted
          loop
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Image
          src={activeGame.background_image}
          alt={activeGame.name}
          fill
          priority
          className="object-cover opacity-80"
        />
      )}

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-linear-to-r from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

      {/* Tags */}
      <div className="absolute top-6 left-8 flex gap-3">
        {(activeGame.details?.genres || []).slice(0, 4).map((g) => (
          <span
            key={g.name}
            className="px-3 py-1 text-sm bg-white/10 border border-white/20 rounded-full backdrop-blur-sm"
          >
            {g.name}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="absolute left-8 bottom-16 max-w-xl">
        <motion.h1
          key={activeGame.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-5xl font-extrabold mb-3"
        >
          {activeGame.name}
        </motion.h1>

        <p className="text-gray-300 line-clamp-3 mb-6 text-sm max-w-md">
          {activeGame.details?.description_raw || ""}
        </p>

        <div className="flex items-center gap-4">
          <button className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition">
            Buy now <span className="text-green-500">$24.00</span>
          </button>

          <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition">
            ❤️
          </button>
        </div>
      </div>

      {/* Bottom indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
        {trending.map((_, i) => (
          <button
            key={i}
            onClick={() => handleSetActiveIndex(i)}
            className={`w-3 h-3 rounded-full transition ${
              i === activeIndex ? "bg-white scale-125" : "bg-gray-600"
            }`}
          ></button>
        ))}
      </div>
    </section>
  );
}

// "use client";

// import { useEffect, useRef } from "react";
// import Image from "next/image";
// import { motion } from "framer-motion";

// interface Game {
//   id: number;
//   name: string;
//   background_image: string;
// }

// interface HeroSectionProps {
//   trending: Game[];
//   activeIndex: number;
//   setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
// }

// export default function HeroSection({
//   trending,
//   activeIndex,
//   setActiveIndex,
// }: HeroSectionProps) {
//   const intervalRef = useRef<number | null>(null);

//   // Auto-cycle hero every 6s
//   useEffect(() => {
//     if (trending.length === 0) return;

//     intervalRef.current = window.setInterval(() => {
//       setActiveIndex((prev) => (prev + 1) % trending.length);
//     }, 6000);

//     return () => {
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     };
//   }, [trending, setActiveIndex]);

//   const handleSetActiveIndex = (i: number) => {
//     setActiveIndex(i);

//     // Reset interval
//     if (intervalRef.current) clearInterval(intervalRef.current);
//     intervalRef.current = window.setInterval(() => {
//       setActiveIndex((prev) => (prev + 1) % trending.length);
//     }, 6000);
//   };

//   const activeGame = trending[activeIndex];
//   if (!activeGame) return null;

//   return (
//     <section className="relative w-full h-[45vh] overflow-hidden mb-20">
//       <Image
//         src={activeGame.background_image}
//         alt={activeGame.name}
//         fill
//         priority
//         className="object-cover opacity-70 transition-all duration-1000"
//       />
//       <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />

//       <div className="absolute bottom-12 left-12 max-w-2xl">
//         <motion.h1
//           key={activeGame.id}
//           initial={{ opacity: 0, y: 30 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8 }}
//           className="text-5xl font-extrabold mb-4"
//         >
//           {activeGame.name}
//         </motion.h1>
//         <motion.button
//           whileHover={{ scale: 1.05 }}
//           className="px-6 py-3 bg-cyan-500 text-black font-semibold rounded-full hover:bg-cyan-400 transition"
//         >
//           Explore Now
//         </motion.button>
//       </div>

//       {/* Dots */}
//       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
//         {trending.map((_, i) => (
//           <button
//             key={i}
//             onClick={() => handleSetActiveIndex(i)}
//             className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${
//               i === activeIndex ? "bg-cyan-400 scale-125" : "bg-zinc-600"
//             }`}
//           />
//         ))}
//       </div>
//     </section>
//   );
// }
