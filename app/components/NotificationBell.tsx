"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { BsBellFill } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import { FaKissWinkHeart } from "react-icons/fa";

type Game = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: any;
  };
};

type Notification = {
  id: string;
  game: Game;
  label: string;
  daysLeft: number;
};

export default function NotificationBell({ games }: { games: Game[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = useMemo<Notification[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return games
      .map((g) => {
        const raw = g.igdb?.releaseDate;
        if (!raw) return null;

        const release =
          raw?.toDate?.() ??
          (typeof raw === "number" ? new Date(raw * 1000) : new Date(raw));

        release.setHours(0, 0, 0, 0);

        const diff = (release.getTime() - today.getTime()) / 86400000;

        if (diff < 0 || diff > 5) return null;

        return {
          id: g.id,
          game: g,
          label:
            diff === 0
              ? "Releases today"
              : diff === 1
                ? "Releases tomorrow"
                : `Releases in ${diff} days`,
          daysLeft: diff,
        };
      })
      .filter((n): n is Notification => n !== null);
  }, [games]);

  return (
    <>
      {/* BELL */}
      <div
        ref={ref}
        className={`relative z-50 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600 rounded-full px-2 cursor-pointer transition-colors duration-300
        ${
          open &&
          "bg-linear-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,255,255,0.5)]"
        }`}
        onClick={() => setOpen((p) => !p)}
      >
        <button className="relative p-2 rounded-full">
          <BsBellFill size={14} />

          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </button>

        {/* DROPDOWN */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
              className="
        absolute right-0 mt-3 w-80
        rounded-2xl overflow-hidden
        bg-zinc-900 backdrop-blur-xl
        border border-white/10
        shadow-[0_20px_60px_rgba(0,0,0,0.6)]
        z-50
      "
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center text-center py-10 gap-3"
              >
                <div
                  className="
    pointer-events-none
    absolute inset-0
    rounded-2xl
    before:absolute before:inset-0
    before:rounded-2xl
    before:border
    before:border-cyan-400/40
    before:shadow-[0_0_25px_rgba(34,211,238,0.45)]
  "
                />
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-cyan-400 text-3xl"
                >
                  <FaKissWinkHeart />
                </motion.div>

                <p className="text-sm font-semibold text-white">
                  Notification System
                </p>

                <p className="text-xs text-white/60">Coming Soon</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
