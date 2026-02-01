"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FiHeart } from "react-icons/fi";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { db } from "../lib/firebase";
import { FaHeart, FaMusic, FaStar } from "react-icons/fa";
import { IoMdAdd, IoMdCheckmarkCircle } from "react-icons/io";
import { IoCloseCircle } from "react-icons/io5";
import Link from "next/link";
import { GoArrowRight } from "react-icons/go";
import { useMusic } from "../context/MusicContext";

export default function GameModal({
  game,
  user,
  savedGames,
  onClose,
}: {
  game: any;
  savedGames: Record<string, any>;
  setSavedGames: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  user?: any;
  onClose: () => void;
}) {
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { pause, isActuallyPlaying } = useMusic();
  const modalHasTakenAudioRef = useRef(false);

  /* ---------------------------
     Scroll Lock
  ---------------------------- */
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  useEffect(() => {
    if (!modalHasTakenAudioRef.current && isActuallyPlaying) {
      pause();
      modalHasTakenAudioRef.current = true;

      toast("Music paused to focus on the trailer", {
        id: "hero-audio-focus",
        icon: <FaMusic />,
      });
    }

    return () => {
      // IMPORTANT: do NOT auto-resume music here
      modalHasTakenAudioRef.current = false;
    };
  }, []);

  const videoId = game.videos?.[0]?.video_id;
  const releaseDate =
    typeof game.first_release_date === "number"
      ? new Date(game.first_release_date * 1000).toLocaleDateString()
      : "Unknown";

  const genres = game.genres?.map((g: any) => g.name) || [];
  const cover =
    game.cover?.url &&
    `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`;

  const gameId = game?.id?.toString();
  const saved = savedGames?.[gameId];
  const exists = Boolean(saved);

  const text = game.storyline || game.summary || "No Description Available.";
  const MAX_LENGTH = 220;

  const isLong = text.length > MAX_LENGTH;
  const preview = isLong ? text.slice(0, MAX_LENGTH) + "…" : text;

  /* ---------------------------
     Actions
  ---------------------------- */
  const handleAdd = async () => {
    if (!user || !game) return;
    console.log("user", user);
    setLoadingAdd(true);

    // Normalize genres
    const genres = Array.isArray(game.genres)
      ? game.genres
          .map((g: any) => (typeof g === "object" ? g.name : g))
          .filter(Boolean)
      : [];

    // Normalize platforms
    const platforms = Array.isArray(game.platforms)
      ? game.platforms
          .map((p: any) => p?.platform?.name || p?.name)
          .filter(Boolean)
      : [];

    // Normalize release date
    const releaseDate =
      typeof game.first_release_date === "number"
        ? new Date(game.first_release_date * 1000)
        : null;

    // Resolve cover
    let coverUrl = "/placeholder-game.jpg";

    if (game.cover) {
      if (typeof game.cover === "string") {
        coverUrl = game.cover.startsWith("http")
          ? game.cover
          : `https:${game.cover}`;
      } else if (game.cover.url) {
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`;
      }
    } else if (game.background_image) {
      coverUrl = game.background_image;
    }

    const payload = {
      name: game.name,

      igdb: {
        id: game.id,
        name: game.name,
        cover: coverUrl,
        rating: game.rating || 0,
        genres,
        platforms,
        releaseDate,
      },

      my_rating: null,
      playtime: 0,
      progress: 0,
      notes: "",

      status: "Want To Play",
      favorite: false,

      categoryRatings: null,

      lastUpdated: serverTimestamp(),
    };

    await setDoc(
      doc(db, "users", user.uid, "games_igdb", game.id.toString()),
      payload,
      { merge: true },
    );

    setLoadingAdd(false);
    toast.success("Added to library");
  };

  const toggleFavorite = async () => {
    if (!user || !gameId || !saved) return;

    setLoadingFav(true);

    const updated = !saved.favorite;

    try {
      await setDoc(
        doc(db, "users", user.uid, "games_igdb", gameId),
        {
          favorite: updated,
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );

      // ✅ TOAST FEEDBACK
      if (updated) {
        toast(`${game.name} Added to favorites`, {
          icon: "❤️",
        });
      } else {
        toast(`${game.name} Removed from favorites`, {
          icon: "💔",
        });
      }
    } catch (err) {
      toast.error("Failed to update favorite");
    } finally {
      setLoadingFav(false);
    }
  };

  const truncate = (text: string, length = 300) => {
    if (!text) return "";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  if (!game) return null;

  /* ---------------------------
     Render
  ---------------------------- */
  return (
    <>
      {/* BACKDROP */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* MODAL */}
      <motion.div
        className="
          fixed top-20 left-1/2 z-50
          w-[95vw] sm:w-[90vw] md:w-[720px] lg:w-[860px]
          -translate-x-1/2
          bg-zinc-950 rounded-t-2xl
          max-h-[92vh] overflow-y-auto
        "
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "120%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HERO */}
        <div className="relative h-[300px] bg-black">
          {videoId ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1`}
              allow="autoplay; fullscreen"
            />
          ) : (
            <img src={cover} className="w-full h-full object-cover" />
          )}

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full cursor-pointer ease-in-out transition-all duration-300 hover:scale-105"
          >
            <IoCloseCircle size={30} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT */}
          <div className="md:col-span-2 space-y-5">
            {/* TITLE + ACTION */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-bold leading-tight tracking-tight">
                {game.name}
              </h2>

              <Link href={`/game/${game.id}`} prefetch={false}>
                <button
                  className="
          inline-flex items-center gap-2
          px-4 py-1 rounded-full
          bg-white/10 hover:bg-white/20
          text-sm font-semibold
          transition-all duration-200
          hover:scale-105 cursor-pointer
        "
                >
                  Go to Game Page
                  <GoArrowRight size={20} className="text-base" />
                </button>
              </Link>
            </div>

            {/* GENRES */}
            <div className="flex flex-wrap gap-2">
              {genres.map((g: string) => (
                <span
                  key={g}
                  className="
          px-3 py-1 text-xs font-medium
          rounded-full
          bg-white/10 text-white/80
          backdrop-blur
        "
                >
                  {g}
                </span>
              ))}
            </div>

            {/* SUMMARY */}
            <div className="relative space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-linear-to-b from-cyan-400 to-blue-500" />
                <h2 className="text-lg font-semibold tracking-wide text-white">
                  Summary
                </h2>
              </div>

              {/* Text */}
              <div className="relative">
                <p className="text-sm leading-relaxed text-white/80 line-clamp-7">
                  {text}
                </p>

                {/* Fade-out overlay */}
                {text.length > 460 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-linear-to-t from-zinc-950 to-transparent" />
                )}
              </div>

              {/* Read More */}
              {text.length > 460 && (
                <button
                  onClick={() => setAboutOpen(true)}
                  className="group cursor-pointer inline-flex items-center gap-1 text-cyan-300 text-sm font-medium transition-all duration-300 hover:text-cyan-200"
                >
                  <span className="relative">
                    Read more
                    <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-cyan-400 transition-all duration-300 group-hover:w-full " />
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <img src={cover} className="rounded-xl" />

            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Rating</span>
                <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                  {typeof game.rating === "number" ? (
                    <>
                      <FaStar />
                      {Math.round(game.rating)}/100
                    </>
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-white/60">Release</span>
                <span>{releaseDate}</span>
              </div>
            </div>

            {/* ACTIONS */}
            {!exists ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95, rotateX: 15 }}
                onClick={handleAdd}
                disabled={loadingAdd}
                className="
                  w-full py-2 rounded-lg
                  bg-cyan-500 hover:bg-cyan-400 opacity-80
                  text-black font-semibold cursor-pointer ease-in-out transition-all duration-300 hover:opacity-100
                "
              >
                {loadingAdd ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                  </>
                ) : (
                  <div className="flex justify-center items-center gap-2">
                    <IoMdAdd size={22} />
                    Added to Want To Play
                  </div>
                )}
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="w-full py-2 bg-green-600 rounded-lg flex items-center justify-center gap-2"
                  onClick={() => {
                    toast.success(`${game.name} is already being tracked`);
                  }}
                >
                  <IoMdCheckmarkCircle />
                  {saved.status}
                </motion.button>

                <motion.button
                  disabled={loadingFav}
                  whileHover={!loadingFav ? { scale: 1.1 } : {}}
                  onClick={toggleFavorite}
                  className={`w-full py-2 rounded-lg transition cursor-pointer ${
                    saved?.favorite
                      ? "bg-red-600 text-white"
                      : "bg-white/10 hover:bg-white/20"
                  } ${loadingFav ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {loadingFav ? (
                      <div className="py-0.4">
                        <span className="loading loading-spinner loading-xs" />
                      </div>
                    ) : saved?.favorite ? (
                      <>
                        <FaHeart />
                        Favorited
                      </>
                    ) : (
                      <>
                        <FiHeart />
                        Add to Favorites
                      </>
                    )}
                  </div>
                </motion.button>
              </>
            )}

            <AnimatePresence>
              {aboutOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    key="backdrop"
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-999"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => setAboutOpen(false)} // click outside to close
                  />

                  {/* Modal Content */}
                  <motion.div
                    key="modal"
                    className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto bg-white/10 border border-white/20 rounded-2xl p-6 max-w-3xl w-full z-1000 shadow-2xl"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 120,
                      damping: 16,
                    }}
                  >
                    <p className="text-white/80 text-base leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                      {game.storyline || game.summary}
                    </p>

                    <button
                      onClick={() => setAboutOpen(false)}
                      className="absolute top-3 right-3 text-white/70 hover:text-white text-2xl"
                    >
                      ✕
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
}
