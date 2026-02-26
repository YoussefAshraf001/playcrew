"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
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
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        onLoad={() => setLoadedSrc(src)}
        className={`h-full w-full ${imgClassName || "object-cover"} transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default function ShelfPage() {
  const { user, profile, loading: userLoading } = useUser();
  const [showIntro, setShowIntro] = useState(true);
  const [flickerOn, setFlickerOn] = useState(false);

  const initialShelf = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c, null])) as ShelfMap,
    [],
  );

  const [gamesByCategory, setGamesByCategory] =
    useState<ShelfMap>(initialShelf);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (modalOpen || !currentCategory) return;
    const id = window.setTimeout(() => setCurrentCategory(null), 220);
    return () => window.clearTimeout(id);
  }, [modalOpen, currentCategory]);

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

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setFlickerOn(true), 1050),
      window.setTimeout(() => setFlickerOn(false), 1150),
      window.setTimeout(() => setFlickerOn(true), 1230),
      window.setTimeout(() => setFlickerOn(false), 1300),
      window.setTimeout(() => setFlickerOn(true), 1380),
      window.setTimeout(() => setFlickerOn(false), 1460),
      window.setTimeout(() => setShowIntro(false), 1800),
    ];

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

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
        className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#05080d] text-left transition-all duration-300 hover:border-teal-300/55 hover:shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_12px_30px_rgba(20,184,166,0.22)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-cyan-100/10 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />

        <div className="relative z-10 flex min-h-[140px] items-center gap-4 p-4">
          <div className="relative h-30 w-22 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.03]">
            {game ? (
              <Poster src={game.cover} alt={game.name} />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl text-zinc-500">
                +
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-[0.16em] text-teal-200/85">
              {category}
            </p>
            <p className="mt-2 line-clamp-2 text-base font-semibold text-white">
              {game ? game.name : "Select a nominee"}
            </p>
          </div>
        </div>

        {game && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeGame(category);
            }}
            className="absolute right-3 top-3 z-20 h-7 w-7 rounded-full border border-red-300/35 bg-black/75 text-red-300 opacity-0 transition group-hover:opacity-100"
            aria-label={`Remove ${category}`}
          >
            x
          </button>
        )}
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

      <main className="relative min-h-screen overflow-y-auto bg-[#07060a] px-4 pb-8 pt-20 sm:px-6 lg:px-8 xl:h-svh xl:overflow-hidden xl:pb-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(45,212,191,0.3),transparent_42%),radial-gradient(ellipse_at_0%_35%,rgba(20,184,166,0.14),transparent_42%),radial-gradient(ellipse_at_100%_35%,rgba(6,182,212,0.14),transparent_42%),linear-gradient(180deg,rgba(7,10,14,0.9),rgba(4,7,10,0.98))]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_36px)] opacity-35" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(94,234,212,0.2),rgba(56,189,248,0.08)_46%,transparent_72%)] blur-2xl" />

        <AnimatePresence>
          {showIntro && (
            <motion.div
              key="shelf-intro"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/72 backdrop-blur-[1.5px]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: flickerOn ? 0.75 : 0.08,
                }}
                transition={{ duration: 0.08 }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.95),rgba(125,211,252,0.35)_22%,rgba(6,182,212,0.16)_40%,transparent_62%)]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.5 : 0.02,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08 }}
                className="absolute left-1/2 top-[12%] h-[56%] w-0.5 -translate-x-1/2 bg-linear-to-b from-transparent via-cyan-100 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.015 }}
                className="absolute left-[47%] top-[16%] h-[42%] w-0.5 bg-linear-to-b from-transparent via-white to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.02 }}
                className="absolute left-[53%] top-[18%] h-[40%] w-0.5 bg-linear-to-b from-transparent via-white to-transparent blur-[0.5px]"
              />
              <motion.img
                src="/Award.png"
                alt="Awards intro"
                initial={{
                  scale: 2.1,
                  opacity: 0.2,
                  filter: "brightness(0.75)",
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  filter: flickerOn
                    ? "brightness(1.95) drop-shadow(0 0 42px rgba(125,211,252,0.95))"
                    : "brightness(1.05) drop-shadow(0 0 28px rgba(45,212,191,0.55))",
                }}
                transition={{
                  scale: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.55 },
                  filter: { duration: 0.08 },
                }}
                className="w-[260px] sm:w-[340px] md:w-[430px] select-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-4 cursor-default xl:h-full xl:min-h-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 10 : 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <header className="shrink-0 overflow-hidden rounded-2xl border border-teal-300/20 bg-zinc-950/75 backdrop-blur-xl">
            <div className="bg-linear-to-r from-teal-500/20 via-cyan-300/10 to-emerald-500/20 px-5 py-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-teal-100/85">
                PlayCrew Awards
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
              <div>
                <div className="flex items-start gap-4">
                  <img
                    src="/Title-Award.png"
                    alt="Hall of Fame award"
                    className="mt-0.5 h-16 w-16 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(45,212,191,0.52)] sm:h-20 sm:w-20"
                  />
                  <div>
                    <h1 className="capitalize text-2xl font-bold text-white sm:text-3xl">
                      {profile?.username ? `${profile.username}'s` : "My"} Hall
                      of Fame
                    </h1>
                    <p className="mt-2 text-sm text-zinc-300">
                      Pick winners across categories and build your personal
                      game awards.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-teal-200/20 bg-black/35 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Locked In
                </p>
                <p className="text-2xl font-bold text-teal-300">
                  {filledCount}
                  <span className="pl-1 text-zinc-500">
                    / {CATEGORIES.length}
                  </span>
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)] xl:flex-1 xl:min-h-0">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col overflow-hidden rounded-2xl border border-teal-300/18 bg-zinc-950/75 backdrop-blur-xl xl:min-h-0"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-teal-200/85">
                  Best of All Time
                </p>
                <span className="rounded-full border border-teal-300/30 bg-teal-400/10 px-2.5 py-1 text-[11px] text-teal-200">
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
                <div className="relative mx-auto h-[410px] md:h-[530px] lg:h-[528px] w-full max-w-[400px] overflow-hidden rounded-2xl border border-teal-400/30 bg-[#05080d] shadow-[0_0_0_1px_rgba(45,212,191,0.15)] transition-all duration-300 group-hover:border-teal-300/60 group-hover:shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_14px_34px_rgba(20,184,166,0.28)]">
                  <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-r from-transparent via-cyan-100/10 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />
                  <div className="absolute inset-0 rounded-2xl">
                    {bestCover ? (
                      <Poster
                        src={bestCover}
                        alt={bestGame?.name || "Best game"}
                        imgClassName="object-contain bg-[#05080d]"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-zinc-400">
                        <img
                          src="/Award.png"
                          alt="Award trophy"
                          className="mb-2 h-12 w-12 object-contain opacity-90"
                        />
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
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/72 backdrop-blur-xl xl:min-h-0"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">
                  Award Categories
                </p>
                <span className="text-xs text-zinc-500">
                  Tap any card to pick a game
                </span>
              </div>

              <div className="grid gap-2 p-4 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {CATEGORIES.filter((c) => c !== "Best of All Time").map(
                  (category) => renderNomineeCard(category),
                )}
              </div>
            </motion.section>
          </div>
        </motion.section>

        {currentCategory && (
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
