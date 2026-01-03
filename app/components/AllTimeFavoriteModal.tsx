"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useUser } from "../context/UserContext";

interface TrackedGame {
  id: number;
  name: string;
  background_image?: string;
  rating?: number;
  favoriteAllTime?: boolean;
}

interface AllTimeFavoriteModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AllTimeFavoriteModal({
  open,
  onClose,
}: AllTimeFavoriteModalProps) {
  const { user } = useUser();
  const [games, setGames] = useState<TrackedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user) return;

    const fetchGames = async () => {
      setLoading(true);
      try {
        const gamesCol = collection(db, "users", user.uid, "games");
        const snapshot = await getDocs(query(gamesCol));

        const loadedGames: TrackedGame[] = snapshot.docs.map(
          (docSnap) =>
            ({
              id: Number(docSnap.id),
              ...docSnap.data(),
            } as TrackedGame)
        );

        setGames(loadedGames);

        // Pre-select the current favorite
        const currentFavorite = loadedGames.find((g) => g.favoriteAllTime);
        if (currentFavorite) setSelectedGameId(currentFavorite.id);
      } catch (err) {
        console.error("Failed to fetch games", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [open, user]);

  const handleSelectGame = async (gameId: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const gamesCol = collection(db, "users", user.uid, "games");
      const snapshot = await getDocs(gamesCol);
      const batchUpdates = snapshot.docs.map((docSnap) => {
        const gId = Number(docSnap.id);
        return setDoc(
          doc(db, "users", user.uid, "games", String(gId)),
          { favoriteAllTime: gId === gameId },
          { merge: true }
        );
      });
      await Promise.all(batchUpdates);
      setSelectedGameId(gameId);
    } catch (err) {
      console.error("Failed to save favorite", err);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const filteredGames = games
    .filter((g) => g.name)
    .filter((g) =>
      search
        ? g.name.toLowerCase().includes(search.toLowerCase())
        : g.rating && g.rating >= 9
    )
    .sort(
      (a, b) =>
        (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name)
    );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-zinc-900 rounded-2xl w-full max-w-2xl p-6 relative shadow-lg"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-cyan-400 transition"
            >
              <FiX size={24} />
            </button>

            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Select Your Favorite Game of All Time
            </h2>

            <input
              type="text"
              placeholder="Search game..."
              className="w-full mb-4 p-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none text-center"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner />
              </div>
            ) : filteredGames.length === 0 ? (
              <p className="text-center text-zinc-400 py-20">
                I don't see it in your games list 😔
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 min-h-[60vh] max-h-[60vh] overflow-y-auto auto-rows-min">
                {filteredGames.map((game) => (
                  <div
                    key={game.id}
                    className={`cursor-pointer rounded-xl overflow-hidden shadow-lg border-2 transition
    ${
      selectedGameId === game.id
        ? "border-cyan-400 scale-105"
        : "border-transparent hover:border-white/20"
    }`}
                    onClick={() => handleSelectGame(game.id)}
                  >
                    {/* Skeleton + image */}
                    <div className="relative w-full h-36 bg-zinc-700">
                      <img
                        src={game.background_image || "/placeholder-game.jpg"}
                        alt={""}
                        className="w-full h-full object-cover absolute top-0 left-0"
                      />
                      {/* Remove perpetual blinking */}
                    </div>

                    {/* Game info */}
                    <div className="p-2 bg-zinc-800 text-white flex flex-col items-start gap-1">
                      <span className="font-semibold truncate w-full">
                        {game.name}
                      </span>
                      {game.rating !== undefined && (
                        <span className="text-yellow-400 text-sm">
                          ⭐ {Math.round(game.rating)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {saving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex justify-center items-center gap-2 w-full">
                  <span className="loading loading-dots loading-xl"></span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
