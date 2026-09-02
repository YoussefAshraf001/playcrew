"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";
import Navbar from "./Navbar";

const CONTENT_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.42, 0, 0.58, 1],
      delay: 0.8,
    },
  },
};

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell flex h-svh overflow-hidden">
      <Navbar />

      <motion.main
        className="min-w-0 max-w-full flex-1 overflow-y-auto"
        variants={CONTENT_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.main>
    </div>
  );
}
