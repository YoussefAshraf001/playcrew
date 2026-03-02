"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

import Countdown from "@/app/components/Countdowncomponent";
import { useGames } from "@/app/context/GameContext";

type CalendarGame = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
  };
};

type GameWithParsedDate = CalendarGame & { date: Date | null };
type DatedGame = CalendarGame & { date: Date };

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export default function CalendarPage() {
  const { games, gamesLoading } = useGames();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayGames, setSelectedDayGames] = useState<DatedGame[] | null>(
    null,
  );

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const monthGames = useMemo(() => {
    return (games as CalendarGame[])
      .map(
        (g): GameWithParsedDate => ({
          ...g,
          date: parseDate(g.igdb?.releaseDate),
        }),
      )
      .filter(
        (g): g is DatedGame =>
          g.date instanceof Date &&
          g.date.getMonth() === month &&
          g.date.getFullYear() === year,
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [games, month, year]);

  const sidebarMonthGames = useMemo(() => {
    const now = new Date();
    return [...monthGames].sort((a, b) => {
      const aUpcoming = a.date.getTime() >= now.getTime();
      const bUpcoming = b.date.getTime() >= now.getTime();
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
  }, [monthGames]);

  const gamesByDay = useMemo(() => {
    const map = new Map<number, DatedGame[]>();
    monthGames.forEach((g) => {
      const day = g.date.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(g);
    });
    return map;
  }, [monthGames]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const totalCalendarCells = 42;
  const today = new Date();

  const isCurrentMonth =
    month === today.getMonth() && year === today.getFullYear();

  useEffect(() => {
    const syncToCurrentMonth = () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      setCursor((prev) => {
        if (
          prev.getFullYear() === currentMonthStart.getFullYear() &&
          prev.getMonth() === currentMonthStart.getMonth()
        ) {
          return prev;
        }

        return currentMonthStart;
      });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) syncToCurrentMonth();
    };

    syncToCurrentMonth();
    window.addEventListener("focus", syncToCurrentMonth);
    window.addEventListener("pageshow", syncToCurrentMonth);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncToCurrentMonth);
      window.removeEventListener("pageshow", syncToCurrentMonth);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>PlayCrew - Release Calendar</title>
        <meta
          name="description"
          content="Track upcoming and recent game releases in your PlayCrew release calendar."
        />
      </Helmet>

      <main className="h-svh overflow-hidden bg-black text-white pt-22 px-3 sm:px-4 lg:px-7">
        <section className="mx-auto h-full max-w-[1500px]">
          <div className="origin-top scale-[0.9] sm:scale-[0.92] lg:scale-[0.9] 2xl:scale-[0.93] relative h-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-linear-to-br from-[#07121c]/95 via-[#050a10]/95 to-black/95 shadow-[0_25px_80px_rgba(0,0,0,0.55)] flex flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.14),transparent_50%)] pointer-events-none" />

            <div className="relative z-10 p-3.5 sm:p-5 lg:p-6 border-b border-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">
                  Release Tracker
                </p>
                <h1 className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-wide">
                  {cursor.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl border border-white/15 bg-black/40 hover:bg-cyan-500/20 transition cursor-pointer flex items-center justify-center"
                >
                  <FaArrowLeft />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl border border-white/15 bg-black/40 hover:bg-cyan-500/20 transition cursor-pointer flex items-center justify-center"
                >
                  <FaArrowRight />
                </button>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] flex-1 min-h-0">
              <section className="p-3.5 sm:p-5 lg:p-6 border-b xl:border-b-0 xl:border-r border-white/10 h-full flex flex-col min-h-0">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {WEEK_DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] sm:text-xs uppercase tracking-[0.15em] text-white/60 py-2"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${year}-${month}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="grid grid-cols-7 grid-rows-6 gap-1.5 sm:gap-2 flex-1 min-h-0"
                  >
                    {Array.from({ length: totalCalendarCells }).map((_, i) => {
                      const day = i - firstDayOffset + 1;
                      const isInMonth = day >= 1 && day <= daysInMonth;

                      if (!isInMonth) {
                        return (
                          <div
                            key={`empty-${i}`}
                            className="rounded-xl border border-transparent"
                          />
                        );
                      }

                      const dayGames = gamesByDay.get(day) || [];
                      const isToday = isCurrentMonth && day === today.getDate();

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (!dayGames.length) return;
                            setSelectedDayGames(dayGames);
                          }}
                          className={`relative rounded-xl overflow-hidden text-left border transition ${
                            dayGames.length
                              ? "cursor-pointer hover:border-cyan-300/40"
                              : "cursor-default"
                          } ${
                            isToday
                              ? "border-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.55)]"
                              : "border-white/10"
                          }`}
                        >
                          {dayGames.length > 0 && (
                            <div
                              className={`absolute inset-0 ${
                                dayGames.length > 1 ? "grid grid-cols-2" : ""
                              } ${dayGames.length > 2 ? "grid-rows-2" : ""}`}
                            >
                              {dayGames.slice(0, 4).map((g) => (
                                <img
                                  key={g.id}
                                  src={g.igdb?.cover || "/placeholder-game.jpg"}
                                  alt={g.name}
                                  className="w-full h-full object-cover"
                                />
                              ))}
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/55" />

                          <span className="absolute top-2 right-3 z-10 text-[11px] sm:text-xs font-medium text-white/95">
                            {day}
                          </span>

                          {dayGames.length > 1 && (
                            <span className="absolute right-1.5 bottom-1.5 z-10 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md bg-black/70 text-white/90">
                              {dayGames.length} Games
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </section>

              <aside className="p-3.5 sm:p-5 lg:p-6 h-full flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold tracking-wide">
                    Upcoming This Month
                  </h2>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${year}-${month}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      {gamesLoading && (
                        <div className="h-full min-h-[638px] flex items-center justify-center">
                          <span className="loading loading-dots loading-xl" />
                        </div>
                      )}

                      {!gamesLoading &&
                        sidebarMonthGames.map((g, index) => (
                          <motion.div
                            key={g.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                          >
                            <Link
                              href={`/game/${g.id}`}
                              className="group block rounded-xl border border-white/10 bg-black/35 overflow-hidden hover:border-cyan-400/35 transition"
                            >
                              <div className="flex gap-3 px-2.5 py-2">
                                <img
                                  src={g.igdb?.cover || "/placeholder-game.jpg"}
                                  alt={g.name}
                                  className="w-14 h-20 sm:w-16 sm:h-22 rounded-lg object-cover shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm sm:text-base font-medium truncate">
                                    {g.name}
                                  </p>
                                  <p className="text-xs text-white/60 mt-1">
                                    {g.date.toLocaleDateString(undefined, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </p>
                                  <div className="mt-2 text-xs text-cyan-300">
                                    <Countdown date={g.date} />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}

                      {gamesLoading && monthGames.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-black/35 p-5 text-sm text-white/60">
                          No tracked releases in this month.
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {selectedDayGames && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayGames(null)}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-5xl max-h-[88vh] rounded-2xl border border-cyan-500/30 overflow-hidden"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-[#050b12]">
                  <img
                    src={
                      selectedDayGames[0]?.igdb?.cover ||
                      "/placeholder-game.jpg"
                    }
                    alt={selectedDayGames[0]?.name || "Game poster"}
                    className="h-full w-auto max-w-full object-contain opacity-35"
                  />
                </div>
                <div className="absolute inset-0 bg-linear-to-b from-[#050b12]/84 via-[#050b12]/92 to-[#050b12]/96 backdrop-blur-sm" />

                <div className="relative z-10 px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold">
                    Releasing that day ({selectedDayGames.length}{" "}
                    {selectedDayGames.length > 1 ? "Games" : "Game"})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDayGames(null)}
                    className="px-3 py-1 rounded-lg border border-white/20 text-sm text-white/80 hover:text-white hover:border-cyan-300/60 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="relative z-10 p-4 sm:p-6 overflow-y-auto max-h-[74vh]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {selectedDayGames.map((g) => (
                      <Link
                        key={g.id}
                        href={`/game/${g.id}`}
                        className="group relative rounded-xl overflow-hidden h-60 border border-white/10 hover:border-cyan-400/35 transition"
                      >
                        <img
                          src={g.igdb?.cover || "/placeholder-game.jpg"}
                          alt={g.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />
                        <div className="absolute left-3 right-3 bottom-3">
                          <p className="text-sm font-semibold leading-tight">
                            {g.name}
                          </p>
                          {g.date && (
                            <p className="text-[11px] text-white/70 mt-1">
                              {g.date.toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

