"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import MarqueeText from "./MarqueeText";

interface CategoryRatings {
  graphics: number;
  gameplay: number;
  story: number;
  ost: number;
  cinematics: number;
  voiceActing: number;
}

interface TrackedGame {
  id: number;
  name: string;
  slug: string;
  background_image?: string;
  screenshots?: string[];
  playtime?: number;
  rating?: number;
  status?: string | null;
  favorite?: boolean;
  progress?: number;
  lastUpdated?: any;
  notes?: string;
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
    categoryRatings: CategoryRatings
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
  { label: "Great", value: 8 },
  { label: "Good", value: 7 },
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

const tierFor = (score10: number) => {
  if (score10 >= 9) return "S";
  if (score10 >= 8) return "A";
  if (score10 >= 7) return "B";
  if (score10 >= 6) return "C";
  if (score10 >= 5) return "D";
  return "F";
};

const tierEmojiMap: Record<string, string> = {
  S: "💎",
  A: "🔥",
  B: "👍",
  C: "👌",
  D: "😬",
  F: "💀",
};

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

  if (!open) return null;

  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>(
    initialCategoryRatings ?? DEFAULT_CATEGORIES
  );
  const [progress, setProgress] = useState<number>(initialProgress ?? 0);
  const [hours, setHours] = useState<number>(Math.floor(initialPlaytime ?? 0));
  const [minutes, setMinutes] = useState<number>(
    Math.round(((initialPlaytime ?? 0) % 1) * 60)
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
    game?.id,
    initialNotes,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialStatus,
    initialFavorite,
    initialCategoryRatings,
  ]);

  const setCategory = (k: keyof CategoryRatings, v: number) =>
    setCategoryRatings((s) => ({ ...s, [k]: v }));

  const applyPreset = (val: number) =>
    setCategoryRatings({
      graphics: val,
      gameplay: val,
      story: val,
      ost: val,
      cinematics: val,
      voiceActing: val,
    });

  const weightedRating = useMemo(() => {
    const score =
      (categoryRatings.graphics || 0) * WEIGHTS.graphics +
      (categoryRatings.gameplay || 0) * WEIGHTS.gameplay +
      (categoryRatings.story || 0) * WEIGHTS.story +
      (categoryRatings.ost || 0) * WEIGHTS.ost +
      (categoryRatings.cinematics || 0) * WEIGHTS.cinematics +
      (categoryRatings.voiceActing || 0) * WEIGHTS.voiceActing;
    return Math.round(score * 10) / 10;
  }, [categoryRatings]);

  const tier = useMemo(() => tierFor(weightedRating), [weightedRating]);
  const tierEmoji = tierEmojiMap[tier] ?? "";

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    await onSave(
      notes,
      weightedRating,
      progress,
      totalPlaytime,
      status,
      favorite,
      categoryRatings
    );
  };

  const bgUrl = game?.background_image || "/placeholder-game.jpg";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 18, stiffness: 300 }}
            className="w-full max-w-3xl rounded-2xl shadow-2xl bg-linear-to-b from-zinc-900/90 to-zinc-900/95
             max-h-[95vh] overflow-auto"
            role="dialog"
            aria-modal="true"
          >
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
                  <option value="Not Interested">Not Interested</option>
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
            <div className="relative h-44 w-full">
              <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-900 animate-pulse" />
              <img
                src={bgUrl}
                alt={game?.name || "Game background"}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  imageLoaded && !imageError ? "opacity-100" : "opacity-0"
                }`}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 grid grid-cols-2 gap-3 p-4 items-end">
                <div className="bg-black/30 backdrop-blur-md rounded-xl p-3 w-full h-[100px] flex flex-col justify-center">
                  <h3>
                    <MarqueeText
                      text={String(game?.name) || "Unknown Game"}
                      className="text-xl font-bold text-white"
                      loopForever
                    />
                  </h3>
                  <div className="flex justify-center items-center gap-2 text-sm text-amber-400">
                    {game?.id}
                  </div>
                </div>
                <div className="bg-black/30 backdrop-blur-md rounded-xl p-3 w-full h-[100px] flex flex-col justify-center items-center">
                  <div className="flex gap-2 mb-1">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset.value)}
                        className={`px-2 py-1 text-xs rounded-full font-semibold transition ${
                          getClosestPreset(weightedRating) === preset.label
                            ? "bg-cyan-400 text-black"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <h3 className="text-center text-sm text-zinc-300 block">
                    {getClosestPreset(weightedRating)}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-amber-400 mt-1">
                    {weightedRating.toFixed(1)}/10 {tierEmoji} • {tier} Tier
                  </div>
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-2 gap-3 bg-zinc-800/60 p-3 rounded-xl">
                {Object.keys(categoryRatings).map((cat) => (
                  <div key={cat} className="flex flex-col gap-1">
                    <div className="flex justify-between pb-2 text-sm text-zinc-300 capitalize">
                      <span>{cat}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                        <button
                          key={n}
                          onClick={() =>
                            setCategory(cat as keyof CategoryRatings, n)
                          }
                          className={`w-6 h-6 flex items-center justify-center text-xs rounded border ${
                            categoryRatings[cat as keyof CategoryRatings] >= n
                              ? "bg-yellow-400 text-black border-yellow-500"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress & Playtime */}
              <div className="grid md:grid-cols-2 gap-3 bg-zinc-800/60 p-3 rounded-xl">
                <div className="text-center">
                  <label className="text-sm text-zinc-300 pb-2 block">
                    Game Progress
                  </label>
                  <div className="text-center">
                    <div
                      ref={progressRef}
                      onClick={(e) => {
                        if (!progressRef.current) return;
                        const rect =
                          progressRef.current.getBoundingClientRect();
                        const newP = Math.round(
                          ((e.clientX - rect.left) / rect.width) * 100
                        );
                        setProgress(Math.max(0, Math.min(100, newP)));
                      }}
                      className="w-full h-6 bg-zinc-700 rounded-lg mt-1 relative cursor-pointer"
                    >
                      <div
                        className="h-6 rounded-lg bg-emerald-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs font-semibold">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <label className="text-sm text-zinc-300 pb-2 block">
                    Playtime
                  </label>
                  <div className="flex items-center gap-2 mt-1">
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
                          Math.max(0, Math.min(59, Number(e.target.value)))
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
                      Saving
                    </div>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// "use client";

// import { useState, useEffect, useRef } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { FaStar, FaHeart, FaCrown, FaPause, FaPlay } from "react-icons/fa";
// import { IoBanOutline } from "react-icons/io5";
// import { GiMouthWatering } from "react-icons/gi";
// import { TbBucketDroplet } from "react-icons/tb";

// interface NotesModalProps {
//   open: boolean;
//   initialNotes: string;
//   initialRating: number;
//   initialProgress: number;
//   initialPlaytime: number;
//   initialStatus: string;
//   initialFavorite: boolean;
//   showFavorite: boolean;
//   showStatus: boolean;
//   onClose: () => void;
//   onSave: (
//     notes: string,
//     rating: number,
//     progress: number,
//     playtime: number,
//     status: string,
//     favorite: boolean
//   ) => Promise<void>;
//   saving: boolean;
// }

// export default function GameTrackingModal({
//   open,
//   initialNotes,
//   initialRating,
//   initialProgress,
//   initialPlaytime,
//   initialStatus,
//   initialFavorite,
//   showStatus,
//   showFavorite,
//   onClose,
//   onSave,
//   saving,
// }: NotesModalProps) {
//   const [notes, setNotes] = useState(initialNotes);
//   const [rating, setRating] = useState(initialRating);
//   const [progress, setProgress] = useState(initialProgress);
//   const [statusOpen, setStatusOpen] = useState(false);
//   const [status, setStatus] = useState(initialStatus);
//   const [favorite, setFavorite] = useState(initialFavorite);

//   const [hours, setHours] = useState(Math.floor(initialPlaytime));
//   const [minutes, setMinutes] = useState(
//     Math.round((initialPlaytime % 1) * 60)
//   );

//   const progressRef = useRef<HTMLDivElement>(null);
//   const [dragging, setDragging] = useState(false);

//   useEffect(() => {
//     if (!open) return;
//     setNotes(initialNotes);
//     setRating(initialRating ?? 0);
//     setProgress(initialProgress ?? 0);
//     setStatusOpen(false);
//     setStatus(initialStatus);
//     setFavorite(initialFavorite);
//     setHours(Math.floor(initialPlaytime));
//     setMinutes(Math.round((initialPlaytime % 1) * 60));
//   }, [
//     open,
//     initialNotes,
//     initialRating,
//     initialProgress,
//     initialPlaytime,
//     initialStatus,
//     initialFavorite,
//     initialStatus,
//   ]);

//   useEffect(() => {
//     const handleMouseMove = (e: MouseEvent) => {
//       if (!dragging || !progressRef.current) return;
//       const rect = progressRef.current.getBoundingClientRect();
//       const newProgress = Math.round(
//         ((e.clientX - rect.left) / rect.width) * 100
//       );
//       setProgress(Math.max(0, Math.min(100, newProgress)));
//     };
//     const handleMouseUp = () => setDragging(false);

//     window.addEventListener("mousemove", handleMouseMove);
//     window.addEventListener("mouseup", handleMouseUp);
//     return () => {
//       window.removeEventListener("mousemove", handleMouseMove);
//       window.removeEventListener("mouseup", handleMouseUp);
//     };
//   }, [dragging]);

//   const handleClickProgress = (e: React.MouseEvent<HTMLDivElement>) => {
//     if (!progressRef.current) return;
//     const rect = progressRef.current.getBoundingClientRect();
//     const newProgress = Math.round(
//       ((e.clientX - rect.left) / rect.width) * 100
//     );
//     setProgress(Math.max(0, Math.min(100, newProgress)));
//   };

//   const totalPlaytime = hours + minutes / 60;

//   useEffect(() => {
//     if (!open) return; // only apply when modal is open

//     if (status === "Completed") {
//       setProgress(100);
//     }
//   }, [status, open]);

//   return (
//     <AnimatePresence>
//       {open && (
//         <motion.div
//           className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           exit={{ opacity: 0 }}
//         >
//           <motion.div
//             className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-white/20 grid gap-6"
//             initial={{ scale: 0.95, opacity: 0 }}
//             animate={{ scale: 1, opacity: 1 }}
//             exit={{ scale: 0.95, opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           >
//             <div className="w-full text-center">
//               <h3>Quick Tracker Edit</h3>
//             </div>
//             {/* Top Section: Status & Favorite */}
//             <div className="flex items-center justify-between gap-4">
//               {showStatus && (
//                 <div className="relative">
//                   {/* Trigger button */}
//                   <button
//                     type="button"
//                     onClick={() => setStatusOpen((prev) => !prev)}
//                     className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700"
//                   >
//                     {/* Current status icon */}
//                     {status === "Playing" && <FaPlay />}
//                     {status === "On Hold" && <FaPause />}
//                     {status === "Dropped" && <TbBucketDroplet size={15} />}
//                     {status === "Completed" && <FaCrown size={20} />}
//                     {status === "Not Interested" && <IoBanOutline size={20} />}
//                     {status === "Want to Play" && <GiMouthWatering size={20} />}
//                     <span className="text-white">{status}</span>
//                   </button>

//                   {/* Dropdown options */}
//                   {/* Dropdown options */}
//                   {statusOpen && (
//                     <div className="absolute mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "Playing" ? "border-2 border-cyan-400" : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("Playing");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <FaPlay /> Playing
//                       </button>

//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "On Hold" ? "border-2 border-cyan-400" : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("On Hold");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <FaPause /> On Hold
//                       </button>

//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "Dropped" ? "border-2 border-cyan-400" : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("Dropped");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <TbBucketDroplet size={15} /> Dropped
//                       </button>

//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "Completed"
//                             ? "border-2 border-cyan-400"
//                             : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("Completed");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <FaCrown size={20} /> Completed
//                       </button>

//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "Not Interested"
//                             ? "border-2 border-cyan-400"
//                             : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("Not Interested");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <IoBanOutline size={20} /> Not Interested
//                       </button>

//                       <button
//                         className={`flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-700 rounded-lg transition ${
//                           status === "Want to Play"
//                             ? "border-2 border-cyan-400"
//                             : ""
//                         }`}
//                         onClick={() => {
//                           setStatus("Want to Play");
//                           setStatusOpen(false);
//                         }}
//                       >
//                         <GiMouthWatering size={20} /> Want to Play
//                       </button>
//                     </div>
//                   )}
//                 </div>
//               )}

//               {showFavorite && (
//                 <FaHeart
//                   size={28}
//                   className={`cursor-pointer transition ${
//                     favorite ? "text-red-500" : "text-gray-600"
//                   }`}
//                   onClick={() => setFavorite(!favorite)}
//                 />
//               )}
//             </div>

//             {/* Middle Section: Notes & Rating */}
//             <div className="bg-gray-800 rounded-2xl p-4 grid gap-4">
//               <textarea
//                 value={notes}
//                 onChange={(e) => setNotes(e.target.value)}
//                 rows={4}
//                 placeholder="Write your notes..."
//                 className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white resize-none"
//               />

//               <div className="flex items-center gap-2">
//                 <span className="text-sm text-white/80">Rating:</span>
//                 {[1, 2, 3, 4, 5].map((i) => (
//                   <FaStar
//                     key={i}
//                     size={22}
//                     className={`cursor-pointer ${
//                       i <= rating ? "text-yellow-400" : "text-gray-500"
//                     }`}
//                     onClick={() => setRating(i)}
//                   />
//                 ))}
//               </div>
//             </div>

//             {/* Bottom Section: Progress & Playtime */}
//             <div className="bg-gray-800 rounded-2xl p-4 grid gap-4">
//               <div>
//                 <span className="text-sm text-white/80 mb-1 block">
//                   Progress: {progress}%
//                 </span>
//                 <div
//                   ref={progressRef}
//                   className="w-full h-4 bg-gray-700 rounded-lg relative cursor-pointer"
//                   onMouseDown={() => setDragging(true)}
//                   onClick={handleClickProgress}
//                 >
//                   <div
//                     className="h-4 bg-purple-500 rounded-lg transition-all"
//                     style={{ width: `${progress}%` }}
//                   />
//                 </div>
//               </div>

//               <div className="flex items-center gap-2">
//                 <label className="text-sm text-white/80">Playtime:</label>
//                 <input
//                   type="number"
//                   min={0}
//                   value={hours}
//                   onChange={(e) =>
//                     setHours(Math.max(0, Number(e.target.value)))
//                   }
//                   className="w-16 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
//                 />
//                 <span className="text-white/70">hrs</span>
//                 <input
//                   type="number"
//                   min={0}
//                   max={59}
//                   value={minutes}
//                   onChange={(e) =>
//                     setMinutes(
//                       Math.max(0, Math.min(59, Number(e.target.value)))
//                     )
//                   }
//                   className="w-16 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
//                 />
//                 <span className="text-white/70">mins</span>
//               </div>
//             </div>

//             {/* Buttons */}
//             <div className="flex justify-end gap-4">
//               <button
//                 onClick={onClose}
//                 className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
//                 disabled={saving}
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={async () => {
//                   await onSave(
//                     notes,
//                     rating,
//                     progress,
//                     totalPlaytime,
//                     status,
//                     favorite
//                   );
//                   onClose();
//                 }}
//                 className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition font-semibold"
//                 disabled={saving}
//               >
//                 {saving ? (
//                   <div className="flex justify-center items-center gap-2 w-full">
//                     <span className="loading loading-spinner loading-xs" />
//                     Saving
//                   </div>
//                 ) : (
//                   "Save"
//                 )}
//               </button>
//             </div>
//           </motion.div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// }
