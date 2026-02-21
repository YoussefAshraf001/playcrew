"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { IoMdTrophy } from "react-icons/io";
import { toast } from "react-hot-toast";

import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import GamePickerModal from "@/app/components/GamePickerModal";
import LoadingSpinner from "../explore/loading";

interface ShelfGame {
  igdbId: number;
  name: string;
  cover: string;
  rating: number;
  releaseDate: Date | null;
}

const CATEGORIES = [
  "Best of All Time",
  "Best Story",
  "Best Gameplay",
  "Best Soundtrack",
  "Best Voice Acting",
  "Best Graphics",
  "Best Art Direction",
  "Best World Design",
  "Most Anticipated",
] as const;

type Category = (typeof CATEGORIES)[number];
type ShelfMap = Record<Category, ShelfGame | null>;

const toOriginalIgdbCover = (url?: string) => {
  if (!url) return url;
  if (!url.includes("igdb.com")) return url;
  return url.replace(/\/t_[^/]+\//, "/t_original/");
};

function Poster({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default function ShelfPage() {
  const { user, profile, loading: userLoading } = useUser();

  const initialShelf = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c, null])) as ShelfMap,
    [],
  );

  const [gamesByCategory, setGamesByCategory] =
    useState<ShelfMap>(initialShelf);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadShelf = async () => {
      try {
        const snap = await getDocs(
          collection(db, "users", user.uid, "personalPicks"),
        );
        const loaded: ShelfMap = { ...initialShelf };

        snap.forEach((d) => {
          const category = d.id as Category;
          if (!CATEGORIES.includes(category)) return;
          const data = d.data();
          if (!data?.igdbId || !data?.name || !data?.cover) return;

          loaded[category] = {
            igdbId: data.igdbId,
            name: data.name,
            cover: data.cover,
            rating: data.rating ?? 0,
            releaseDate: data.releaseDate ?? null,
          };
        });

        setGamesByCategory(loaded);
      } catch {
        toast.error("Failed to load shelf");
      }
    };

    loadShelf();
  }, [user, initialShelf]);

  const filledCount = useMemo(
    () => Object.values(gamesByCategory).filter(Boolean).length,
    [gamesByCategory],
  );

  const openModal = (category: Category) => {
    setCurrentCategory(category);
    setModalOpen(true);
  };

  const pickGame = async (game: ShelfGame) => {
    if (!user || !currentCategory) return;

    const upgradedCover = toOriginalIgdbCover(game.cover) || game.cover;

    try {
      await setDoc(
        doc(db, "users", user.uid, "personalPicks", currentCategory),
        {
          igdbId: game.igdbId,
          name: game.name,
          cover: upgradedCover,
        },
        { merge: true },
      );

      setGamesByCategory((prev) => ({
        ...prev,
        [currentCategory]: {
          ...game,
          cover: upgradedCover,
        },
      }));

      toast.success(`${game.name} added`);
    } catch {
      toast.error("Failed to save game");
    } finally {
      setModalOpen(false);
      setCurrentCategory(null);
    }
  };

  const removeGame = async (category: Category) => {
    if (!user) return;

    try {
      await setDoc(
        doc(db, "users", user.uid, "personalPicks", category),
        {
          igdbId: null,
          name: null,
          cover: null,
        },
        { merge: true },
      );
      setGamesByCategory((prev) => ({ ...prev, [category]: null }));
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove game");
    }
  };

  const renderNomineeCard = (category: Category) => {
    const game = gamesByCategory[category];
    return (
      <motion.div
        key={category}
        onClick={() => openModal(category)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(category);
          }
        }}
        role="button"
        tabIndex={0}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 text-left backdrop-blur-sm"
      >
        <div className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-[conic-gradient(from_0deg,rgba(251,191,36,0),rgba(34,211,238,0.95),rgba(59,130,246,0.85),rgba(251,191,36,0.9),rgba(251,191,36,0))] opacity-0 blur-[1px] transition-opacity duration-300 group-hover:animate-[spin_2.2s_linear_infinite] group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-[1px] rounded-2xl bg-zinc-950/92" />
        <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-amber-300/70 to-transparent opacity-60" />

        <div className="relative z-10 flex min-h-[140px] items-center gap-4 p-4">
          <div className="relative h-30 w-22 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
            {game ? (
              <Poster src={game.cover} alt={game.name} />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl text-zinc-500">
                +
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-[0.16em] text-amber-200/85">
              {category}
            </p>
            <p className="mt-2 line-clamp-2 text-base font-semibold text-white">
              {game ? game.name : "Select a nominee"}
            </p>
          </div>

          {game && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeGame(category);
              }}
              className="h-7 w-7 shrink-0 rounded-full border border-red-300/35 bg-black/70 text-red-300 opacity-0 transition group-hover:opacity-100"
              aria-label={`Remove ${category}`}
            >
              x
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const bestGame = gamesByCategory["Best of All Time"];
  const bestCover = bestGame?.cover
    ? toOriginalIgdbCover(bestGame.cover) || bestGame.cover
    : null;

  if (userLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Helmet>
        <title>PlayCrew - Awards Shelf</title>
      </Helmet>

      <main className="relative min-h-screen overflow-hidden bg-[#07060a] px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(251,191,36,0.33),transparent_42%),radial-gradient(ellipse_at_0%_35%,rgba(245,158,11,0.14),transparent_42%),radial-gradient(ellipse_at_100%_35%,rgba(245,158,11,0.14),transparent_42%),linear-gradient(180deg,rgba(10,8,13,0.88),rgba(5,6,10,0.97))]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_36px)] opacity-35" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,220,130,0.22),rgba(255,220,130,0.08)_46%,transparent_72%)] blur-2xl" />

        <section className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <header className="overflow-hidden rounded-2xl border border-amber-300/20 bg-zinc-950/75 backdrop-blur-xl">
            <div className="bg-linear-to-r from-amber-500/20 via-yellow-300/10 to-amber-500/20 px-5 py-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/85">
                PlayCrew Awards
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
              <div>
                <h1 className="capitalize text-2xl font-bold text-white sm:text-3xl">
                  {profile?.username ? `${profile.username}'s` : "My"} Hall of
                  Fame
                </h1>
                <p className="mt-2 text-sm text-zinc-300">
                  Pick winners across categories and build your personal game
                  awards.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/20 bg-black/35 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Locked In
                </p>
                <p className="text-2xl font-bold text-amber-300">
                  {filledCount}
                  <span className="pl-1 text-zinc-500">
                    / {CATEGORIES.length}
                  </span>
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-amber-300/18 bg-zinc-950/75 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/85">
                  Best of All Time
                </p>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                  #1
                </span>
              </div>

              <div
                onClick={() => openModal("Best of All Time")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openModal("Best of All Time");
                  }
                }}
                role="button"
                tabIndex={0}
                className="group relative block w-full p-4"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-black">
                  <div className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-[conic-gradient(from_0deg,rgba(251,191,36,0),rgba(34,211,238,0.95),rgba(99,102,241,0.88),rgba(251,191,36,0.9),rgba(251,191,36,0))] opacity-0 blur-[1px] transition-opacity duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:opacity-100" />
                  <div className="absolute inset-[1px] rounded-2xl border border-cyan-400/35 bg-black shadow-[0_0_0_1px_rgba(34,211,238,0.15)]">
                    {bestCover ? (
                      <Poster
                        src={bestCover}
                        alt={bestGame?.name || "Best game"}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-zinc-400">
                        <IoMdTrophy className="mb-2 text-4xl text-amber-300/80" />
                        <span className="text-sm uppercase tracking-[0.18em]">
                          Choose Winner
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {bestGame && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGame("Best of All Time");
                    }}
                    className="absolute right-7 top-7 z-20 h-8 w-8 rounded-full border border-red-300/35 bg-black/75 text-red-300 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove best game"
                  >
                    x
                  </button>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/72 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">
                  Award Categories
                </p>
                <span className="text-xs text-zinc-500">
                  Tap any card to pick a game
                </span>
              </div>

              <div className="grid gap-2 p-4 md:grid-cols-2">
                {CATEGORIES.filter((c) => c !== "Best of All Time").map(
                  (category) => renderNomineeCard(category),
                )}
              </div>
            </motion.section>
          </div>
        </section>

        {modalOpen && currentCategory && (
          <GamePickerModal
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            currentCategory={currentCategory}
            pickGame={pickGame}
          />
        )}
      </main>
    </>
  );
}
