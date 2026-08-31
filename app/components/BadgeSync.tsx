"use client";

import { useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import { BADGES, calculateBadgeStats, getEarnedBadgeIds, type BadgeGame } from "@/app/lib/badges";

export default function BadgeSync() {
  const { user, profile, loading: userLoading } = useUser();
  const { games, gamesLoading } = useGames();
  const syncingRef = useRef(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || !profile || userLoading || gamesLoading || syncingRef.current) return;

    const earnedIds = getEarnedBadgeIds(calculateBadgeStats(games as BadgeGame[]));
    const savedIds = Array.isArray(profile.unlockedBadgeIds)
      ? profile.unlockedBadgeIds
      : [];
    const savedSet = new Set(savedIds);
    const newlyUnlocked = earnedIds.filter((id) => !savedSet.has(id));
    if (!newlyUnlocked.length) return;

    syncingRef.current = true;
    const sync = async () => {
      try {
        const mergedIds = Array.from(new Set([...savedIds, ...newlyUnlocked]));
        await setDoc(
          doc(db, "users", uid),
          { unlockedBadgeIds: mergedIds },
          { merge: true },
        );

        const firstBadge = BADGES.find((badge) => badge.id === newlyUnlocked[0]);
        toast.success(
          newlyUnlocked.length === 1
            ? `Badge unlocked: ${firstBadge?.title ?? "New badge"}`
            : `${newlyUnlocked.length} badges unlocked!`,
        );
      } catch (error) {
        console.error("Failed to sync badges", error);
      } finally {
        syncingRef.current = false;
      }
    };

    void sync();
  }, [games, gamesLoading, profile, user?.uid, userLoading]);

  return null;
}
