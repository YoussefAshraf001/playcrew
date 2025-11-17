"use client";

import { motion } from "framer-motion";
import DashGameCard from "./DashGameCard";

export default function GamesGrid({ games }: { games: any[] }) {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.08 } },
      }}
    >
      {games.map((game) => (
        <DashGameCard key={game.id} game={game} />
      ))}
    </motion.div>
  );
}
