"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, ChangeEvent, DragEvent } from "react";
import toast from "react-hot-toast";
import { MdBookmarkRemove } from "react-icons/md";
import {
  FaBan,
  FaHeart,
  FaRegHeart,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
  FaTrash,
} from "react-icons/fa";

import ConfirmModal from "./ConfirmModal";
import {
  CategoryRatings,
  PlaySession,
  SaveUpload,
  TrackedGame,
} from "../types/trackedGame";
import {
  appendPlaySession,
  formatSessionDuration,
  normalizePlaySessions,
  normalizeSessionDate,
} from "../lib/playSessions";
import { auth, db } from "../lib/firebase";
import { TiFolderDelete } from "react-icons/ti";
import { BsSave } from "react-icons/bs";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface GameTrackingModalProps {
  open: boolean;
  game: TrackedGame | null;
  initialNotes: string;
  initialRating: number | null;
  initialProgress: number;
  initialPlaytime: number;
  initialPlayedSessions?: PlaySession[];
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
    playedSessions: PlaySession[],
    save?: SaveUpload | null,
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
    cinematics: "No Cinematics",
    voiceActing: "No VC",
  };
  return labels[cat] ?? "";
};

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

const isZipFile = (file: File) => file.name.toLowerCase().endsWith(".zip");

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
    initialPlayedSessions,
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

  const [notes, setNotes] = useState(initialNotes ?? "");
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>(
    initialCategoryRatings ?? DEFAULT_CATEGORIES,
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
  const [isSaveDropActive, setIsSaveDropActive] = useState(false);
  const [saveUploads, setSaveUploads] = useState<SaveUpload[]>([]);
  const [selectedSaveFile, setSelectedSaveFile] = useState<File | null>(null);
  const [checkingSave, setCheckingSave] = useState(false);
  const [existingSave, setExistingSave] = useState<SaveUpload | null>(null);
  const [uploadingSave, setUploadingSave] = useState(false);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<
    number | null
  >(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setProgress(initialProgress ?? 0);
    setHours(Math.floor(initialPlaytime ?? 0));
    setMinutes(Math.round(((initialPlaytime ?? 0) % 1) * 60));
    setStatus(initialStatus ?? "Playing");
    setFavorite(initialFavorite ?? false);
    setNotInterested(game?.notInterested === true);
    setPlayedSessions(normalizePlaySessions(initialPlayedSessions));
    setIsSaveDropActive(false);

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
    initialNotes,
    initialRating,
    initialProgress,
    initialPlaytime,
    JSON.stringify(initialPlayedSessions),
    initialStatus,
    initialFavorite,
    initialCategoryRatings,
  ]);

  useEffect(() => {
    if (!game) return;

    const user = auth.currentUser;
    if (!user) return;

    let isMounted = true;

    const checkSave = async () => {
      const user = auth.currentUser;
      if (!user || !game) return;

      setCheckingSave(true);

      try {
        const ref = doc(
          db,
          "users",
          user.uid,
          "games_igdb",
          game.igdb.id.toString(),
        );

        const snap = await getDoc(ref);

        if (snap.exists()) {
          setExistingSave(snap.data().save ?? null);
        } else {
          setExistingSave(null);
        }
      } catch (err) {
        console.error("Save check error:", err);
      } finally {
        setCheckingSave(false);
      }
    };

    // reset previous state when switching games
    setExistingSave(null);
    setSaveUploads([]);
    setSelectedSaveFile(null);

    checkSave();

    return () => {
      isMounted = false;
    };
  }, [game]);

  const setCategory = (
    k: keyof CategoryRatings,
    v: number | "excluded" | null,
  ) => setCategoryRatings((s) => ({ ...s, [k]: v }));

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

  const sessionHistory = useMemo(() => {
    return normalizePlaySessions(playedSessions);
  }, [playedSessions]);

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    const nextPlayedSessions =
      totalPlaytime > initialPlaytime
        ? appendPlaySession(playedSessions, initialPlaytime, totalPlaytime)
        : playedSessions;

    await onSave(
      notes,
      hasAnyRatings ? weightedRating : null,
      progress,
      totalPlaytime,
      status,
      favorite,
      categoryRatings,
      notInterested,
      nextPlayedSessions,
    );
  };

  const uploadSaveFile = async (file: File) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("gameId", game!.igdb.id.toString());
    formData.append("userId", user.uid);

    const res = await fetch("/api/save-upload", {
      method: "POST",
      body: formData,
    });

    let data;
    try {
      data = await res.json();
    } catch (err: any) {
      console.error("🔥 REAL SAVE UPLOAD ERROR:", err);
      throw new Error("Invalid server response");
    }
    if (!res.ok) {
      console.error("UPLOAD API ERROR:", data);
      throw new Error(data?.error || "Upload failed");
    }

    return data;
  };

  const saveUploadOnly = async (upload: SaveUpload) => {
    const user = auth.currentUser;
    if (!user || !game) return;

    const ref = doc(
      db,
      "users",
      user.uid,
      "games_igdb",
      game.igdb.id.toString(),
    );

    await setDoc(
      ref,
      {
        save: upload,
        lastUpdated: new Date(),
      },
      { merge: true },
    );
  };

  const handleUploadSelectedFile = async (file: File) => {
    if (!isZipFile(file)) {
      toast.error("Only .zip save files are allowed.");
      return;
    }

    try {
      setUploadingSave(true);
      setSelectedSaveFile(file);
      const result = await uploadSaveFile(file);
      const upload: SaveUpload = {
        id: crypto.randomUUID(),
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        uploadedAt: new Date(),
        storageKey: result.storageKey,
      };

      await saveUploadOnly(upload);

      setSaveUploads([upload]);
      setExistingSave(null);
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploadingSave(false);
    }
  };

  const handleSaveFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUploadSelectedFile(file);
  };

  const handleSaveFileDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSaveDropActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleUploadSelectedFile(file);
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
    setCategoryRatings({ ...DEFAULT_CATEGORIES });
  };

  const clearNotInterested = () => setNotInterested(false);

  const isNotInterested = notInterested;

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

  const bgUrl = game?.igdb.cover || "/placeholder-game.jpg";
  const releaseDate = normalizeDate(game?.igdb.releaseDate);
  const gameIsReleased = !!releaseDate && releaseDate <= new Date();

  const blockIfUnreleased = () => {
    if (!gameIsReleased) {
      toast.error("Game isn't released yet.");
      return true;
    }
    return false;
  };

  const progressRadius = 40;
  const progressStroke = 8;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset =
    progressCircumference - (progress / 100) * progressCircumference;

  const hasSave =
    !checkingSave &&
    ((saveUploads.length > 0 && saveUploads[0]?.storageKey) ||
      existingSave?.storageKey);

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

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

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

            <div className="relative z-10 grid h-full grid-rows-[auto_auto] gap-3 overflow-y-auto p-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-y sm:min-h-0 sm:grid-rows-[auto_1fr] sm:overflow-hidden sm:gap-4 sm:p-4">
              <header className="grid gap-3 rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5 backdrop-blur-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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

                <div className="flex max-w-[420px] flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                  {showStatus && (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="h-8 min-w-[118px] rounded-lg border border-white/20 bg-black/45 px-2.5 text-xs text-white"
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
                      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium whitespace-nowrap transition ${
                        favorite
                          ? "border-red-300/60 bg-red-500/25 text-red-100"
                          : "border-white/20 bg-black/40 text-white hover:bg-white/10"
                      }`}
                    >
                      {favorite ? <FaHeart /> : <FaRegHeart />}
                      <span>{favorite ? "Favorited" : "Favorite"}</span>
                    </motion.button>
                  )}

                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveOpen(true)}
                      className="relative rounded-md border border-red-300/35 bg-red-500/12 px-2.5 py-1.5 text-[11px] font-medium text-red-100 transition hover:bg-red-500/22 disabled:opacity-60 whitespace-nowrap"
                      disabled={saving || removing}
                    >
                      <span
                        className={`flex items-center justify-center gap-2 ${removing ? "opacity-0" : ""}`}
                      >
                        <MdBookmarkRemove /> Remove Entry
                      </span>
                    </button>
                  )}
                </div>
              </header>

              <div className="grid gap-3 sm:min-h-0 md:grid-cols-[1.2fr_0.8fr]">
                <section className="grid gap-3 sm:min-h-0 sm:grid-rows-[auto_1fr]">
                  <div
                    className={`relative rounded-2xl border border-white/15 bg-black/35 p-2.5 backdrop-blur-md ${!gameIsReleased ? "opacity-45" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-200">
                        Rating System
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!hasAnyRatings}
                          onClick={() => {
                            if (blockIfUnreleased()) return;
                            setCategoryRatings(DEFAULT_CATEGORIES);
                          }}
                          className={`rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition ${
                            hasAnyRatings
                              ? "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/12 hover:text-white"
                              : "border-white/10 bg-white/3 text-zinc-600 cursor-default"
                          }`}
                        >
                          Clear Rating
                        </button>
                        <button
                          type="button"
                          onClick={handleNotInterested}
                          className={`inline-flex px-2.5 py-0.5 items-center justify-center gap-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap transition ${
                            isNotInterested
                              ? "border-cyan-300/45 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/26"
                              : "border-red-300/35 bg-red-500/12 text-red-100 hover:bg-red-500/22"
                          }`}
                        >
                          <FaBan
                            className={`text-sm ${isNotInterested ? "text-cyan-300" : "text-red-500"}`}
                          />
                          <span>
                            {isNotInterested ? "Interested" : "Not Interested"}
                          </span>
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
                                    className={`h-5 min-w-5 rounded-md border px-1 text-[10px] font-semibold transition ${
                                      isActive
                                        ? "scale-105 bg-white/80 text-black"
                                        : "border-white/15 bg-black/45 text-zinc-300"
                                    } ${
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

                <aside className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:min-h-0 md:grid-cols-1 md:grid-rows-[auto_auto_auto_auto] md:content-start">
                  <div
                    className={`relative rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-md sm:col-span-2 md:col-span-1 ${!gameIsReleased ? "opacity-45" : ""}`}
                  >
                    <div className="mb-1.5 flex flex-col items-center text-center">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-200">
                        Overall
                      </p>
                      <motion.div
                        key={
                          weightedRating === null
                            ? "empty"
                            : formatRating(weightedRating)
                        }
                        className="mt-1.5 flex items-end justify-center gap-1.5 leading-none"
                      >
                        {weightedRating !== null ? (
                          <span className="text-3xl font-bold tracking-tight text-white">
                            {formatRating(weightedRating)}
                          </span>
                        ) : (
                          <span className="text-3xl font-bold text-zinc-400">
                            ---
                          </span>
                        )}
                        <span className="pb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          /10
                        </span>
                      </motion.div>
                      <p className="mt-1.5 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                        {weightedRating !== null
                          ? getClosestPreset(weightedRating)
                          : "Not rated"}
                      </p>
                    </div>
                    <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-zinc-100 to-zinc-400 transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, (weightedRating ?? 0) * 10))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1 pt-1.5">
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
                            className="text-sm text-amber-300 transition"
                          >
                            {icon}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-md ${!gameIsReleased ? "opacity-45" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                          {getProgressText(progress)}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-white">
                          {hours}h {minutes}m
                        </p>
                        <button
                          type="button"
                          onClick={() => setSessionsOpen(true)}
                          className="mt-1 text-xs text-emerald-300 hover:underline"
                        >
                          View Sessions{" "}
                          {sessionHistory.length
                            ? `(${sessionHistory.length})`
                            : ""}
                        </button>
                      </div>

                      <div className="relative h-14 w-14 shrink-0">
                        <svg
                          className="h-14 w-14 -rotate-90"
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
                          <span className="text-sm font-semibold text-white">
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={progress}
                        disabled={!gameIsReleased}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        className="h-2 w-full cursor-pointer accent-emerald-400"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="rounded-xl border border-white/12 bg-white/3 px-3 py-2">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-zinc-500">
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
                          className="w-full bg-transparent text-lg font-semibold text-white outline-none"
                        />
                      </label>
                      <label className="rounded-xl border border-white/12 bg-white/3 px-3 py-2">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          Minutes
                        </span>
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
                          className="w-full bg-transparent text-lg font-semibold text-white outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="relative rounded-2xl border border-white/15 bg-black/35 h-[163px] p-2 backdrop-blur-md">
                    {uploadingSave && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2 text-white">
                          <span className="loading loading-dots loading-md" />
                          <p className="text-xs text-zinc-300">
                            Uploading save...
                          </p>
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {checkingSave && (
                        <motion.div
                          key="checking-save"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm"
                        >
                          <div className="flex flex-col items-center gap-2 text-white">
                            <span className="loading loading-dots loading-md" />
                            <p className="text-xs text-zinc-300">
                              Checking save...
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div layout className="relative flex flex-col">
                      {/* 🧠 HEADER */}
                      <motion.p
                        layout
                        className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 text-center pt-1"
                      >
                        Save Slot
                      </motion.p>

                      {/* 🎮 SLOT */}
                      <AnimatePresence mode="wait">
                        {hasSave ? (
                          <motion.div
                            key="filled"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-3 flex items-center gap-4 rounded-xl border border-amber-400/40 bg-black/50 px-4 py-6 min-h-20"
                          >
                            {/* 🎮 Cover */}
                            <img
                              src={game.igdb.cover}
                              alt={game.name}
                              className="h-14 w-20 rounded-md object-cover border border-white/20"
                            />

                            {/* 📄 Info */}
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <motion.div
                                initial="initial"
                                animate="animate"
                                className="flex flex-col"
                              >
                                <motion.p
                                  variants={{
                                    initial: { y: 6 },
                                    animate: { y: 0 },
                                  }}
                                  transition={{
                                    duration: 0.25,
                                    ease: "easeOut",
                                  }}
                                  className="truncate max-w-[230px] text-base font-semibold text-white"
                                >
                                  {game?.name ?? "Slot 01"}
                                </motion.p>

                                <motion.p
                                  variants={{
                                    initial: { opacity: 0, y: 4 },
                                    animate: { opacity: 1, y: 0 },
                                  }}
                                  transition={{ delay: 0.15, duration: 0.25 }}
                                  className="text-[11px] text-amber-300 tracking-wide"
                                >
                                  {(() => {
                                    const raw =
                                      existingSave?.uploadedAt ||
                                      saveUploads[0]?.uploadedAt ||
                                      game?.save?.uploadedAt;

                                    if (!raw) return "Unknown date";

                                    // ✅ Firestore Timestamp (client SDK)
                                    if (
                                      typeof (raw as any).toDate === "function"
                                    ) {
                                      return (raw as any)
                                        .toDate()
                                        .toLocaleString();
                                    }

                                    // ✅ Firestore Timestamp (from API / JSON)
                                    if (
                                      typeof raw === "object" &&
                                      "seconds" in raw
                                    ) {
                                      return new Date(
                                        raw.seconds * 1000,
                                      ).toLocaleString();
                                    }

                                    // ✅ fallback
                                    const d = new Date(raw as any);
                                    return isNaN(d.getTime())
                                      ? "Unknown date"
                                      : d.toLocaleString();
                                  })()}
                                </motion.p>
                              </motion.div>
                              <motion.p
                                variants={{
                                  initial: { opacity: 0, y: 4 },
                                  animate: { opacity: 1, y: 0 },
                                }}
                                transition={{ delay: 0.15, duration: 0.25 }}
                                className="text-[11px] text-amber-300 tracking-wide"
                              >
                                {formatSize(game?.save?.sizeBytes)}
                              </motion.p>
                            </div>

                            {/* ⚡ Actions */}
                            <div className="flex items-center gap-3 ml-2">
                              {/* ⬇ Download */}
                              <button
                                onClick={async () => {
                                  const fileName =
                                    existingSave?.storageKey ||
                                    saveUploads[0]?.storageKey;

                                  if (!fileName) {
                                    console.error("No fileName");
                                    return;
                                  }

                                  const res = await fetch(
                                    "/api/save-download",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ fileName }),
                                    },
                                  );

                                  const data = await res.json();

                                  if (!res.ok) {
                                    console.error(data.error);
                                    return;
                                  }

                                  window.open(data.downloadUrl, "_blank");
                                }}
                                className="text-white transition-all cursor-pointer hover:scale-125 duration-200 ease-in-out"
                              >
                                <BsSave size={15} />
                              </button>

                              {/* 🗑 Delete */}
                              <button
                                onClick={async () => {
                                  const fileName =
                                    existingSave?.storageKey ||
                                    saveUploads[0]?.storageKey;
                                  if (!fileName) return;

                                  await fetch("/api/save-delete", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      fileName,
                                      gameId: game!.igdb.id,
                                      userId: auth.currentUser!.uid,
                                    }),
                                  });

                                  setSaveUploads([]);
                                  setSelectedSaveFile(null);
                                  setExistingSave(null);
                                }}
                                className="text-white transition-all  cursor-pointer hover:scale-125 duration-200 ease-in-out"
                              >
                                <TiFolderDelete size={20} />
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.label
                            key="empty"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className={`mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed px-3 py-6 min-h-20 transition ${
                              isSaveDropActive
                                ? "border-amber-400/60 bg-amber-400/10"
                                : "border-white/12 bg-white/3 hover:border-white/25 hover:bg-white/5"
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsSaveDropActive(true);
                            }}
                            onDragLeave={() => setIsSaveDropActive(false)}
                            onDrop={handleSaveFileDrop}
                          >
                            <input
                              type="file"
                              accept=".zip"
                              className="hidden"
                              onChange={handleSaveFileChange}
                            />

                            <div className="flex items-center gap-4 w-full opacity-70">
                              {/* 🎮 Image skeleton with centered text */}
                              <div className="relative h-14 w-20 rounded-md bg-white/10 border border-white/10 flex items-center justify-center">
                                <span className="text-[10px] text-zinc-400 tracking-wide">
                                  EMPTY SLOT
                                </span>
                              </div>

                              {/* 📄 Text */}
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-zinc-400">
                                  Slot #1
                                </p>
                              </div>
                            </div>
                          </motion.label>
                        )}
                      </AnimatePresence>
                    </motion.div>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
