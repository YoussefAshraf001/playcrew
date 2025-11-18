"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// Firebase
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// User context
import { useUser } from "../context/UserContext";
import ConfirmModal from "./ConfirmModal";
import { Game } from "../types/game";
import { FaCalendarAlt } from "react-icons/fa";

interface HeroSectionProps {
  trending: Game[];
}

export default function HeroSection({ trending }: HeroSectionProps) {
  const router = useRouter();
  const { user } = useUser();

  const [savedGames, setSavedGames] = useState<Record<number, string>>({});
  const [loadingSave, setLoadingSave] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [gameToRemove, setGameToRemove] = useState<Game | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeGame = trending[activeIndex];
  if (!activeGame) return null;

  // --------------------------------------------------------------------
  // Load all tracked statuses from Firestore
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const trackedGames = snap.exists() ? snap.data()?.trackedGames || {} : {};
      const results: Record<number, string> = {};

      for (const g of trending) {
        if (trackedGames[g.id]?.status) {
          results[g.id] = trackedGames[g.id].status;
        }
      }

      setSavedGames(results);
    })();
  }, [user, trending]);

  // --------------------------------------------------------------------
  // Auto-rotate hero
  // --------------------------------------------------------------------
  const startInterval = () => {
    if (!trending.length) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % trending.length);
    }, 10000);
  };

  const stopInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    startInterval();
    return () => stopInterval();
  }, [trending]);

  const handleManualSwitch = (i: number) => {
    setActiveIndex(i);
    stopInterval();
    startInterval();
  };

  // --------------------------------------------------------------------
  // Save / Remove for Later
  // --------------------------------------------------------------------
  const handleSaveClick = (game: Game) => {
    const status = savedGames[game.id];
    if (status) {
      // Game already tracked → open modal for removal
      setGameToRemove(game);
      setModalOpen(true);
      stopInterval();
    } else {
      toggleSaveForLater(game);
    }
  };

  const toggleSaveForLater = async (game: Game) => {
    if (!user) {
      toast.error("You must be logged in to save games");
      return;
    }

    setLoadingSave(true);
    stopInterval();

    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const trackedGames = snap.exists() ? snap.data()?.trackedGames || {} : {};

      const updated = {
        ...trackedGames,
        [game.id]: {
          gameId: game.id.toString(),
          gameName: game.name,
          status: "Want to Play",
          updatedAt: new Date().toISOString(),
        },
      };

      await setDoc(ref, { trackedGames: updated }, { merge: true });

      setSavedGames((prev) => ({ ...prev, [game.id]: "Want to Play" }));
      toast.success(
        "Saved for Later! You will find it in your Want to Play section"
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update saved status");
    } finally {
      setLoadingSave(false);
      startInterval();
    }
  };

  const removeTrackedGame = async () => {
    if (!user || !gameToRemove) return;

    setLoadingSave(true);
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const trackedGames = snap.exists() ? snap.data()?.trackedGames || {} : {};

      delete trackedGames[gameToRemove.id];

      await setDoc(ref, { trackedGames }, { merge: true });

      setSavedGames((prev) => {
        const newState = { ...prev };
        delete newState[gameToRemove.id];
        return newState;
      });

      toast.success("Game removed from your list");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove game");
    } finally {
      setLoadingSave(false);
      setModalOpen(false);
      setGameToRemove(null);
      startInterval();
    }
  };

  return (
    <section className="relative mx-auto w-[65%] h-[50vh] overflow-hidden mb-20">
      {/* Background fade transition */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={() => router.push(`/game/${activeGame.id}`)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <Image
              src={activeGame.background_image}
              alt={activeGame.name}
              fill
              priority
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edge fade overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-y-0 left-0 w-32 bg-linear-to-r from-black to-transparent" />
        <div className="absolute inset-y-0 right-0 w-32 bg-linear-to-l from-black to-transparent" />
      </div>

      {/* Gradient */}
      <div className="absolute inset-0 bg-linear-to-r from-black via-black/40 to-transparent" />

      {/* Tags */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
        {activeGame.tags?.slice(0, 5).map((tag) => (
          <span
            key={tag.id}
            className="text-xs font-medium bg-white/10 text-white px-2 py-1 rounded-full hover:bg-white/20 transition"
          >
            {tag.name}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="absolute left-8 bottom-16 max-w-lg">
        <motion.h1
          key={activeGame.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-bold mb-3"
        >
          {activeGame.name}
        </motion.h1>

        <p className="text-gray-400 text-sm my-4 flex items-center gap-2">
          Realesed In:
          <span>
            {activeGame.released
              ? new Date(activeGame.released).getFullYear()
              : "TBA"}
          </span>
        </p>

        <div className="flex items-center gap-4">
          {/* Explore */}
          <button
            onClick={() => router.push(`/game/${activeGame.id}`)}
            className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 hover:scale-105 transition transform"
          >
            Explore
          </button>

          {/* Save for Later / Remove */}
          <button
            onClick={() => handleSaveClick(activeGame)}
            className={`px-4 py-3 rounded-xl border transition transform hover:scale-105 ${
              savedGames[activeGame.id]
                ? "bg-green-600 border-green-500"
                : "bg-white/10 hover:bg-white/20 border-white/20"
            }`}
            disabled={loadingSave}
          >
            {loadingSave ? (
              <span className="loading loading-spinner loading-sm" />
            ) : savedGames[activeGame.id] ? (
              `Tracked (${savedGames[activeGame.id]})`
            ) : (
              "Mark for Later"
            )}
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-3">
        {trending.map((_, i) => (
          <button
            key={i}
            onClick={() => handleManualSwitch(i)}
            className={`w-3 h-3 rounded-full transition ${
              i === activeIndex ? "bg-white scale-125" : "bg-gray-600"
            }`}
          />
        ))}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        open={modalOpen}
        title="Remove Game?"
        message={`Are you sure you want to remove "${gameToRemove?.name}" from your list?`}
        onConfirm={removeTrackedGame}
        onCancel={() => {
          setModalOpen(false);
          setGameToRemove(null);
          startInterval();
        }}
        confirmText="Remove"
        cancelText="Cancel"
      />
    </section>
  );
}
