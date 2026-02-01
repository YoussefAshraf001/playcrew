"use client";

import { motion } from "framer-motion";

export default function LoadingSpinner() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-black">
      <motion.div
        className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: 1,
        }}
      />
    </main>
  );
}
