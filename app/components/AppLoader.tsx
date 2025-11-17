"use client";

import { ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Sidebar from "./Sidebar";
import LoadingSpinner from "./LoadingSpinner";

interface AppLoaderProps {
  children: ReactNode;
}

export default function AppLoader({ children }: AppLoaderProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Correctly typed Variants
  const sidebarVariants: Variants = {
    hidden: { scaleY: 0, opacity: 0, originY: 0 },
    visible: {
      scaleY: 1,
      opacity: 1,
      originY: 0,
      transition: {
        duration: 0.8,
        ease: [0.42, 0, 0.58, 1],
      },
    },
  };

  const contentVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.8, ease: [0.42, 0, 0.58, 1] },
    },
  };

  return (
    <>
      <AnimatePresence>{loading && <LoadingSpinner />}</AnimatePresence>

      {!loading && (
        <div className="flex min-h-screen">
          <motion.div
            className="z-50"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
          >
            <Sidebar />
          </motion.div>

          <motion.main
            className="flex-1"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {children}
          </motion.main>
        </div>
      )}
    </>
  );
}
