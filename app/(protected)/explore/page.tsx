"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { collection, onSnapshot } from "firebase/firestore";

import HeroSection from "@/app/components/HeroSection";
import GenreRow from "@/app/components/GenreRow";
import SkeletonRow from "@/app/components/SkeletonRow";
import HeroSkeleton from "@/app/components/HeroSkeleton";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { useUI } from "@/app/context/UIContext";

const SECTION_ORDER = [
  "Trending Now",
  "Most Anticipated",
  "Top Rated",
  "Critically Acclaimed",
  "Story Rich",
  "Most Played",
  "Indie Spotlight",
  "Hidden Gems",
  "Recently Released",
] as const;

type SectionTitle = (typeof SECTION_ORDER)[number];

const SECTION_ENDPOINTS: Record<SectionTitle, string> = {
  "Trending Now": "/api/igdb/explore/trending",
  "Most Anticipated": "/api/igdb/explore/upcoming",
  "Top Rated": "/api/igdb/explore/top-rated",
  "Critically Acclaimed": "/api/igdb/explore/critically-acclaimed",
  "Story Rich": "/api/igdb/explore/story-rich",
  "Most Played": "/api/igdb/explore/most-played",
  "Indie Spotlight": "/api/igdb/explore/indie-spotlight",
  "Hidden Gems": "/api/igdb/explore/hidden-gems",
  "Recently Released": "/api/igdb/explore/recently-released",
};

const PAGE_LIMIT = 30;

export default function ExplorePage() {
  const { user } = useUser();
  const { navbarLayout } = useUI();
  const [hero, setHero] = useState<any[]>([]);
  const [sections, setSections] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [savedGames, setSavedGames] = useState<Record<string, any>>({});
  const [sectionHasMore, setSectionHasMore] = useState<Record<string, boolean>>(
    {},
  );
  const [sectionLoadingMore, setSectionLoadingMore] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

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
    const checkSectionHasMore = async (
      sectionData: Record<string, any[]>,
    ): Promise<Record<string, boolean>> => {
      const checks = await Promise.all(
        SECTION_ORDER.map(async (title) => {
          const initial = sectionData[title] || [];
          if (!Array.isArray(initial) || initial.length < PAGE_LIMIT) {
            return [title, false] as const;
          }

          const endpoint = SECTION_ENDPOINTS[title];
          try {
            const res = await fetch(`${endpoint}?offset=${PAGE_LIMIT}&limit=1`);
            if (!res.ok) return [title, false] as const;
            const payload = (await res.json()) as any[];
            return [
              title,
              Array.isArray(payload) && payload.length > 0,
            ] as const;
          } catch {
            return [title, false] as const;
          }
        }),
      );

      return Object.fromEntries(checks);
    };

    const cached = sessionStorage.getItem("explore-data");

    if (cached) {
      const parsed = JSON.parse(cached);
      setHero(parsed.hero);
      setSections(parsed.sections);
      void (async () => {
        const moreState = await checkSectionHasMore(parsed.sections || {});
        setSectionHasMore(moreState);
        setLoading(false);
      })();
      return;
    }

    const load = async () => {
      const data = await fetchExploreData();
      sessionStorage.setItem("explore-data", JSON.stringify(data));
      setHero(data.hero);
      setSections(data.sections);
      const moreState = await checkSectionHasMore(data.sections || {});
      setSectionHasMore(moreState);
      setLoading(false);
    };

    load();
  }, []);

  const sectionEntries = useMemo(
    () =>
      SECTION_ORDER.filter((title) => Array.isArray(sections[title])).map(
        (title) => ({
          title,
          games: sections[title] || [],
        }),
      ),
    [sections],
  );

  const loadMoreForSection = async (title: SectionTitle) => {
    const endpoint = SECTION_ENDPOINTS[title];
    if (!endpoint) return;
    if (sectionLoadingMore[title]) return;
    if (!sectionHasMore[title]) return;

    const current = sections[title] || [];
    const offset = current.length;

    try {
      setSectionLoadingMore((prev) => ({ ...prev, [title]: true }));

      const res = await fetch(
        `${endpoint}?offset=${offset}&limit=${PAGE_LIMIT}`,
      );
      if (!res.ok) throw new Error("Failed to load more");
      const next = (await res.json()) as any[];
      const safeNext = Array.isArray(next) ? next : [];

      setSections((prev) => {
        const existing = prev[title] || [];
        const seen = new Set(existing.map((g: any) => String(g?.id)));
        const merged = [...existing];

        for (const item of safeNext) {
          const id = String(item?.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push(item);
        }

        return { ...prev, [title]: merged };
      });

      setSectionHasMore((prev) => ({
        ...prev,
        [title]: safeNext.length >= PAGE_LIMIT,
      }));
    } catch {
      setSectionHasMore((prev) => ({ ...prev, [title]: false }));
    } finally {
      setSectionLoadingMore((prev) => ({ ...prev, [title]: false }));
    }
  };

  return (
    <>
      <main
        className={`relative min-h-screen  ${
          navbarLayout === "sidebar" ? "pt-5 pl-5" : "pt-16"
        } overflow-x-hidden bg-[var(--theme-bg)] text-white`}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[520px] w-full bg-linear-to-b from-cyan-500/10 via-cyan-400/5 to-transparent" />
          <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute right-0 top-56 h-96 w-96 rounded-full bg-blue-500/8 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-[1800px]">
          <header className="mb-6 px-4 sm:px-6 lg:px-8 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
              PlayCrew Discovery
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
              Explore
            </h1>
          </header>

          <section className="mb-10 px-2 sm:px-4 lg:px-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/35 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <AnimatePresence mode="wait">
                {hero.length === 0 ? (
                  <motion.div
                    key="hero-skeleton"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <HeroSkeleton />
                  </motion.div>
                ) : (
                  <motion.div
                    key="hero"
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
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
            </div>
          </section>

          {loading ? (
            <div className="space-y-18 px-4 sm:px-6 lg:px-8">
              {[...Array(9)].map((_, i) => (
                <div key={i}>
                  <SkeletonRow />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-4 sm:px-6 lg:px-8">
              {sectionEntries.map((section, i) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: "easeOut",
                    delay: i * 0.04,
                  }}
                  className="rounded-2xl p-2 transition hover:bg-white/2"
                >
                  <GenreRow
                    title={section.title}
                    user={user}
                    games={section.games}
                    savedGames={savedGames}
                    setSavedGames={setSavedGames}
                    hasMore={sectionHasMore[section.title]}
                    loadingMore={sectionLoadingMore[section.title]}
                    onLoadMore={() => loadMoreForSection(section.title)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
