"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import Countdown from "@/app/components/Countdowncomponent";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import Link from "next/link";

type Game = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: any;
  };
};

export default function CalendarPage() {
  const { user } = useUser();
  const year = new Date().getFullYear();
  const [games, setGames] = useState<Game[]>([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDayGames, setSelectedDayGames] = useState<
    typeof monthGames | null
  >(null);

  /* ---------------- DATA ---------------- */

  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "games_igdb");
    return onSnapshot(ref, (snap) => {
      const list: Game[] = [];
      snap.forEach((doc) =>
        list.push({ id: doc.id, ...(doc.data() as Omit<Game, "id">) }),
      );
      setGames(list);
    });
  }, [user]);

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (typeof value === "number")
      return new Date(value < 1e12 ? value * 1000 : value);
    if (typeof value === "string") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const monthGames = useMemo(() => {
    return games
      .map((g) => ({ ...g, date: parseDate(g.igdb?.releaseDate) }))
      .filter(
        (g) =>
          g.date &&
          g.date.getMonth() === month &&
          g.date.getFullYear() === year,
      )
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());
  }, [games, month, year]);

  const gamesByDay = useMemo(() => {
    const map = new Map<number, typeof monthGames>();

    monthGames.forEach((g) => {
      const day = g.date!.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(g);
    });

    return map;
  }, [monthGames]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const today = new Date();

  /* ---------------- UI ---------------- */

  return (
    <>
      <Helmet>
        <title>PlayCrew – Release Calendar</title>
      </Helmet>

      <div className="h-screen bg-black text-white flex overflow-hidden pt-16">
        {/* LEFT – CALENDAR */}
        <main className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 bg-zinc-900 rounded-full px-4 py-2">
            <button onClick={() => setMonth((m) => m - 1)}>
              <FaArrowLeft />
            </button>

            <h1 className="font-bold">
              {new Date(year, month).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h1>

            <button onClick={() => setMonth((m) => m + 1)}>
              <FaArrowRight />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-hidden p-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${year}-${month}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="grid grid-cols-7 grid-rows-6 gap-2 h-full"
              >
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const games = gamesByDay.get(day) || [];
                  const isToday =
                    day === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear();

                  return (
                    <div
                      key={day}
                      onClick={() => {
                        if (games.length > 1) {
                          setSelectedDayGames(games);
                        } else if (games.length === 1) {
                          window.location.href = `/game/${games[0].id}`;
                        }
                      }}
                      className={`relative rounded-lg overflow-hidden cursor-pointer
              ${isToday ? "ring-2 ring-cyan-400" : "ring-1 ring-white/10"}
            `}
                    >
                      {games.length > 0 && (
                        <div
                          className={`absolute inset-0 ${
                            games.length > 1 && "grid grid-cols-2"
                          } ${
                            games.length > 2 && "grid grid-cols-2 grid-rows-2"
                          }`}
                        >
                          {games.slice(0, 4).map((g, i) => (
                            <img
                              key={i}
                              src={g.igdb?.cover}
                              className="w-full h-full object-cover"
                            />
                          ))}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60" />

                      <div className="relative z-10 p-2 text-xs">{day}</div>

                      {games.length > 4 && (
                        <div className="absolute bottom-1 right-1 text-[10px] text-white/80">
                          +{games.length - 4}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* RIGHT – UPCOMING */}
        <aside className="w-full sm:w-[420px] border-l border-white/10 flex flex-col overflow-hidden">
          <h2 className="p-5 text-lg font-semibold">Upcoming</h2>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {monthGames.map((g, i) => (
                  <motion.div
                    key={`${g.id}-${i}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                  >
                    <Link href={`/game/${g.id}`}>
                      <div
                        className="
                        relative h-60
                        rounded-xl overflow-hidden
                        group cursor-pointer shadow-lg
                      "
                      >
                        <img
                          src={g.igdb?.cover}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
                        />

                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

                        <div className="relative z-10 h-full flex flex-col justify-end p-4">
                          <Countdown date={g.date!} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </aside>
        <AnimatePresence>
          {selectedDayGames && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayGames(null)}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                className="
          bg-zinc-900 rounded-2xl
          w-full max-w-4xl
          max-h-[85vh]
          flex flex-col
          overflow-hidden
        "
              >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-lg font-bold mx-auto">
                    Releasing That Day ({selectedDayGames.length} Games)
                  </h2>
                  <button
                    onClick={() => setSelectedDayGames(null)}
                    className="text-white/60 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {selectedDayGames.map((g) => (
                      <Link
                        key={g.id}
                        href={`/game/${g.id}`}
                        className="group relative rounded-xl overflow-hidden h-60"
                      >
                        <img
                          src={g.igdb?.cover}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

                        <div className="absolute bottom-0 p-4">
                          <p className="text-white font-semibold">{g.name}</p>
                          <p className="text-xs text-white/60">
                            {g.date?.toLocaleDateString()}
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
      </div>
    </>
  );
}
