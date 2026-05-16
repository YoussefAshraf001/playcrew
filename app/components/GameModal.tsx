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
    `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`;

  const gameId = game?.id?.toString();
  const saved = savedGames?.[gameId];
  const exists = Boolean(saved);

  const text = game.storyline || game.summary || "No Description Available.";
  const MAX_LENGTH = 220;

  const isLong = text.length > MAX_LENGTH;
  const preview = isLong ? text.slice(0, MAX_LENGTH) + "â€¦" : text;

  /* ---------------------------
     Actions
  ---------------------------- */
  const handleAdd = async () => {
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    if (!game) return;
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
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`;
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
    toast.success(
      <span>
        <span className="font-bold pr-1">{game.name}</span>
        <span className="text-black">was added to your library</span>
      </span>,
    );
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    if (!gameId || !saved) return;

    setLoadingFav(true);

    const updated = !saved.favorite;

    try {
      await setDoc(
        doc(db, "users", user.uid, "games_igdb", gameId),
        {
          favorite: updated,
        },
        { merge: true },
      );

      // âœ… TOAST FEEDBACK
      if (updated) {
        toast(
          <span>
            <span className="font-bold">{game.name}</span>
            <span className="text-black"> added to favorites</span>
          </span>,
          {
            icon: "â¤ï¸",
          },
        );
      } else {
        toast(
          <span>
            <span className="font-bold">{game.name}</span>
            <span className="text-black"> removed from favorites</span>
          </span>,
          {
            icon: "ðŸ’”",
          },
        );
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
          fixed left-1/2 top-[7vh] z-50
          w-[95vw] sm:w-[90vw] md:w-[760px] lg:w-[920px]
          -translate-x-1/2
          flex h-[88vh] flex-col overflow-hidden
          rounded-2xl border border-white/10
          bg-zinc-950/98 shadow-[0_32px_80px_rgba(0,0,0,0.55)]
        "
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HERO */}
        <div className="relative h-[220px] shrink-0 bg-black sm:h-[250px]">
          {videoId ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1`}
              allow="autoplay; fullscreen"
            />
          ) : (
            <img
              src={cover || "/placeholder-game.jpg"}
              alt={game.name}
              className="w-full h-full object-cover"
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-zinc-850 via-zinc-950/35 to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white transition hover:scale-105 hover:bg-black/70"
          >
            <IoCloseCircle size={30} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden p-5 md:grid-cols-3 md:p-6">
          {/* LEFT */}
          <div className="min-h-0 space-y-5 md:col-span-2">
            {/* TITLE + ACTION */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
                {game.name}
              </h2>

              <Link href={`/game/${game.id}`} prefetch={false}>
                <button
                  className="
          inline-flex cursor-pointer items-center gap-2 rounded-full
          border border-cyan-300/40 bg-cyan-500/10 px-4 py-1.5
          text-sm font-semibold text-cyan-100
          transition-all duration-200 hover:scale-105 hover:bg-cyan-500/20
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
          rounded-full border border-white/12
          bg-white/6 px-3 py-1 text-xs font-medium text-white/85
        "
                >
                  {g}
                </span>
              ))}
            </div>

            {/* SUMMARY */}
            <div className="relative flex min-h-0 flex-col space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-linear-to-b from-cyan-400 to-blue-500" />
                <h2 className="text-lg font-semibold tracking-wide text-white">
                  Summary
                </h2>
              </div>

              {/* Text */}
              <div className="relative max-h-56 overflow-y-auto pr-1">
                <p className="text-sm leading-relaxed text-white/80">{text}</p>

                {/* Fade-out overlay */}
                {text.length > 460 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-linear-to-t from-zinc-950 to-transparent" />
                )}
              </div>

              {/* Read More */}
              {text.length > 460 && (
                <button
                  onClick={() => setAboutOpen(true)}
                  className="group inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-cyan-300 transition-all duration-300 hover:text-cyan-200"
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
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <img
              src={cover || "/placeholder-game.jpg"}
              alt={game.name}
              className="h-85 w-full rounded-xl border border-white/12 object-cover"
            />

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
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
                  w-full cursor-pointer rounded-lg py-2.5
                  bg-cyan-500 text-black font-semibold
                  transition-all duration-300 hover:bg-cyan-400
                "
              >
                {loadingAdd ? (
                  <>
                    <span className="loading loading-dots loading-xs" />
                  </>
                ) : (
                  <div className="flex justify-center items-center gap-2">
                    <IoMdAdd size={22} />
                    Add to Want To Play
                  </div>
                )}
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 font-semibold"
                  onClick={() => {
                    toast.success(
                      <span>
                        <span className="font-bold pr-1">{game.name}</span>
                        <span className="text-black">
                          is already being tracked
                        </span>
                      </span>,
                    );
                  }}
                >
                  <IoMdCheckmarkCircle />
                  {saved.status}
                </motion.button>

                <motion.button
                  disabled={loadingFav}
                  whileHover={!loadingFav ? { scale: 1.1 } : {}}
                  onClick={toggleFavorite}
                  className={`w-full py-2.5 rounded-lg transition cursor-pointer ${
                    saved?.favorite
                      ? "bg-red-600 text-white"
                      : "bg-white/10 text-white hover:bg-white/20"
                  } ${loadingFav ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {loadingFav ? (
                      <div className="py-0.4">
                        <span className="loading loading-dots loading-xs" />
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
                    className="fixed inset-x-0 top-1/2 z-1000 mx-auto w-[92vw] max-w-3xl -translate-y-1/2 rounded-2xl border border-white/20 bg-zinc-950/95 p-6 shadow-2xl"
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
                      className="absolute right-3 top-3 text-2xl text-white/70 hover:text-white"
                    >
                      âœ•
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
