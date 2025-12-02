"use client";

import { motion } from "framer-motion";

export default function Page() {
  return (
    <div className="w-full h-screen bg-linear-to-b from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center relative overflow-hidden">
      {/* Animated background shapes */}
      <motion.div
        className="absolute w-72 h-72 bg-cyan-600 rounded-full mix-blend-screen opacity-20 animate-pulse"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{ top: "10%", left: "20%" }}
      />
      <motion.div
        className="absolute w-96 h-96 bg-purple-600 rounded-full mix-blend-screen opacity-20 animate-pulse"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{ bottom: "15%", right: "15%" }}
      />

      {/* Main content */}
      <div className="relative z-10 text-center px-4">
        <motion.h1
          className="text-5xl sm:text-6xl font-extrabold text-white mb-4 drop-shadow-lg"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Coming Soon
        </motion.h1>
        <motion.p
          className="text-lg sm:text-xl text-white/70 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          All your epic gaming screenshots will appear here soon!
        </motion.p>

        <motion.button
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-semibold shadow-lg transition"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          Stay Tuned
        </motion.button>
      </div>
    </div>
  );
}
