"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { FaMedal } from "react-icons/fa";
import { GiTrophy } from "react-icons/gi";

const PAGE_SIZE = 15;

interface ShelfGame {
  igdbId: number;
  name: string;
  cover: string;
  rating: number;
  releaseDate: Date | null;
}

interface ModalProps {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  currentCategory: string | null;
  pickGame: (game: ShelfGame) => Promise<void>;
}

export default function GamePickerModal({
  modalOpen,
  setModalOpen,
  currentCategory,
  pickGame,
}: ModalProps) {
  const { user } = useUser();
  const [allGames, setAllGames] = useState<ShelfGame[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [loading, setLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

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

    return allGames
      .filter((g) => {
        if (!g.name) return false;

        if (!g.name.toLowerCase().includes(search.toLowerCase())) return false;

        const isReleased = g.releaseDate && g.releaseDate <= now;

        const isUnreleased = !g.releaseDate || g.releaseDate > now;

        if (currentCategory === "Most Anticipated") {
          return isUnreleased;
        }

        return isReleased;
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [allGames, search, currentCategory]);

  const totalPages = Math.ceil(filteredGames.length / PAGE_SIZE);
  const paginatedGames = filteredGames.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  if (!modalOpen || !currentCategory) return null;

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

  useEffect(() => {
    if (modalOpen) {
      setSearch("");
      setPage(1);
    }
  }, [modalOpen]);

  return (
    <AnimatePresence>
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-zinc-800 rounded-xl p-6 min-w-[320px] w-full max-w-[800px] h-[860px] flex flex-col"
          >
            <h3 className="text-xl font-bold text-white mb-4 text-center">
              {currentCategory === "Best of All Time" ? (
                <p className="flex justify-center items-center gap-2">
                  <FaMedal className="inline mr-2 text-yellow-400" />
                  Pick the{" "}
                  <span className="text-yellow-400">Best Game of All Time</span>
                </p>
              ) : (
                <div className="flex justify-center items-center gap-2">
                  <GiTrophy className="text-yellow-400" />
                  Pick the Game with the{" "}
                  <span className="text-yellow-400 uppercase tracking-wide">
                    Best {currentCategory}
                  </span>
                </div>
              )}
            </h3>

            {/* Search */}
            <input
              type="text"
              placeholder="Search games..."
              className="mb-4 px-3 py-2 rounded-lg w-full bg-zinc-700 text-white placeholder-white"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            {/* Game grid */}
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <span className="loading loading-infinity loading-xl text-white"></span>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="flex items-center justify-center flex-1 text-white">
                No games found
              </div>
            ) : (
              <div className="overflow-hidden flex-1 relative">
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={page}
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-5 grid-rows-3 gap-4 absolute top-0 left-0 w-full"
                  >
                    {paginatedGames.map((game) => (
                      <motion.div
                        key={game.igdbId}
                        className="relative cursor-pointer overflow-hidden rounded-xl shadow-2xl bg-zinc-900"
                        onClick={() => game && pickGame(game)}
                        whileHover={{ scale: 1.05, rotateX: -2, rotateY: 2 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 20,
                        }}
                      >
                        {/* Image container */}
                        <div className="w-full h-48 relative overflow-hidden">
                          {game && (
                            <motion.img
                              src={game.cover}
                              alt={game.name}
                              className="w-full h-full object-cover"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: loadedImages[game.igdbId] ? 1 : 0,
                              }}
                              transition={{ duration: 0.5 }}
                              onLoad={() =>
                                setLoadedImages((prev) => ({
                                  ...prev,
                                  [game.igdbId]: true,
                                }))
                              }
                            />
                          )}
                          {/* Gradient overlay for name */}
                          {/* <div className="absolute bottom-0 left-0 w-full h-12 bg-linear-to-t from-black/80 to-transparent flex items-center justify-center px-2">
                            <p className="text-white text-center text-sm font-semibold truncate">
                              {game?.name ?? ""}
                            </p>
                          </div> */}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-4">
                <button
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:bg-zinc-600"
                  disabled={page === 1}
                  onClick={() => {
                    setDirection("left");
                    setPage((p) => p - 1);
                  }}
                >
                  Prev
                </button>
                <span className="text-white">
                  {page} / {totalPages}
                </span>
                <button
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:bg-zinc-600"
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

            <button
              onClick={() => setModalOpen(false)}
              className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
