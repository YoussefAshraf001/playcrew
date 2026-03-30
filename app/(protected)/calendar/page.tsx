"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowLeft,
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight,
  FaCrown,
  FaPause,
  FaPlay,
} from "react-icons/fa";
import { MdBlock, MdOutlineOnlinePrediction } from "react-icons/md";
import { GiMouthWatering } from "react-icons/gi";

import Countdown from "@/app/components/Countdowncomponent";
import { useGames } from "@/app/context/GameContext";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";

type CalendarGame = {
  id: string;
  name: string;
  status?: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
  };
};

type GameWithParsedDate = CalendarGame & { date: Date | null };
type DatedGame = CalendarGame & { date: Date };

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DESKTOP_DRAWER_WIDTH = 360;

const isYearOnlyRelease = (date: Date | null) => {
  if (!date) return false;
  return (
    date.getTime() > Date.now() &&
    date.getMonth() === 11 &&
    date.getDate() === 31
  );
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
  const [yearDrawerOpen, setYearDrawerOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("calendar.yearDrawerOpen");
    return stored === null ? true : stored === "true";
  });

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const parsedGames = useMemo(() => {
    return (games as CalendarGame[])
      .map(
        (g): GameWithParsedDate => ({
          ...g,
          date: parseReleaseDate(g.igdb?.releaseDate),
        }),
      )
      .filter((g): g is DatedGame => g.date instanceof Date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [games]);

  const monthGames = useMemo(() => {
    return parsedGames.filter(
      (g) =>
        !isYearOnlyRelease(g.date) &&
        g.date.getMonth() === month &&
        g.date.getFullYear() === year,
    );
  }, [parsedGames, month, year]);

  const sidebarMonthGames = useMemo(() => {
    const now = new Date();
    return [...monthGames].sort((a, b) => {
      const aUpcoming = a.date.getTime() >= now.getTime();
      const bUpcoming = b.date.getTime() >= now.getTime();
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
  }, [monthGames]);

  const yearOnlyGames = useMemo(() => {
    return parsedGames.filter(
      (g) => isYearOnlyRelease(g.date) && g.date.getFullYear() === year,
    );
  }, [parsedGames, year]);

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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Playing":
        return {
          label: "Playing",
          icon: <FaPlay size={10} />,
          className: "border-blue-300/35 bg-blue-500/15 text-blue-100",
        };
      case "On Hold":
        return {
          label: "On Hold",
          icon: <FaPause size={10} />,
          className: "border-emerald-300/35 bg-emerald-500/15 text-emerald-100",
        };
      case "Dropped":
        return {
          label: "Dropped",
          icon: <MdBlock size={11} />,
          className: "border-red-300/35 bg-red-500/15 text-red-100",
        };
      case "Completed":
        return {
          label: "Completed",
          icon: <FaCrown size={10} />,
          className: "border-yellow-300/35 bg-yellow-500/15 text-yellow-100",
        };
      case "Online":
        return {
          label: "Online",
          icon: <MdOutlineOnlinePrediction size={12} />,
          className: "border-purple-300/35 bg-purple-500/15 text-purple-100",
        };
      case "Want To Play":
        return {
          label: "Want To Play",
          icon: <GiMouthWatering size={11} />,
          className: "border-cyan-300/35 bg-cyan-500/15 text-cyan-100",
        };
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>PlayCrew - Release Calendar</title>
        <meta
          name="description"
          content="Track upcoming and recent game releases in your PlayCrew release calendar."
        />
      </Helmet>

      <main className="h-svh overflow-hidden bg-black px-3 pt-22 text-white sm:px-4 lg:px-7">
        <section className="mx-auto h-full max-w-[1680px]">
          <div className="relative flex h-full origin-top scale-[0.9] flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-linear-to-br from-[#07121c]/95 via-[#050a10]/95 to-black/95 shadow-[0_25px_80px_rgba(0,0,0,0.55)] sm:scale-[0.92] lg:scale-[0.9] 2xl:scale-[0.93]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.14),transparent_50%)]" />

            <div className="relative z-10 flex flex-col gap-3 border-b border-white/10 p-3.5 md:flex-row md:items-center md:justify-between sm:p-5 lg:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">
                  Release Tracker
                </p>
                <h1 className="mt-1.5 text-xl font-semibold tracking-wide sm:text-2xl">
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
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-black/40 transition hover:bg-cyan-500/20"
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
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-black/40 transition hover:bg-cyan-500/20"
                >
                  <FaArrowRight />
                </button>
              </div>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
              <motion.section
                layout
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex min-w-0 flex-1 flex-col border-b border-white/10 p-3.5 xl:border-b-0 xl:border-r sm:p-5 lg:p-6"
              >
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((d) => (
                    <div
                      key={d}
                      className="py-2 text-center text-[10px] uppercase tracking-[0.15em] text-white/60 sm:text-xs"
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
                    className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1.5 sm:gap-2"
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
                          className={`relative overflow-hidden rounded-xl border text-left transition ${
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
                                  className="h-full w-full object-cover"
                                />
                              ))}
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/55" />

                          <span className="absolute right-3 top-2 z-10 text-[11px] font-medium text-white/95 sm:text-xs">
                            {day}
                          </span>

                          {dayGames.length > 1 && (
                            <span className="absolute bottom-1.5 right-1.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white/90 sm:text-[11px]">
                              {dayGames.length} Games
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </motion.section>

              <motion.aside
                layout
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="hidden min-h-0 w-[420px] shrink-0 border-l border-white/10 p-3.5 xl:flex xl:flex-col sm:p-5 lg:p-6"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-wide sm:text-lg">
                    Upcoming This Month
                  </h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`month-${year}-${month}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      {gamesLoading ? (
                        <div className="flex min-h-60 items-center justify-center">
                          <span className="loading loading-dots loading-xl" />
                        </div>
                      ) : sidebarMonthGames.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/35 p-5 text-sm text-white/60">
                          No confirmed release dates in this month.
                        </div>
                      ) : (
                        sidebarMonthGames.map((g, index) => {
                          const statusBadge = getStatusBadge(g.status);
                          const isReleased = g.date.getTime() <= Date.now();
                          return (
                            <motion.div
                              key={g.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.2,
                                delay: index * 0.03,
                              }}
                              className="pr-4"
                            >
                              <Link
                                href={`/game/${g.id}`}
                                className="group block overflow-hidden rounded-xl border border-white/10 bg-black/35 pt-2 transition hover:border-cyan-400/35"
                              >
                                <div className="flex gap-3 px-2.5 py-2">
                                  <img
                                    src={
                                      g.igdb?.cover || "/placeholder-game.jpg"
                                    }
                                    alt={g.name}
                                    className="h-28 w-20 shrink-0 rounded-lg object-cover"
                                  />

                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <p className="truncate text-sm font-medium sm:text-base">
                                      {g.name}
                                    </p>
                                    <p className="mt-1 text-xs text-white/60">
                                      {g.date.toLocaleDateString(undefined, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </p>
                                    {isReleased ? (
                                      <div className="mt-auto flex flex-wrap items-center gap-2 pb-2">
                                        <Countdown date={g.date} />
                                        {statusBadge && (
                                          <span
                                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${statusBadge.className}`}
                                          >
                                            {statusBadge.icon}
                                            {statusBadge.label}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="mt-2 text-xs text-cyan-300">
                                        <Countdown date={g.date} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.aside>

              <AnimatePresence initial={false}>
                {yearOnlyGames.length > 0 && (
                  <motion.button
                    type="button"
                    aria-label={
                      yearDrawerOpen
                        ? `Hide ${year} drawer`
                        : `Show ${year} drawer`
                    }
                    onClick={() => setYearDrawerOpen((open) => !open)}
                    initial={false}
                    animate={{ x: yearDrawerOpen ? -DESKTOP_DRAWER_WIDTH : 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="absolute right-0 top-1/2 z-30 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-amber-300/25 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(5,5,5,0.94))] text-amber-100 shadow-[-12px_0_30px_rgba(0,0,0,0.3)] transition hover:border-amber-200/40 xl:flex"
                  >
                    {yearDrawerOpen ? <FaChevronRight /> : <FaChevronLeft />}
                  </motion.button>
                )}
              </AnimatePresence>

              <motion.aside
                initial={false}
                animate={{
                  width:
                    yearDrawerOpen && yearOnlyGames.length > 0
                      ? DESKTOP_DRAWER_WIDTH
                      : 0,
                  opacity: yearDrawerOpen && yearOnlyGames.length > 0 ? 1 : 0,
                }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="relative hidden min-h-0 shrink-0 overflow-hidden border-l border-amber-300/20 bg-[linear-gradient(180deg,rgba(14,10,3,0.96),rgba(5,5,5,0.98))] xl:flex xl:flex-col"
              >
                <div className="flex min-w-[360px] flex-1 flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
                        Expected this year, but no specific release day yet.
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">
                        Coming in {year}
                      </h2>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="space-y-3">
                      {gamesLoading ? (
                        <div className="flex min-h-60 items-center justify-center">
                          <span className="loading loading-dots loading-xl" />
                        </div>
                      ) : yearOnlyGames.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/35 p-5 text-sm text-white/60">
                          No year-only releases tracked for {year}.
                        </div>
                      ) : (
                        yearOnlyGames.map((g, index) => {
                          const statusBadge = getStatusBadge(g.status);
                          return (
                            <motion.div
                              key={g.id}
                              initial={{ opacity: 0, x: 18 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.22,
                                delay: index * 0.03,
                              }}
                            >
                              <Link
                                href={`/game/${g.id}`}
                                className="group block overflow-hidden rounded-[22px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(53,35,8,0.95),rgba(18,12,4,0.98))] shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-200/35 hover:shadow-[0_22px_50px_rgba(0,0,0,0.34)]"
                              >
                                <div className="flex gap-3.5 p-3">
                                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-[0_12px_26px_rgba(0,0,0,0.25)]">
                                    <img
                                      src={
                                        g.igdb?.cover || "/placeholder-game.jpg"
                                      }
                                      alt={g.name}
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent" />
                                  </div>

                                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                                    <div>
                                      <p className="line-clamp-2 text-[17px] font-semibold leading-tight text-white">
                                        {g.name}
                                      </p>
                                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/75">
                                        Date Unconfirmed
                                      </p>
                                    </div>

                                    {statusBadge && (
                                      <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${statusBadge.className}`}
                                        >
                                          {statusBadge.icon}
                                          {statusBadge.label}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </motion.aside>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {selectedDayGames && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
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
                className="relative max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-cyan-500/30"
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

                <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                  <h3 className="text-base font-semibold sm:text-lg">
                    Releasing that day ({selectedDayGames.length}{" "}
                    {selectedDayGames.length > 1 ? "Games" : "Game"})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDayGames(null)}
                    className="cursor-pointer rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 transition hover:border-cyan-300/60 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="relative z-10 max-h-[74vh] overflow-y-auto p-4 sm:p-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {selectedDayGames.map((g) => (
                      <Link
                        key={g.id}
                        href={`/game/${g.id}`}
                        className="group relative h-60 overflow-hidden rounded-xl border border-white/10 transition hover:border-cyan-400/35"
                      >
                        <img
                          src={g.igdb?.cover || "/placeholder-game.jpg"}
                          alt={g.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="line-clamp-2 text-sm font-medium text-white">
                            {g.name}
                          </p>
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


