"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCloseCircle } from "react-icons/io5";
import { FaStar } from "react-icons/fa6";
import { PickerGame } from "../types/trackedGame";

type IgdbGame = {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  rating?: number;
  total_rating?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (game: PickerGame) => Promise<void> | void;
  disabledGameIds?: number[];
  title?: string;
};

const toPickerGame = (game: IgdbGame): PickerGame | null => {
  if (!game.id || !game.name || !game.cover?.url) return null;

  return {
    igdbId: game.id,
    name: game.name,
    cover: `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`,
    rating: game.rating ?? game.total_rating ?? 0,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    status: "",
  };
};

export default function ScreenshotsGamePickerModal({
  open,
  onClose,
  onPick,
  disabledGameIds = [],
  title = "Add Game Collection",
}: Props) {
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<PickerGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setGames([]);
    setLoadedImages({});
  }, [open]);

  // Fetch games
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const fetchGames = async () => {
      setLoading(true);

      try {
        const res = await fetch("/api/igdb/awards-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: search.trim(),
          }),
          signal: controller.signal,
        });

        const raw = await res.json();

        const data = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.games)
            ? raw.games
            : [];

        const mapped = data.map(toPickerGame).filter(Boolean) as PickerGame[];

        setGames(mapped);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Search failed", err);
        }
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchGames, 100);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [search, open]);

  const handlePick = async (game: PickerGame) => {
    if (disabledGameIds.includes(game.igdbId)) return;

    await onPick(game);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-2000 flex items-center justify-center bg-black/80 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-3xl h-[80vh] rounded-3xl border border-cyan-500/30 bg-zinc-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden"
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {title}
              </h2>
              <button onClick={onClose}>
                <IoCloseCircle className="text-2xl text-zinc-400 hover:text-white" />
              </button>
            </div>

            {/* Search */}
            <div className="mt-3 relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search games..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-500/50"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <IoCloseCircle size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <span className="loading loading-dots loading-lg text-cyan-500" />
              </div>
            ) : games.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
                {search ? "No results found." : "Start typing to search games."}
              </div>
            ) : (
              games.map((game) => {
                const disabled = disabledGameIds.includes(game.igdbId);

                return (
                  <motion.div
                    key={game.igdbId}
                    whileHover={!disabled ? { scale: 1.01 } : {}}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition cursor-pointer ${
                      disabled
                        ? "border-white/10 opacity-50 cursor-not-allowed"
                        : "border-white/10 hover:border-cyan-500/40 hover:bg-white/5"
                    }`}
                    onClick={() => handlePick(game)}
                  >
                    {/* Cover */}
                    <div className="w-14 h-20 shrink-0 rounded-md overflow-hidden bg-zinc-900 border border-white/10">
                      <img
                        src={game.cover}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        onLoad={() =>
                          setLoadedImages((prev) => ({
                            ...prev,
                            [game.igdbId]: true,
                          }))
                        }
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">
                        {game.name}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                        <span className="flex items-center gap-1">
                          <FaStar size={10} className="text-amber-300" />
                          {Math.round(game.rating || 0) || "N/A"}
                        </span>

                        <span>
                          {game.releaseDate
                            ? game.releaseDate.getFullYear()
                            : "TBA"}
                        </span>
                      </div>
                    </div>

                    {/* Disabled label */}
                    {disabled && (
                      <span className="text-xs text-red-300">
                        Already added
                      </span>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
