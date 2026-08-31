"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import {
  BADGES,
  calculateBadgeStats,
  getBadgeProgress,
  type BadgeGame,
} from "@/app/lib/badges";

const FAMILY_POSITION = {
  completed: "0% 50%",
  playtime: "50% 50%",
  reviews: "100% 50%",
} as const;

const AchievementImage = ({
  family,
  className = "",
}: {
  family: keyof typeof FAMILY_POSITION;
  className?: string;
}) => (
  <div
    role="img"
    aria-label={`${family} achievement artwork`}
    className={`bg-no-repeat ${className}`}
    style={{
      backgroundImage: "url('/achievements/achievement-families.png')",
      backgroundSize: "300% 100%",
      backgroundPosition: FAMILY_POSITION[family],
    }}
  />
);

const TIER_STYLES = {
  bronze:
    "border-[#cd7f32]/70 bg-[#cd7f32]/12 shadow-[inset_0_1px_0_rgba(205,127,50,0.18)]",
  silver:
    "border-[#c0c0c0]/65 bg-[#c0c0c0]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
  gold:
    "border-[#ffd700]/70 bg-[#ffd700]/10 shadow-[inset_0_1px_0_rgba(255,215,0,0.2)]",
  platinum:
    "border-[#67e8f9]/65 bg-[#67e8f9]/10 shadow-[inset_0_1px_0_rgba(103,232,249,0.18)]",
  diamond:
    "border-[#a78bfa]/70 bg-[#a78bfa]/12 shadow-[inset_0_1px_0_rgba(167,139,250,0.2)]",
} as const;

const TIER_COLORS = {
  bronze: "#e09a55",
  silver: "#e2e8f0",
  gold: "#ffd84d",
  platinum: "#8be9f7",
  diamond: "#b9a2ff",
} as const;

export default function BadgeCabinet({
  games,
  unlockedBadgeIds = [],
  compact = false,
}: {
  games: BadgeGame[];
  unlockedBadgeIds?: string[];
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const stats = calculateBadgeStats(games);
  const unlocked = new Set([
    ...unlockedBadgeIds,
    ...BADGES.filter((badge) => stats[badge.family] >= badge.threshold).map(
      (badge) => badge.id,
    ),
  ]);

  useEffect(() => {
    if (!compact || modalOpen) return;

    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % BADGES.length);
    }, 5500);

    return () => window.clearInterval(interval);
  }, [compact, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  const updateCarouselControls = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    setCanScrollLeft(carousel.scrollLeft > 2);
    setCanScrollRight(
      carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    if (compact) return;
    const carousel = carouselRef.current;
    if (!carousel) return;

    updateCarouselControls();
    const resizeObserver = new ResizeObserver(updateCarouselControls);
    resizeObserver.observe(carousel);
    carousel.addEventListener("scroll", updateCarouselControls, {
      passive: true,
    });

    return () => {
      resizeObserver.disconnect();
      carousel.removeEventListener("scroll", updateCarouselControls);
    };
  }, [compact, updateCarouselControls]);

  const moveCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction * Math.max(280, carousel.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  if (compact) {
    const achievement = BADGES[activeIndex];
    const progress = getBadgeProgress(achievement, stats);
    const isUnlocked = unlocked.has(achievement.id);

    return (
      <>
        <section
          className={`relative flex h-full min-h-[260px] w-full flex-col overflow-hidden rounded-2xl border shadow-xl ${
            isUnlocked
              ? TIER_STYLES[achievement.tier]
              : "border-white/10 bg-black/25"
          }`}
        >
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group relative flex min-h-0 flex-1 cursor-pointer flex-col text-left"
            aria-label="Open all achievements"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -22 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col"
              >
                <AchievementImage
                  family={achievement.family}
                  className={`min-h-0 flex-1 bg-cover transition duration-300 group-hover:scale-[1.025] ${
                    isUnlocked ? "" : "grayscale brightness-[0.35]"
                  }`}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{
                        color: isUnlocked
                          ? TIER_COLORS[achievement.tier]
                          : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {achievement.tier} achievement
                    </span>
                    <span className="text-xs">{isUnlocked ? "✓" : "🔒"}</span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {achievement.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-300">
                    {achievement.description}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress.percent}%`,
                        backgroundColor: isUnlocked
                          ? TIER_COLORS[achievement.tier]
                          : "rgba(255,255,255,0.85)",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-white/60">
                    {Math.min(progress.value, achievement.threshold)} / {achievement.threshold}
                    {achievement.family === "playtime" ? "h" : ""}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </button>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/55 px-2 py-2 backdrop-blur-md">
            <button
              type="button"
              onClick={() =>
                setActiveIndex((index) =>
                  index === 0 ? BADGES.length - 1 : index - 1,
                )
              }
              className="rounded-full p-1.5 text-white/65 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous achievement"
            >
              <FiChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 hover:text-white"
            >
              {unlocked.size} / {BADGES.length} · View all
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((index) => (index + 1) % BADGES.length)
              }
              className="rounded-full p-1.5 text-white/65 transition hover:bg-white/10 hover:text-white"
              aria-label="Next achievement"
            >
              <FiChevronRight />
            </button>
          </div>
        </section>

        {modalOpen &&
          createPortal(
            <AnimatePresence>
              <motion.div
                className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 18 }}
                  onClick={(event) => event.stopPropagation()}
                  className="theme-panel-strong flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
                >
                  <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-7">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                        Player Progress
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-white">
                        Achievements
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {unlocked.size} of {BADGES.length} unlocked
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                      aria-label="Close achievements"
                    >
                      <FiX size={20} />
                    </button>
                  </header>

                  <div className="scrollbar-hide grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
                    {BADGES.map((item) => {
                      const itemProgress = getBadgeProgress(item, stats);
                      const itemUnlocked = unlocked.has(item.id);

                      return (
                        <article
                          key={item.id}
                          className={`overflow-hidden rounded-2xl border ${
                            itemUnlocked
                              ? TIER_STYLES[item.tier]
                              : "border-white/8 bg-white/[0.025]"
                          }`}
                        >
                          <AchievementImage
                            family={item.family}
                            className={`aspect-[16/9] w-full bg-cover ${
                              itemUnlocked ? "" : "grayscale brightness-[0.3]"
                            }`}
                          />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p
                                  className="text-[9px] font-bold uppercase tracking-[0.18em]"
                                  style={{
                                    color: itemUnlocked
                                      ? TIER_COLORS[item.tier]
                                      : "rgba(255,255,255,0.45)",
                                  }}
                                >
                                  {item.tier}
                                </p>
                                <h3 className="mt-1 font-bold text-white">
                                  {item.title}
                                </h3>
                              </div>
                              <span>{itemUnlocked ? "✓" : "🔒"}</span>
                            </div>
                            <p className="mt-2 min-h-10 text-xs leading-relaxed text-zinc-400">
                              {item.description}
                            </p>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
                              <div
                                className="h-full rounded-full bg-white/75"
                                style={{ width: `${itemProgress.percent}%` }}
                              />
                            </div>
                            <p className="mt-1 text-right text-[10px] text-zinc-400">
                              {Math.min(itemProgress.value, item.threshold)} / {item.threshold}
                              {item.family === "playtime" ? "h" : ""}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )}
      </>
    );
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Achievements</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {unlocked.size} of {BADGES.length} achievements unlocked
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => moveCarousel(-1)}
            disabled={!canScrollLeft}
            aria-label="Previous achievements"
            className={`rounded-full border p-2.5 transition ${
              canScrollLeft
                ? "theme-accent-text theme-hover-accent border-[rgba(var(--theme-accent-rgb),0.45)] shadow-[0_0_16px_rgba(var(--theme-accent-rgb),0.18)]"
                : "border-white/5 text-white/20"
            }`}
          >
            <FiChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => moveCarousel(1)}
            disabled={!canScrollRight}
            aria-label="Next achievements"
            className={`rounded-full border p-2.5 transition ${
              canScrollRight
                ? "theme-accent-text theme-hover-accent border-[rgba(var(--theme-accent-rgb),0.45)] shadow-[0_0_16px_rgba(var(--theme-accent-rgb),0.18)]"
                : "border-white/5 text-white/20"
            }`}
          >
            <FiChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        ref={carouselRef}
        className="scrollbar-hide flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {BADGES.map((badge) => {
          const progress = getBadgeProgress(badge, stats);
          const isUnlocked = unlocked.has(badge.id) || progress.percent === 100;

          return (
            <article
              key={badge.id}
              className={`relative w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border p-4 transition sm:w-[320px] ${
                isUnlocked
                  ? TIER_STYLES[badge.tier]
                  : "border-white/8 bg-white/[0.02] opacity-55"
              }`}
            >
              <div className="flex items-start gap-3">
                <AchievementImage
                  family={badge.family}
                  className={`h-12 w-12 shrink-0 rounded-2xl bg-cover ${
                    isUnlocked ? "" : "grayscale brightness-[0.35]"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white">{badge.title}</h3>
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.18em]"
                      style={{
                        color: isUnlocked
                          ? TIER_COLORS[badge.tier]
                          : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {badge.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {badge.description}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-zinc-400">
                  <span>{isUnlocked ? "Unlocked" : "Progress"}</span>
                  <span>
                    {Math.min(progress.value, badge.threshold)} / {badge.threshold}
                    {badge.family === "playtime" ? "h" : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress.percent}%`,
                      backgroundColor: isUnlocked
                        ? TIER_COLORS[badge.tier]
                        : "rgba(255,255,255,0.75)",
                    }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
