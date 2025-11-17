"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import PosterImage from "./PosterImages";
import { Game } from "../types/game";

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  return (
    <Link href={`/game/${game.id}`}>
      <motion.div
        whileHover={{ scale: 1.03 }}
        className="min-w-[320px] sm:min-w-[360px] md:min-w-[400px] lg:min-w-[450px] h-[220px] relative rounded-xl overflow-hidden shadow-lg cursor-pointer"
      >
        <PosterImage
          src={game.background_image || "/placeholder-game.jpg"}
          alt={game.name}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 text-white flex items-center justify-between gap-4">
          <div className="pr-4">
            <h3 className="font-bold text-lg truncate">{game.name}</h3>
            <p className="text-cyan-400 mt-1">⭐ {game.rating.toFixed(1)}</p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
