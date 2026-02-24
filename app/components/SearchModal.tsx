"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

type Game = {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  version_parent?: number;
};

export default function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      const res = await fetch("/api/igdb/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      const withCovers = (data as Game[]).filter(
        (game) => game.cover && game.cover.url,
      );

      setResults(withCovers);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[#161616] w-full max-w-3xl h-[560px] rounded-xl overflow-hidden flex flex-col"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <div className="p-4 border-b border-white/10 flex gap-3">
          <input
            autoFocus
            className="flex-1 bg-transparent text-white text-lg outline-none"
            placeholder="Search a game..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose}>x</button>
        </div>

        <div className="h-[480px] overflow-y-auto p-3">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                className="text-white/50 text-center py-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="loading loading-dots loading-lg" />
              </motion.div>
            ) : (
              <motion.div
                key="results"
                className="space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {results.length === 0 && query.trim().length > 0 ? (
                  <div className="text-white/40 text-center py-10">
                    No games found
                  </div>
                ) : (
                  results.map((game) => (
                    <Link
                      key={game.id}
                      href={`/game/${game.id}`}
                      onClick={onClose}
                      className="flex items-center gap-4 p-3 rounded-lg bg-black hover:bg-zinc-800 transition"
                    >
                      <img
                        src={
                          game.cover?.url
                            ? `https:${game.cover.url.replace(
                                "t_thumb",
                                "t_cover_small",
                              )}`
                            : "/placeholder.jpg"
                        }
                        className="w-12 h-16 rounded object-cover"
                      />

                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {game.name}
                        </div>

                        <div className="text-sm text-white/50">
                          {game.first_release_date && (
                            <>
                              {" "}
                              {new Date(
                                game.first_release_date * 1000,
                              ).getFullYear()}
                            </>
                          )}
                        </div>
                      </div>

                      <span className="text-white/40">{">"}</span>
                    </Link>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
