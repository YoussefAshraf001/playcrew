"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function FeaturedGameHero({ game }: { game: any }) {
  return (
    <motion.section
      className="relative h-[60vh] w-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <Image
        src={game.background_image || "/placeholder-game.jpg"}
        alt={game.name}
        fill
        className="object-cover brightness-[0.35]"
        priority
      />
      <div className="absolute inset-0 flex flex-col justify-end px-8 pb-12 bg-linear-to-t from-black/90 via-black/40 to-transparent">
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 text-cyan-400">
          {game.name}
        </h1>
        <p className="text-zinc-300 max-w-2xl text-lg">
          Continue your journey or discover new adventures.
        </p>
      </div>
    </motion.section>
  );
}
