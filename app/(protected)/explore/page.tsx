"use client";

import { useEffect, useState } from "react";
import HeroSection from "@/app/components/HeroSection";
import GenreRow from "@/app/components/GenreRow";
import SkeletonRow from "@/app/components/SkeletonRow";
import { AnimatePresence, motion } from "framer-motion";
import HeroSkeleton from "@/app/components/HeroSkeleton";
import { Helmet } from "react-helmet-async";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";

export default function ExplorePage() {
  const { user } = useUser();
  const [hero, setHero] = useState<any[]>([]);
  const [sections, setSections] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [savedGames, setSavedGames] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user?.uid) return;

    const ref = collection(db, "users", user.uid, "games_igdb");

    const unsub = onSnapshot(ref, (snap) => {
      const data: Record<string, any> = {};

      snap.forEach((doc) => {
        data[doc.id] = doc.data();
      });

      setSavedGames(data);
    });

    return () => unsub();
  }, [user?.uid]);

  const fetchExploreData = async () => {
    const [
      upcoming,
      trending,
      topRated,
      criticallyAcclaimed,
      storyRich,
      mostPlayed,
      indieSpotlight,
      hiddenGems,
      recentlyReleased,
    ] = await Promise.all([
      fetch("/api/igdb/explore/upcoming").then((r) => r.json()),
      fetch("/api/igdb/explore/trending").then((r) => r.json()),
      fetch("/api/igdb/explore/top-rated").then((r) => r.json()),
      fetch("/api/igdb/explore/story-rich").then((r) => r.json()),
      fetch("/api/igdb/explore/most-played").then((r) => r.json()),
      fetch("/api/igdb/explore/indie-spotlight").then((r) => r.json()),
      fetch("/api/igdb/explore/critically-acclaimed").then((r) => r.json()),
      fetch("/api/igdb/explore/hidden-gems").then((r) => r.json()),
      fetch("/api/igdb/explore/recently-released").then((r) => r.json()),
    ]);

    return {
      hero: upcoming,
      sections: {
        "Trending Now": trending,
        "Most Anticipated": upcoming,
        "Top Rated": topRated,
        "Critically Acclaimed": criticallyAcclaimed,
        "Story Rich": storyRich,
        "Most Played": mostPlayed,
        "Indie Spotlight": indieSpotlight,
        "Hidden Gems": hiddenGems,
        "Recently Released": recentlyReleased,
      },
    };
  };

  useEffect(() => {
    const cached = sessionStorage.getItem("explore-data");

    if (cached) {
      const parsed = JSON.parse(cached);
      setHero(parsed.hero);
      setSections(parsed.sections);
      setLoading(false);
      return;
    }

    const load = async () => {
      const data = await fetchExploreData();
      sessionStorage.setItem("explore-data", JSON.stringify(data));
      setHero(data.hero);
      setSections(data.sections);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <>
      <Helmet>
        <title>PlayCrew - Explore</title>
        <meta
          name="description"
          content="Discover new games, browse recommendations, and explore what to play next."
        />
      </Helmet>

      <main className="min-h-screen bg-black text-white mt-12">
        <AnimatePresence mode="wait">
          {hero.length === 0 ? (
            <motion.div
              key="hero-skeleton"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <HeroSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
              }}
            >
              <HeroSection
                trending={hero}
                user={user}
                savedGames={savedGames}
                setSavedGames={setSavedGames}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="px-12">
          {loading
            ? [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
            : Object.entries(sections).map(([title, games], i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    ease: "easeOut",
                    delay: i * 0.12,
                  }}
                >
                  <GenreRow
                    title={title}
                    user={user}
                    games={Array.isArray(games) ? games : []}
                    savedGames={savedGames}
                    setSavedGames={setSavedGames}
                  />
                  <div className="relative mb-5">
                    <div className="h-px w-full bg-linear-to-r from-transparent via-cyan-400/50 to-transparent" />
                    <div className="absolute inset-0 blur-sm bg-linear-to-r from-transparent via-cyan-400/40 to-transparent" />
                  </div>
                </motion.div>
              ))}
        </div>
      </main>
    </>
  );
}
