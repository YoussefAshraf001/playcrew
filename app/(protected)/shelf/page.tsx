"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { toast } from "react-hot-toast";
import { useUser } from "@/app/context/UserContext";
import GamePickerModal from "@/app/components/GamePickerModal";
import { IoMdTrophy } from "react-icons/io";
import { motion } from "framer-motion";
import LoadingSpinner from "../explore/loading";
import { Helmet } from "react-helmet-async";

interface ShelfGame {
  igdbId: number;
  name: string;
  cover: string;
  rating: number;
  releaseDate: Date | null;
}

/* ----------------------------- */
/* Shelf configuration */
/* ----------------------------- */

const CATEGORIES = [
  "Best of All Time",
  "Best Story",
  "Best Gameplay",
  "Best Soundtrack",
  "Best Voice Acting",
  "Best Graphics",
  "Best Art Direction",
  "Best World Design",
  // "Most Played",
  "Most Anticipated",
] as const;

type Category = (typeof CATEGORIES)[number];

export default function Shelf() {
  const { user, profile, loading: userLoading } = useUser();

  const [gamesByCategory, setGamesByCategory] = useState<
    Record<Category | "Most Anticipated", ShelfGame | null>
  >(
    () =>
      Object.fromEntries(
        [...CATEGORIES, "Most Anticipated"].map((c) => [c, null]),
      ) as Record<Category | "Most Anticipated", ShelfGame | null>,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<
    Category | "Most Anticipated" | null
  >(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  /* ----------------------------- */
  /* Load shelf from Firestore */
  /* ----------------------------- */

  useEffect(() => {
    if (!user) return;

    const loadShelf = async () => {
      try {
        const snap = await getDocs(
          collection(db, "users", user.uid, "personalPicks"),
        );

        const loaded = Object.fromEntries(
          [...CATEGORIES, "Most Anticipated"].map((c) => [c, null]),
        ) as Record<Category | "Most Anticipated", ShelfGame | null>;

        snap.forEach((docSnap) => {
          const category = docSnap.id as Category | "Most Anticipated";
          const data = docSnap.data();

          if (data?.igdbId && data?.name && data?.cover) {
            loaded[category] = {
              igdbId: data.igdbId,
              name: data.name,
              cover: data.cover,
              rating: data.rating ?? 0,
              releaseDate: data.releaseDate ?? null,
            };
          }
        });

        setGamesByCategory(loaded);
      } catch (err) {
        toast.error("Failed to load shelf");
      }
    };

    loadShelf();
  }, [user]);

  /* ----------------------------- */
  /* Actions */
  /* ----------------------------- */

  const openModal = (category: Category | "Most Anticipated") => {
    setCurrentCategory(category);
    setModalOpen(true);
  };

  const pickGame = async (game: ShelfGame) => {
    if (!user || !currentCategory) return;

    try {
      await setDoc(
        doc(db, "users", user.uid, "personalPicks", currentCategory),
        {
          igdbId: game.igdbId,
          name: game.name,
          cover: game.cover,
        },
        { merge: true },
      );

      setGamesByCategory((p) => ({ ...p, [currentCategory]: game }));
      toast.success(`${game.name} added`);
    } catch (err) {
      toast.error("Failed to save game");
    } finally {
      setModalOpen(false);
      setCurrentCategory(null);
    }
  };

  const removeGame = async (category: Category | "Most Anticipated") => {
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "personalPicks", category), {
        igdbId: null,
        name: null,
        cover: null,
      });

      setGamesByCategory((p) => ({ ...p, [category]: null }));
      toast.success("Removed");
    } catch (err) {
      toast.error("Failed to remove game");
    }
  };

  function GameImage({ src, alt }: { src: string; alt: string }) {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      setLoaded(false);
    }, [src]);

    return (
      <div className="relative w-full h-full overflow-hidden rounded-xl">
        {/* Skeleton */}
        {!loaded && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
        )}

        {/* Image */}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`
          w-full h-full object-cover
          transition-opacity duration-500
          ${loaded ? "opacity-100" : "opacity-0"}
        `}
        />
      </div>
    );
  }

  /* ----------------------------- */
  /* UI */
  /* ----------------------------- */

  const renderSlot = (
    category: Category | "Most Anticipated",
    large = false,
  ) => {
    const game = gamesByCategory[category];

    return (
      <motion.div
        key={category}
        onClick={() => openModal(category)}
        className={`
          relative cursor-pointer overflow-hidden rounded-xl
          ${large ? "w-64 h-96" : "w-50 h-65"}

          bg-zinc-900/80 backdrop-blur
          transition hover:scale-[1.03] group
          ${
            game
              ? "border border-white/10"
              : "border-2 border-dashed border-white/30"
          }
          hover:shadow-[0_0_40px_#ffffff]
          easre-in-out duration-400
          hover:scale-[1.04]
        `}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Remove button — hover only */}
        {game && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeGame(category);
            }}
            className="
              absolute top-2 right-2 z-20
              w-6 h-6 rounded-full
              bg-red-500 text-white text-sm
              opacity-0 group-hover:opacity-100
              transition
              hover:bg-red-400
            "
          >
            ×
          </button>
        )}

        {/* Content */}
        {game ? (
          <>
            <div className="relative w-full h-full overflow-hidden rounded-xl">
              {/* Skeleton */}
              {!imgLoaded && (
                <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
              )}

              {/* Image */}
              <GameImage src={game.cover} alt={game.name} />
            </div>

            {/* Game name — hover only */}
            {/* <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-center px-4 text-white text-lg font-semibold opacity-0 group-hover:opacity-100 transition">
              {game.name}
            </div> */}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-white/60">
            <span className="text-5xl font-bold">+</span>
            <span className="text-sm mt-1">Add Game</span>
          </div>
        )}

        {/* Category + trophy — always visible, bottom centered */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm font-semibold text-white bg-black/60 px-3 py-1 rounded-full pointer-events-none">
          <IoMdTrophy className="text-yellow-400" />
          <span className="whitespace-nowrap">{category}</span>
        </div>
      </motion.div>
    );
  };

  if (userLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Helmet>
        <title>PlayCrew - Gaming Shelf</title>
      </Helmet>

      <div
        className="relative min-h-screen bg-cover bg-center p-8 pt-20 lg:pt-25"
        style={{ backgroundImage: "url('/shelf-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 flex flex-col items-center gap-10">
          {/* Ribbon Title */}
          <div className="relative flex justify-center w-full">
            <span className="relative inline-block px-6 py-2 text-xl font-bold text-white uppercase bg-yellow-600 before:absolute before:-left-3 before:top-0 before:w-3 before:h-full before:bg-yellow-700 before:skew-x-[-20deg] after:absolute after:-right-3 after:top-0 after:w-3 after:h-full after:bg-yellow-700 after:skew-x-20 shadow-lg">
              {/* {profile?.username ? `${profile.username}'s` : "My"} Hall of Games */}
              {profile?.username ? `${profile.username}'s` : "My"} Gaming Hall
              of Fame
            </span>
            {/* <span className="relative inline-block px-6 py-2 text-xl font-bold text-white uppercase bg-yellow-600 before:absolute before:-left-3 before:top-0 before:w-3 before:h-full before:bg-yellow-700 before:skew-x-[-20deg] after:absolute after:-right-3 after:top-0 after:w-3 after:h-full after:bg-yellow-700 after:skew-x-20 shadow-lg">
            MY GAMES OF THE YEAR
          </span> */}
          </div>

          {/* Top: Best of All Time */}
          <div className="flex justify-center w-full">
            {renderSlot("Best of All Time", true)}
          </div>
          <hr className="text-gray-500 w-[50%]" />

          {/* Grid: Other categories */}
          <div
            className="
  grid
grid-cols-1
md:grid-cols-2
lg:grid-cols-4
xl:grid-cols-6
2xl:grid-cols-8
 gap-6
  w-full
  place-items-center
"
          >
            {CATEGORIES.filter((c) => c !== "Best of All Time").map((c) =>
              renderSlot(c),
            )}
          </div>

          {/* Bottom: Most Anticipated */}
          {/* {renderSlot("Most Anticipated", true)} */}
        </div>

        {/* Game Picker Modal */}
        {modalOpen && currentCategory && (
          <GamePickerModal
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            currentCategory={currentCategory}
            pickGame={pickGame}
          />
        )}
      </div>
    </>
  );
}
