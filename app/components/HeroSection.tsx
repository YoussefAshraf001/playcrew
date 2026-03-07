"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../lib/firebase";

import {
  FaPlay,
  FaPause,
  FaCrown,
  FaMusic,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import {
  MdRemoveCircleOutline,
  MdOutlineOnlinePrediction,
  MdFullscreen,
} from "react-icons/md";
import { GiMouthWatering } from "react-icons/gi";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useMusic } from "../context/MusicContext";
import { useUI } from "../context/UIContext";

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
  const { startRouteLoading } = useUI();
  const { pause, isActuallyPlaying } = useMusic();
  const heroIsAudibleRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const [videoFailed, setVideoFailed] = useState(false);
  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    if (!activeGame) return;

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
          "t_cover_big_2x",
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
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    if (!existsInLibrary) return;

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
  const showPoster = !media.video || videoFailed || !isPlaying;

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % trending.length);
    setVideoFailed(false);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? trending.length - 1 : prev - 1));
  };

  const toggleMute = () => {
    if (!playerRef.current) return;

    if (muted) {
      // 🔊 becoming audible
      playerRef.current.unMute();

      if (!heroIsAudibleRef.current) {
        // only pause + notify if music was actually playing
        if (isActuallyPlaying) {
          pause();

          toast("Music paused to focus on the trailer", {
            id: "hero-audio-focus",
            icon: <FaMusic />,
          });
        } else {
          pause(); // still enforce silence, just no toast
        }

        heroIsAudibleRef.current = true;
      }
    } else {
      // 🔇 becoming silent
      playerRef.current.mute();
      heroIsAudibleRef.current = false;
    }

    setMuted(!muted);
  };

  const togglePlay = () => {
    if (!playerRef.current?.getPlayerState) return;

    const state = playerRef.current.getPlayerState();
    if (state === window.YT?.PlayerState?.PLAYING) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      return;
    }

    playerRef.current.playVideo();
  };

  const goFullscreen = () => {
    const el = heroSectionRef.current;
    if (!el) return;

    if (el.requestFullscreen) el.requestFullscreen();
  };

  const clearControlsHideTimer = () => {
    if (!controlsHideTimerRef.current) return;
    clearTimeout(controlsHideTimerRef.current);
    controlsHideTimerRef.current = null;
  };

  const resetControlsHideTimer = () => {
    clearControlsHideTimer();
    setControlsVisible(true);
    if (!isFullscreen) return;
    controlsHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 5000);
  };

  const applyVideoCoverScale = () => {
    const host = playerHostRef.current;
    if (!host) return;
    const parent = host.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;

    const targetRatio = 16 / 9;
    const hostRatio = w / h;
    const scale =
      hostRatio > targetRatio
        ? hostRatio / targetRatio
        : targetRatio / hostRatio;

    host.style.left = "50%";
    host.style.top = "50%";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.position = "absolute";
    host.style.transform = `translate(-50%, -50%) scale(${Math.max(1, scale)})`;
    host.style.transformOrigin = "center center";
    host.style.pointerEvents = "none";
  };

  /* ---------------------------
     Auto rotate
  ---------------------------- */
  useEffect(() => {
    if (!media.video) return;

    const initPlayer = () => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(media.video);
        setTimeout(applyVideoCoverScale, 0);
        return;
      }

      playerRef.current = new window.YT.Player("yt-player", {
        videoId: media.video,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            e.target.mute();
            heroIsAudibleRef.current = false;

            if (muted) {
              e.target.mute();
            } else {
              e.target.unMute();
            }

            e.target.playVideo();
            setIsPlaying(true);
            setTimeout(applyVideoCoverScale, 0);
          },

          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              if (progressTimer.current) clearInterval(progressTimer.current);

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
              setIsPlaying(false);
              if (progressTimer.current) clearInterval(progressTimer.current);

              // 🔒 If hero was audible, keep music paused
              if (heroIsAudibleRef.current) {
                pause();
              }
            }

            if (e.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (progressTimer.current) clearInterval(progressTimer.current);
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

  useEffect(() => {
    const onResize = () => applyVideoCoverScale();
    window.addEventListener("resize", onResize);

    const host = playerHostRef.current;
    const parent = host?.parentElement;
    const ro =
      parent && "ResizeObserver" in window
        ? new ResizeObserver(() => applyVideoCoverScale())
        : null;
    if (ro && parent) ro.observe(parent);

    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, [activeIndex]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const nowFullscreen =
        document.fullscreenElement === heroSectionRef.current;
      setIsFullscreen(nowFullscreen);
      setControlsVisible(true);
      clearControlsHideTimer();
      if (nowFullscreen) {
        controlsHideTimerRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 5000);
      }
      setTimeout(() => applyVideoCoverScale(), 0);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      clearControlsHideTimer();
    };
  }, []);

  /* ---------------------------
     Render
  ---------------------------- */
  return (
    <section
      ref={heroSectionRef}
      className={`relative h-[58vh] w-full overflow-hidden sm:h-[62vh] ${
        isFullscreen && !controlsVisible ? "cursor-none" : ""
      }`}
      onMouseMove={resetControlsHideTimer}
      onMouseEnter={resetControlsHideTimer}
      onTouchStart={resetControlsHideTimer}
    >
      {/* Background */}
      <div className="absolute inset-0">
        {/* VIDEO */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-b-xl">
          <div
            id="yt-player"
            ref={playerHostRef}
            className="absolute h-full w-full"
            style={{
              opacity: showPoster ? 0 : 1,
              transition: showPoster
                ? "opacity 0ms linear"
                : "opacity 700ms ease-in-out",
            }}
          />
        </div>

        <div
          className={`absolute inset-0 z-10 bg-black transition-opacity ${
            showPoster ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transition: showPoster
              ? "opacity 350ms ease-out"
              : "opacity 500ms ease-in-out",
          }}
        />

        {media.image && (
          <Image
            src={
              media.image.startsWith("http")
                ? media.image
                : `https:${media.image.replace("t_thumb", "t_1080p")}`
            }
            fill
            onClick={() => {
              if (!isPlaying && media.video) togglePlay();
            }}
            className={`z-20 object-cover ${
              showPoster ? "opacity-100" : "opacity-0"
            } ${!isPlaying && media.video ? "cursor-pointer" : ""}`}
            style={{
              transition: showPoster
                ? "opacity 1200ms ease-in-out"
                : "opacity 700ms ease-in-out",
            }}
            alt={activeGame.name}
            priority
          />
        )}
      </div>

      {/* SIDE CONTROLS */}
      <button
        onClick={goPrev}
        className={`group absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/20 bg-black/35 p-3 text-white backdrop-blur-md transition-all duration-250 hover:-translate-x-0.5 hover:border-cyan-300/60 hover:bg-cyan-500/20 hover:shadow-[0_0_22px_rgba(34,211,238,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 sm:left-6 sm:p-4 ${
          isFullscreen && !controlsVisible
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
        aria-label="Previous featured game"
      >
        <FiArrowLeft className="text-lg transition-transform duration-250 group-hover:-translate-x-0.5" />
      </button>

      <button
        onClick={goNext}
        className={`group absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/20 bg-black/35 p-3 text-white backdrop-blur-md transition-all duration-250 hover:translate-x-0.5 hover:border-cyan-300/60 hover:bg-cyan-500/20 hover:shadow-[0_0_22px_rgba(34,211,238,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 sm:right-6 sm:p-4 ${
          isFullscreen && !controlsVisible
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
        aria-label="Next featured game"
      >
        <FiArrowRight className="text-lg transition-transform duration-250 group-hover:translate-x-0.5" />
      </button>

      {/* <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent" /> */}

      <div className="relative z-20 h-full flex items-end px-14 pb-16">
        {!videoFailed && (
          <motion.div
            className={`absolute top-6 right-6 z-30 flex gap-3 transition-opacity duration-300 ${
              isFullscreen && !controlsVisible
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
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
                    {muted ? <FaVolumeMute /> : <FaVolumeUp />}
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

        <div
          className={`max-w-xl transition-opacity duration-300 ${
            isFullscreen && !controlsVisible
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
        >
          <h1 className="text-5xl font-bold mb-4">{activeGame.name}</h1>

          <div className="flex gap-4">
            <button
              onClick={() => {
                startRouteLoading();
                router.push(`/game/${gameId}`);
              }}
              className="px-6 py-3 bg-zinc-500 text-white rounded-xl cursor-pointer hover:scale-105 ease-in-out transition-all duration-300"
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
      <div
        className={`absolute bottom-4 left-1/2 z-30 w-[92%] -translate-x-1/2 transition-opacity duration-300 ${
          isFullscreen && !controlsVisible
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
      >
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
