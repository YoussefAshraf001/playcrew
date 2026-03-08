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
import { IoCloseCircle } from "react-icons/io5";

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
  "Best Immersion",
  "Best World Design",
  "Most Anticipated",
  "Most Underrated",
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

function FadeInImage({
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800/70" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${imgClassName || "h-full w-full object-contain"} transition-opacity duration-500 ${
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
  const [introAwardLoaded, setIntroAwardLoaded] = useState(false);

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
    if (!introAwardLoaded) return;

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
  }, [introAwardLoaded]);

  const filledCount = useMemo(
    () => Object.values(gamesByCategory).filter(Boolean).length,
    [gamesByCategory],
  );
  const nomineeCategories = useMemo(
    () => CATEGORIES.filter((c) => c !== "Best of All Time"),
    [],
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
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="group relative w-full overflow-hidden rounded-2xl border border-amber-200/25 bg-[#08090d] text-left transition-all duration-300 hover:border-amber-200/60 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_16px_36px_rgba(0,0,0,0.38)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_26%,rgba(0,0,0,0.2)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-amber-100/10 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />
        <div className="pointer-events-none absolute inset-x-3 bottom-2 h-2 rounded-full bg-black/40 blur-sm" />

        <div className="relative z-10 flex h-full min-h-[120px] items-center gap-3 p-3">
          <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-xl border border-amber-200/25 bg-zinc-900/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-transform duration-300 group-hover:scale-[1.05]">
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.45)_100%)]" />
            {game ? (
              <Poster src={game.cover} alt={game.name} />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl text-zinc-500">
                +
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex rounded-md border border-amber-200/20 bg-amber-300/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100/90 wrap-break-words">
              {category}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white/95 wrap-break-word">
              {game ? game.name : "Select a nominee"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              Award Winner
            </p>
          </div>
        </div>

        {game && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeGame(category);
            }}
            aria-label={`Remove ${category}`}
            className="group absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center gap-0 overflow-hidden rounded-full border border-white/20 bg-black/60 px-0 text-zinc-100 opacity-0 pointer-events-none shadow-lg backdrop-blur-sm transition-all duration-300 ease-out group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:w-28 hover:gap-1.5 hover:rounded-xl hover:border-red-300/60 hover:bg-red-500/25 hover:px-3 hover:text-red-100 focus-visible:w-28 focus-visible:gap-1.5 focus-visible:rounded-xl focus-visible:px-3 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
          >
            <IoCloseCircle size={18} className="shrink-0" />
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
        <meta
          name="description"
          content="Build and manage your personal game awards shelf, including category winners and all-time picks."
        />
      </Helmet>

      <main className="relative min-h-screen overflow-y-auto bg-[#090704] px-4 pb-6 pt-20 sm:px-6 lg:px-8 xl:h-svh xl:overflow-hidden xl:pb-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(251,191,36,0.26),transparent_42%),radial-gradient(ellipse_at_0%_35%,rgba(245,158,11,0.14),transparent_42%),radial-gradient(ellipse_at_100%_35%,rgba(217,119,6,0.12),transparent_42%),linear-gradient(180deg,rgba(10,8,5,0.92),rgba(6,5,3,0.98))]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_36px)] opacity-35" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.2),rgba(180,83,9,0.1)_46%,transparent_72%)] blur-2xl" />

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
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,251,235,0.98),rgba(251,191,36,0.38)_24%,rgba(245,158,11,0.2)_42%,transparent_64%)]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.5 : 0.02,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08 }}
                className="absolute left-1/2 top-[12%] h-[56%] w-0.5 -translate-x-1/2 bg-linear-to-b from-transparent via-amber-100 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.015 }}
                className="absolute left-[47%] top-[16%] h-[42%] w-0.5 bg-linear-to-b from-transparent via-amber-50 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.02 }}
                className="absolute left-[53%] top-[18%] h-[40%] w-0.5 bg-linear-to-b from-transparent via-amber-50 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{
                  scale: 2.1,
                  opacity: 0.2,
                  filter: "brightness(0.75)",
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  filter: flickerOn
                    ? "brightness(1.95) drop-shadow(0 0 42px rgba(251,191,36,0.92))"
                    : "brightness(1.05) drop-shadow(0 0 28px rgba(245,158,11,0.55))",
                }}
                transition={{
                  scale: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.55 },
                  filter: { duration: 0.08 },
                }}
                className="relative w-[260px] sm:w-[340px] md:w-[430px] select-none"
              >
                {!introAwardLoaded && (
                  <div className="absolute inset-0 animate-pulse rounded-full bg-amber-100/10" />
                )}
                <img
                  src="/Award.png"
                  alt="Awards intro"
                  onLoad={() => setIntroAwardLoaded(true)}
                  onError={() => setIntroAwardLoaded(true)}
                  className={`h-full w-full object-contain transition-opacity duration-500 ${
                    introAwardLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="relative z-10 mx-auto flex w-full max-w-[1550px] flex-col gap-3 cursor-default xl:h-full xl:min-h-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 10 : 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <header className="shrink-0 overflow-hidden rounded-2xl border border-amber-200/25 bg-zinc-950/70 backdrop-blur-xl">
            <div className="bg-linear-to-r from-amber-500/28 via-yellow-300/10 to-orange-500/22 px-4 py-1.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/85">
                PlayCrew Awards
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
              <div className="max-w-[900px]">
                <div className="flex items-start gap-4">
                  <FadeInImage
                    src="/Title-Award.png"
                    alt="Hall of Fame award"
                    className="mt-0.5 h-14 w-14 shrink-0 sm:h-16 sm:w-16"
                    imgClassName="h-full w-full object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.45)]"
                  />
                  <div>
                    <h1 className="capitalize text-xl font-black text-white sm:text-2xl lg:text-3xl">
                      {profile?.username ? `${profile.username}'s` : "My"} Hall
                      of Fame
                    </h1>
                    <p className="mt-1 text-sm text-zinc-300 lg:text-[15px]">
                      Pick winners across categories and build your personal
                      game awards.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200/25 bg-black/35 px-3 py-2 text-right shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Locked In
                </p>
                <p className="text-xl font-bold text-amber-300">
                  {filledCount}
                  <span className="pl-1 text-zinc-500">
                    / {CATEGORIES.length}
                  </span>
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)] xl:flex-1 xl:min-h-0">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col overflow-hidden rounded-2xl border border-amber-200/25 bg-zinc-950/76 backdrop-blur-xl xl:min-h-0"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-100/85">
                  Best of All Time
                </p>
                <p className="rounded-full border border-amber-200/35 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100">
                  #<span className="pl-0.5">1</span>
                </p>
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
                className="group relative block w-full p-3"
              >
                <div className="relative mx-auto h-[min(48vh,420px)] w-full max-w-[390px] overflow-hidden rounded-2xl border border-amber-200/28 bg-[#05080d] shadow-[0_0_0_1px_rgba(251,191,36,0.16)] transition-all duration-300 group-hover:border-amber-200/60 group-hover:shadow-[0_0_0_1px_rgba(251,191,36,0.28),0_18px_40px_rgba(0,0,0,0.45)] sm:h-[min(52vh,500px)] xl:h-[clamp(300px,52vh,620px)]">
                  <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_58%)]" />
                  <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,rgba(0,0,0,0.24)_100%)]" />
                  <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-r from-transparent via-amber-100/12 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />
                  <div className="absolute inset-0 rounded-2xl">
                    {bestCover ? (
                      <Poster
                        src={bestCover}
                        alt={bestGame?.name || "Best game"}
                        imgClassName="object-cover bg-[#05080d]"
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
                    aria-label="Remove Best of All Time game"
                    className="group absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center gap-0 overflow-hidden rounded-full border border-white/20 bg-black/60 px-0 text-zinc-100 opacity-0 pointer-events-none shadow-lg backdrop-blur-sm transition-all duration-300 ease-out group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:w-28 hover:gap-1.5 hover:rounded-xl hover:border-red-300/60 hover:bg-red-500/25 hover:px-3 hover:text-red-100 focus-visible:w-28 focus-visible:gap-1.5 focus-visible:rounded-xl focus-visible:px-3 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                  >
                    <IoCloseCircle size={18} className="shrink-0" />
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
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">
                  Award Categories
                </p>
                <span className="text-xs text-zinc-500">
                  Tap any card to pick a game
                </span>
              </div>

              <div className="grid gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {nomineeCategories.map((category) =>
                  renderNomineeCard(category),
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
            theme="shelf"
          />
        )}
      </main>
    </>
  );
}
