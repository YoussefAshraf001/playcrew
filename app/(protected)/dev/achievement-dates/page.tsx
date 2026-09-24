"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { doc, setDoc } from "firebase/firestore";
import { FiCalendar, FiCheck, FiClock } from "react-icons/fi";
import toast from "react-hot-toast";

import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import {
  BADGES,
  calculateBadgeStats,
  type BadgeGame,
  type BadgeFamily,
} from "@/app/lib/badges";

type TimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

const toDate = (value: unknown) => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as TimestampLike).toDate?.() ?? null;
  }
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = (value as TimestampLike).seconds;
    return typeof seconds === "number" ? new Date(seconds * 1000) : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const seededUnit = (text: string) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

export default function AchievementDateBackfillPage() {
  const { user, profile, loading, isAdmin } = useUser();
  const { games, gamesLoading } = useGames();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const preview = useMemo(() => {
    if (!user || !profile || gamesLoading) return [];

    const joinedAt =
      toDate(profile.creationTime) ??
      toDate(user.metadata.creationTime) ??
      new Date();
    const now = new Date();
    const lifespan = Math.max(1, now.getTime() - joinedAt.getTime());
    const stats = calculateBadgeStats(games as BadgeGame[]);
    const unlockedIds = new Set(
      Array.isArray(profile.unlockedBadgeIds)
        ? profile.unlockedBadgeIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
    );
    const existing =
      profile.badgeUnlockedAt && typeof profile.badgeUnlockedAt === "object"
        ? (profile.badgeUnlockedAt as Record<string, unknown>)
        : {};

    const estimates = new Map<string, Date>();
    const families = [...new Set(BADGES.map((badge) => badge.family))];

    families.forEach((family) => {
      const familyBadges = BADGES.filter(
        (badge) => badge.family === family && unlockedIds.has(badge.id),
      ).sort((a, b) => a.threshold - b.threshold);
      let previousTime = joinedAt.getTime();

      familyBadges.forEach((badge, index) => {
        const realDate = toDate(existing[badge.id]);
        if (realDate) {
          previousTime = Math.max(previousTime, realDate.getTime());
          return;
        }

        const current = Math.max(
          badge.threshold,
          stats[family as BadgeFamily] ?? badge.threshold,
        );
        const progressRatio = badge.threshold / current;
        const curve = Math.pow(progressRatio, 0.72) * 0.92;
        const jitter =
          (seededUnit(`${user.uid}:${badge.id}`) - 0.5) * 0.07;
        const ratio = Math.min(0.97, Math.max(0.025, curve + jitter));
        const latestAllowed =
          now.getTime() - Math.max(0, familyBadges.length - index - 1) * 3600000;
        const estimate = Math.min(
          latestAllowed,
          Math.max(previousTime + 3600000, joinedAt.getTime() + lifespan * ratio),
        );
        const date = new Date(estimate);
        estimates.set(badge.id, date);
        previousTime = estimate;
      });
    });

    return BADGES.filter((badge) => estimates.has(badge.id)).map((badge) => ({
      badge,
      date: estimates.get(badge.id)!,
    }));
  }, [games, gamesLoading, profile, user]);

  const applyDates = async () => {
    if (!user || !profile || !isAdmin || !preview.length) return;
    setApplying(true);
    try {
      const existing =
        profile.badgeUnlockedAt && typeof profile.badgeUnlockedAt === "object"
          ? (profile.badgeUnlockedAt as Record<string, unknown>)
          : {};
      const badgeUnlockedAt = { ...existing };
      preview.forEach(({ badge, date }) => {
        badgeUnlockedAt[badge.id] = date;
      });
      await setDoc(
        doc(db, "users", user.uid),
        { badgeUnlockedAt },
        { merge: true },
      );
      setApplied(true);
      toast.success(`${preview.length} achievement dates added`);
    } catch (error) {
      console.error("Failed to backfill achievement dates", error);
      toast.error("Could not apply achievement dates");
    } finally {
      setApplying(false);
    }
  };

  if (loading || gamesLoading) {
    return <main className="grid min-h-screen place-items-center text-zinc-400">Loading developer tools…</main>;
  }

  if (!user || !profile || !isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-white">Developer access only</h1>
          <p className="mt-2 text-sm text-zinc-400">This tool is restricted to your administrator account.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] px-4 pb-16 pt-24 text-white sm:px-6">
      <section className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Developer Tool</p>
        <h1 className="mt-2 text-3xl font-black">Achievement Date Backfill</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Estimates missing unlock dates from your account creation date and current progress. Dates are deterministically randomized, remain ordered within each achievement family, and never replace recorded timestamps.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <FiCalendar className="text-cyan-300" size={22} />
            <div>
              <p className="font-bold">{preview.length} missing dates</p>
              <p className="text-xs text-zinc-400">Previewed for {profile.username ?? user.email ?? "your account"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={applyDates}
            disabled={applying || applied || preview.length === 0}
            className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? "Applying…" : applied ? "Dates applied" : "Apply estimated dates"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {preview.map(({ badge, date }) => (
            <article key={badge.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <Image
                src={`/achievements/icons/${badge.id}.png`}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-bold">{badge.title}</h2>
                  {applied && <FiCheck className="shrink-0 text-emerald-300" />}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                  <FiClock /> {date.toLocaleString()}
                </p>
              </div>
            </article>
          ))}
        </div>

        {!preview.length && (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6 text-center text-sm text-emerald-200">
            Every unlocked achievement already has a recorded date.
          </div>
        )}
      </section>
    </main>
  );
}
