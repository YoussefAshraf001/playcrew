"use client";

import { useEffect, useState } from "react";
import GenreRow from "@/app/components/GenreRow";
import { motion } from "framer-motion";
import HeroSection from "@/app/components/HeroSection";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

if (!API_KEY) throw new Error("Missing NEXT_PUBLIC_RAWG_API_KEY");

const GENRES = [
  "action",
  "shooter",
  "casual",
  "adventure",
  "indie",
  "massively-multiplayer",
  "fighting",
];

const REVALIDATE_TIME = 3600;

// ---------------------------
// Fetch Helpers
// ---------------------------
async function fetchJSON(url: string) {
  const res = await fetch(url, { next: { revalidate: REVALIDATE_TIME } });
  if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
  return res.json();
}

async function getTrending() {
  const url = `https://api.rawg.io/api/games/lists/popular?key=${API_KEY}&page_size=10`;
  const data = await fetchJSON(url);
  return data.results || [];
}

async function getGenres() {
  const promises = GENRES.map(async (genre) => {
    const url = `https://api.rawg.io/api/games?key=${API_KEY}&genres=${genre}&page_size=30`;
    const data = await fetchJSON(url);
    return [genre, data.results || []] as const;
  });
  const resolved = await Promise.all(promises);
  return Object.fromEntries(resolved);
}

// ---------------------------
// Client Explore Page
// ---------------------------
export default function ExplorePage() {
  const [trending, setTrending] = useState<any[]>([]);
  const [sections, setSections] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [trendingData, genresData] = await Promise.all([
          getTrending(),
          getGenres(),
        ]);
        setTrending(trendingData);
        setSections(genresData);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load games. Try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen bg-black text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </motion.div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>{error}</p>
      </main>
    );
  }

  return (
    <motion.main
      className="min-h-screen bg-black text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Content */}
      <div className="flex w-full gap-8 max-w-screen overflow-hidden pt-14">
        <div className="flex-1 min-w-0 overflow-y-auto space-y-16 pb-20">
          {/* Hero Section */}
          {trending.length > 0 && <HeroSection trending={trending} />}

          {/* Genre Rows */}
          {Object.entries(sections).map(([genre, games]) => (
            <GenreRow key={genre} title={genre} games={games} />
          ))}
        </div>
      </div>
    </motion.main>
  );
}
