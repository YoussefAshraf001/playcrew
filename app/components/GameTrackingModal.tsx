"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHeart,
  FaRegHeart,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";

type StoredRating = number | "excluded";

interface CategoryRatings {
  graphics: StoredRating;
  gameplay: StoredRating;
  story: StoredRating;
  ost: StoredRating;
  cinematics: StoredRating;
  voiceActing: StoredRating;
}

interface TrackedGame {
  _docId: string;

  name: string;

  // User data
  playtime?: number;
  my_rating?: number;
  status?: string;
  progress?: number;
  notes?: string;
  categoryRatings?: CategoryRatings;
  favorite?: boolean;
  favoriteAllTime?: boolean;
  lastUpdated?: any;

  // IGDB data
  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    genres?: string[];
    releaseDate?: Date;
  };
}

interface GameTrackingModalProps {
  open: boolean;
  game: TrackedGame | null;
  initialNotes: string;
  initialRating: number;
  initialProgress: number;
  initialPlaytime: number;
  initialStatus: string;
  initialFavorite: boolean;
  initialCategoryRatings?: CategoryRatings;
  showStatus: boolean;
  showFavorite: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
  ) => Promise<void> | void;
}

const DEFAULT_CATEGORIES: CategoryRatings = {
  graphics: 0,
  gameplay: 0,
  story: 0,
  ost: 0,
  cinematics: 0,
  voiceActing: 0,
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
  } = props;

  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>(
    initialCategoryRatings ?? DEFAULT_CATEGORIES,
  );
  const [progress, setProgress] = useState<number>(initialProgress ?? 0);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const [hours, setHours] = useState<number>(Math.floor(initialPlaytime ?? 0));
  const [minutes, setMinutes] = useState<number>(
    Math.round(((initialPlaytime ?? 0) % 1) * 60),
  );

  const [status, setStatus] = useState<string>(initialStatus ?? "Playing");
  const [favorite, setFavorite] = useState<boolean>(initialFavorite ?? false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setProgress(initialProgress ?? 0);
    setHours(Math.floor(initialPlaytime ?? 0));
    setMinutes(Math.round(((initialPlaytime ?? 0) % 1) * 60));
    setStatus(initialStatus ?? "Playing");
    setFavorite(initialFavorite ?? false);

    if (initialCategoryRatings) {
      setCategoryRatings(initialCategoryRatings);
    } else if (
      typeof initialRating === "number" &&
      !Number.isNaN(initialRating)
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

    setImageLoaded(false);
    setImageError(false);
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

  const setCategory = (k: keyof CategoryRatings, v: number | "excluded") =>
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
      if (typeof score === "number") {
        weightedSum += score * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0;
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }, [categoryRatings]);

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    await onSave(
      notes,
      weightedRating,
      progress,
      totalPlaytime,
      status,
      favorite,
      categoryRatings,
    );
  };

  const bgUrl = game?.igdb.cover || "/placeholder-game.jpg";

  const normalizeDate = (value?: any) => {
    if (!value) return null;

    // Firestore Timestamp (object form)
    if (typeof value === "object" && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }

    // Firestore Timestamp (toDate method)
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    // IGDB unix timestamp
    if (typeof value === "number") {
      return new Date(value * 1000);
    }

    // ISO string fallback
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const releaseDate = normalizeDate(game?.igdb.releaseDate);
  const gameIsReleased = !!releaseDate && releaseDate <= new Date();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={bgUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="relative w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/50 to-black/90 backdrop-blur-md" />

            {/* CONTENT */}
            <div className="relative z-10">
              {/* TOP ROW */}
              <div className="flex justify-between items-center p-4 gap-3 bg-zinc-800/60">
                {showStatus && (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="p-2 bg-zinc-900 rounded-md border border-zinc-700 text-white text-sm cursor-pointer"
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
                  <button
                    onClick={() => setFavorite((f) => !f)}
                    className={`px-3 py-2 rounded-full font-semibold text-sm bg-red-600 hover:bg-red-500 hover:scale-105 transition-all ease-in-out duration-300 cursor-pointer`}
                  >
                    <motion.span
                      animate={{ scale: favorite ? 1.2 : 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {favorite ? (
                        <div className="flex items-center justify-center gap-2">
                          <FaHeart />
                          Favorite
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <FaRegHeart />
                          Add to Favorites
                        </div>
                      )}
                    </motion.span>
                  </button>
                )}
              </div>

              {/* HERO IMAGE */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={bgUrl}
                  className="relative h-44 w-full overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                  {/* Content */}
                  <div
                    className={`${
                      gameIsReleased
                        ? "grid-cols-2 items-end"
                        : "grid-cols-1 place-items-center"
                    } absolute inset-0 grid gap-3 p-4`}
                  >
                    <div
                      className={`${
                        gameIsReleased
                          ? "w-full h-[100px]"
                          : "w-[50%] h-[100px] text-center"
                      } bg-black/30 backdrop-blur-md rounded-xl p-3 flex flex-col justify-center`}
                    >
                      <h3 className="text-xl font-bold text-white transition max-w-[340px] line-clamp-2 mx-auto">
                        {game?.name}
                      </h3>
                      <div className="flex justify-center items-center gap-2 text-sm text-amber-400">
                        {releaseDate
                          ? releaseDate.toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "Release date unknown"}
                      </div>
                    </div>
                    {gameIsReleased && (
                      <div className="bg-black/30 backdrop-blur-md rounded-xl p-3 w-full h-[100px] flex flex-col justify-center items-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {Array.from({ length: 5 }, (_, i) => {
                            const starValue = (i + 1) * 2; // 0-10 scale
                            let starIcon;

                            if (weightedRating >= starValue) {
                              starIcon = <FaStar />; // full star
                            } else if (weightedRating >= starValue - 1) {
                              starIcon = <FaStarHalfAlt />; // half star
                            } else {
                              starIcon = <FaRegStar />; // empty
                            }

                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() =>
                                  setCategoryRatings({
                                    graphics: starValue,
                                    gameplay: starValue,
                                    story: starValue,
                                    ost: starValue,
                                    cinematics: starValue,
                                    voiceActing: starValue,
                                  })
                                }
                                className="text-yellow-400 text-lg transition hover:scale-110"
                              >
                                {starIcon}
                              </button>
                            );
                          })}
                        </div>

                        <h3 className="text-center text-sm text-zinc-300 block">
                          {getClosestPreset(weightedRating)}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-amber-400 mt-1">
                          {weightedRating.toFixed(1)}/10
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* CONTENT */}
              <div className="p-4 grid gap-4 relative">
                {/* Rating grid */}
                <div
                  className={`grid grid-cols-2 gap-3 bg-zinc-800/60 p-3 rounded-xl ${
                    !gameIsReleased ? "opacity-50" : ""
                  }`}
                >
                  {categoryOrder.map((cat) => (
                    <div key={cat} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center pb-2 text-sm text-zinc-300 capitalize">
                        <span>{cat}</span>

                        {cat === "voiceActing" && (
                          <button
                            type="button"
                            onClick={() =>
                              setCategory(
                                "voiceActing",
                                categoryRatings.voiceActing === "excluded"
                                  ? 0
                                  : "excluded",
                              )
                            }
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                              categoryRatings.voiceActing === "excluded"
                                ? "bg-red-500/80 border-red-500 text-white"
                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                            }`}
                            title="Exclude voice acting from rating"
                          >
                            {categoryRatings.voiceActing === "excluded"
                              ? "Excluded"
                              : "No VA"}
                          </button>
                        )}

                        {cat === "cinematics" && (
                          <button
                            type="button"
                            onClick={() =>
                              setCategory(
                                "cinematics",
                                categoryRatings.cinematics === "excluded"
                                  ? 0
                                  : "excluded",
                              )
                            }
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                              categoryRatings.cinematics === "excluded"
                                ? "bg-red-500/80 border-red-500 text-white"
                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                            }`}
                            title="Exclude cinematics from rating"
                          >
                            {categoryRatings.cinematics === "excluded"
                              ? "Excluded"
                              : "No Cinematics"}
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1 flex-wrap">
                        {Array.from({ length: 11 }, (_, n) => n).map((n) => {
                          const value =
                            categoryRatings[cat as keyof CategoryRatings];

                          const isExcluded = value === "excluded";
                          const isActive =
                            !isExcluded && (value as number) >= n;

                          return (
                            <button
                              key={n}
                              onClick={() => {
                                if (!gameIsReleased) {
                                  toast.error("Game isn't released yet!");
                                  return;
                                }
                                if (!isExcluded)
                                  setCategory(cat as keyof CategoryRatings, n);
                              }}
                              className={`w-6 h-6 flex items-center justify-center text-xs rounded border
                        ${isActive ? "bg-yellow-400 text-black border-yellow-500" : ""}
                        ${
                          !isActive && !isExcluded
                            ? "bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                            : ""
                        }
                        ${
                          isExcluded
                            ? "bg-zinc-900 text-zinc-400 border-zinc-700 opacity-40 cursor-not-allowed"
                            : ""
                        } ease-in-out transition-all duration-300`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress & Playtime */}
                <div
                  className={`grid md:grid-cols-2 gap-3 bg-zinc-800/60 p-3 rounded-xl ${
                    !gameIsReleased ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="text-center">
                    <label className="text-sm text-zinc-300 pb-2 block">
                      Game Progress
                    </label>
                    <div
                      ref={progressRef}
                      className={`relative w-full h-6 mt-1 rounded-lg bg-zinc-700 overflow-hidden transition-colors ${
                        !gameIsReleased
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:bg-zinc-600"
                      }`}
                      onMouseDown={(e) => {
                        if (!gameIsReleased || !progressRef.current) return;

                        e.preventDefault(); // prevent text selection

                        const rect =
                          progressRef.current.getBoundingClientRect();

                        const updateProgress = (clientX: number) => {
                          const newProgress = Math.round(
                            ((clientX - rect.left) / rect.width) * 100,
                          );
                          setProgress(Math.max(0, Math.min(100, newProgress)));
                        };

                        // Update once immediately
                        updateProgress(e.clientX);

                        const moveHandler = (ev: MouseEvent) =>
                          updateProgress(ev.clientX);
                        const upHandler = () => {
                          document.removeEventListener(
                            "mousemove",
                            moveHandler,
                          );
                          document.removeEventListener("mouseup", upHandler);
                        };

                        document.addEventListener("mousemove", moveHandler);
                        document.addEventListener("mouseup", upHandler);
                      }}
                      onTouchStart={(e) => {
                        if (!gameIsReleased || !progressRef.current) return;
                        e.preventDefault();
                        const rect =
                          progressRef.current.getBoundingClientRect();

                        const updateProgress = (clientX: number) => {
                          const newProgress = Math.round(
                            ((clientX - rect.left) / rect.width) * 100,
                          );
                          setProgress(Math.max(0, Math.min(100, newProgress)));
                        };

                        // Update immediately
                        updateProgress(e.touches[0].clientX);

                        const moveHandler = (ev: TouchEvent) => {
                          updateProgress(ev.touches[0].clientX);
                        };
                        const endHandler = () => {
                          document.removeEventListener(
                            "touchmove",
                            moveHandler,
                          );
                          document.removeEventListener("touchend", endHandler);
                        };

                        document.addEventListener("touchmove", moveHandler, {
                          passive: false,
                        });
                        document.addEventListener("touchend", endHandler, {
                          passive: false,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (!gameIsReleased || !progressRef.current) return;
                        const rect =
                          progressRef.current.getBoundingClientRect();
                        const hoverP = Math.round(
                          ((e.clientX - rect.left) / rect.width) * 100,
                        );
                        setHoverProgress(Math.max(0, Math.min(100, hoverP)));
                      }}
                      onMouseLeave={() => setHoverProgress(null)}
                    >
                      {/* Filled progress */}
                      <div
                        className="absolute top-0 left-0 h-full bg-emerald-400 rounded-lg transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />

                      {/* Hover preview */}
                      {hoverProgress !== null && (
                        <div
                          className="absolute top-0 left-0 h-full bg-white/20 rounded-lg pointer-events-none"
                          style={{ width: `${hoverProgress}%` }}
                        />
                      )}

                      {/* Percentage label */}
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs font-semibold">
                        {hoverProgress !== null ? hoverProgress : progress}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center relative">
                    <label className="text-sm text-zinc-300 pb-2 block">
                      Playtime
                    </label>
                    <div
                      className={`flex items-center gap-2 mt-1 ${
                        !gameIsReleased ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <input
                        type="number"
                        min={0}
                        value={hours}
                        onChange={(e) =>
                          setHours(Math.max(0, Number(e.target.value)))
                        }
                        className="w-21 py-1 px-3 bg-zinc-900 rounded-md border border-zinc-700 text-white text-sm"
                      />
                      <span className="text-zinc-400 text-sm">hrs</span>
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
                        className="w-21 py-1 px-3 bg-zinc-900 rounded-md border border-zinc-700 text-white text-sm"
                      />
                      <span className="text-zinc-400 text-sm">mins</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-zinc-800/60 p-3 rounded-xl">
                  <label className="text-sm text-zinc-300">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Quick notes..."
                    className="w-full h-[200px] mt-1 p-2 bg-zinc-900 rounded-md border border-zinc-700 text-white text-sm resize-none"
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="px-3 py-1 rounded-md bg-zinc-900 text-white border border-zinc-700 text-sm"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await handleSave();
                      onClose();
                    }}
                    disabled={saving}
                    className="px-4 py-1 rounded-md bg-emerald-400 text-black font-bold text-sm shadow-sm hover:brightness-95 disabled:opacity-60"
                  >
                    {saving ? (
                      <div className="flex justify-center items-center gap-2 w-full">
                        <span className="loading loading-spinner loading-xs" />
                      </div>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
