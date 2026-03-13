"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBan,
  FaHeart,
  FaRegHeart,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
} from "react-icons/fa";
import { MdBookmarkRemove } from "react-icons/md";
import ConfirmModal from "./ConfirmModal";
import { CategoryRatings, TrackedGame } from "../types/trackedGame";

interface GameTrackingModalProps {
  open: boolean;
  game: TrackedGame | null;
  initialNotes: string;
  initialRating: number | null;
  initialProgress: number;
  initialPlaytime: number;
  initialStatus: string;
  initialFavorite: boolean;
  initialCategoryRatings?: CategoryRatings;
  showStatus: boolean;
  showFavorite: boolean;
  saving: boolean;
  loading?: boolean;
  removing?: boolean;
  onClose: () => void;
  onHeaderClose?: () => void;
  onRemove?: () => Promise<void> | void;
  onSave: (
    notes: string,
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
  ) => Promise<void> | void;
}

const DEFAULT_CATEGORIES: CategoryRatings = {
  graphics: null,
  gameplay: null,
  story: null,
  ost: null,
  cinematics: null,
  voiceActing: null,
};

const PRESETS: { label: string; value: number }[] = [
  { label: "Masterpiece", value: 10 },
  { label: "Amazing", value: 8 },
  { label: "Great", value: 7 },
  { label: "Good", value: 6 },
  { label: "Average", value: 5 },
  { label: "Poor", value: 3 },
];

const WEIGHTS = {
  graphics: 0.2,
  gameplay: 0.25,
  story: 0.2,
  ost: 0.1,
  cinematics: 0.15,
  voiceActing: 0.1,
} as const;

const MODAL_THEME = {
  border: "border-white/15",
  button: "from-white to-zinc-300 text-black",
} as const;

const getClosestPreset = (score: number) => {
  let closest = PRESETS[0];
  let minDiff = Infinity;
  for (const preset of PRESETS) {
    const diff = Math.abs(preset.value - score);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }
  return closest.label;
};

const getCategoryLabel = (cat: keyof CategoryRatings) => {
  const labels: Record<keyof CategoryRatings, string> = {
    story: "Story",
    graphics: "Graphics",
    gameplay: "Gameplay",
    ost: "OST",
    cinematics: "Cinematics",
    voiceActing: "Voice Acting",
  };
  return labels[cat];
};

const getCategoryShort = (cat: keyof CategoryRatings) => {
  const labels: Partial<Record<keyof CategoryRatings, string>> = {
    cinematics: "No Cinemactics",
    voiceActing: "No VC",
  };
  return labels[cat] ?? "";
};

export default function GameTrackingModal(props: GameTrackingModalProps) {
  const {
    open,
    game,
    onClose,
    onSave,
    initialNotes,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialStatus,
    initialFavorite,
    initialCategoryRatings,
    showStatus,
    showFavorite,
    saving,
    removing = false,
    loading,
    onRemove,
  } = props;

  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>(
    initialCategoryRatings ?? DEFAULT_CATEGORIES,
  );
  const [progress, setProgress] = useState<number>(initialProgress ?? 0);
  const [hours, setHours] = useState<number>(Math.floor(initialPlaytime ?? 0));
  const [minutes, setMinutes] = useState<number>(
    Math.round(((initialPlaytime ?? 0) % 1) * 60),
  );

  const [status, setStatus] = useState<string>(initialStatus ?? "Playing");
  const [favorite, setFavorite] = useState<boolean>(initialFavorite ?? false);
  const [notInterested, setNotInterested] = useState<boolean>(
    game?.notInterested === true,
  );
  const [confirmNotInterestedOpen, setConfirmNotInterestedOpen] =
    useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setProgress(initialProgress ?? 0);
    setHours(Math.floor(initialPlaytime ?? 0));
    setMinutes(Math.round(((initialPlaytime ?? 0) % 1) * 60));
    setStatus(initialStatus ?? "Playing");
    setFavorite(initialFavorite ?? false);
    setNotInterested(game?.notInterested === true);

    const hasMeaningfulCategoryRatings =
      !!initialCategoryRatings &&
      Object.values(initialCategoryRatings).some((v) => v !== null);

    if (hasMeaningfulCategoryRatings && initialCategoryRatings) {
      setCategoryRatings(initialCategoryRatings);
    } else if (
      typeof initialRating === "number" &&
      !Number.isNaN(initialRating) &&
      initialRating > 0
    ) {
      setCategoryRatings({
        graphics: initialRating,
        gameplay: initialRating,
        story: initialRating,
        ost: initialRating,
        cinematics: initialRating,
        voiceActing: initialRating,
      });
    } else {
      setCategoryRatings(DEFAULT_CATEGORIES);
    }
  }, [
    open,
    game?.igdb.id,
    initialNotes,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialStatus,
    initialFavorite,
    initialCategoryRatings,
  ]);

  const setCategory = (k: keyof CategoryRatings, v: number | "excluded" | null) =>
    setCategoryRatings((s) => ({ ...s, [k]: v }));

  const categoryOrder: (keyof CategoryRatings)[] = [
    "story",
    "graphics",
    "gameplay",
    "ost",
    "cinematics",
    "voiceActing",
  ];

  const weightedRating = useMemo(() => {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [cat, weight] of Object.entries(WEIGHTS)) {
      const score = categoryRatings[cat as keyof CategoryRatings];
      if (score === "excluded") continue;

      totalWeight += weight;
      if (typeof score === "number") {
        weightedSum += score * weight;
      }
    }

    if (totalWeight === 0) return null;
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }, [categoryRatings]);

  const hasAnyRatings = useMemo(
    () =>
      Object.values(categoryRatings).some((value) => typeof value === "number"),
    [categoryRatings],
  );

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    await onSave(
      notes,
      hasAnyRatings ? weightedRating : null,
      progress,
      totalPlaytime,
      status,
      favorite,
      categoryRatings,
      notInterested,
    );
  };

  const applyNotInterested = () => {
    setNotInterested(true);
    setProgress(0);
    setCategoryRatings({ ...DEFAULT_CATEGORIES });
  };

  const clearNotInterested = () => {
    setNotInterested(false);
  };

  const handleNotInterested = () => {
    if (isNotInterested) {
      clearNotInterested();
      return;
    }

    if (hasAnyRatings) {
      setConfirmNotInterestedOpen(true);
      return;
    }
    applyNotInterested();
  };

  const bgUrl = game?.igdb.cover || "/placeholder-game.jpg";

  const normalizeDate = (value?: any) => {
    if (!value) return null;
    if (typeof value === "object" && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }
    if (typeof value === "number") {
      return new Date(value * 1000);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const releaseDate = normalizeDate(game?.igdb.releaseDate);
  const gameIsReleased = !!releaseDate && releaseDate <= new Date();
  const isNotInterested = notInterested;
  const handleUnreleasedLockedClick = () => {
    if (!gameIsReleased) {
      toast.error("Game isn't released yet.");
    }
  };
  const progressRadius = 40;
  const progressStroke = 8;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset =
    progressCircumference - (progress / 100) * progressCircumference;

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
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`relative my-2 h-[calc(100dvh-1rem)] w-full max-w-6xl overflow-hidden rounded-2xl border sm:my-0 sm:h-[min(97dvh,760px)] sm:rounded-3xl ${MODAL_THEME.border} shadow-[0_30px_80px_rgba(0,0,0,0.72)]`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-black/58 backdrop-blur-md" />

            <div className="relative z-10 grid h-full grid-rows-[auto_auto_auto] gap-3 overflow-y-auto p-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-y sm:min-h-0 sm:grid-rows-[auto_1fr_auto] sm:overflow-hidden sm:gap-4 sm:p-4">
              <header className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={bgUrl}
                    alt={game?.name || "Game cover"}
                    className="h-14 w-11 shrink-0 rounded-md border border-white/20 object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white sm:text-xl">
                      {game?.name}
                    </h3>
                    <p className="truncate text-xs text-zinc-200/85 sm:text-sm">
                      {releaseDate
                        ? releaseDate.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Release date unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {showStatus && (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-lg border border-white/20 bg-black/45 px-2 py-1.5 text-xs text-white sm:text-sm"
                    >
                      <option value="Playing">Playing</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Dropped">Dropped</option>
                      <option value="Online">Online</option>
                      <option value="Want To Play">Want To Play</option>
                    </select>
                  )}
                  {showFavorite && (
                    <motion.button
                      onClick={() => setFavorite((f) => !f)}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: favorite ? [1, 1.08, 1] : 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition sm:text-sm ${
                        favorite
                          ? "border-red-300/60 bg-red-500/25 text-red-100"
                          : "border-white/20 bg-black/40 text-white hover:bg-white/10"
                      }`}
                    >
                      {favorite ? <FaHeart /> : <FaRegHeart />}
                      <span>{favorite ? "Favorite" : "Add Favorite"}</span>
                    </motion.button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveOpen(true)}
                      className="relative rounded-lg border border-red-300/35 bg-red-500/12 px-3 py-1.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/22 disabled:opacity-60"
                      disabled={saving || removing}
                    >
                      <span
                        className={`flex items-center justify-center gap-2 
                          ${removing ? "opacity-0" : ""}`}
                      >
                        <MdBookmarkRemove />
                        Remove Entry
                      </span>

                      {removing && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="loading loading-dots loading-sm" />
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </header>

              <div className="grid gap-3 sm:min-h-0 md:grid-cols-[1.2fr_0.8fr]">
                <section className="grid gap-3 sm:min-h-0 sm:grid-rows-[auto_1fr]">
                  <div
                    className={`relative rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md ${
                      !gameIsReleased ? "opacity-45" : ""
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-200">
                        Rating System
                      </p>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!hasAnyRatings}
                          onClick={() => setCategoryRatings(DEFAULT_CATEGORIES)}
                          className={`rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition
                            ${
                              hasAnyRatings
                                ? "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/12 hover:text-white"
                                : "border-white/10 bg-white/3 text-zinc-600 cursor-default"
                            }`}
                        >
                          Clear Rating
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryOrder.map((cat) => {
                        const value = categoryRatings[cat];
                        const isExcluded = value === "excluded";
                        const canExclude =
                          cat === "voiceActing" || cat === "cinematics";

                        return (
                          <div
                            key={cat}
                            className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2"
                          >
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="truncate text-xs font-medium text-zinc-100">
                                {getCategoryLabel(cat)}
                              </span>
                              <div className="flex items-center gap-1">
                                {canExclude && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCategory(
                                        cat,
                                        isExcluded ? null : "excluded",
                                      )
                                    }
                                    className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                                      isExcluded
                                        ? "border-red-300/60 bg-red-500/30 text-red-100"
                                        : "border-white/20 bg-black/50 text-zinc-300"
                                    }`}
                                  >
                                    {getCategoryShort(cat)}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: 11 }, (_, i) => {
                                const n = i;
                                const isActive =
                                  !isExcluded &&
                                  typeof value === "number" &&
                                  value >= n;

                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    disabled={
                                      !gameIsReleased ||
                                      isNotInterested ||
                                      isExcluded
                                    }
                                    onClick={() => setCategory(cat, n)}
                                    className={`h-5 min-w-5 rounded-md border px-1 text-[10px] font-semibold transition
                                      ${
                                        isActive
                                          ? "scale-105 bg-white/80 text-black"
                                          : "border-white/15 bg-black/45 text-zinc-300"
                                      }
                                      ${
                                        !gameIsReleased ||
                                        isNotInterested ||
                                        isExcluded
                                          ? "cursor-not-allowed opacity-45"
                                          : "hover:border-white/30 cursor-pointer"
                                      }`}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!gameIsReleased && !isNotInterested && (
                      <button
                        type="button"
                        onClick={handleUnreleasedLockedClick}
                        className="absolute inset-0 z-10 rounded-2xl"
                        aria-label="Game is not released yet"
                      />
                    )}
                    {isNotInterested && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-white/10 bg-black/55 px-4 text-center">
                        <div className="flex max-w-xs flex-col items-center gap-2 text-zinc-100">
                          <FaBan className="text-base text-red-600" />
                          <p className="text-sm font-medium">
                            Rating disabled: marked as Not Interested because it
                            did not match what you need.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid min-h-[170px] grid-rows-[auto_1fr] rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md sm:min-h-0">
                    <label className="pb-2 text-xs uppercase tracking-[0.12em] text-zinc-200">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Quick notes..."
                      className="h-full min-h-[120px] resize-none rounded-xl border border-white/15 bg-black/45 p-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-white/40 sm:min-h-0"
                    />
                  </div>
                </section>

                <aside className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:min-h-0 md:grid-cols-1 md:grid-rows-[auto_auto_auto_auto]">
                  <div
                    className={`relative rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md sm:col-span-2 md:col-span-1 ${
                      !gameIsReleased ? "opacity-45" : ""
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-200 pb-0.5">
                          Overall
                        </p>
                        <p className="mt-1 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                          {weightedRating !== null
                            ? getClosestPreset(weightedRating)
                            : "Not rated"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 leading-none text-3xl font-bold text-white">
                          {weightedRating !== null ? (
                            weightedRating.toFixed(1)
                          ) : (
                            <span className="ml-1 text-zinc-400">---</span>
                          )}
                          {/* <FaStar className="text-amber-300" size={20} /> */}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          out of 10
                        </p>
                      </div>
                    </div>

                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-zinc-100 to-zinc-400 transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, (weightedRating ?? 0) * 10))}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-center gap-1 pt-2">
                      {Array.from({ length: 5 }, (_, i) => {
                        const starValue = (i + 1) * 2;
                        const icon =
                          (weightedRating ?? 0) >= starValue ? (
                            <FaStar />
                          ) : (weightedRating ?? 0) >= starValue - 1 ? (
                            <FaStarHalfAlt />
                          ) : (
                            <FaRegStar />
                          );

                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!gameIsReleased || isNotInterested}
                            className={`text-base text-amber-300 transition ${
                              !gameIsReleased || isNotInterested
                                ? "cursor-not-allowed opacity-45"
                                : "hover:scale-110"
                            }`}
                          >
                            {icon}
                          </button>
                        );
                      })}
                    </div>
                    {!gameIsReleased && !isNotInterested && (
                      <button
                        type="button"
                        onClick={handleUnreleasedLockedClick}
                        className="absolute inset-0 z-10 rounded-2xl"
                        aria-label="Game is not released yet"
                      />
                    )}
                    {isNotInterested && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-white/10 bg-black/55 px-4 text-center">
                        <div className="flex max-w-xs flex-col items-center gap-2 text-zinc-100">
                          <FaBan className="text-base text-red-600" />
                          <p className="text-sm font-medium">
                            Overall rating disabled: marked as Not Interested.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md ${
                      !gameIsReleased ? "opacity-45" : ""
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-center">
                      <label className="text-xs uppercase tracking-[0.12em] text-zinc-200">
                        Progress
                      </label>
                    </div>
                    <div className="mb-3 flex items-center justify-center">
                      <div className="relative h-24 w-24">
                        <svg
                          className="h-24 w-24 -rotate-90"
                          viewBox="0 0 100 100"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r={progressRadius}
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
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
                          <span className="text-sm font-bold text-white">
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={progress}
                      disabled={!gameIsReleased}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer accent-emerald-400"
                    />
                  </div>

                  <div
                    className={`rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md ${
                      !gameIsReleased ? "opacity-45" : ""
                    }`}
                  >
                    <label className="block text-center text-xs uppercase tracking-[0.12em] text-zinc-200">
                      Playtime
                    </label>
                    <div className="mt-2 flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={hours}
                          onChange={(e) =>
                            setHours(Math.max(0, Number(e.target.value)))
                          }
                          disabled={!gameIsReleased}
                          className="w-20 rounded-lg border border-white/20 bg-black/45 px-2 py-1.5 text-center text-sm text-white outline-none"
                        />
                        <span className="text-xs text-zinc-300">hrs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={minutes}
                          onChange={(e) =>
                            setMinutes(
                              Math.max(0, Math.min(59, Number(e.target.value))),
                            )
                          }
                          disabled={!gameIsReleased}
                          className="w-20 rounded-lg border border-white/20 bg-black/45 px-2 py-1.5 text-center text-sm text-white outline-none"
                        />
                        <span className="text-xs text-zinc-300">mins</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-black/35 p-2.5 backdrop-blur-md sm:col-span-2 md:col-span-1">
                    <p className="mb-2 text-center text-[11px] text-zinc-300">
                      {isNotInterested
                        ? "Marked as Not Interested. Click below to unmark."
                        : "Clears ratings and progress."}
                    </p>
                    <button
                      type="button"
                      onClick={handleNotInterested}
                      className={`w-full flex gap-2 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        isNotInterested
                          ? "border-cyan-300/45 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/26"
                          : "border-red-300/40 bg-red-500/22 text-red-100 hover:bg-red-500/28"
                      } ${!isNotInterested && hasAnyRatings ? "opacity-80" : ""}`}
                    >
                      <FaBan
                        className={`text-base ${
                          isNotInterested ? "text-cyan-300" : "text-red-600"
                        }`}
                      />
                      {isNotInterested
                        ? "Unmark Not Interested"
                        : "Mark Not Interested"}
                    </button>
                  </div>
                </aside>
              </div>

              <footer className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-300">
                  {!gameIsReleased
                    ? "Unreleased game: progress and ratings are disabled."
                    : isNotInterested
                      ? "Marked as Not Interested: ratings are disabled until you unmark."
                      : "All changes save instantly when you press Save."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-white/20 bg-black/45 px-3 py-1.5 text-sm text-white transition hover:bg-white/14"
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
                    className={`rounded-lg bg-linear-to-r px-4 py-1.5 text-sm font-bold shadow-sm transition hover:brightness-105 disabled:opacity-60 ${MODAL_THEME.button}`}
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
            </div>

            {/* LOADING OVERLAY */}
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
          </motion.div>

          <ConfirmModal
            open={confirmNotInterestedOpen}
            title="Are you sure?"
            message="Marking this game as not interested means this game did not click with you. Doing so will clear your ratings and progress for this game."
            confirmText="Yes, Clear"
            cancelText="Cancel"
            onCancel={() => setConfirmNotInterestedOpen(false)}
            onConfirm={() => {
              applyNotInterested();
              setConfirmNotInterestedOpen(false);
            }}
          />

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

