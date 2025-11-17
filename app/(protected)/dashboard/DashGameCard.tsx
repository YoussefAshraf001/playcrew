"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function GameCard({ game }: { game: any }) {
  return (
    <motion.div
      className="relative rounded-xl overflow-hidden shadow-lg bg-zinc-900 hover:shadow-cyan-500/50 transition"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.03 }}
    >
      <div className="relative w-full h-48">
        <Image
          src={game.background_image || "/placeholder-game.jpg"}
          alt={game.name}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4 text-white">
        <h3 className="font-bold text-lg truncate">{game.name}</h3>
        <p className="text-sm text-cyan-400 mt-1">
          Status: {game.status || "No status"}
        </p>
        {game.favorite && (
          <span className="text-red-500 font-bold mt-1 inline-block">
            ❤️ Favorited
          </span>
        )}
      </div>
    </motion.div>
  );
}
