"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useUser } from "../context/UserContext";
import { db } from "../lib/firebase";

import { FaPlay, FaPause, FaCrown } from "react-icons/fa";
import {
  MdRemoveCircleOutline,
  MdOutlineOnlinePrediction,
  MdFullscreen,
} from "react-icons/md";
import { GiMouthWatering } from "react-icons/gi";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { IoVolumeMuteOutline } from "react-icons/io5";
import { GoUnmute } from "react-icons/go";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const STATUS_CONFIG = [
  { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" },
  { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" },
  { label: "Dropped", icon: <MdRemoveCircleOutline />, color: "bg-red-500" },
  { label: "Completed", icon: <FaCrown />, color: "bg-green-500" },
  {
    label: "Online",
    icon: <MdOutlineOnlinePrediction />,
    color: "bg-purple-500",
  },
  { label: "Want To Play", icon: <GiMouthWatering />, color: "bg-teal-500" },
];

export default function HeroSection({
  trending,
  user,
  savedGames,
  setSavedGames,
}: {
  trending: any[];
  user?: any;
  savedGames: Record<string, any>;
  setSavedGames: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  if (!trending?.length) return null;

  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const [videoFailed, setVideoFailed] = useState(false);
  const playerRef = useRef<any>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* ---------------------------
  Derived state (IMPORTANT)
  ---------------------------- */
  const activeGame = trending[activeIndex];
  const gameId = String(activeGame.id);
  const game = savedGames[gameId];
  const existsInLibrary = !!game;

  const statusConfig =
    STATUS_CONFIG.find((s) => s.label === status) ||
    STATUS_CONFIG.find((s) => s.label === "Want To Play")!;

  /* ---------------------------
     Actions
  ---------------------------- */
  const handleAddToLibrary = async () => {
    if (!user || !activeGame) return;

    // Normalize genres
    const genres = Array.isArray(activeGame.genres)
      ? activeGame.genres
          .map((g: any) => (typeof g === "object" ? g.name : g))
          .filter(Boolean)
      : [];

    // Normalize platforms
    const platforms = Array.isArray(activeGame.platforms)
      ? activeGame.platforms
          .map((p: any) => p?.platform?.name || p?.name)
          .filter(Boolean)
      : [];

    // Normalize release date
    const releaseDate =
      typeof activeGame.first_release_date === "number"
        ? new Date(activeGame.first_release_date * 1000)
        : null;

    // Resolve cover
    let coverUrl = "/placeholder-game.jpg";

    if (activeGame.cover) {
      if (typeof activeGame.cover === "string") {
        coverUrl = activeGame.cover.startsWith("http")
          ? activeGame.cover
          : `https:${activeGame.cover}`;
      } else if (activeGame.cover.url) {
        coverUrl = `https:${activeGame.cover.url.replace(
          "t_thumb",
          "t_cover_big",
        )}`;
      }
    } else if (activeGame.background_image) {
      coverUrl = activeGame.background_image;
    }

    const payload = {
      name: activeGame.name,

      igdb: {
        id: activeGame.id,
        name: activeGame.name,
        cover: coverUrl,
        rating: activeGame.rating || 0,
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
      doc(db, "users", user.uid, "games_igdb", activeGame.id.toString()),
      payload,
      { merge: true },
    );

    setSavedGames((prev) => ({
      ...prev,
      [gameId]: payload,
    }));

    toast.success("Added to library");
  };

  const toggleFavorite = async () => {
    if (!user || !existsInLibrary) return;

    const ref = doc(db, "users", user.uid, "games_igdb", gameId);

    const updated = !savedGames[gameId].favorite;

    await setDoc(
      ref,
      {
        favorite: updated,
        lastUpdated: new Date(),
      },
      { merge: true },
    );

    setSavedGames((prev) => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        favorite: updated,
      },
    }));
  };

  /* ---------------------------
     Media
  ---------------------------- */
  const videoId = activeGame.videos?.[0]?.video_id;

  const imageSrc =
    activeGame.artworks?.[0]?.url || activeGame.cover?.url || null;

  const media = {
    video: videoId || null,
    image: imageSrc || null,
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % trending.length);
    setVideoFailed(false);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? trending.length - 1 : prev - 1));
  };

  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }

    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;

    if (muted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }

    setMuted(!muted);
  };

  const goFullscreen = () => {
    const el = document.getElementById("yt-player");
    if (!el) return;

    if (el.requestFullscreen) el.requestFullscreen();
  };

  /* ---------------------------
     Auto rotate
  ---------------------------- */
  useEffect(() => {
    if (!media.video) return;

    const initPlayer = () => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(media.video);
        return;
      }

      playerRef.current = new window.YT.Player("yt-player", {
        videoId: media.video,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            e.target.mute();
            e.target.playVideo();
            setIsPlaying(true);
          },

          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              // ✅ Start progress loop ONLY when playing
              if (progressTimer.current) {
                clearInterval(progressTimer.current);
              }

              progressTimer.current = setInterval(() => {
                if (!playerRef.current) return;

                const current = playerRef.current.getCurrentTime();
                const duration = playerRef.current.getDuration();

                if (duration > 0) {
                  setProgress((current / duration) * 100);
                }
              }, 200);
            }

            if (e.data === window.YT.PlayerState.PAUSED) {
              if (progressTimer.current) {
                clearInterval(progressTimer.current);
              }
            }

            if (e.data === window.YT.PlayerState.ENDED) {
              if (progressTimer.current) {
                clearInterval(progressTimer.current);
              }
              goNext();
            }
          },

          onError: () => setVideoFailed(true),
        },
      });
    };

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      // ✅ CLEANUP — THIS FIXES YOUR BUG
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }

      playerRef.current = null;

      if (progressTimer.current) {
        clearInterval(progressTimer.current);
      }
    };
  }, [activeIndex]);

  useEffect(() => {
    // ✅ Only run when we're showing the IMAGE fallback
    if (!videoFailed) return;

    let start = Date.now();
    const duration = 6000;

    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / duration) * 100, 100));
    };

    const interval = setInterval(tick, 50);
    const timeout = setTimeout(() => {
      goNext();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setProgress(0);
    };
  }, [videoFailed, activeIndex]);

  useEffect(() => {
    setVideoFailed(false);
    setProgress(0);
  }, [activeIndex]);

  /* ---------------------------
     Render
  ---------------------------- */
  return (
    <section className="relative mx-auto w-[80%] h-[55vh] overflow-hidden mb-20">
      {/* Background */}
      <div className="absolute inset-0">
        {/* VIDEO */}
        <div className="absolute inset-0 overflow-hidden rounded-b-xl">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              id="yt-player"
              className="w-[177.77vh] h-[60vh] min-w-screen min-h-[56.25vw]"
              style={{
                opacity: videoFailed ? 0 : 1,
                transition: "opacity 300ms ease",
              }}
            />
          </div>
        </div>

        {media.image && (
          <Image
            src={
              media.image.startsWith("http")
                ? media.image
                : `https:${media.image.replace("t_thumb", "t_1080p")}`
            }
            fill
            className={`object-cover transition-opacity duration-300 ${
              videoFailed ? "opacity-100" : "opacity-0"
            }`}
            alt={activeGame.name}
            priority
          />
        )}
      </div>

      {/* SIDE CONTROLS */}
      <button
        onClick={goPrev}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-30 
             bg-white/50 hover:bg-black/70 text-white 
             p-4 rounded-full"
      >
        <FiArrowLeft />
      </button>

      <button
        onClick={goNext}
        className="absolute right-10 top-1/2 -translate-y-1/2 z-30 
             bg-white/50 hover:bg-black/70 text-white 
             p-4 rounded-full"
      >
        <FiArrowRight />
      </button>

      {/* <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent" /> */}

      <div className="relative z-20 h-full flex items-end px-14 pb-16">
        {!videoFailed && (
          <motion.div
            className="absolute top-6 right-6 z-30 flex gap-3"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: existsInLibrary ? 180 : 0 }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <button
                onClick={togglePlay}
                className="p-3 bg-black/60 hover:bg-black/80 rounded-full rotate-y-180"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isPlaying ? "pause" : "play"}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center"
                  >
                    {isPlaying ? <FaPause /> : <FaPlay />}
                  </motion.div>
                </AnimatePresence>
              </button>

              <button
                onClick={toggleMute}
                className="p-3 rounded-full rotate-y-180"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={muted ? "muted" : "unmuted"}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center"
                  >
                    {muted ? <IoVolumeMuteOutline /> : <GoUnmute />}
                  </motion.div>
                </AnimatePresence>
              </button>

              <button
                onClick={goFullscreen}
                className="p-3 bg-black/60 hover:bg-black/80 rounded-full rotate-y-180"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center"
                  >
                    <MdFullscreen />
                  </motion.div>
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        )}

        <div className="max-w-xl">
          <h1 className="text-5xl font-bold mb-4">{activeGame.name}</h1>

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/game/${gameId}`)}
              className="px-6 py-3 bg-white text-black rounded-xl cursor-pointer hover:scale-105 ease-in-out transition-all duration-300"
            >
              Explore
            </button>

            {/* STATUS BUTTON */}
            <div className="relative w-[180px] h-[52px]">
              <motion.div
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: existsInLibrary ? 180 : 0 }}
                transition={{ duration: 0.6 }}
              >
                {/* FRONT */}
                <button
                  onClick={handleAddToLibrary}
                  disabled={existsInLibrary}
                  className="absolute inset-0 flex items-center justify-center
                  rounded-xl bg-white/10 hover:bg-white/20
                  text-white backface-hidden cursor-pointer hover:scale-105 ease-in-out transition-all duration-300"
                >
                  Want to Play
                </button>

                {/* BACK */}
                <div
                  className="absolute inset-0 flex items-center justify-center
                  rounded-xl bg-green-600 text-white backface-hidden cursor-not-allowed hover:scale-105 ease-in-out transition-all duration-300"
                  style={{ transform: "rotateY(180deg)" }}
                  onClick={() => toast.error("Game is already being tracked")}
                >
                  <div className="flex gap-2 items-center">
                    {statusConfig.icon}
                    <span>{statusConfig.label}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            <button
              onClick={toggleFavorite}
              className={`px-5 py-3 rounded-xl ${
                game?.favorite
                  ? "bg-red-500 text-white"
                  : "bg-white/10 hover:bg-white/20"
              } cursor-pointer hover:scale-105 ease-in-out transition-all duration-300`}
            >
              ★ Favorite
            </button>
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] z-30">
        <div
          className="h-1 bg-white/30 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;

            if (playerRef.current) {
              const duration = playerRef.current.getDuration();
              playerRef.current.seekTo(duration * percent, true);
            }
          }}
        >
          <div
            className="h-full bg-white transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
