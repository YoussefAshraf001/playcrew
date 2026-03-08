"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

import HeroSection from "@/app/components/HeroSection";
import GenreRow from "@/app/components/GenreRow";
import SkeletonRow from "@/app/components/SkeletonRow";
import HeroSkeleton from "@/app/components/HeroSkeleton";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";

const TOP_GENRE_COUNT = 6;
const ROW_LIMIT = 30;
const MIN_ROW_GAMES = 12;
const FETCH_LIMIT = 90;
const HORROR_FETCH_ENDPOINT = `/api/igdb/explore/by-genre?genre=${encodeURIComponent("Horror")}&limit=${FETCH_LIMIT}`;
const STORY_RICH_FETCH_ENDPOINT = "/api/igdb/explore/story-rich";

type SavedGame = {
  status?: string;
  favorite?: boolean;
  notInterested?: boolean;
  my_rating?: number | null;
  igdb?: {
    id?: number;
    genres?: string[];
  };
};

type Section = {
  title: string;
  games: any[];
};
type TasteMatch = {
  game: any;
  percent: number;
};

const scoreFromSavedGame = (game: SavedGame): number => {
  if (game.notInterested) return -4;

  let score = 1;
  if (game.favorite) score += 4;

  const rating =
    typeof game.my_rating === "number" && Number.isFinite(game.my_rating)
      ? game.my_rating
      : 0;

  if (rating > 0) score += rating * 0.8;
  if (rating > 0 && rating <= 4) score -= 2;

  switch (game.status) {
    case "Completed":
      score += 2;
      break;
    case "Playing":
      score += 1;
      break;
    case "On Hold":
      score += 0.25;
      break;
    case "Dropped":
      score -= 1.5;
      break;
    default:
      break;
  }

  return score;
};

export default function ForYouPage() {
  const { user } = useUser();
  const [savedGames, setSavedGames] = useState<Record<string, SavedGame>>({});
  const [genrePools, setGenrePools] = useState<Record<string, any[]>>({});
  const [horrorPool, setHorrorPool] = useState<any[]>([]);
  const [storyRichPool, setStoryRichPool] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tasteRowRef = useRef<HTMLDivElement | null>(null);
  const [canScrollTasteLeft, setCanScrollTasteLeft] = useState(false);
  const [canScrollTasteRight, setCanScrollTasteRight] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const ref = collection(db, "users", user.uid, "games_igdb");
    const unsub = onSnapshot(ref, (snap) => {
      const data: Record<string, SavedGame> = {};
      snap.forEach((d) => {
        data[d.id] = d.data() as SavedGame;
      });
      setSavedGames(data);
    });

    return () => unsub();
  }, [user?.uid]);

  const topGenres = useMemo(() => {
    const weights = new Map<string, number>();

    for (const game of Object.values(savedGames)) {
      const genres = Array.isArray(game?.igdb?.genres) ? game.igdb.genres : [];
      if (genres.length === 0) continue;

      const gameWeight = scoreFromSavedGame(game);
      for (const genre of genres) {
        const prev = weights.get(genre) ?? 0;
        weights.set(genre, prev + gameWeight);
      }
    }

    return [...weights.entries()]
      .filter(([, weight]) => weight > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GENRE_COUNT);
  }, [savedGames]);

  useEffect(() => {
    let active = true;

    const loadGenrePools = async () => {
      if (topGenres.length === 0) {
        setGenrePools({});
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [responses, horrorRes, storyRichRes] = await Promise.all([
          Promise.all(
            topGenres.map(async ([genre]) => {
              const res = await fetch(
                `/api/igdb/explore/by-genre?genre=${encodeURIComponent(genre)}&limit=${FETCH_LIMIT}`,
              );
              const payload = res.ok ? await res.json() : [];
              const games = Array.isArray(payload)
                ? payload.filter((g: any) => g?.id && g?.name)
                : [];
              return [genre, games] as const;
            }),
          ),
          fetch(HORROR_FETCH_ENDPOINT),
          fetch(STORY_RICH_FETCH_ENDPOINT),
        ]);

        const horrorPayload = horrorRes.ok ? await horrorRes.json() : [];
        const storyRichPayload = storyRichRes.ok ? await storyRichRes.json() : [];

        if (!active) return;
        setGenrePools(Object.fromEntries(responses));
        setHorrorPool(
          Array.isArray(horrorPayload)
            ? horrorPayload.filter((g: any) => g?.id && g?.name)
            : [],
        );
        setStoryRichPool(
          Array.isArray(storyRichPayload)
            ? storyRichPayload.filter((g: any) => g?.id && g?.name)
            : [],
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadGenrePools();

    return () => {
      active = false;
    };
  }, [topGenres]);

  const personalized = useMemo(() => {
    const topGenreWeightMap = new Map(topGenres);
    const topGenreWeightTotal = topGenres.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    );
    const libraryIds = new Set<string>();
    for (const [docId, game] of Object.entries(savedGames)) {
      const id = game?.igdb?.id ? String(game.igdb.id) : docId;
      libraryIds.add(id);
    }

    const seenAcrossRows = new Set<string>();
    const sections: Section[] = [];
    const pushSection = (title: string, pool: any[]) => {
      if (!Array.isArray(pool) || pool.length === 0) return;
      const uniqueInRow = new Set<string>();
      const rowGames: any[] = [];

      for (const game of pool) {
        const id = String(game?.id ?? "");
        if (
          !id ||
          libraryIds.has(id) ||
          seenAcrossRows.has(id) ||
          uniqueInRow.has(id)
        ) {
          continue;
        }
        rowGames.push(game);
        uniqueInRow.add(id);
        seenAcrossRows.add(id);
        if (rowGames.length >= ROW_LIMIT) break;
      }

      if (rowGames.length < MIN_ROW_GAMES) {
        for (const game of pool) {
          const id = String(game?.id ?? "");
          if (!id || libraryIds.has(id) || uniqueInRow.has(id)) continue;
          rowGames.push(game);
          uniqueInRow.add(id);
          if (rowGames.length >= MIN_ROW_GAMES) break;
        }
      }

      if (rowGames.length > 0) {
        sections.push({ title, games: rowGames });
      }
    };

    pushSection("Because You Like Horror", horrorPool);
    pushSection("Because You Like Story Rich Games", storyRichPool);

    for (const [genre] of topGenres) {
      if (genre.toLowerCase() === "horror") continue;
      const pool = genrePools[genre] ?? [];
      if (pool.length === 0) continue;

      const uniqueInRow = new Set<string>();
      const rowGames: any[] = [];

      for (const game of pool) {
        const id = String(game?.id ?? "");
        if (
          !id ||
          libraryIds.has(id) ||
          seenAcrossRows.has(id) ||
          uniqueInRow.has(id)
        ) {
          continue;
        }
        rowGames.push(game);
        uniqueInRow.add(id);
        seenAcrossRows.add(id);
        if (rowGames.length >= ROW_LIMIT) break;
      }

      if (rowGames.length < MIN_ROW_GAMES) {
        for (const game of pool) {
          const id = String(game?.id ?? "");
          if (!id || libraryIds.has(id) || uniqueInRow.has(id)) continue;
          rowGames.push(game);
          uniqueInRow.add(id);
          if (rowGames.length >= MIN_ROW_GAMES) break;
        }
      }

      if (rowGames.length > 0) {
        sections.push({
          title: `Because You Like ${genre}`,
          games: rowGames,
        });
      }
    }

    const hero: any[] = [];
    const heroIds = new Set<string>();
    for (const section of sections) {
      for (const game of section.games) {
        const id = String(game?.id ?? "");
        if (!id || heroIds.has(id)) continue;
        hero.push(game);
        heroIds.add(id);
        if (hero.length >= 8) break;
      }
      if (hero.length >= 8) break;
    }

    const uniqueCandidates = new Map<string, any>();
    for (const [genre] of topGenres) {
      for (const game of genrePools[genre] ?? []) {
        const id = String(game?.id ?? "");
        if (!id || libraryIds.has(id) || uniqueCandidates.has(id)) continue;
        uniqueCandidates.set(id, game);
      }
    }

    const tasteMatches: TasteMatch[] = [...uniqueCandidates.values()]
      .map((game) => {
        const genres: string[] = Array.isArray(game?.genres)
          ? game.genres
              .map((g: any) => (typeof g === "string" ? g : g?.name))
              .filter(Boolean)
          : [];

        const matchedWeight = genres.reduce(
          (sum, genre) => sum + (topGenreWeightMap.get(genre) ?? 0),
          0,
        );
        const genreSignal =
          topGenreWeightTotal > 0 ? matchedWeight / topGenreWeightTotal : 0;
        const ratingSignal =
          typeof game?.rating === "number"
            ? Math.max(0, Math.min(1, game.rating / 100))
            : 0.65;
        const voteSignal =
          typeof game?.total_rating_count === "number"
            ? Math.max(
                0,
                Math.min(1, Math.log10(game.total_rating_count + 1) / 3),
              )
            : 0.5;
        const raw = genreSignal * 0.7 + ratingSignal * 0.2 + voteSignal * 0.1;
        const percent = Math.max(65, Math.min(99, Math.round(raw * 100)));
        return { game, percent };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 18);

    return { hero, sections, tasteMatches };
  }, [genrePools, horrorPool, savedGames, storyRichPool, topGenres]);

  useEffect(() => {
    const el = tasteRowRef.current;
    if (!el) return;

    const updateScrollState = () => {
      setCanScrollTasteLeft(el.scrollLeft > 0);
      setCanScrollTasteRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };

    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [personalized.tasteMatches.length]);

  return (
    <>
      <Helmet>
        <title>PlayCrew - For You</title>
        <meta
          name="description"
          content="Genre-based recommendations personalized from your library."
        />
      </Helmet>

      <main className="relative min-h-screen overflow-x-hidden bg-[#020408] pb-18 pt-16 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[520px] w-full bg-linear-to-b from-cyan-500/10 via-cyan-400/5 to-transparent" />
          <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute right-0 top-56 h-96 w-96 rounded-full bg-blue-500/8 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-[1800px]">
          <header className="mb-6 px-4 pt-2 sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
              Personalized Discovery
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
              For You
            </h1>
          </header>

          <section className="mb-10 px-2 sm:px-4 lg:px-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/35 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <AnimatePresence mode="wait">
                {personalized.hero.length === 0 ? (
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
                      trending={personalized.hero}
                      user={user}
                      savedGames={savedGames}
                      setSavedGames={setSavedGames}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <div className="mb-6 rounded-2xl border border-cyan-300/20 bg-zinc-900/40 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-100 sm:text-base">
                    Top Taste Matches
                  </h2>
                  <span className="text-[10px] text-zinc-400">
                    Estimated genre-fit score
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      tasteRowRef.current?.scrollBy({ left: -420, behavior: "smooth" })
                    }
                    disabled={!canScrollTasteLeft}
                    className={`rounded-full border p-2 transition ${
                      canScrollTasteLeft
                        ? "border-white/20 bg-black/35 text-white hover:border-cyan-300/50 hover:bg-cyan-500/15"
                        : "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
                    }`}
                    aria-label="Scroll taste matches left"
                  >
                    <FiArrowLeft />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      tasteRowRef.current?.scrollBy({ left: 420, behavior: "smooth" })
                    }
                    disabled={!canScrollTasteRight}
                    className={`rounded-full border p-2 transition ${
                      canScrollTasteRight
                        ? "border-white/20 bg-black/35 text-white hover:border-cyan-300/50 hover:bg-cyan-500/15"
                        : "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
                    }`}
                    aria-label="Scroll taste matches right"
                  >
                    <FiArrowRight />
                  </button>
                </div>
              </div>
              <div
                ref={tasteRowRef}
                className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide"
              >
              {personalized.tasteMatches.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-zinc-300">
                  No strong matches yet.
                </div>
              ) : (
                personalized.tasteMatches.map((item) => {
                  const game = item.game;
                  const cover = game?.cover?.url
                    ? `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`
                    : "/placeholder-game.jpg";
                  return (
                    <Link
                      key={`taste-${game.id}`}
                      href={`/game/${game.id}`}
                      className="group relative h-[210px] w-[145px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    >
                      <img
                        src={cover}
                        alt={game.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/25 to-transparent" />
                      <div className="absolute left-2 top-2 rounded-full border border-cyan-300/40 bg-black/70 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                        {item.percent}% Match
                      </div>
                      <div className="absolute inset-x-2 bottom-2">
                        <p className="line-clamp-2 text-xs font-semibold text-white">
                          {game.name}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-18 px-4 sm:px-6 lg:px-8">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <SkeletonRow />
                </div>
              ))}
            </div>
          ) : personalized.sections.length === 0 ? (
            <div className="px-4 pb-20 text-center sm:px-6 lg:px-8">
              <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-zinc-900/45 p-6">
                <p className="text-sm text-zinc-200">
                  Add and rate more games to build your top genres and unlock
                  personalized rows.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 px-4 sm:px-6 lg:px-8">
              {personalized.sections.map((section, i) => (
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
