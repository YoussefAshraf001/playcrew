"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";

interface HoldToRefreshButtonProps {
  gameId: number;
  gameName: string;
  trackedGames: Record<string, any>;
  size?: number; // diameter of circle
}

export default function HoldToRefreshButton({
  gameId,
  gameName,
  trackedGames,
  size = 40,
}: HoldToRefreshButtonProps) {
  const { user } = useUser();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTrackedGame = async (patch: Partial<any>) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const currentGames = snap.exists() ? snap.data().trackedGames || {} : {};

    const merged = {
      ...(currentGames[String(gameId)] || {}),
      ...patch,
      id: gameId,
    };

    await updateDoc(ref, {
      trackedGames: { ...currentGames, [String(gameId)]: merged },
    });

    return merged;
  };

  const refreshFromRawg = async () => {
    const game = trackedGames[String(gameId)];
    if (!game) return;

    const toastId = toast.loading(`Refreshing ${gameName}...`);
    try {
      // Step 1: Search for the game by name
      const searchRes = await fetch(
        `https://api.rawg.io/api/games?search=${encodeURIComponent(
          gameName
        )}&key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
      );
      if (!searchRes.ok) throw new Error("RAWG search failed");

      const searchData = await searchRes.json();
      if (!searchData.results || searchData.results.length === 0)
        throw new Error("Game not found on RAWG");

      const firstResult = searchData.results[0];

      // Step 2: Fetch full game details by slug
      const res = await fetch(
        `https://api.rawg.io/api/games/${firstResult.slug}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
      );
      if (!res.ok) throw new Error("RAWG fetch failed");

      const rawgData = await res.json();

      // Step 3: Only update changed fields
      const patch: Partial<typeof game> = {};
      if (
        rawgData.background_image &&
        rawgData.background_image !== game.background_image
      )
        patch.background_image = rawgData.background_image;
      if (rawgData.rating && rawgData.rating !== game.rating)
        patch.rating = rawgData.rating;
      if (rawgData.playtime && rawgData.playtime !== game.playtime)
        patch.playtime = rawgData.playtime;

      if (Object.keys(patch).length === 0) {
        toast.success(`${gameName} is already up to date!`, { id: toastId });
      } else {
        patch.lastUpdated = new Date();
        await updateTrackedGame(patch);
        toast.success(`${gameName} refreshed!`, { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to refresh ${gameName}`, { id: toastId });
    } finally {
      setProgress(0);
      setHolding(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Start holding
  const startHold = () => {
    if (!user) return;
    setHolding(true);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;

        if (next >= 100) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          refreshFromRawg();
          return 100;
        }

        return next;
      });
    }, 50);
  };

  const stopHold = () => {
    setHolding(false);
    setProgress(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
    >
      {/* Background Circle */}
      <div
        className="absolute inset-0 rounded-full bg-gray-700"
        style={{ width: size, height: size }}
      />
      {/* Progress Circle */}
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-500 origin-center"
        style={{
          width: size,
          height: size,
          clipPath: `circle(${progress}% at 50% 50%)`,
        }}
      />
      {/* Icon */}
      <div className="absolute inset-0 flex items-center justify-center text-black font-bold text-sm cursor-pointer">
        ⟳
      </div>
    </div>
  );
}
