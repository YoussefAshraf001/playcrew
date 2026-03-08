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
  MdFullscreenExit,
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
  interface Document {
    webkitFullscreenElement?: Element | null;
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
const HERO_TRAILER_VOLUME_KEY = "hero-trailer-volume";
const HERO_VIDEO_OVERSCAN = 1.18;
const HERO_VIDEO_SCALE_CLASS =
  "origin-center transform-gpu scale-[1.28] sm:scale-[1.46] lg:scale-[1.74]";

const pickHeroVideoId = (videos?: any[]) => {
  if (!Array.isArray(videos) || videos.length === 0) return null;

  const withId = videos.filter((v) => typeof v?.video_id === "string");
  if (withId.length === 0) return null;
  return withId[0]?.video_id ?? null;
};

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
  const volumeControlRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [heroVolume, setHeroVolume] = useState(0.7);
  const [heroVolumeHydrated, setHeroVolumeHydrated] = useState(false);
  const [volumePanelOpen, setVolumePanelOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isMounted = useRef(false);

  const syncHeroVideoLayout = () => {
    const host = playerHostRef.current;
    if (!host) return;

    const iframe = host.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return;

    const rect = host.getBoundingClientRect();
    const containerW = Math.max(1, rect.width);
    const containerH = Math.max(1, rect.height);
    const videoRatio = 16 / 9;
    const section = heroSectionRef.current;
    const inFullscreen =
      !!section &&
      (document.fullscreenElement === section ||
        document.webkitFullscreenElement === section);

    const width = inFullscreen
      ? Math.min(containerW, containerH * videoRatio)
      : Math.max(containerW, containerH * videoRatio) * HERO_VIDEO_OVERSCAN;
    const height = inFullscreen
      ? Math.min(containerH, containerW / videoRatio)
      : Math.max(containerH, containerW / videoRatio) * HERO_VIDEO_OVERSCAN;

    try {
      if (playerRef.current?.setSize) {
        playerRef.current.setSize(Math.ceil(width), Math.ceil(height));
      }
    } catch {
      // ignore transient YT setSize errors while player is initializing
    }

    iframe.style.position = "absolute";
    iframe.style.left = "50%";
    iframe.style.top = "50%";
    iframe.style.width = `${Math.ceil(width)}px`;
    iframe.style.height = `${Math.ceil(height)}px`;
    iframe.style.transform = "translate(-50%, -50%)";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HERO_TRAILER_VOLUME_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          setHeroVolume(Math.max(0, Math.min(1, parsed)));
        }
      }
    } catch {
      // ignore localStorage issues
    } finally {
      setHeroVolumeHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!heroVolumeHydrated) return;
    try {
      localStorage.setItem(HERO_TRAILER_VOLUME_KEY, String(heroVolume));
    } catch {
      // ignore localStorage issues
    }
  }, [heroVolume, heroVolumeHydrated]);

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

    toast.success(
      <span>
        <span className="font-bold pr-1">{game.name}</span>
        <span className="text-black">added to library</span>
      </span>,
    );
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

    toast.success(
      <span>
        <span className="font-bold pr-1">{game.name}</span>
        <span className="text-black">
          {updated ? "added to your favorites" : "removed from your favorites"}
        </span>
      </span>,
      {
        icon: updated ? "❤️" : "💔",
      },
    );
  };

  /* ---------------------------
     Media
  ---------------------------- */
  const videoId = pickHeroVideoId(activeGame.videos);

  const imageSrc =
    activeGame.artworks?.[0]?.url || activeGame.cover?.url || null;

  const media = {
    video: videoId || null,
    image: imageSrc || null,
  };
  const shouldUsePoster = !media.video || videoFailed || !isPlaying;
  // Never hide video behind a black layer when there is no image fallback.
  const showPoster = shouldUsePoster && !!media.image;
  const showReadabilityBg = !media.video || !isPlaying;

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
      playerRef.current.setVolume(Math.round(heroVolume * 100));
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

  const updateHeroVolume = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setHeroVolume(clamped);

    if (!playerRef.current) return;

    playerRef.current.setVolume(Math.round(clamped * 100));

    if (clamped <= 0.001) {
      playerRef.current.mute();
      heroIsAudibleRef.current = false;
      setMuted(true);
      return;
    }

    playerRef.current.unMute();
    setMuted(false);

    if (!heroIsAudibleRef.current) {
      if (isActuallyPlaying) {
        pause();
        toast("Music paused to focus on the trailer", {
          id: "hero-audio-focus",
          icon: <FaMusic />,
        });
      } else {
        pause();
      }
      heroIsAudibleRef.current = true;
    }
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

  const toggleFullscreen = async () => {
    const section = heroSectionRef.current;
    if (!section) return;

    try {
      if (!document.fullscreenElement) {
        setIsFullscreen(true);
        await section.requestFullscreen();
      } else {
        setIsFullscreen(false);
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen(false);
      // ignore fullscreen API errors
    }
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

  /* ---------------------------
     Auto rotate
  ---------------------------- */
  useEffect(() => {
    if (!media.video) {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
      setIsPlaying(false);
      setProgress(0);
      return;
    }

    const initPlayer = () => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(media.video);
        playerRef.current.setVolume(Math.round(heroVolume * 100));
        if (muted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
        playerRef.current.playVideo();
        setIsPlaying(true);
        requestAnimationFrame(syncHeroVideoLayout);
        return;
      }

      if (!playerHostRef.current) return;

      playerRef.current = new window.YT.Player(playerHostRef.current, {
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

            e.target.setVolume(Math.round(heroVolume * 100));

            e.target.playVideo();
            setIsPlaying(true);
            requestAnimationFrame(syncHeroVideoLayout);
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
  }, [activeIndex, media.video]);

  useEffect(() => {
    const onResize = () => syncHeroVideoLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      syncHeroVideoLayout();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // ✅ Only run when we're showing the IMAGE fallback
    const imageFallbackActive = !media.video || videoFailed;
    if (!imageFallbackActive) return;

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
  }, [media.video, videoFailed, activeIndex]);

  useEffect(() => {
    setVideoFailed(false);
    setProgress(0);
  }, [activeIndex, media.video]);

  useEffect(() => {
    if (!isFullscreen) return;
    setVolumePanelOpen(false);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    requestAnimationFrame(syncHeroVideoLayout);
  }, [activeIndex, media.video, isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const section = heroSectionRef.current;
      const next =
        !!section &&
        (document.fullscreenElement === section ||
          document.webkitFullscreenElement === section);
      setIsFullscreen(next);
      requestAnimationFrame(syncHeroVideoLayout);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      onFullscreenChange as EventListener,
    );
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        onFullscreenChange as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      clearControlsHideTimer();
    };
  }, []);

  useEffect(() => {
    if (!volumePanelOpen) return;

    const onOutside = (e: MouseEvent) => {
      if (!volumeControlRef.current?.contains(e.target as Node)) {
        setVolumePanelOpen(false);
      }
    };

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVolumePanelOpen(false);
    };

    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [volumePanelOpen]);

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
            ref={playerHostRef}
            className={`absolute inset-0 ${
              isFullscreen
                ? "origin-center transform-gpu scale-100"
                : HERO_VIDEO_SCALE_CLASS
            }`}
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
            } ${
              media.video
                ? isFullscreen
                  ? "origin-center transform-gpu scale-100"
                  : HERO_VIDEO_SCALE_CLASS
                : ""
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

      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-black/75 via-black/35 to-transparent transition-opacity duration-500 ${
          showReadabilityBg ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="relative z-20 h-full flex items-end px-14 pb-16">
        {!videoFailed && (
          <motion.div
            className={`absolute top-6 right-6 z-30 flex gap-3 transition-opacity duration-300 ${
              isFullscreen && !controlsVisible
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
                aria-label={isPlaying ? "Pause trailer" : "Play trailer"}
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

              <div className="relative" ref={volumeControlRef}>
                <button
                  type="button"
                  onClick={() => setVolumePanelOpen((prev) => !prev)}
                  className="rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
                  aria-label="Open trailer volume controls"
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

                <AnimatePresence>
                  {volumePanelOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-white/20 bg-black/82 p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                    >
                      <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-200">
                        <span>Trailer Volume</span>
                        <span className="font-semibold text-white">
                          {Math.round(heroVolume * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-zinc-100 transition hover:bg-white/12"
                          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
                        >
                          {muted ? (
                            <FaVolumeMute size={12} />
                          ) : (
                            <FaVolumeUp size={12} />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(heroVolume * 100)}
                          onChange={(e) =>
                            updateHeroVolume(Number(e.target.value) / 100)
                          }
                          className="h-1.5 w-full cursor-pointer accent-cyan-300"
                          aria-label="Trailer volume"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isFullscreen ? "fullscreen-exit" : "fullscreen-enter"}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center"
                  >
                    {isFullscreen ? <MdFullscreenExit /> : <MdFullscreen />}
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
          } rounded-2xl p-4 transition-[background-color,border-color,backdrop-filter] duration-500 sm:p-5 ${
            showReadabilityBg
              ? "border border-white/10 bg-black/35 backdrop-blur-sm"
              : "border border-transparent bg-transparent backdrop-blur-0"
          }`}
        >
          <h1 className="mb-4 text-5xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {activeGame.name}
          </h1>

          <div className="flex gap-4">
            <button
              onClick={() => {
                startRouteLoading();
                router.push(`/game/${gameId}`);
              }}
              className="px-6 py-3 bg-white/10 text-white rounded-xl cursor-pointer hover:scale-105 ease-in-out transition-all duration-300"
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
