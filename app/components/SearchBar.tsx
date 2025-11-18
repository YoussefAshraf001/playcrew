"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Hide dropdown if query too short
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      return;
    }

    setShowDropdown(true);
    setLoading(true);

    // Clear previous debounce
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
      // Abort previous fetch
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(
          `https://api.rawg.io/api/games?key=${API_KEY}&search=${query}&page_size=6`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        if ((err as any).name === "AbortError") return;
        console.error(err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [query]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="relative w-1/3 min-w-[250px]">
      <input
        type="text"
        value={query}
        placeholder="Looking for a specific game?"
        onChange={(e) => setQuery(e.target.value)}
        className="bg-[#2a2a2a] text-white rounded-full px-4 py-2 w-full outline-none"
      />

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-12 w-full bg-[#1e1e1e] border border-white/10 rounded-lg shadow-lg z-50 h-[450px] overflow-y-auto"
          >
            <div className="h-full flex flex-col px-1">
              {loading ? (
                <div className="h-full flex items-center justify-center py-4 text-white/50">
                  <span className="loading loading-spinner loading-xl" />
                </div>
              ) : results.length > 0 ? (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col mt-2"
                >
                  {results.map((game) => (
                    <motion.div
                      key={game.id}
                      variants={itemVariants}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded transition"
                    >
                      <Link
                        href={`/game/${game.id}`}
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 w-full"
                      >
                        <img
                          src={game.background_image}
                          className="w-10 h-14 object-cover rounded-md"
                          alt={game.name}
                        />
                        <span className="text-white text-sm">{game.name}</span>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="h-full flex items-center justify-center py-4 text-white/50">
                  No results found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
