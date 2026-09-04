"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCrown,
  FaInfoCircle,
  FaPause,
  FaPlay,
  FaRegStar,
  FaStar,
} from "react-icons/fa";
import {
  MdBlock,
  MdOutlineAddToQueue,
  MdOutlineOnlinePrediction,
} from "react-icons/md";

import Countdown from "@/app/components/Countdowncomponent";
import PreReleaseBadge from "@/app/components/PreReleaseBadge";
import { useGames } from "@/app/context/GameContext";
import {
  formatReleaseDate,
  hasConfirmedReleaseDay,
  parseReleaseDate,
  type ReleaseDatePrecision,
} from "@/app/lib/releaseDates";
import type { PreReleaseAccess } from "@/app/types/trackedGame";
import { useUI } from "@/app/context/UIContext";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import { isAutomaticallyInEarlyAccess } from "@/app/lib/igdbReleasePhases";
import { deleteField, doc, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";

type CalendarGame = {
  id: string;
  name: string;
  status?: string;
  calendarPrimary?: boolean;
  releasePhase?: "early-access" | "full-release" | "standard";
  preReleaseAccess?: PreReleaseAccess | null;
  customReleaseTime?: {
    releasesAt?: unknown;
    timeZone?: string;
    sourceTimeZone?: string;
  } | null;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
    earlyAccessDate?: unknown;
    earlyAccessDatePrecision?: ReleaseDatePrecision | null;
    fullReleaseDate?: unknown;
    fullReleaseDatePrecision?: ReleaseDatePrecision | null;
    releaseDateKind?: "early-access" | "full-release" | "unknown" | null;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };
};

type GameWithParsedDate = CalendarGame & {
  occurrenceId: string;
  releasePhase: "early-access" | "full-release" | "standard";
  date: Date | null;
  countdownDate: Date | null;
  datePrecision?: ReleaseDatePrecision | null;
};
type DatedGame = CalendarGame & {
  occurrenceId: string;
  releasePhase: "early-access" | "full-release" | "standard";
  date: Date;
  countdownDate: Date | null;
  datePrecision?: ReleaseDatePrecision | null;
};
type CalendarPanel = "confirmed" | "windows" | "tba";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRE_RELEASE_LABELS: Record<PreReleaseAccess["type"], string> = {
  "early-access": "Early Access",
  "advanced-access": "Advanced Access",
  leaked: "Leaked",
};
const PRE_RELEASE_SHORT_LABELS: Record<PreReleaseAccess["type"], string> = {
  "early-access": "Early Access",
  "advanced-access": "Advanced Access",
  leaked: "Leaked",
};

const getCalendarCover = (cover?: string) => {
  if (!cover) return "/placeholder-game.jpg";
  if (!cover.toLowerCase().includes("igdb")) return cover;
  return cover.replace(/\/t_[^/]+\//, "/t_1080p/");
};
const PANEL_TABS: Array<{
  id: CalendarPanel;
  label: string;
  eyebrow: string;
  title: (year: number) => string;
}> = [
  {
    id: "confirmed",
    label: "Confirmed",
    eyebrow: "We Are Locked In Gang.",
    title: () => "Upcoming This Month",
  },
  {
    id: "windows",
    label: "Estimated",
    eyebrow: "Release period known, exact day still unconfirmed.",
    title: (year) => `Estimated Releases · ${year}`,
  },
  {
    id: "tba",
    label: "TBA",
    eyebrow: "No usable release window has been announced yet.",
    title: () => "Release Date TBA",
  },
];

export default function CalendarPage() {
  const { games, gamesLoading } = useGames();
  const { user } = useUser();
  const { navbarLayout } = useUI();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayGames, setSelectedDayGames] = useState<DatedGame[] | null>(
    null,
  );
  const [activePanel, setActivePanel] = useState<CalendarPanel>("confirmed");
  const [countdownInfoOpen, setCountdownInfoOpen] = useState(false);
  const [panelDirection, setPanelDirection] = useState<1 | -1>(1);
  const [estimatedQuarter, setEstimatedQuarter] = useState<
    number | "year" | null
  >(() => Math.floor(new Date().getMonth() / 3) + 1);
  const [savingPrimaryGameId, setSavingPrimaryGameId] = useState<string | null>(
    null,
  );

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const moveToMonth = (nextCursor: Date) => {
    setCursor(nextCursor);
    setEstimatedQuarter(Math.floor(nextCursor.getMonth() / 3) + 1);
  };

  const parsedOccurrences = useMemo(() => {
    return (games as CalendarGame[])
      .flatMap((g): GameWithParsedDate[] => {
        const earlyAccessDate = parseReleaseDate(g.igdb?.earlyAccessDate);
        const fullReleaseDate = parseReleaseDate(g.igdb?.fullReleaseDate);
        const exactTime = parseReleaseDate(g.customReleaseTime?.releasesAt);
        const occurrences: GameWithParsedDate[] = [];

        if (earlyAccessDate) {
          occurrences.push({
            ...g,
            occurrenceId: `${g.id}-early-access`,
            releasePhase: "early-access",
            date: earlyAccessDate,
            countdownDate:
              g.igdb?.releaseDateKind === "early-access" ? exactTime : null,
            datePrecision:
              g.igdb?.earlyAccessDatePrecision ??
              (g.igdb?.releaseDateKind === "early-access"
                ? g.igdb?.releaseDatePrecision
                : null) ??
              "day",
          });
        }

        if (fullReleaseDate) {
          occurrences.push({
            ...g,
            occurrenceId: `${g.id}-full-release`,
            releasePhase: "full-release",
            date: fullReleaseDate,
            countdownDate:
              g.igdb?.releaseDateKind === "full-release" ? exactTime : null,
            datePrecision:
              g.igdb?.fullReleaseDatePrecision ??
              (g.igdb?.releaseDateKind === "full-release"
                ? g.igdb?.releaseDatePrecision
                : null) ??
              "day",
          });
        }

        if (occurrences.length === 0) {
          occurrences.push({
            ...g,
            occurrenceId: `${g.id}-standard`,
            releasePhase: "standard",
            date: parseReleaseDate(g.igdb?.releaseDate),
            countdownDate: exactTime,
            datePrecision: g.igdb?.releaseDatePrecision,
          });
        }

        return occurrences;
      })
      .sort(
        (a, b) =>
          (a.date?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.date?.getTime() ?? Number.POSITIVE_INFINITY),
      );
  }, [games]);

  const parsedGames = useMemo(
    () =>
      parsedOccurrences.filter(
        (game): game is DatedGame => game.date instanceof Date,
      ),
    [parsedOccurrences],
  );

  const monthGames = useMemo(() => {
    return parsedGames.filter(
      (g) =>
        hasConfirmedReleaseDay(g.date, g.datePrecision) &&
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

  const releaseWindowGames = useMemo(() => {
    return parsedGames
      .filter((game) => {
        if (hasConfirmedReleaseDay(game.date, game.datePrecision)) return false;

        const precision = game.datePrecision;
        const windowYear = game.date.getUTCFullYear();
        if (windowYear !== year) return false;

        if (estimatedQuarter === "year") return precision === "year";
        if (precision === "year") return false;

        if (precision === "month") {
          return typeof estimatedQuarter === "number"
            ? Math.floor(game.date.getUTCMonth() / 3) + 1 === estimatedQuarter
            : game.date.getUTCMonth() === month;
        }
        if (precision === "quarter") {
          const gameQuarter = Math.floor(game.date.getUTCMonth() / 3) + 1;
          return typeof estimatedQuarter === "number"
            ? gameQuarter === estimatedQuarter
            : gameQuarter === Math.floor(month / 3) + 1;
        }
        return false;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [estimatedQuarter, parsedGames, month, year]);

  const tbaGames = useMemo(
    () => parsedOccurrences.filter((game) => game.date === null),
    [parsedOccurrences],
  );

  const gamesByDay = useMemo(() => {
    const map = new Map<number, DatedGame[]>();
    monthGames.forEach((g) => {
      const day = g.date.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(g);
    });
    map.forEach((dayGames) => {
      dayGames.sort(
        (a, b) =>
          Number(Boolean(b.calendarPrimary)) -
          Number(Boolean(a.calendarPrimary)),
      );
    });
    return map;
  }, [monthGames]);

  const setPrimaryDayCover = async (
    selectedGame: DatedGame,
    dayGames: DatedGame[],
  ) => {
    if (!user || selectedGame.calendarPrimary) return;

    setSavingPrimaryGameId(selectedGame.id);
    try {
      const batch = writeBatch(db);
      Array.from(
        new Map(dayGames.map((game) => [game.id, game])).values(),
      ).forEach((game) => {
        batch.update(doc(db, "users", user.uid, "games_igdb", game.id), {
          calendarPrimary: game.id === selectedGame.id ? true : deleteField(),
        });
      });
      await batch.commit();

      setSelectedDayGames((current) => {
        if (!current) return current;
        return current
          .map((game) => ({
            ...game,
            calendarPrimary: game.id === selectedGame.id,
          }))
          .sort(
            (a, b) =>
              Number(Boolean(b.calendarPrimary)) -
              Number(Boolean(a.calendarPrimary)),
          );
      });
      toast.success(`${selectedGame.name} is now the day cover.`);
    } catch (error) {
      console.error("Failed to set calendar day cover", error);
      toast.error("Could not update the day cover.");
    } finally {
      setSavingPrimaryGameId(null);
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const totalCalendarCells = 42;
  const today = new Date();

  const isCurrentMonth =
    month === today.getMonth() && year === today.getFullYear();
  const isViewingCurrentMonth = isCurrentMonth;

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
          icon: <MdOutlineAddToQueue size={11} />,
          className: "border-cyan-300/35 bg-cyan-500/15 text-cyan-100",
        };
      default:
        return null;
    }
  };

  const hasAutomaticEarlyAccess = (game: CalendarGame) =>
    isAutomaticallyInEarlyAccess(
      game.igdb?.earlyAccessDate,
      game.igdb?.fullReleaseDate,
      today.getTime(),
    );

  const getAccessType = (game: CalendarGame) =>
    (game.releasePhase === "early-access"
      ? "early-access"
      : game.preReleaseAccess?.type) ??
    (hasAutomaticEarlyAccess(game) ? "early-access" : null);

  const getAccessLabel = (game: CalendarGame) => {
    const accessType = getAccessType(game);
    if (!accessType) return null;
    if (!game.preReleaseAccess && hasAutomaticEarlyAccess(game)) {
      return "Early Access Available";
    }
    return PRE_RELEASE_LABELS[accessType];
  };

  const shouldShowFullReleaseBadge = (game: CalendarGame) =>
    game.releasePhase === "full-release" &&
    Boolean(parseReleaseDate(game.igdb?.earlyAccessDate));

  const getReleasePhaseLabel = (game: DatedGame, compact = false) => {
    if (game.releasePhase === "full-release") {
      if (!shouldShowFullReleaseBadge(game)) return null;
      return (
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-300/55 bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.2)] backdrop-blur-xl">
          {compact ? "Full Release" : "Full Release"}
        </span>
      );
    }

    const accessType = getAccessType(game);
    if (!accessType) return null;
    return (
      <PreReleaseBadge
        type={accessType}
        label={
          compact
            ? PRE_RELEASE_SHORT_LABELS[accessType]
            : (getAccessLabel(game) ?? undefined)
        }
        compact
        themeBackground={compact}
      />
    );
  };

  const getLeakedOnLabel = (game: CalendarGame) => {
    if (game.preReleaseAccess?.type !== "leaked") return null;

    const leakedAt = parseReleaseDate(game.preReleaseAccess.unlockedAt);
    if (!leakedAt) return null;

    return `Leaked on ${leakedAt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const handlePanelChange = (nextPanel: CalendarPanel) => {
    if (nextPanel === activePanel) return;

    const currentIndex = PANEL_TABS.findIndex((tab) => tab.id === activePanel);
    const nextIndex = PANEL_TABS.findIndex((tab) => tab.id === nextPanel);
    setPanelDirection(nextIndex > currentIndex ? 1 : -1);
    setActivePanel(nextPanel);
  };

  const activeTab =
    PANEL_TABS.find((tab) => tab.id === activePanel) ?? PANEL_TABS[0];

  const selectedDate = selectedDayGames?.[0]?.date ?? null;
  const selectedDateParts = selectedDate
    ? {
        weekday: selectedDate.toLocaleDateString(undefined, {
          weekday: "long",
        }),
        date: selectedDate.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      }
    : null;

  const panelVariants: Variants = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      y: direction > 0 ? 42 : -42,
      scale: 0.98,
    }),
    center: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      y: direction > 0 ? -42 : 42,
      scale: 0.98,
    }),
  };

  return (
    <>
      <main
        className={`h-svh overflow-hidden bg-[var(--theme-bg)] ${
          navbarLayout === "sidebar" ? "pt-15" : "px-3 pt-22"
        } theme-text sm:px-4 lg:px-7`}
      >
        <section className="mx-auto h-full max-w-[1680px]">
          <div className="relative flex h-full origin-top scale-[0.9] flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] theme-panel shadow-[0_25px_80px_rgba(0,0,0,0.22)] sm:scale-[0.92] lg:scale-[0.9] 2xl:scale-[0.93]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--theme-accent-rgb),0.14),transparent_50%)]" />

            <div className="relative z-10 flex flex-col gap-3 border-b border-[var(--theme-border)] p-3.5 md:flex-row md:items-center md:justify-between sm:p-5 lg:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">
                  Release Tracker
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-semibold tracking-wide sm:text-2xl">
                    {cursor.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h1>
                  {!isViewingCurrentMonth && (
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        moveToMonth(
                          new Date(now.getFullYear(), now.getMonth(), 1),
                        );
                      }}
                      className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:border-cyan-300/55 hover:bg-cyan-400/16"
                    >
                      Back to Current Month
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => moveToMonth(new Date(year, month - 1, 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel-alt)] transition hover:bg-[rgba(var(--theme-accent-rgb),0.16)]"
                >
                  <FaArrowLeft />
                </button>

                <button
                  type="button"
                  onClick={() => moveToMonth(new Date(year, month + 1, 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel-alt)] transition hover:bg-[rgba(var(--theme-accent-rgb),0.16)]"
                >
                  <FaArrowRight />
                </button>
              </div>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
              <motion.section
                layout
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex min-w-0 flex-1 flex-col border-b border-[var(--theme-border)] p-3.5 xl:border-b-0 xl:border-r sm:p-5 lg:p-6"
              >
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((d) => (
                    <div
                      key={d}
                      className="py-2 text-center text-[10px] uppercase tracking-[0.15em] theme-text-muted sm:text-xs"
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
                    className="my-auto grid min-h-[430px] w-full flex-1 grid-cols-7 grid-rows-6 gap-1.5 sm:max-h-[620px] sm:gap-2"
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
                      const primaryReleaseGame = dayGames[0] ?? null;
                      const isToday = isCurrentMonth && day === today.getDate();
                      const phaseBadges = dayGames.filter(
                        (game, index, entries) => {
                          const badge = shouldShowFullReleaseBadge(game)
                            ? "full-release"
                            : getAccessType(game);
                          return (
                            badge !== null &&
                            entries.findIndex((candidate) =>
                              shouldShowFullReleaseBadge(candidate)
                                ? badge === "full-release"
                                : getAccessType(candidate) === badge,
                            ) === index
                          );
                        },
                      );
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-label={
                            dayGames.length
                              ? `${dayGames.length} ${dayGames.length === 1 ? "game" : "games"} releasing on ${cursor.toLocaleDateString("en-US", { month: "long" })} ${day}`
                              : `${cursor.toLocaleDateString("en-US", { month: "long" })} ${day}, no releases`
                          }
                          onClick={() => {
                            if (!dayGames.length) return;
                            setSelectedDayGames(dayGames);
                          }}
                          className={`group relative overflow-hidden rounded-xl border text-left transition-[transform,border-color,box-shadow,background-color] duration-500 ease-in-out ${
                            dayGames.length
                              ? "cursor-pointer bg-[radial-gradient(circle_at_50%_56%,rgba(var(--theme-accent-rgb),0.18),transparent_58%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:border-[rgba(var(--theme-accent-rgb),0.68)] hover:shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.22),0_0_28px_rgba(var(--theme-accent-rgb),0.13),0_14px_32px_rgba(0,0,0,0.25)]"
                              : "cursor-default bg-black/20"
                          } ${
                            isToday
                              ? "border-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.55)]"
                              : dayGames.length
                                ? "border-[rgba(var(--theme-accent-rgb),0.28)]"
                                : "border-white/[0.07]"
                          }`}
                        >
                          {dayGames.length > 0 && (
                            <>
                              <img
                                src={getCalendarCover(
                                  primaryReleaseGame?.igdb?.cover,
                                )}
                                alt={
                                  primaryReleaseGame?.name ??
                                  "Release game cover"
                                }
                                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,14,0.18),rgba(7,10,18,0.7)_58%,rgba(7,10,18,0.88))]" />
                              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--theme-accent-rgb))] to-transparent opacity-45 transition-opacity duration-500 ease-in-out group-hover:opacity-90" />
                              <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b border-l border-[rgba(var(--theme-accent-rgb),0.32)] transition-all duration-500 ease-in-out group-hover:h-4 group-hover:w-4 group-hover:border-[rgba(var(--theme-accent-rgb),0.65)]" />
                              <span className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 border-r border-t border-[rgba(var(--theme-accent-rgb),0.32)] transition-all duration-500 ease-in-out group-hover:h-4 group-hover:w-4 group-hover:border-[rgba(var(--theme-accent-rgb),0.65)]" />
                            </>
                          )}

                          <span className="absolute right-3 top-2 z-10 text-[11px] font-medium theme-text sm:text-xs">
                            {day}
                          </span>

                          {phaseBadges.length > 0 && (
                            <div className="absolute left-1.5 top-1.5 z-10 flex max-w-[calc(100%-3.5rem)] gap-1 overflow-hidden">
                              {phaseBadges.map((game) => (
                                <span key={game.occurrenceId}>
                                  {getReleasePhaseLabel(game, true)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* {dayGames.length > 0 && (
                            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center pt-3 text-center text-white">
                              <div className="relative grid h-11 w-11 place-items-center sm:h-14 sm:w-14">
                                <span className="absolute inset-0 rounded-full border border-white/35 transition-[transform,border-color] duration-500 ease-in-out group-hover:scale-110 group-hover:border-white/60" />
                                <span className="absolute inset-1 rounded-full border border-dashed border-white/40 transition-transform duration-700 ease-in-out group-hover:rotate-90" />
                                <span className="absolute inset-2 rounded-full bg-white/10 shadow-[inset_0_0_12px_rgba(255,255,255,0.12),0_0_18px_rgba(255,255,255,0.12)]" />
                                <span className="relative font-mono text-xl font-black tabular-nums leading-none text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-transform duration-500 ease-in-out group-hover:scale-110 sm:text-2xl">
                                  {dayGames.length}
                                </span>
                              </div>
                              <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.22em] text-white/90 sm:text-[8px]">
                                {dayGames.length === 1 ? "Release" : "Releases"}
                              </span>
                              <span className="mt-1 hidden items-center gap-1 sm:flex">
                                {Array.from({
                                  length: Math.min(dayGames.length, 5),
                                }).map((_, releaseIndex) => (
                                  <span
                                    key={releaseIndex}
                                    className="h-1 w-1 rounded-full bg-white/80 shadow-[0_0_5px_rgba(255,255,255,0.7)]"
                                  />
                                ))}
                                {dayGames.length > 5 && (
                                  <span className="text-[6px] font-bold text-white/70">
                                    +{dayGames.length - 5}
                                  </span>
                                )}
                              </span>
                            </div>
                          )} */}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </motion.section>

              <motion.aside
                layout
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="hidden min-h-0 w-[420px] shrink-0 border-l border-[var(--theme-border)] theme-surface xl:flex xl:flex-col"
              >
                <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                  <div className="rounded-2xl border border-[var(--theme-border)] theme-surface p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="grid grid-cols-3 gap-1.5">
                      {PANEL_TABS.map((tab) => {
                        const isActive = tab.id === activePanel;
                        const count =
                          tab.id === "confirmed"
                            ? sidebarMonthGames.length
                            : tab.id === "windows"
                              ? releaseWindowGames.length
                              : tbaGames.length;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handlePanelChange(tab.id)}
                            className={`relative min-w-0 overflow-hidden rounded-xl border px-2 py-2.5 text-center transition-all duration-200 ${
                              isActive
                                ? tab.id === "confirmed"
                                  ? "border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.2)]"
                                  : tab.id === "windows"
                                    ? "border-amber-300/40 bg-amber-300 text-amber-950 shadow-[0_10px_24px_rgba(251,191,36,0.18)]"
                                    : "border-violet-300/40 bg-violet-300 text-violet-950 shadow-[0_10px_24px_rgba(167,139,250,0.18)]"
                                : tab.id === "confirmed"
                                  ? "border-transparent bg-cyan-500/[0.06] text-cyan-100/75 hover:border-cyan-300/15 hover:bg-cyan-500/10 hover:text-cyan-50"
                                  : tab.id === "windows"
                                    ? "border-transparent bg-amber-500/[0.06] text-amber-100/75 hover:border-amber-300/15 hover:bg-amber-500/10 hover:text-amber-50"
                                    : "border-transparent bg-violet-500/[0.06] text-violet-100/75 hover:border-violet-300/15 hover:bg-violet-500/10 hover:text-violet-50"
                            }`}
                          >
                            <div className="relative z-10">
                              <div className="flex items-center justify-center gap-1.5">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isActive
                                      ? "bg-current opacity-65"
                                      : tab.id === "confirmed"
                                        ? "bg-cyan-300"
                                        : tab.id === "windows"
                                          ? "bg-amber-300"
                                          : "bg-violet-300"
                                  }`}
                                />
                                <p className="truncate text-[8px] font-bold uppercase tracking-[0.18em] opacity-65">
                                  {tab.id === "confirmed"
                                    ? "Exact"
                                    : tab.id === "windows"
                                      ? "Approx."
                                      : "Unknown"}
                                </p>
                              </div>
                              <div className="mt-1 flex items-center justify-center gap-1.5">
                                <p className="truncate text-[13px] font-bold tracking-tight">
                                  {tab.label}
                                </p>
                                <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] font-black leading-none">
                                  {count > 99 ? "99+" : count}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <AnimatePresence initial={false}>
                      {activePanel === "windows" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, y: -8 }}
                          animate={{ height: "auto", opacity: 1, y: 0 }}
                          exit={{ height: 0, opacity: 0, y: -8 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1.5 grid grid-cols-5 gap-1.5 border-t border-white/[0.07] pt-1.5">
                            {([1, 2, 3, 4, "year"] as const).map((quarter) => {
                              const isSelected = estimatedQuarter === quarter;
                              return (
                                <button
                                  key={quarter}
                                  type="button"
                                  onClick={() =>
                                    setEstimatedQuarter((current) =>
                                      current === quarter ? null : quarter,
                                    )
                                  }
                                  aria-pressed={isSelected}
                                  title={
                                    isSelected
                                      ? "Return to the selected month"
                                      : quarter === "year"
                                        ? `Show releases listed only as ${year}`
                                        : `Show all Q${quarter} release estimates`
                                  }
                                  className={`rounded-lg border px-2 py-1.5 text-[10px] font-black tracking-[0.12em] transition ${
                                    isSelected
                                      ? "border-amber-300/45 bg-amber-300 text-amber-950 shadow-[0_6px_16px_rgba(251,191,36,0.16)]"
                                      : "border-transparent bg-amber-500/[0.06] text-amber-100/60 hover:border-amber-300/20 hover:bg-amber-500/12 hover:text-amber-100"
                                  }`}
                                >
                                  {quarter === "year" ? "Year" : `Q${quarter}`}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div
                  className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5"
                  style={{ perspective: 1600 }}
                >
                  <div className="mb-4 shrink-0">
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${
                        activePanel === "confirmed"
                          ? "text-cyan-200/75"
                          : activePanel === "windows"
                            ? "text-amber-200/75"
                            : "text-violet-200/75"
                      }`}
                    >
                      {activeTab.eyebrow}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {activeTab.title(year)}
                      </h2>
                      {activePanel === "windows" && estimatedQuarter && (
                        <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                          {estimatedQuarter === "year"
                            ? "Year only"
                            : `Q${estimatedQuarter}`}
                        </span>
                      )}
                      {activePanel === "confirmed" && (
                        <button
                          type="button"
                          onClick={() => setCountdownInfoOpen(true)}
                          aria-label="How release countdowns work"
                          title="How release countdowns work"
                          className="grid h-6 w-6 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-cyan-200/75 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                        >
                          <FaInfoCircle size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[var(--theme-border)] theme-surface">
                    <AnimatePresence
                      custom={panelDirection}
                      mode="wait"
                      initial={false}
                    >
                      <motion.div
                        key={`${activePanel}-${year}-${month}`}
                        custom={panelDirection}
                        variants={panelVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          duration: 0.34,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="absolute inset-0 flex min-h-0 flex-col"
                        style={{
                          willChange: "transform, opacity",
                        }}
                      >
                        <div className="min-h-0 flex-1 overflow-y-auto p-3.5 pr-4 pb-5 [scrollbar-gutter:stable_both-edges]">
                          {gamesLoading ? (
                            <div className="flex min-h-60 h-full items-center justify-center rounded-[22px] border border-[var(--theme-border)] theme-surface">
                              <span className="loading loading-dots loading-xl" />
                            </div>
                          ) : activePanel === "confirmed" ? (
                            sidebarMonthGames.length === 0 ? (
                              <div className="rounded-[22px] border border-[var(--theme-border)] theme-surface p-5 text-sm theme-text-muted">
                                No confirmed release dates in this month.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {sidebarMonthGames.map((g, index) => {
                                  const statusBadge = getStatusBadge(g.status);
                                  const accessType = getAccessType(g);
                                  const leakedOnLabel = getLeakedOnLabel(g);
                                  const isReleased =
                                    g.date.getTime() <= today.getTime();
                                  return (
                                    <motion.div
                                      key={g.occurrenceId}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{
                                        duration: 0.2,
                                        delay: index * 0.03,
                                      }}
                                    >
                                      <Link
                                        href={`/game/${g.id}`}
                                        className="group block overflow-hidden rounded-[22px] border border-[var(--theme-border)] theme-surface pt-2 shadow-[0_18px_38px_rgba(0,0,0,0.15)] transition-[transform,border-color,box-shadow,background-color] duration-500 ease-in-out hover:-translate-y-1 hover:border-[rgba(var(--theme-accent-rgb),0.45)] hover:shadow-[0_22px_48px_rgba(0,0,0,0.24),0_0_24px_rgba(var(--theme-accent-rgb),0.09)]"
                                      >
                                        <div className="flex gap-3 px-2.5 py-2">
                                          <img
                                            src={getCalendarCover(
                                              g.igdb?.cover,
                                            )}
                                            alt={g.name}
                                            decoding="async"
                                            className="h-31 w-23 shrink-0 rounded-[16px] object-cover"
                                          />

                                          <div className="flex min-w-0 flex-1 flex-col">
                                            <p className="truncate text-sm font-medium sm:text-base">
                                              {g.name}
                                            </p>
                                            <p className="mt-1 text-xs text-white/60">
                                              {g.date.toLocaleDateString(
                                                undefined,
                                                {
                                                  weekday: "short",
                                                  month: "short",
                                                  day: "numeric",
                                                },
                                              )}
                                            </p>
                                            {(accessType ||
                                              shouldShowFullReleaseBadge(
                                                g,
                                              )) && (
                                              <span className="mt-2 w-fit">
                                                {leakedOnLabel && accessType ? (
                                                  <PreReleaseBadge
                                                    type={accessType}
                                                    label={leakedOnLabel}
                                                    compact
                                                  />
                                                ) : (
                                                  getReleasePhaseLabel(g)
                                                )}
                                              </span>
                                            )}
                                            {isReleased ? (
                                              <div className="mt-auto flex flex-wrap items-center gap-2 pb-2">
                                                <Countdown
                                                  date={
                                                    g.countdownDate ?? g.date
                                                  }
                                                />
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
                                                <Countdown
                                                  date={
                                                    g.countdownDate ?? g.date
                                                  }
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )
                          ) : activePanel === "windows" ? (
                            releaseWindowGames.length === 0 ? (
                              <div className="rounded-[22px] border border-white/10 bg-black/35 p-5 text-sm text-white/60">
                                {estimatedQuarter
                                  ? estimatedQuarter === "year"
                                    ? `No year-only release estimates for ${year}.`
                                    : `No estimated releases apply to Q${estimatedQuarter} ${year}.`
                                  : "No estimated releases apply to this month."}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 pr-1">
                                {releaseWindowGames.map((g, index) => {
                                  return (
                                    <motion.div
                                      key={g.occurrenceId}
                                      initial={{
                                        opacity: 0,
                                        y: 18,
                                        scale: 0.96,
                                      }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      transition={{
                                        duration: 0.24,
                                        delay: index * 0.04,
                                      }}
                                    >
                                      <Link
                                        href={`/game/${g.id}`}
                                        className="group block overflow-hidden rounded-3xl border border-gray-600/50"
                                      >
                                        <div className="relative aspect-[0.72] overflow-hidden">
                                          <img
                                            src={
                                              g.igdb?.cover ||
                                              "/placeholder-game.jpg"
                                            }
                                            alt={g.name}
                                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                          />
                                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.18)_34%,rgba(7,5,2,0.88)_90%,rgba(7,5,2,0.98))]" />
                                          <div className="absolute left-2.5 top-2.5">
                                            {getReleasePhaseLabel(g, true)}
                                          </div>
                                          <div className="absolute inset-x-0 bottom-0 p-3.5">
                                            <p className="line-clamp-3 text-[14px] font-semibold leading-[1.04] tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                              {g.name}
                                            </p>
                                            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
                                              {formatReleaseDate(
                                                g.date,
                                                g.datePrecision,
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      </Link>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )
                          ) : tbaGames.length === 0 ? (
                            <div className="rounded-[22px] border border-white/10 bg-black/35 p-5 text-sm text-white/60">
                              No games with an unannounced release date.
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 pr-1">
                              {tbaGames.map((g, index) => (
                                <motion.div
                                  key={g.occurrenceId}
                                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{
                                    duration: 0.24,
                                    delay: index * 0.04,
                                  }}
                                >
                                  <Link
                                    href={`/game/${g.id}`}
                                    className="group block overflow-hidden rounded-3xl border border-violet-300/20"
                                  >
                                    <div className="relative aspect-[0.72] overflow-hidden">
                                      <img
                                        src={
                                          g.igdb?.cover ||
                                          "/placeholder-game.jpg"
                                        }
                                        alt={g.name}
                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                      />
                                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.18)_34%,rgba(7,5,2,0.88)_90%,rgba(7,5,2,0.98))]" />
                                      <div className="absolute inset-x-0 bottom-0 p-3.5">
                                        <p className="line-clamp-3 text-[14px] font-semibold leading-[1.04] tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                          {g.name}
                                        </p>
                                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/75">
                                          TBA
                                        </p>
                                      </div>
                                    </div>
                                  </Link>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.aside>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {countdownInfoOpen && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCountdownInfoOpen(false)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="countdown-info-title"
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/20 bg-zinc-950 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:p-7"
              >
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                    Release countdowns
                  </span>
                  <h2
                    id="countdown-info-title"
                    className="mt-3 text-2xl font-black tracking-tight text-white"
                  >
                    Why the time may not be exact
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    IGDB and game publishers usually provide a release day, but
                    not an exact launch time. Until one is announced, PlayCrew
                    calculates the countdown from the listed release date.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Exact launch times are often shared closer to release. If
                    you know the confirmed time, edit the game tracker and
                    choose{" "}
                    <span className="font-bold text-cyan-200">
                      Set exact time
                    </span>
                    . Select the announcement&apos;s timezone and PlayCrew will
                    convert it into your local time automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCountdownInfoOpen(false)}
                    autoFocus
                    className="mt-6 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-cyan-200"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedDayGames && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayGames(null)}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 32, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-[var(--theme-border)] bg-[var(--theme-surface-strong)] shadow-[var(--theme-shadow)] sm:max-h-[86vh] sm:rounded-[2rem] sm:border-b"
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <img
                    src={
                      selectedDayGames[0]?.igdb?.cover ||
                      "/placeholder-game.jpg"
                    }
                    alt=""
                    className="h-full w-full scale-110 object-cover opacity-20 blur-3xl"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,var(--theme-surface-strong)_35%,var(--theme-bg-elevated)_100%)]" />
                  <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-400/12 blur-3xl" />
                </div>

                <header className="relative z-10 flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                        Release day
                      </span>
                      <span className="text-xs text-white/45">
                        {selectedDayGames.length}{" "}
                        {selectedDayGames.length === 1 ? "game" : "games"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-cyan-200/75">
                      {selectedDateParts?.weekday}
                    </p>
                    <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {selectedDateParts?.date ?? "Release details"}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/50">
                      Everything landing in your library on this day.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDayGames(null)}
                    aria-label="Close release day details"
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/25 text-xl text-white/65 transition hover:border-cyan-300/40 hover:bg-white/10 hover:text-white"
                  >
                    ×
                  </button>
                </header>

                <div className="relative z-10 overflow-y-auto p-4 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {selectedDayGames.map((g, index) => {
                      const statusBadge = getStatusBadge(g.status);
                      const accessType = getAccessType(g);
                      const accessLabel = accessType ? getAccessLabel(g) : null;
                      const leakedOnLabel = getLeakedOnLabel(g);

                      return (
                        <motion.div
                          key={g.occurrenceId}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.045 }}
                          className="relative"
                        >
                          <Link
                            href={`/game/${g.id}`}
                            className="group flex min-h-36 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.075] hover:shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:min-h-44 sm:p-3"
                          >
                            <div className="relative w-24 shrink-0 overflow-hidden rounded-xl bg-black/30 sm:w-28">
                              <img
                                src={g.igdb?.cover || "/placeholder-game.jpg"}
                                alt={g.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
                              <div className="flex flex-wrap gap-1.5">
                                {(accessLabel ||
                                  shouldShowFullReleaseBadge(g)) &&
                                  (leakedOnLabel && accessType ? (
                                    <PreReleaseBadge
                                      type={accessType}
                                      label={leakedOnLabel}
                                      compact
                                    />
                                  ) : (
                                    getReleasePhaseLabel(g)
                                  ))}
                                {statusBadge && (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${statusBadge.className}`}
                                  >
                                    {statusBadge.icon}
                                    {statusBadge.label}
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-2 line-clamp-2 text-base font-bold leading-tight text-white sm:text-lg">
                                {g.name}
                              </h3>
                              <p className="mt-1 text-xs text-white/45">
                                {leakedOnLabel
                                  ? leakedOnLabel
                                  : g.releasePhase === "full-release"
                                    ? "Official full release"
                                    : accessLabel
                                      ? `Marked as ${accessLabel}`
                                      : "Official release"}
                              </p>
                            </div>
                          </Link>
                          {selectedDayGames.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                void setPrimaryDayCover(g, selectedDayGames)
                              }
                              disabled={
                                g.calendarPrimary ||
                                savingPrimaryGameId !== null
                              }
                              aria-label={
                                g.calendarPrimary
                                  ? `${g.name} is the day cover`
                                  : `Use ${g.name} as the day cover`
                              }
                              title={
                                g.calendarPrimary
                                  ? "Current day cover"
                                  : "Use as day cover"
                              }
                              className={`absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-md transition sm:bottom-5 sm:right-5 ${
                                g.calendarPrimary
                                  ? "cursor-default border-amber-300/40 bg-amber-400/20 text-amber-100"
                                  : "border-white/15 bg-black/60 text-white/70 hover:border-amber-300/40 hover:bg-amber-400/15 hover:text-amber-100 disabled:cursor-wait disabled:opacity-50"
                              }`}
                            >
                              {g.calendarPrimary ? (
                                <FaStar size={10} />
                              ) : (
                                <FaRegStar size={10} />
                              )}
                              {savingPrimaryGameId === g.id
                                ? "Saving..."
                                : g.calendarPrimary
                                  ? "Day cover"
                                  : "Use as cover"}
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
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
