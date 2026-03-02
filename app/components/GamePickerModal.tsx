"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaMedal,
  // FaCheckCircle,
  // FaPauseCircle,
  // FaTimesCircle,
  // FaGamepad,
  // FaGlobe,
  // FaClock,
} from "react-icons/fa";
import { GiTrophy } from "react-icons/gi";

const PAGE_SIZE = 10;

interface ShelfGame {
  igdbId: number;
  name: string;
  cover: string;
  status: string;
  rating: number;
  releaseDate: Date | null;
}

interface ModalProps {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  currentCategory: string | null;
  pickGame: (game: ShelfGame) => Promise<void>;
  disabledGameIds?: number[];
  disabledOverlayText?: string;
  theme?: "shelf" | "default";
}

const toHighQualityCover = (url: string) => {
  if (!url) return url;
  if (!url.includes("igdb.com")) return url;
  // Use cover-specific size to avoid side gutters from non-cover variants.
  return url.replace(/\/t_[^/]+\//, "/t_cover_big_2x/");
};

const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// const getStatusMeta = (status?: string) => {
//   switch (status) {
//     case "Completed":
//       return {
//         label: "Completed",
//         icon: FaCheckCircle,
//         style: "border-emerald-300/45 bg-emerald-400/15 text-emerald-100",
//       };
//     case "On Hold":
//       return {
//         label: "On Hold",
//         icon: FaPauseCircle,
//         style: "border-amber-300/45 bg-amber-400/15 text-amber-100",
//       };
//     case "Dropped":
//       return {
//         label: "Dropped",
//         icon: FaTimesCircle,
//         style: "border-rose-300/45 bg-rose-400/15 text-rose-100",
//       };
//     case "Online":
//       return {
//         label: "Online",
//         icon: FaGlobe,
//         style: "border-violet-300/45 bg-violet-400/15 text-violet-100",
//       };
//     case "Want To Play":
//       return {
//         label: "Want To Play",
//         icon: FaClock,
//         style: "border-zinc-300/45 bg-zinc-300/15 text-zinc-100",
//       };
//     case "Playing":
//     default:
//       return {
//         label: "Playing",
//         icon: FaGamepad,
//         style: "border-cyan-300/45 bg-cyan-400/15 text-cyan-100",
//       };
//   }
// };

export default function GamePickerModal({
  modalOpen,
  setModalOpen,
  currentCategory,
  pickGame,
  disabledGameIds = [],
  disabledOverlayText = "Already Added",
  theme = "default",
}: ModalProps) {
  const { user } = useUser();
  const [allGames, setAllGames] = useState<ShelfGame[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [loading, setLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [includeUnreleased, setIncludeUnreleased] = useState(false);
  const [pickingGameId, setPickingGameId] = useState<number | null>(null);

  useEffect(() => {
    if (!modalOpen || !user) return;

    const fetchGames = async () => {
      setLoading(true);

      try {
        const gamesCol = collection(db, "users", user.uid, "games_igdb");
        const snapshot = await getDocs(gamesCol);

        const loaded: ShelfGame[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();

            if (!data?.igdb?.id || !data?.name || !data?.igdb?.cover) {
              return null;
            }

            return {
              igdbId: data.igdb.id,
              name: data.name,
              cover: data.igdb.cover,
              status: data.status ?? "Playing",
              rating: data.my_rating ?? 0,
              releaseDate: data.igdb.releaseDate?.seconds
                ? new Date(data.igdb.releaseDate.seconds * 1000)
                : null,
            };
          })
          .filter(Boolean) as ShelfGame[];

        setAllGames(loaded);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch games");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [modalOpen, user]);

  const filteredGames = useMemo(() => {
    const now = new Date();
    const normalizedSearch = normalizeForSearch(search);

    return allGames
      .filter((g) => {
        if (!g.name) return false;

        if (!normalizeForSearch(g.name).includes(normalizedSearch)) return false;

        const isReleased = !!g.releaseDate && g.releaseDate <= now;

        const isUnreleased = !g.releaseDate || g.releaseDate > now;

        if (currentCategory === "Most Anticipated") {
          return includeUnreleased ? true : isUnreleased;
        }

        return includeUnreleased ? true : isReleased;
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [allGames, search, currentCategory, includeUnreleased]);

  const totalPages = Math.ceil(filteredGames.length / PAGE_SIZE);
  const paginatedGames = filteredGames.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    if (modalOpen) {
      setSearch("");
      setPage(1);
      setIncludeUnreleased(currentCategory === "Most Anticipated");
    }
  }, [modalOpen, currentCategory]);

  if (!currentCategory) return null;

  const pageVariants = {
    enter: (dir: "left" | "right") => ({
      x: dir === "right" ? 300 : -300,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: "left" | "right") => ({
      x: dir === "right" ? -300 : 300,
      opacity: 0,
    }),
  };

  const isScreenshotsPicker = currentCategory === "Screenshots Gallery";
  const isShelfTheme = theme === "shelf";
  const modalTitle = isScreenshotsPicker
    ? "Pick a Game for Screenshots Gallery"
    : currentCategory === "Best of All Time"
      ? "Pick the Best Game of All Time"
      : `Pick a Winner for ${currentCategory}`;
  const modalSubtitle = isScreenshotsPicker
    ? "Collection Selection"
    : "Award Selection";
  const accentBorder = isShelfTheme ? "border-amber-200/30" : "border-cyan-500/30";
  const accentGlow = isShelfTheme
    ? "bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.14),transparent_55%),linear-gradient(180deg,rgba(5,5,5,0.35),transparent_32%)]"
    : "bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.14),transparent_55%),linear-gradient(180deg,rgba(5,5,5,0.35),transparent_32%)]";
  const accentIcon = isShelfTheme ? "text-amber-300" : "text-cyan-500";
  const accentSubtitle = isShelfTheme ? "text-amber-100/80" : "text-cyan-500/80";
  const accentInputBorder = isShelfTheme ? "border-amber-200/20" : "border-cyan-500/20";
  const accentToggleOn = isShelfTheme
    ? "border-amber-200/45 bg-amber-300/15 text-amber-100"
    : "border-cyan-500/45 bg-cyan-500/15 text-cyan-500";
  const accentCardBorder = isShelfTheme ? "border-amber-200/20" : "border-cyan-500/20";
  const accentLoading = isShelfTheme ? "text-amber-200" : "text-cyan-500";
  const accentDisabledPill = isShelfTheme
    ? "border-amber-200/40 text-amber-100"
    : "border-cyan-500/40 text-cyan-500";

  return (
    <AnimatePresence mode="wait">
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-3 sm:p-5"
          onClick={() => setModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`relative flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-zinc-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.65)] ${accentBorder}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`pointer-events-none absolute inset-0 ${accentGlow}`} />

            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                  {currentCategory === "Best of All Time" ? (
                    <FaMedal className={accentIcon} />
                  ) : (
                    <GiTrophy className={accentIcon} />
                  )}
                  <span>{modalTitle}</span>
                </h3>
                <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${accentSubtitle}`}>
                  {modalSubtitle}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="relative z-10 flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:px-5 md:flex-row md:items-center">
              <input
                type="text"
                placeholder="Search games..."
                className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm text-white placeholder:text-zinc-400 md:flex-1 ${accentInputBorder}`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <div className="flex w-full flex-wrap items-center gap-2 self-start md:w-auto md:self-auto md:justify-end">
                <span className="shrink-0 rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-xs text-zinc-300">
                  {filteredGames.length} games
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIncludeUnreleased((prev) => !prev);
                    setPage(1);
                  }}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    includeUnreleased
                      ? accentToggleOn
                      : "border-white/15 bg-black/45 text-zinc-300"
                  }`}
                  title="Include unreleased games"
                >
                  {includeUnreleased
                    ? "Include Unreleased: On"
                    : "Include Unreleased: Off"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="relative z-10 flex flex-1 items-center justify-center">
                <span className={`loading loading-dots loading-xl ${accentLoading}`} />
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="relative z-10 flex flex-1 items-center justify-center text-zinc-300">
                No Games Found
              </div>
            ) : (
              <div className="relative z-10 min-h-0 flex-1 overflow-hidden px-4 py-3 sm:px-5">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={page}
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="grid h-full grid-cols-2 auto-rows-max content-start gap-3 overflow-y-auto pr-1 touch-pan-y sm:grid-cols-3 lg:grid-cols-5"
                  >
                    {paginatedGames.map((game) => {
                      const isDisabled = disabledGameIds.includes(game.igdbId);
                      return (
                      <motion.button
                        type="button"
                        key={game.igdbId}
                        disabled={pickingGameId !== null || isDisabled}
                        className={`group relative h-58 sm:h-60 xl:h-75 overflow-hidden rounded-xl border bg-black/55 text-left shadow-xl ${accentCardBorder} ${
                          pickingGameId !== null
                            ? "cursor-wait"
                            : isDisabled
                              ? "cursor-not-allowed opacity-80"
                              : ""
                        }`}
                        onClick={async () => {
                          if (pickingGameId !== null || isDisabled) return;
                          setPickingGameId(game.igdbId);
                          try {
                            await pickGame(game);
                          } finally {
                            setPickingGameId(null);
                          }
                        }}
                        whileHover={
                          pickingGameId === null && !isDisabled
                            ? { y: -3, scale: 1.01 }
                            : {}
                        }
                        transition={{
                          type: "spring",
                          stiffness: 220,
                          damping: 22,
                        }}
                      >
                        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
                          <motion.img
                            src={toHighQualityCover(game.cover)}
                            alt={game.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                            loading="lazy"
                            decoding="async"
                            initial={{ opacity: 0 }}
                            animate={{
                              opacity: loadedImages[game.igdbId] ? 1 : 0,
                            }}
                            transition={{ duration: 0.35 }}
                            onLoad={() =>
                              setLoadedImages((prev) => ({
                                ...prev,
                                [game.igdbId]: true,
                              }))
                            }
                          />
                        </div>
                        {pickingGameId === game.igdbId && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65">
                            <span className={`loading loading-dots loading-lg ${accentLoading}`} />
                          </div>
                        )}
                        {isDisabled && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                            <span className={`rounded-full border bg-black/70 px-3 py-1 text-xs font-semibold ${accentDisabledPill}`}>
                              {disabledOverlayText}
                            </span>
                          </div>
                        )}
                      </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {totalPages > 1 && (
              <div className="relative z-10 flex items-center justify-center gap-4 border-t border-white/10 px-4 py-3">
                <button
                  className="rounded-lg border border-white/20 bg-black/45 px-3 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => {
                    setDirection("left");
                    setPage((p) => p - 1);
                  }}
                >
                  Prev
                </button>
                <span className="text-sm text-zinc-200">
                  {page} / {totalPages}
                </span>
                <button
                  className="rounded-lg border border-white/20 bg-black/45 px-3 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page === totalPages}
                  onClick={() => {
                    setDirection("right");
                    setPage((p) => p + 1);
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
