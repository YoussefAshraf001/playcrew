"use client";

import { useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import { BADGES, calculateBadgeStats, getEarnedBadgeIds, type BadgeGame } from "@/app/lib/badges";

const TIER_COLORS = {
  bronze: "#e09a55", silver: "#e2e8f0", gold: "#ffd84d",
  platinum: "#8be9f7", diamond: "#b9a2ff",
} as const;

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
        const unlockedAt = new Date();
        const savedDates =
          profile.badgeUnlockedAt && typeof profile.badgeUnlockedAt === "object"
            ? (profile.badgeUnlockedAt as Record<string, unknown>)
            : {};
        const badgeUnlockedAt = { ...savedDates };
        newlyUnlocked.forEach((id) => {
          badgeUnlockedAt[id] = unlockedAt;
        });
        const mergedIds = Array.from(new Set([...savedIds, ...newlyUnlocked]));
        await setDoc(
          doc(db, "users", uid),
          { unlockedBadgeIds: mergedIds, badgeUnlockedAt },
          { merge: true },
        );

        newlyUnlocked.forEach((id) => {
          const badge = BADGES.find((item) => item.id === id);
          if (!badge) return;
          toast.custom((notification) => (
            <div
              className={`flex w-[340px] items-center gap-3 rounded-2xl border bg-zinc-950/95 p-3 text-white shadow-2xl transition ${notification.visible ? "opacity-100" : "opacity-0"}`}
              style={{ borderColor: `${TIER_COLORS[badge.tier]}88` }}
            >
              <div
                className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl"
                style={{ backgroundColor: `${TIER_COLORS[badge.tier]}20` }}
              >
                {badge.icon}
                <span
                  className="absolute inset-0 rounded-xl bg-no-repeat"
                  style={{
                    backgroundImage:
                      `url('/achievements/icons/${badge.id}.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: TIER_COLORS[badge.tier] }}>
                  Achievement unlocked · {badge.tier}
                </p>
                <p className="mt-0.5 font-bold">{badge.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {unlockedAt.toLocaleString()}
                </p>
              </div>
            </div>
          ), { duration: 6000 });
        });
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
