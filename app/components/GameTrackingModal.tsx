"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MdBookmarkRemove } from "react-icons/md";
import {
  FaBan,
  FaCrown,
  FaHeart,
  FaRegHeart,
  FaStar,
  FaTrash,
} from "react-icons/fa";

import ConfirmModal from "./ConfirmModal";
import { PlaySession, TrackedGame } from "../types/trackedGame";
import {
  appendPlaySession,
  formatSessionDuration,
  normalizePlaySessions,
  normalizeSessionDate,
} from "../lib/playSessions";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";
import { GAME_STICKERS } from "../lib/gameStickers";
import { IoMdAdd } from "react-icons/io";

interface GameTrackingModalProps {
  open: boolean;
  game: TrackedGame | null;
  initialReview: {
    text: string;
    sticker: string | null;
  };
  initialSticker?: string | null;
  initialRating: number | null;
  initialProgress: number;
  initialPlaytime: number;
  initialPlayedSessions?: PlaySession[];
  initialStatus: string;
  initialFavorite: boolean;
  showStatus: boolean;
  showFavorite: boolean;
  saving: boolean;
  loading?: boolean;
  removing?: boolean;
  onClose: () => void;
  onHeaderClose?: () => void;
  onRemove?: () => Promise<void> | void;
  onSave: (
    review: {
      text: string;
      sticker: string | null;
    },
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    notInterested: boolean,
    playedSessions: PlaySession[],
  ) => Promise<void> | void;
}

const MODAL_THEME = {
  border: "border-white/12",
  button:
    "from-amber-200 via-white to-zinc-200 text-black shadow-[0_12px_28px_rgba(255,255,255,0.16)]",
} as const;

const RATING_PRESETS = [
  { label: "Awful", value: 1 },
  { label: "Okay", value: 3 },
  { label: "Great", value: 5 },
  { label: "Excellent", value: 7.5 },
  { label: "Masterpiece", value: 10 },
] as const;

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

const getRatingLabel = (rating: number | null) => {
  if (rating === null) return "Unrated";
  if (rating >= 9.5) return "Masterpiece";
  if (rating >= 8.5) return "Excellent";
  if (rating >= 7) return "Great";
  if (rating >= 5) return "Okay";
  if (rating >= 3) return "Weak";
  return "Awful";
};

const getInitialRatingValue = (initialRating: number | null) => {
  if (typeof initialRating === "number" && Number.isFinite(initialRating)) {
    return Math.max(0, Math.min(10, Math.round(initialRating * 10) / 10));
  }

  return null;
};

export default function GameTrackingModal(props: GameTrackingModalProps) {
  const {
    open,
    game,
    onClose,
    onSave,
    initialReview,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialPlayedSessions,
    initialStatus,
    initialFavorite,
    showStatus,
    showFavorite,
    saving,
    removing = false,
    loading,
    onRemove,
  } = props;

  const [notes, setNotes] = useState(initialReview.text ?? "");
  const [stickerDrawerOpen, setStickerDrawerOpen] = useState(false);
  const [sticker, setSticker] = useState<string | null>(
    initialReview.sticker ?? null,
  );

  useEffect(() => {
    setNotes(initialReview.text ?? "");
    setSticker(initialReview.sticker ?? null);
  }, [initialReview]);

  const [rating, setRating] = useState<number | null>(
    getInitialRatingValue(initialRating),
  );
  const [progress, setProgress] = useState(initialProgress ?? 0);
  const [hours, setHours] = useState(Math.floor(initialPlaytime ?? 0));
  const [minutes, setMinutes] = useState(
    Math.round(((initialPlaytime ?? 0) % 1) * 60),
  );
  const [status, setStatus] = useState(initialStatus ?? "Playing");
  const [favorite, setFavorite] = useState(initialFavorite ?? false);
  const [notInterested, setNotInterested] = useState(
    game?.notInterested === true,
  );
  const [confirmNotInterestedOpen, setConfirmNotInterestedOpen] =
    useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [playedSessions, setPlayedSessions] = useState<PlaySession[]>(
    normalizePlaySessions(initialPlayedSessions),
  );
  const [pendingDeleteSession, setPendingDeleteSession] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  const sessionHistory = useMemo(() => {
    return normalizePlaySessions(playedSessions);
  }, [playedSessions]);

  const displayedRating = rating;
  const dialRating = displayedRating ?? 0;
  const dialMin = 0;
  const dialMax = 10;
  const arcSpanDeg = 260;
  const dialStartAngle = -220;
  const dialRadius = 92;
  const dialCenter = 112;
  const dialStroke = 12;
  const circumference = 2 * Math.PI * dialRadius;
  const arcLength = (arcSpanDeg / 360) * circumference;
  const dialProgress =
    dialRating > 0 ? (dialRating - dialMin) / (dialMax - dialMin) : 0;
  const dialOffset = arcLength * (1 - dialProgress);

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    const nextPlayedSessions =
      totalPlaytime > initialPlaytime
        ? appendPlaySession(playedSessions, initialPlaytime, totalPlaytime)
        : playedSessions;

    await onSave(
      {
        text: notes,
        sticker,
      },
      rating,
      progress,
      totalPlaytime,
      status,
      favorite,
      notInterested,
      nextPlayedSessions,
    );
  };

  const getProgressText = (value: number) => {
    if (value >= 100) return "Journey Finished";
    if (value >= 85) return "Final stretch";
    if (value >= 60) return "Midway through the story";
    if (value >= 35) return "Getting into it";
    if (value >= 10) return "Starting out";
    if (value >= 5) return "Lets do it";
    return "Just beginning";
  };

  const applyNotInterested = () => {
    setNotInterested(true);
    setRating(null);
  };

  const clearNotInterested = () => setNotInterested(false);

  const isNotInterested = notInterested;

  const handleNotInterested = () => {
    if (isNotInterested) {
      clearNotInterested();
      return;
    }

    if (rating !== null) {
      setConfirmNotInterestedOpen(true);
      return;
    }

    applyNotInterested();
  };

  const normalizeDate = (value?: unknown) => parseReleaseDate(value);

  const bgUrl = game?.igdb.cover || "/placeholder-game.jpg";
  const releaseDate = normalizeDate(game?.igdb.releaseDate);
  const gameIsReleased = !!releaseDate && releaseDate <= new Date();

  const progressRadius = 40;
  const progressStroke = 8;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset =
    progressCircumference - (progress / 100) * progressCircumference;

  const handleDeleteSession = async (index: number, deductTime: boolean) => {
    const removed = playedSessions[index];
    const updated = playedSessions.filter((_, i) => i !== index);

    let newHours = hours;
    let newMinutes = minutes;

    if (deductTime && removed) {
      const removedHours = removed.durationHours || 0;

      const currentTotal = hours + minutes / 60;
      const newTotal = Math.max(0, currentTotal - removedHours);

      newHours = Math.floor(newTotal);
      newMinutes = Math.round((newTotal % 1) * 60);

      setHours(newHours);
      setMinutes(newMinutes);
    }

    // ✅ update local state immediately
    setPlayedSessions(updated);

    toast.success(
      deductTime ? "Session removed & time deducted" : "Session removed",
    );
  };

  const selectedSticker = GAME_STICKERS.find((s) => s.id === sticker);

  if (!game) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-2 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={bgUrl}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: -10 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`relative my-2 h-[calc(100dvh-1rem)]  md:h-[min(97dvh,860px)] w-full max-w-6xl overflow-hidden rounded-[28px] border sm:my-0 sm:rounded-[32px] ${MODAL_THEME.border} shadow-[0_30px_80px_rgba(0,0,0,0.72)]`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(135deg,rgba(0,0,0,0.3),rgba(0,0,0,0.72))] backdrop-blur-md" />

            <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3 p-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-y sm:gap-4 sm:p-6">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-32 rounded-full bg-amber-200/10 blur-3xl" />

              <header className="grid gap-3 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={bgUrl}
                    alt={game?.name || "Game cover"}
                    className="h-16 w-12 shrink-0 rounded-xl border border-white/20 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  />
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.26em] text-amber-100/70">
                      Edit Game
                    </p>
                    <h3 className="truncate text-lg font-bold text-white sm:text-[1.35rem]">
                      {game?.name}
                    </h3>
                    <p className="truncate text-xs text-zinc-200/85 sm:text-sm">
                      {formatReleaseDate(
                        game?.igdb.releaseDate,
                        game?.igdb.releaseDatePrecision,
                      )}
                    </p>
                  </div>
                  {!gameIsReleased && (
                    <div className="rounded-full border border-amber-400/20 bg-red-500/30 px-3 py-1 text-xs text-white">
                      Unreleased Game
                    </div>
                  )}
                </div>

                <div className="flex max-w-[500px] flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                  {showStatus && (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="h-9 cursor-pointer min-w-[118px] rounded-xl border border-white/15 bg-black/35 px-3 text-xs text-white shadow-inner shadow-black/20"
                    >
                      <option value="Playing">Playing</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Dropped">Dropped</option>
                      <option value="Online">Online</option>
                      <option value="Try Again?">Try Again?</option>
                      <option value="Want To Play">Want To Play</option>
                    </select>
                  )}

                  {showFavorite && (
                    <motion.button
                      onClick={() => setFavorite((f) => !f)}
                      whileHover={{ y: -2, scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: favorite ? [1, 1.08, 1] : 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 cursor-pointer rounded-xl border px-3 text-[11px] font-medium whitespace-nowrap transition ${
                        favorite
                          ? "border-red-300/60 bg-red-500/22 text-red-100 shadow-[0_10px_24px_rgba(239,68,68,0.15)]"
                          : "border-white/15 bg-black/35 text-white hover:bg-white/10"
                      }`}
                    >
                      {favorite ? <FaHeart /> : <FaRegHeart />}
                      <span>{favorite ? "Favorited" : "Favorite"}</span>
                    </motion.button>
                  )}

                  {onRemove && (
                    <motion.button
                      onClick={() => setConfirmRemoveOpen(true)}
                      whileHover={{ y: -2, scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="relative rounded-xl border border-red-300/35 bg-red-500/12 px-3 py-2 text-[11px] font-medium text-red-100 transition hover:bg-red-500/22 disabled:opacity-60 whitespace-nowrap"
                      disabled={saving || removing}
                    >
                      <span
                        className={`flex items-center justify-center gap-2 cursor-pointer ${removing ? "opacity-0" : ""}`}
                      >
                        <MdBookmarkRemove /> Remove Game from collection
                      </span>
                    </motion.button>
                  )}
                </div>
              </header>

              <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
                <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr] md:items-stretch">
                  <section className="grid gap-3 sm:min-h-0">
                    <div
                      className={`relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 backdrop-blur-xl`}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-100/35 to-transparent" />
                      <div className="grid mt-6 gap-4">
                        <div className="rounded-[24px] border border-white/12 bg-black/20 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
                            <div className="flex-col justify-center mx-auto w-full max-w-[260px]">
                              <div className="relative mx-auto h-56 w-56">
                                <svg
                                  className="h-full w-full"
                                  viewBox="0 0 224 224"
                                >
                                  <circle
                                    cx={dialCenter}
                                    cy={dialCenter}
                                    r={dialRadius}
                                    fill="none"
                                    stroke="rgba(255,255,255,0.12)"
                                    strokeWidth={dialStroke}
                                    strokeLinecap="round"
                                    strokeDasharray={`${arcLength} ${circumference}`}
                                    transform={`rotate(${dialStartAngle} ${dialCenter} ${dialCenter})`}
                                  />

                                  <circle
                                    cx={dialCenter}
                                    cy={dialCenter}
                                    r={dialRadius}
                                    fill="none"
                                    stroke="url(#ratingDialGradient)"
                                    strokeWidth={dialStroke}
                                    strokeLinecap="round"
                                    strokeDasharray={`${arcLength} ${circumference}`}
                                    strokeDashoffset={dialOffset}
                                    transform={`rotate(${dialStartAngle} ${dialCenter} ${dialCenter})`}
                                    style={{
                                      transition:
                                        "stroke-dashoffset 200ms ease",
                                    }}
                                  />
                                  <defs>
                                    <linearGradient
                                      id="ratingDialGradient"
                                      x1="0%"
                                      y1="0%"
                                      x2="100%"
                                      y2="100%"
                                    >
                                      <stop offset="0%" stopColor="#f5d47a" />
                                      <stop offset="55%" stopColor="#ffd778" />
                                      <stop offset="100%" stopColor="#fff1c7" />
                                    </linearGradient>
                                  </defs>
                                </svg>

                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-400">
                                    Rating
                                  </p>
                                  <motion.div
                                    className="mt-1 flex items-end justify-center gap-1 leading-none"
                                    animate={{
                                      scale: rating === 10 ? 1.05 : 1,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 180,
                                      damping: 18,
                                    }}
                                  >
                                    <motion.span
                                      key={rating}
                                      initial={{ y: 8, opacity: 0 }}
                                      animate={{ y: 0, opacity: 1 }}
                                      transition={{
                                        duration: 0.18,
                                        ease: "easeOut",
                                      }}
                                      className="text-5xl font-bold tracking-tight text-[#ffd77a] flex items-center justify-center"
                                    >
                                      {rating === 10 ? (
                                        <motion.div
                                          initial={{ scale: 0.7, rotate: -15 }}
                                          animate={{ scale: 1, rotate: 0 }}
                                          transition={{
                                            type: "spring",
                                            stiffness: 250,
                                            damping: 14,
                                          }}
                                        >
                                          <FaCrown className="text-6xl text-yellow-300 drop-shadow-[0_0_18px_rgba(255,215,122,0.7)]" />
                                        </motion.div>
                                      ) : (
                                        formatRating(rating ?? 0)
                                      )}
                                    </motion.span>
                                    <span className="pb-1 text-sm text-zinc-400">
                                      /10
                                    </span>
                                  </motion.div>
                                </div>
                              </div>
                              <div className="w-38 mx-auto flex items-center justify-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/12 px-3 py-1.5 text-[11px] font-medium text-amber-100">
                                <FaStar className="text-sm" />
                                <span>{getRatingLabel(rating)}</span>
                              </div>
                            </div>

                            <div className="grid gap-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.22em] text-amber-100/70">
                                    Your Rating
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    Use the slider to set the score.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleNotInterested}
                                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition ${
                                    isNotInterested
                                      ? "border-cyan-300/45 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/26"
                                      : "border-red-300/35 bg-red-500/12 text-red-100 hover:bg-red-500/22"
                                  } ${
                                    isNotInterested
                                      ? "opacity-45"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  <FaBan
                                    className={`text-sm ${isNotInterested ? "text-cyan-300" : "text-red-500"}`}
                                  />
                                  <span>
                                    {isNotInterested
                                      ? "Restore"
                                      : "Not Interested"}
                                  </span>
                                </button>
                              </div>

                              <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                                <input
                                  type="range"
                                  min={0}
                                  max={10}
                                  step={0.1}
                                  value={rating ?? 0}
                                  disabled={isNotInterested}
                                  onChange={(e) => {
                                    if (isNotInterested) return;
                                    setRating(Number(e.target.value));
                                  }}
                                  className="h-2.5 w-full accent-[#ffd77a]"
                                />
                              </div>

                              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                                {RATING_PRESETS.map((preset) => {
                                  const isActive =
                                    rating !== null &&
                                    Math.abs(rating - preset.value) < 0.001;

                                  return (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      disabled={isNotInterested}
                                      onClick={() => {
                                        if (isNotInterested) return;
                                        setRating(preset.value);
                                      }}
                                      className={`text-left transition ${
                                        isActive
                                          ? "text-amber-200"
                                          : "text-zinc-400 hover:text-zinc-200"
                                      } ${
                                        isNotInterested
                                          ? "opacity-45"
                                          : "cursor-pointer"
                                      }`}
                                    >
                                      <span className="ml-2">
                                        {preset.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 md:min-h-0">
                    <div
                      className={`flex h-full min-h-[300px] flex-col rounded-[28px] border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-4 backdrop-blur-xl lg:min-h-[360px] lg:p-5`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/55">
                            {getProgressText(progress)}
                          </p>
                          <p className="mt-2 text-3xl font-bold tracking-tight text-white lg:mt-3 lg:text-4xl">
                            {hours}h {minutes}m
                          </p>
                          <button
                            type="button"
                            onClick={() => setSessionsOpen(true)}
                            className="mt-2 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/16"
                          >
                            View Sessions{" "}
                            {sessionHistory.length
                              ? `(${sessionHistory.length})`
                              : ""}
                          </button>
                        </div>

                        <div className="flex shrink-0 flex-col items-center rounded-[22px] border border-white/10 bg-black/20 px-3 py-2.5 text-center lg:px-4 lg:py-3">
                          <span className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            Progress
                          </span>
                          <div className="relative h-14 w-14 lg:h-16 lg:w-16">
                            <svg
                              className="h-14 w-14 -rotate-90 lg:h-16 lg:w-16"
                              viewBox="0 0 100 100"
                            >
                              <circle
                                cx="50"
                                cy="50"
                                r={progressRadius}
                                fill="none"
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth={progressStroke}
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r={progressRadius}
                                fill="none"
                                stroke="url(#progressGradient)"
                                strokeWidth={progressStroke}
                                strokeLinecap="round"
                                strokeDasharray={progressCircumference}
                                strokeDashoffset={progressOffset}
                                style={{
                                  transition: "stroke-dashoffset 200ms ease",
                                }}
                              />
                              <defs>
                                <linearGradient
                                  id="progressGradient"
                                  x1="0%"
                                  y1="0%"
                                  x2="100%"
                                  y2="100%"
                                >
                                  <stop offset="0%" stopColor="#6ee7b7" />
                                  <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-semibold text-white lg:text-sm">
                                {progress}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:mt-5 lg:flex-1 lg:grid-rows-[auto_auto] lg:gap-4">
                        <div className="rounded-[24px] border border-white/10 bg-black/20 p-3.5 lg:p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                              Completion
                            </span>
                            <span className="text-sm font-semibold text-white">
                              {progress}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={progress}
                            disabled={!gameIsReleased}
                            onChange={(e) =>
                              setProgress(Number(e.target.value))
                            }
                            className="h-2.5 w-full accent-emerald-400"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="rounded-[22px] border border-white/12 bg-white/4 px-4 py-3">
                            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                              Hours
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={hours}
                              onChange={(e) =>
                                setHours(Math.max(0, Number(e.target.value)))
                              }
                              disabled={!gameIsReleased}
                              className="w-full bg-transparent text-xl font-semibold text-white outline-none lg:text-2xl"
                            />
                          </label>
                          <label className="rounded-[22px] border border-white/12 bg-white/4 px-4 py-3">
                            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                              Minutes
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={minutes}
                              onChange={(e) =>
                                setMinutes(
                                  Math.max(
                                    0,
                                    Math.min(59, Number(e.target.value)),
                                  ),
                                )
                              }
                              disabled={!gameIsReleased}
                              className="w-full bg-transparent text-xl font-semibold text-white outline-none lg:text-2xl"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_280px]">
                  {/* REVIEW */}

                  <div className="grid min-h-[170px] grid-rows-[auto_1fr] rounded-[24px] border border-white/12 bg-white/8 p-3.5 backdrop-blur-xl md:min-h-[220px]">
                    <label className="pb-2 text-xs uppercase tracking-[0.16em] text-zinc-200">
                      Review
                    </label>

                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Write your thoughts..."
                      className="h-full min-h-[120px] resize-none rounded-[20px] border border-white/12 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-white/30 md:min-h-[150px]"
                    />
                  </div>

                  {/* STICKER */}

                  <div className="flex h-full flex-col rounded-[25px] border border-dashed border-white/15 bg-black/20 p-4">
                    <label className="pb-2 block text-xs uppercase tracking-[0.16em] text-zinc-200 text-center">
                      Got me feeling like
                    </label>

                    <div
                      onClick={() => setStickerDrawerOpen(true)}
                      className="
                        group
                        relative
                        flex
                        h-full
                        cursor-pointer
                        flex-col
                        items-center
                        justify-center
                        rounded-[18px]
                        text-center
                        transition
                        hover:border-white/20
                      "
                    >
                      {selectedSticker ? (
                        <img
                          src={selectedSticker.image}
                          alt={selectedSticker.label}
                          className="h-50 w-50 object-contain rounded-lg"
                        />
                      ) : (
                        <>
                          <div className="text-5xl opacity-50 grayscale">
                            🥺
                          </div>

                          <p className="mt-3 text-xs">
                            No sticker selected for this game
                          </p>
                        </>
                      )}

                      {/* Overlay */}

                      <div
                        className="
                          absolute
                          inset-0
                          flex
                          items-center
                          justify-center
                          rounded-[25px]
                          bg-zinc-800/90
                          opacity-0
                          transition
                          group-hover:opacity-100
                        "
                      >
                        <div className="flex flex-col items-center gap-2">
                          <IoMdAdd size={50} />

                          <span className="text-sm font-medium text-white">
                            {selectedSticker
                              ? "Edit Sticker"
                              : "Choose Sticker"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="flex flex-col gap-2 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-300">
                  {isNotInterested
                    ? "Unmark as Not Interested to rate this game."
                    : "Your library, your rules."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-white/15 bg-black/35 px-3.5 py-2 text-sm text-white transition hover:bg-white/14"
                    disabled={saving || removing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await handleSave();
                      onClose();
                    }}
                    disabled={saving || removing}
                    className={`rounded-xl bg-linear-to-r px-4 py-2 text-sm font-bold transition hover:brightness-105 disabled:opacity-60 ${MODAL_THEME.button}`}
                  >
                    {saving ? (
                      <div className="flex w-full items-center justify-center gap-2">
                        <span className="loading loading-dots loading-xs" />
                      </div>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </footer>

              <AnimatePresence>
                {sessionsOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: 8 }}
                      className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Play Sessions
                          </p>
                          <p className="text-xs text-zinc-400">
                            Each playtime increase creates a dated session
                            entry.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSessionsOpen(false)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/12"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        {sessionHistory.length ? (
                          sessionHistory.map((session, index) => {
                            const playedAt = normalizeSessionDate(
                              session.playedAt,
                            );
                            return (
                              <div
                                key={`${playedAt?.toISOString?.() ?? "session"}-${index}`}
                                className="group relative rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {playedAt
                                        ? playedAt.toLocaleDateString(
                                            undefined,
                                            {
                                              weekday: "long",
                                              month: "long",
                                              day: "numeric",
                                              year: "numeric",
                                            },
                                          )
                                        : "Session date unavailable"}
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                      {playedAt
                                        ? playedAt.toLocaleTimeString(
                                            undefined,
                                            {
                                              hour: "numeric",
                                              minute: "2-digit",
                                            },
                                          )
                                        : "Unknown time"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-emerald-300">
                                      +
                                      {formatSessionDuration(
                                        session.durationHours,
                                      )}
                                    </p>

                                    {/* 🗑 Delete (appears on hover) */}
                                    <button
                                      onClick={() =>
                                        setPendingDeleteSession(index)
                                      }
                                      className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300"
                                    >
                                      <FaTrash size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-zinc-400">
                            No play sessions yet. Increase playtime and save to
                            log one.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {(loading || saving) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                >
                  <span className="loading loading-dots loading-lg text-white" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CONFIRM TO SET GAME AS NOT INTERESTED */}
            <ConfirmModal
              open={confirmNotInterestedOpen}
              title="Are you sure?"
              message="Marking this game as not interested means this game did not click with you. Doing so will clear your ratings for this game."
              confirmText="Yes, Clear"
              cancelText="Cancel"
              onCancel={() => setConfirmNotInterestedOpen(false)}
              onConfirm={() => {
                applyNotInterested();
                setConfirmNotInterestedOpen(false);
              }}
            />

            {/* DELETE GAME ENTRY */}
            <ConfirmModal
              open={confirmRemoveOpen}
              title="Remove entry?"
              message="This will remove the game from your library entry, including tracking data saved for it."
              confirmText={removing ? "Removing..." : "Yes, Remove"}
              cancelText="Cancel"
              onCancel={() => {
                if (!removing) setConfirmRemoveOpen(false);
              }}
              onConfirm={async () => {
                if (!onRemove) return;
                await onRemove();
                setConfirmRemoveOpen(false);
              }}
            />

            {/* DELETE SESSION */}
            <ConfirmModal
              open={pendingDeleteSession !== null}
              title="Remove session?"
              message="Do you want to remove this session only, or also deduct its time from total playtime?"
              confirmText="Remove & Deduct"
              cancelText="Remove Only"
              onCancel={() => {
                if (pendingDeleteSession === null) return;

                const index = pendingDeleteSession;
                setPendingDeleteSession(null);
                handleDeleteSession(index, false);
              }}
              onConfirm={() => {
                if (pendingDeleteSession === null) return;

                const index = pendingDeleteSession;
                setPendingDeleteSession(null);
                handleDeleteSession(index, true);
              }}
            />

            <AnimatePresence>
              {stickerDrawerOpen && (
                <>
                  {/* Backdrop */}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setStickerDrawerOpen(false)}
                    className="absolute inset-0 z-30 bg-black/30"
                  />

                  {/* Drawer */}

                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{
                      type: "spring",
                      damping: 30,
                      stiffness: 300,
                    }}
                    className="absolute right-0 top-0 z-40 h-full w-[360px] border-l border-white/10 bg-zinc-950/95 backdrop-blur-xl"
                  >
                    <div className="flex h-full flex-col">
                      {/* Header */}

                      <div className="flex items-center justify-between border-b border-white/10 p-4">
                        <h3 className="text-lg font-semibold text-white">
                          What are you feeling?
                        </h3>

                        <button
                          onClick={() => setStickerDrawerOpen(false)}
                          className="text-zinc-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Stickers */}
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 gap-3">
                          {GAME_STICKERS.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSticker(s.id);
                                setStickerDrawerOpen(false);
                              }}
                              className={`rounded-2xl border p-3 transition cursor-pointer ${
                                sticker === s.id
                                  ? "border-orange-400 bg-orange-500/10"
                                  : "border-white/10 bg-white/5 hover:bg-white/10"
                              }`}
                            >
                              <img
                                src={s.image}
                                alt={s.label}
                                className="mx-auto h-30 w-30 object-contain"
                              />
                              <p className="mt-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                                {s?.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Footer */}

                      <div className="border-t border-white/10 p-4">
                        <button
                          onClick={() => setSticker(null)}
                          className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                        >
                          Clear Sticker
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
