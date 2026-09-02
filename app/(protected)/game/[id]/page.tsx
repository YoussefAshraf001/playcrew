"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FaHeart,
  FaFire,
  FaPlaystation,
  FaXbox,
  FaApple,
  FaSteam,
  FaPause,
  FaPlay,
  FaCrown,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaLinux,
  FaGoogle,
  FaStar,
  FaSkullCrossbones,
  FaWindows,
  FaTrophy,
} from "react-icons/fa";
import { BsNintendoSwitch } from "react-icons/bs";
import { IoLogoGameControllerA, IoLogoGameControllerB } from "react-icons/io";
import {
  MdOutlineOnlinePrediction,
  MdOutlineAddToQueue,
  MdRemoveCircleOutline,
} from "react-icons/md";
import { DiAndroid } from "react-icons/di";
import {
  SiBattledotnet,
  SiEa,
  SiEpicgames,
  SiGogdotcom,
  SiRiotgames,
  SiStadia,
  SiUbisoft,
  SiWii,
} from "react-icons/si";
import { IoCloseCircle } from "react-icons/io5";
import { FaUnlockKeyhole } from "react-icons/fa6";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiExternalLink,
  FiMessageSquare,
  FiSmile,
  FiThumbsUp,
} from "react-icons/fi";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { getAwardCategoryFromDocId, getAwardYears } from "@/app/lib/awards";
import {
  formatReleaseDate,
  hasConfirmedReleaseDay,
  parseReleaseDate,
} from "@/app/lib/releaseDates";
import { getAutomaticReleaseState } from "@/app/lib/igdbReleasePhases";
import { db } from "@/app/lib/firebase";
import {
  appendRecentGameActionSummary,
  getRecentGameActionSummary,
} from "@/app/lib/recentGameActions";
import { useUser } from "@/app/context/UserContext";
import { useUI } from "@/app/context/UIContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import ScreenshotsCarousel from "@/app/components/ScreenshotsCarousel";
import VideoCarousel from "@/app/components/VideoCarousel";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import SimilarGamesGrid from "@/app/components/SimilarGamesGrid";
import GameSticker from "@/app/components/GameSticker";
import { TrackedGame } from "@/app/types/trackedGame";

const statuses = [
  { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" }, // Active / ongoing â†’ blue = focus
  { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" }, // Paused / waiting â†’ yellow = caution
  {
    label: "Dropped",
    icon: <MdRemoveCircleOutline size={16} />,
    color: "bg-red-500",
  }, // Stop / negative â†’ red
  { label: "Completed", icon: <FaCrown size={20} />, color: "bg-green-500" }, // Success â†’ green
  {
    label: "Online",
    icon: <MdOutlineOnlinePrediction size={23} />,
    color: "bg-purple-500",
  }, // Neutral / discovery â†’ purple
  {
    label: "Want To Play",
    icon: <MdOutlineAddToQueue size={20} />,
    color: "bg-teal-500",
  }, // Excited / wishlist â†’ teal
];

type StatusType = string | null;
type StoredRating = number | "excluded" | null;
type WinnerAward = {
  year: number;
  category: string;
};

interface SimilarGame {
  id: number;
  name: string;
  cover?: string;
  rating?: number;
  released?: number | null;
}

interface GameReview {
  id: string;
  userId: string;
  username: string;
  text: string;
  sticker: string | null;
  rating: number | null;
  playtime: number;
  avatar: string | null;
  memberSince: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  status: string | null;
  progress: number;
  playedOn: string | string[] | null;
  reactions: Record<ReviewReaction, number>;
  myReaction: ReviewReaction | null;
}

type ReviewReaction = "helpful" | "funny" | "100-percent" | "glazzing";

const COUNTDOWN_UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const;

function ReleaseCountdown({ date }: { date: Date }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, date.getTime() - Date.now()),
  );

  useEffect(() => {
    const updateRemaining = () =>
      setRemaining(Math.max(0, date.getTime() - Date.now()));

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [date]);

  const totalSeconds = Math.floor(remaining / 1000);
  const values = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative isolate overflow-hidden rounded-[28px] border border-white/12 bg-black/12 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.24)]"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_58%)]" />

      <div className="mb-4 flex flex-col items-center justify-center gap-1.5 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.85)]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.26em] text-[#a5f3fc]">
            Launch countdown
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/40">
          <FiClock aria-hidden="true" /> Live
        </span>
      </div>

      <div
        className="grid grid-cols-4 gap-1.5 sm:gap-2.5"
        role="timer"
        aria-label={`Time until release: ${values.days} days, ${values.hours} hours, ${values.minutes} minutes, and ${values.seconds} seconds`}
      >
        {COUNTDOWN_UNITS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-2xl border border-white/12 bg-white/[0.035] px-1 py-2.5 text-center shadow-inner backdrop-blur-md sm:py-3"
          >
            <div className="font-mono text-xl font-black tabular-nums leading-none text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.28)] sm:text-2xl lg:text-3xl">
              {String(values[key]).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:text-[9px]">
              {label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RatingAnalysis({
  score,
  totalCount,
}: {
  score?: number | null;
  totalCount?: number | null;
}) {
  const displayScore =
    typeof score === "number" ? Math.max(0, Math.min(5, score / 20)) : 0;
  const meterRows = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    fill: Math.max(0, 100 - Math.abs(displayScore - stars) * 100),
  }));

  return (
    <section className="flex h-full flex-col rounded-[26px] border border-white/12 bg-black/20 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#67e8f9]">
              Rating Analysis
            </p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/45">
              IGDB
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold">Player Rating</h2>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-amber-300">
            {displayScore.toFixed(1)}
          </p>
          <p className="text-[10px] text-white/45">out of 5</p>
        </div>
      </div>

      <div className="my-auto min-h-[132px] space-y-2 py-4">
        {meterRows.map(({ stars, fill }) => (
          <div
            key={stars}
            className="grid grid-cols-[28px_minmax(0,1fr)_42px] items-center gap-2"
          >
            <span
              className={`text-xs font-bold transition-colors duration-300 ${
                fill > 0 ? "text-amber-200" : "text-white/35"
              }`}
            >
              {stars}★
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                animate={{ width: `${fill}%` }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
              />
            </div>
            <span className="text-right text-[10px] tabular-nums text-white/45">
              {fill > 0 ? `${Math.round(fill)}%` : "—"}
            </span>
          </div>
        ))}
      </div>

      <p className="border-t border-white/8 pt-3 text-[11px] text-white/45">
        {totalCount
          ? `${totalCount} IGDB rating${totalCount === 1 ? "" : "s"}`
          : "No IGDB ratings yet"}
      </p>
    </section>
  );
}
const formatBeatTime = (seconds: unknown) => {
  if (typeof seconds !== "number" || seconds <= 0) return "—";
  const hours = seconds / 3600;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
};

function TimeToBeat({ gameName, data }: { gameName: string; data?: any }) {
  const estimates = [
    { label: "Main Story", value: data?.hastily },
    { label: "Main + Extras", value: data?.normally },
    { label: "Completionist", value: data?.completely },
  ];
  const hasData = estimates.some(
    ({ value }) => typeof value === "number" && value > 0,
  );

  return (
    <section className="flex h-full flex-col rounded-[26px] border border-white/12 bg-black/20 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#67e8f9]">
            Playtime estimates
          </p>
          <h2 className="mt-1 text-xl font-bold">How Long to Beat</h2>
        </div>
        <FiClock className="text-2xl text-white/35" aria-hidden="true" />
      </div>

      <div className="grid flex-1 grid-cols-3 items-center gap-2 py-4">
        {estimates.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center"
          >
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/8 text-[#67e8f9]">
              <FiClock />
            </div>
            <p className="text-xl font-black tabular-nums">
              {formatBeatTime(value)}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-[11px] text-white/45">
        <span>
          {hasData
            ? `${data?.count ?? 0} User submissions`
            : "No estimates available yet"}
        </span>
        <a
          href={`https://howlongtobeat.com/?q=${encodeURIComponent(gameName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[#67e8f9] transition hover:text-[#a5f3fc]"
        >
          Check HLTB <FiExternalLink />
        </a>
      </div>
    </section>
  );
}

const formatCommunityDate = (value: any) => {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";
};

const normalizePlayedOn = (
  value: string | string[] | null | undefined,
): string[] => (Array.isArray(value) ? value : value ? [value] : []);

const formatPlayedOn = (value: string | string[] | null | undefined) => {
  const values = normalizePlayedOn(value);
  if (!values.length) return "Not set";
  const labels: Record<string, string> = {
    steam: "Steam",
    "epic-games": "Epic Games",
    gog: "GOG",
    xbox: "Xbox",
    "xbox-360": "Xbox 360",
    "xbox-one": "Xbox One",
    "xbox-series": "Xbox Series X/S",
    "xbox-game-pass-pc": "Xbox Game Pass for PC",
    playstation: "PlayStation",
    "playstation-2": "PlayStation 2",
    "playstation-3": "PlayStation 3",
    "playstation-4": "PlayStation 4",
    "playstation-5": "PlayStation 5",
    psp: "PSP",
    "ps-vita": "PS Vita",
    nintendo: "Nintendo",
    "ea-app": "EA App",
    "ubisoft-connect": "Ubisoft Connect",
    "battle-net": "Battle.net",
    "riot-games": "Riot Games",
    "offline-activation": "Offline Activation",
    pirated: "Pirated",
  };
  return values
    .map((item) => labels[item] ?? item.replace(/-/g, " "))
    .join(", ");
};

function PlayedOnPlatformIcon({
  value,
  className = "",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const props = { className, "aria-hidden": true };

  switch (value) {
    case "steam":
      return <FaSteam {...props} />;
    case "epic-games":
      return <SiEpicgames {...props} />;
    case "gog":
      return <SiGogdotcom {...props} />;
    case "xbox":
    case "xbox-360":
    case "xbox-one":
    case "xbox-series":
    case "xbox-game-pass-pc":
      return <FaXbox {...props} />;
    case "playstation":
    case "playstation-2":
    case "playstation-3":
    case "playstation-4":
    case "playstation-5":
    case "psp":
    case "ps-vita":
      return <FaPlaystation {...props} />;
    case "nintendo":
      return <BsNintendoSwitch {...props} />;
    case "ea-app":
      return <SiEa {...props} />;
    case "ubisoft-connect":
      return <SiUbisoft {...props} />;
    case "battle-net":
      return <SiBattledotnet {...props} />;
    case "riot-games":
      return <SiRiotgames {...props} />;
    case "offline-activation":
      return <FaUnlockKeyhole {...props} />;
    case "pirated":
      return <FaSkullCrossbones {...props} />;
    default:
      return <IoLogoGameControllerA {...props} />;
  }
}

function CommunityReviewSticker({ sticker }: { sticker: string }) {
  const [activeLoop, setActiveLoop] = useState(0);
  const [pendingLoop, setPendingLoop] = useState<number | null>(null);
  const [initialReady, setInitialReady] = useState(false);
  const isLinkedSticker = sticker.startsWith("http") || sticker.startsWith("/");
  const isRemoteAnimated =
    sticker.startsWith("http") && /\.(gif|webp)(?:$|[?#])/i.test(sticker);
  const sourceForLoop = (loop: number) =>
    isRemoteAnimated
      ? `${sticker}${sticker.includes("?") ? "&" : "?"}playcrewLoop=${loop}`
      : sticker;

  useEffect(() => {
    if (!isRemoteAnimated) return;
    const timer = window.setTimeout(() => {
      setPendingLoop(activeLoop + 1);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeLoop, isRemoteAnimated, sticker]);

  useEffect(() => {
    setActiveLoop(0);
    setPendingLoop(null);
    setInitialReady(false);
  }, [sticker]);

  if (!isLinkedSticker) {
    return (
      <span className="inline-flex rounded-md border border-white/15 bg-white/[0.035] p-2">
        <GameSticker stickerId={sticker} />
      </span>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {!initialReady && (
        <div className="absolute inset-0 animate-pulse bg-white/[0.08]" />
      )}
      <img
        key={activeLoop}
        src={sourceForLoop(activeLoop)}
        alt="Review sticker"
        decoding="async"
        onLoad={() => setInitialReady(true)}
        onError={() => setInitialReady(true)}
        className={`h-auto max-h-full w-auto max-w-full rounded-2xl border border-white/15 bg-white/[0.035] object-contain p-1 transition-opacity duration-300 ${
          initialReady ? "opacity-100" : "opacity-0"
        }`}
      />
      {pendingLoop !== null && (
        <img
          key={`pending-${pendingLoop}`}
          src={sourceForLoop(pendingLoop)}
          alt=""
          aria-hidden="true"
          decoding="async"
          onLoad={() => {
            setActiveLoop(pendingLoop);
            setPendingLoop(null);
          }}
          onError={() => setPendingLoop(null)}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams();
  const { user, profile: userProfile } = useUser();
  const { navbarLayout } = useUI();

  const [game, setGame] = useState<any>(null);
  const [gameLoadError, setGameLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!game?.name) return;

    document.title = `${game.name} • PlayCrew`;
  }, [game?.name]);
  // const [bgImage, setBgImage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusType>(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [loadingGame, setLoadingGame] = useState(false);
  const [trackedGameData, setTrackedGameData] = useState<any>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingRemoving, setTrackingRemoving] = useState(false);
  const [winnerAwards, setWinnerAwards] = useState<WinnerAward[]>([]);
  const [loadingWinnerAwards, setLoadingWinnerAwards] = useState(true);
  const [gameReviews, setGameReviews] = useState<GameReview[]>([]);
  const [loadingGameReviews, setLoadingGameReviews] = useState(false);
  const [gameReviewsError, setGameReviewsError] = useState(false);
  const [gameReviewsRefreshKey, setGameReviewsRefreshKey] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [releaseClock, setReleaseClock] = useState(0);

  useEffect(() => {
    setActiveReviewIndex((current) =>
      Math.max(0, Math.min(current, gameReviews.length - 1)),
    );
  }, [gameReviews.length]);

  useEffect(() => {
    setActiveReviewIndex(0);
  }, [game?.id]);

  const gotyAwards = useMemo(
    () => winnerAwards.filter((award) => award.category === "Game of the Year"),
    [winnerAwards],
  );
  const otherWinnerAwards = useMemo(
    () => winnerAwards.filter((award) => award.category !== "Game of the Year"),
    [winnerAwards],
  );

  const [aboutOpen, setAboutOpen] = useState(false);

  const [tab, setTab] = useState<"screenshots" | "trailers" | "similar">(
    "screenshots",
  );
  const genreContainerRef = useRef<HTMLDivElement>(null);
  const genreTrackRef = useRef<HTMLDivElement>(null);
  const [genreShouldScroll, setGenreShouldScroll] = useState(false);
  const [genreScrollDistance, setGenreScrollDistance] = useState(0);
  const [loadedBackground, setLoadedBackground] = useState<string | null>(null);
  const [screenshotsReady, setScreenshotsReady] = useState(false);

  useEffect(() => {
    if (!aboutOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [aboutOpen]);

  const requireLogin = () => {
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    return true;
  };

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      setLoadingGame(true);
      setGameLoadError(null);
      try {
        const res = await fetch(`/api/igdb/game`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data?.id || typeof data.name !== "string") {
          throw new Error(data?.error || "Game data could not be loaded");
        }

        setGame(data);
      } catch (err) {
        console.error(err);
        setGame(null);
        setGameLoadError(
          err instanceof Error ? err.message : "Game data could not be loaded",
        );
      } finally {
        setLoadingGame(false);
      }
    };
    fetchGame();
  }, [id]);

  // Screenshots (if IGDB returns an array of objects with .url)
  const screenshots = useMemo(() => {
    if (!game) return [];

    return (
      game.short_screenshots?.map((s: any, i: number) => ({
        id: i,
        image: s.replace(/t_[^/]+/, "t_1080p"), // 1080p quality
        // image: s.replace(/t_[^/]+/, "t_original"), // full quality
        bg: s.replace(/t_[^/]+/, "t_screenshot_big"), // background
      })) ?? []
    );
  }, [game]);

  const description =
    game?.description_raw &&
    game.description_raw.toLowerCase() !== "no description available"
      ? game.description_raw
      : game?.summary;

  const videoThumbnails = game?.videos?.map((v: any, idx: any) => ({
    id: v.id,
    thumbnail: `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`,
    videoId: v.video_id,
  }));

  const similarGames = useMemo<SimilarGame[]>(
    () =>
      Array.isArray(game?.similar_games)
        ? (game.similar_games as SimilarGame[])
        : [],
    [game?.similar_games],
  );

  const posterImage = useMemo(() => {
    if (!game) return "/placeholder-game.jpg";

    const trackedCover = trackedGameData?.igdb?.cover;
    if (
      typeof trackedCover === "string" &&
      trackedCover.trim() &&
      !trackedCover.toLowerCase().includes("igdb")
    ) {
      return trackedCover;
    }

    if (game.cover) {
      if (typeof game.cover === "string") {
        const rawCover = game.cover.startsWith("//")
          ? `https:${game.cover}`
          : game.cover;
        return rawCover.replace(/t_[^/]+/, "t_1080p");
      }

      if (game.cover.url) {
        const rawCover = game.cover.url.startsWith("//")
          ? `https:${game.cover.url}`
          : game.cover.url;
        return rawCover.replace(/t_[^/]+/, "t_1080p");
      }
    }

    if (game.background_image) {
      const rawBg = game.background_image.startsWith("//")
        ? `https:${game.background_image}`
        : game.background_image;
      return rawBg.replace(/t_[^/]+/, "t_1080p");
    }
    return "/placeholder-game.jpg";
  }, [game, trackedGameData]);

  useEffect(() => {
    if (!screenshots?.length) {
      setScreenshotsReady(true);
      return;
    }

    let cancelled = false;
    setScreenshotsReady(false);

    const previewImage = new Image();
    previewImage.src = screenshots[0].image;
    previewImage.onload = () => {
      if (!cancelled) setScreenshotsReady(true);
    };
    previewImage.onerror = () => {
      if (!cancelled) setScreenshotsReady(true);
    };

    return () => {
      cancelled = true;
    };
  }, [screenshots]);

  // Screenshot background slideshow. Kept here in case it is restored later.
  // useEffect(() => {
  //   if (!screenshots || screenshots.length === 0) {
  //     setBgImage(null);
  //     return;
  //   }
  //
  //   const pickBackground = () =>
  //     screenshots[Math.floor(Math.random() * screenshots.length)].bg;
  //
  //   setBgImage(pickBackground());
  //
  //   const interval = setInterval(() => {
  //     setBgImage(pickBackground());
  //   }, 10000);
  //
  //   return () => clearInterval(interval);
  // }, [screenshots]);

  useEffect(() => {
    if (!user || !game) return;

    const ref = doc(db, "users", user.uid, "games_igdb", game.id.toString());

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const tracked = snap.data();

        setTrackedGameData(tracked);
        setIsFavorited(Boolean(tracked.favorite));
        setCurrentStatus(tracked.status || null);
      } else {
        setTrackedGameData(null);
        setCurrentStatus(null);
        setIsFavorited(false);
      }
    });

    return () => unsubscribe();
  }, [user, game]);

  useEffect(() => {
    if (!game?.id) {
      setGameReviews([]);
      return;
    }

    let cancelled = false;
    setLoadingGameReviews(true);
    setGameReviewsError(false);

    const loadGameReviews = async () => {
      try {
        const reviewsQuery = query(
          collection(db, "communityReviews"),
          where("gameId", "==", Number(game.id)),
          where("visibility", "==", "public"),
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);

        const reviews = await Promise.all(
          reviewsSnapshot.docs.map(async (reviewDoc) => {
            const data = reviewDoc.data();
            const text = data.text?.trim();

            if (!text) return null;

            const [reviewerResult, trackedGameResult, reactionsResult] =
              await Promise.allSettled([
                getDoc(doc(db, "users", data.userId)),
                getDoc(
                  doc(
                    db,
                    "users",
                    data.userId,
                    "games_igdb",
                    String(data.gameId),
                  ),
                ),
                getDocs(
                  collection(db, "communityReviews", reviewDoc.id, "reactions"),
                ),
              ]);
            const reviewerData =
              reviewerResult.status === "fulfilled" &&
              reviewerResult.value.exists()
                ? reviewerResult.value.data()
                : {};
            const trackedGame =
              trackedGameResult.status === "fulfilled" &&
              trackedGameResult.value.exists()
                ? trackedGameResult.value.data()
                : {};
            const reactionDocs =
              reactionsResult.status === "fulfilled"
                ? reactionsResult.value.docs
                : [];
            const reactions: Record<ReviewReaction, number> = {
              helpful: 0,
              funny: 0,
              "100-percent": 0,
              glazzing: 0,
            };
            let myReaction: ReviewReaction | null = null;
            reactionDocs.forEach((reactionDocument) => {
              const type = reactionDocument.data().type as ReviewReaction;
              if (type in reactions) reactions[type] += 1;
              if (reactionDocument.id === user?.uid) myReaction = type;
            });
            const avatar =
              typeof reviewerData.avatar === "string"
                ? reviewerData.avatar
                : (reviewerData.avatar?.data ??
                  reviewerData.avatarUrl ??
                  reviewerData.photoURL ??
                  null);

            const loadedReview: GameReview = {
              id: reviewDoc.id,
              userId: data.userId,
              username: data.username ?? "PlayCrew User",
              text,
              sticker: data.sticker ?? null,
              rating: typeof data.rating === "number" ? data.rating : null,
              playtime:
                typeof data.playtime === "number"
                  ? data.playtime
                  : typeof trackedGame.playtime === "number"
                    ? trackedGame.playtime
                    : 0,
              avatar,
              memberSince: reviewerData.createdAt ?? null,
              createdAt: data.createdAt ?? trackedGame.lastUpdated ?? null,
              updatedAt: data.updatedAt ?? trackedGame.lastUpdated ?? null,
              status: data.status ?? trackedGame.status ?? null,
              progress:
                typeof data.progress === "number"
                  ? data.progress
                  : typeof trackedGame.progress === "number"
                    ? trackedGame.progress
                    : 0,
              playedOn: data.playedOn ?? trackedGame.playedOn ?? null,
              reactions,
              myReaction,
            };
            return loadedReview;
          }),
        );

        if (!cancelled) {
          setGameReviews(
            reviews.filter(
              (review): review is GameReview =>
                review !== null && review.userId !== user?.uid,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to load game reviews", error);
        if (!cancelled) {
          setGameReviews([]);
          setGameReviewsError(true);
        }
      } finally {
        if (!cancelled) setLoadingGameReviews(false);
      }
    };

    void loadGameReviews();

    return () => {
      cancelled = true;
    };
  }, [game?.id, gameReviewsRefreshKey, user?.uid]);

  useEffect(() => {
    const reviewText = trackedGameData?.review?.text?.trim();
    const visibility =
      (userProfile?.privacy as { profile?: string } | undefined)?.profile ??
      "public";
    if (!user || !game?.id || !reviewText || visibility !== "public") return;

    const communityReviewRef = doc(
      db,
      "communityReviews",
      `${user.uid}_${game.id}`,
    );

    void setDoc(
      communityReviewRef,
      {
        userId: user.uid,
        username: userProfile?.username ?? user.displayName ?? "PlayCrew User",
        gameId: Number(game.id),
        gameName: game.name,
        text: reviewText,
        sticker: trackedGameData.review?.sticker ?? null,
        rating:
          typeof trackedGameData.my_rating === "number"
            ? trackedGameData.my_rating
            : null,
        playtime:
          typeof trackedGameData.playtime === "number"
            ? trackedGameData.playtime
            : 0,
        status: trackedGameData.status ?? null,
        progress:
          typeof trackedGameData.progress === "number"
            ? trackedGameData.progress
            : 0,
        playedOn: trackedGameData.playedOn ?? null,
        visibility: "public",
        createdAt:
          trackedGameData.review?.createdAt ??
          trackedGameData.lastUpdated ??
          new Date(),
        updatedAt:
          trackedGameData.review?.updatedAt ??
          trackedGameData.lastUpdated ??
          new Date(),
      },
      { merge: true },
    )
      .then(() => setGameReviewsRefreshKey((key) => key + 1))
      .catch((error) =>
        console.error("Failed to publish existing review", error),
      );
  }, [
    game?.id,
    game?.name,
    trackedGameData?.lastUpdated,
    trackedGameData?.my_rating,
    trackedGameData?.playedOn,
    trackedGameData?.review?.createdAt,
    trackedGameData?.review?.sticker,
    trackedGameData?.review?.text,
    trackedGameData?.review?.updatedAt,
    user,
    userProfile?.privacy,
    userProfile?.username,
  ]);

  useEffect(() => {
    if (!user || !game?.id) {
      setWinnerAwards([]);
      setLoadingWinnerAwards(false);
      return;
    }

    setLoadingWinnerAwards(true);

    let cancelled = false;

    const loadWinnerCategories = async () => {
      try {
        const yearSnapshots = await Promise.all(
          getAwardYears().map(async (year) => ({
            year,
            snap: await getDocs(
              collection(
                db,
                "users",
                user.uid,
                "awards",
                String(year),
                "categories",
              ),
            ),
          })),
        );

        const winners: WinnerAward[] = yearSnapshots
          .flatMap(({ year, snap }) =>
            snap.docs.flatMap((entry) => {
              const data = entry.data();
              const winnerIgdbId = Number(data?.winner?.igdbId ?? data?.igdbId);
              if (winnerIgdbId !== Number(game.id)) return [];

              const category = getAwardCategoryFromDocId(entry.id);
              if (!category) return [];

              return [
                {
                  year,
                  category,
                },
              ];
            }),
          )
          .sort((a, b) => b.year - a.year);
        if (!cancelled) {
          setWinnerAwards(winners);
          setLoadingWinnerAwards(false);
        }
      } catch (err) {
        console.error("Failed to load winner categories:", err);
        if (!cancelled) {
          setWinnerAwards([]);
          setLoadingWinnerAwards(false);
        }
      }
    };

    void loadWinnerCategories();

    return () => {
      cancelled = true;
    };
  }, [user, game?.id]);

  useEffect(() => {
    if (otherWinnerAwards.length === 0) {
      setGenreShouldScroll(false);
      setGenreScrollDistance(0);
      return;
    }

    const measure = () => {
      const containerWidth = genreContainerRef.current?.clientWidth ?? 0;
      const singleTrackWidth = genreTrackRef.current?.scrollWidth ?? 0;

      setGenreShouldScroll(singleTrackWidth > containerWidth);
      setGenreScrollDistance(singleTrackWidth);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [otherWinnerAwards]);

  const normalizeGenres = (genres: any[] = []) =>
    genres.map((g) => (typeof g === "object" ? g.name : g)).filter(Boolean);

  const normalizePlatforms = (platforms: any[] = []) => {
    const seen = new Set<string>();

    return platforms
      .map((p) => p?.platform?.name || p?.name)
      .filter(Boolean)
      .map((name) => name.toLowerCase())
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  };

  const updateTrackedGame = async (data: any) => {
    if (!user || !game) return;

    const genres = normalizeGenres(game.genres);
    const platforms = normalizePlatforms(game.platforms);

    const releaseDate =
      typeof game.released === "number" ? new Date(game.released * 1000) : null;
    const earlyAccessDate =
      typeof game.earlyAccessDate === "number"
        ? new Date(game.earlyAccessDate * 1000)
        : null;
    const fullReleaseDate =
      typeof game.fullReleaseDate === "number"
        ? new Date(game.fullReleaseDate * 1000)
        : null;

    let coverUrl = "/placeholder-game.jpg";

    if (game.cover) {
      if (typeof game.cover === "string") {
        // If cover is already a string URL
        coverUrl = game.cover.includes("https:")
          ? game.cover
          : `https:${game.cover}`;
      } else if (game.cover.url) {
        // If cover is an object with url property
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_1080p")}`;
      }
    } else if (game.background_image) {
      // Fallback to background image
      coverUrl = game.background_image;
    }

    const previousTrackedGame = trackedGameData ?? null;

    // const previousTrackedGame = trackedGameData ?? {
    //   favorite: isFavorited,
    //   status: currentStatus,
    //   progress: trackedGameData?.progress ?? 0,
    //   my_rating: trackedGameData?.my_rating ?? null,
    //   review: trackedGameData?.review ?? {
    //     text: "",
    //     sticker: null,
    //   },
    //   playtime: trackedGameData?.playtime ?? 0,
    // };

    const shouldSkipLastUpdated = (data?.skipLastUpdated ?? false) === true;

    const payload: any = {
      name: game.name,

      igdb: {
        id: game.id,
        name: game.name,
        cover: coverUrl,
        rating: game.rating || 0,
        genres,
        platforms,
        releaseDate,
        earlyAccessDate,
        earlyAccessDatePrecision: game.earlyAccessDatePrecision ?? null,
        fullReleaseDate,
        fullReleaseDatePrecision: game.fullReleaseDatePrecision ?? null,
        releaseDateKind: game.releaseDateKind ?? null,
        releaseDatePrecision: game.releaseDatePrecision ?? null,
      },

      my_rating: data.my_rating ?? null,
      playtime: data.playtime ?? 0,
      progress: data.progress ?? 0,
      review: {
        text: data.review?.text ?? "",
        sticker: data.review?.sticker ?? null,
      },
      status: data.status,
      favorite: data.favorite ?? false,

      playedSessions: data.playedSessions ?? [],

      recentActionSummary:
        data.recentActionSummary ??
        appendRecentGameActionSummary(
          previousTrackedGame?.recentActionSummary,
          getRecentGameActionSummary(previousTrackedGame, {
            favorite: data.favorite ?? false,
            notInterested: data.notInterested ?? false,
            status: data.status,
            progress: data.progress ?? 0,
            my_rating: data.my_rating ?? null,
            review: data.review ?? {
              text: "",
              sticker: null,
            },
            playtime: data.playtime ?? 0,
            playedSessions: data.playedSessions ?? [],
          }),
        ),
      recentActionSource: "user",
    };

    if (!shouldSkipLastUpdated) {
      payload.lastUpdated = serverTimestamp();
    }

    await setDoc(
      doc(db, "users", user.uid, "games_igdb", game.id.toString()),
      payload,
      { merge: true },
    );
  };

  const handleFavoriteToggle = async () => {
    if (!game) return;
    if (!user) {
      requireLogin();
      return;
    }
    try {
      setLoadingFavorite(true);
      const newFav = !isFavorited;
      await updateTrackedGame({
        favorite: newFav,
        status: currentStatus,
        skipLastUpdated: true,
      });
      setIsFavorited(newFav);
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">
            {newFav ? "was added to favorites" : "was removed from favorites"}
          </span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update favorite.");
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handleChangeStatus = async (status: string) => {
    if (!game) return;
    if (!user) {
      toast.error("You must be logged in to use this feature.");
      return;
    }

    if (currentStatus?.trim().toLowerCase() === status.toLowerCase()) {
      toast.error(
        <>
          Game is already set as{" "}
          <span className="text-red-600 pl-1">{currentStatus}</span>
        </>,
      );
      return;
    }

    const wasTracked = hasTrackedEntry;

    try {
      setLoadingStatus(status);

      // Update Firestore
      if (status === "Completed") {
        await updateTrackedGame({
          status,
          favorite: isFavorited,
          progress: 100,
        });
      } else {
        await updateTrackedGame({
          status,
          favorite: isFavorited,
        });
      }

      // Update local state AFTER Firestore write succeeds
      setCurrentStatus(status);
      setTrackedGameData((prev: any) => ({
        ...(prev ?? {}),
        status,
        favorite: prev?.favorite ?? isFavorited,
        progress: status === "Completed" ? 100 : (prev?.progress ?? 0),
      }));

      if (!wasTracked) {
        toast.success(
          <span>
            <span className="font-bold pr-1">{game.name ?? "Game"}</span>
            <span className="text-black">is now added and marked as</span>
            <span className="font-bold pl-1">{status}</span>
          </span>,
        );
      } else {
        toast.success(
          <span>
            <span className="font-bold pr-1">{game.name ?? "Game"}</span>
            <span className="text-black">status changed to</span>
            <span className="font-bold pl-1">{status}</span>
          </span>,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    } finally {
      setLoadingStatus(null);
    }
  };

  // Normalize parent platforms
  const normalizeParentPlatforms = (
    platforms: { platform: { name: string } }[],
  ) => {
    const result = new Set<string>();

    platforms.forEach(({ platform }) => {
      const name = platform.name.toLowerCase();

      if (name.includes("pc")) {
        result.add("steam");
        result.add("epic");
        return;
      }

      if (name.includes("playstation")) result.add("playstation");
      else if (name.includes("xbox")) result.add("xbox");
      else if (name.includes("nintendo")) result.add("nintendo");
      else if (name.includes("mac")) result.add("mac");
      else if (name.includes("ios")) result.add("ios");
      else if (name.includes("android")) result.add("android");
      else if (name.includes("linux")) result.add("linux");
      else if (name.includes("web")) result.add("google");
      else if (name.includes("stadia")) result.add("stadia");
      else if (name.includes("wii")) result.add("wii");
      else if (name.includes("windows")) result.add("windows");
    });

    return Array.from(result);
  };

  const getParentPlatform = (platformName: string) => {
    const name = platformName.toLowerCase();

    if (name.includes("pc")) return "steam";
    if (name.includes("playstation")) return "playstation";
    if (name.includes("xbox")) return "xbox";
    if (name.includes("nintendo")) return "nintendo";
    if (name.includes("mac")) return "mac";
    if (name.includes("ios")) return "ios";
    if (name.includes("android")) return "android";
    if (name.includes("linux")) return "linux";
    if (name.includes("web")) return "google";
    if (name.includes("stadia")) return "stadia";
    if (name.includes("wii")) return "wii";
    if (name.includes("windows")) return "windows";

    return null;
  };

  // Icon mapping
  const getPlatformIcon = (name?: string) => {
    if (!name) return <IoLogoGameControllerA />;

    switch (name.toLowerCase()) {
      case "steam":
        return <FaSteam />;
      case "epic":
        return <SiEpicgames />;
      case "playstation":
        return <FaPlaystation />;
      case "xbox":
        return <FaXbox />;
      case "nintendo":
        return <BsNintendoSwitch />;
      case "mac":
        return <FaApple />;
      case "ios":
        return <FaApple />;
      case "android":
        return <DiAndroid />;
      case "linux":
        return <FaLinux />;
      case "google":
        return <FaGoogle />;
      case "stadia":
        return <SiStadia />;
      case "wii":
        return <SiWii />;
      case "windows":
        return <FaWindows />;
      default:
        return <IoLogoGameControllerA />;
    }
  };

  // Platform link
  const getPlatformLink = (platform?: string, gameName?: string) => {
    if (!platform || !gameName) return "#";

    switch (platform.toLowerCase()) {
      case "steam":
        return `https://store.steampowered.com/search/?term=${encodeURIComponent(
          gameName,
        )}`;
      case "epic":
        return `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(
          gameName,
        )}`;
      case "playstation":
        return `https://store.playstation.com/en-us/search/${encodeURIComponent(
          gameName,
        )}`;
      case "xbox":
        return `https://www.xbox.com/en-us/Search/Results?q=${encodeURIComponent(
          gameName,
        )}`;
      case "nintendo":
        return `https://www.nintendo.com/search/?q=${encodeURIComponent(
          gameName,
        )}`;
      case "mac":
        return `https://apps.apple.com/us/mac/search?term=${encodeURIComponent(
          gameName,
        )}`;
      case "ios":
        return `https://apps.apple.com/us/iphone/search?term=${encodeURIComponent(
          gameName,
        )}`;
      case "android":
        return `https://play.google.com/store/search?q=${encodeURIComponent(
          gameName,
        )}`;
      case "windows":
        return `https://play.google.com/store/search?q=${encodeURIComponent(
          gameName,
        )}`;
      case "wii":
        return `https://www.google.com/search?q=${encodeURIComponent(
          gameName,
        )} ${encodeURIComponent(platform) + " u"}`;
      case "stadia":
        return `https://stadia.google.com/gg/`;
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(
          gameName,
        )}`;
    }
  };

  const truncate = (text: string, length = 300) => {
    if (!text) return "";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  const getReleaseLabel = (unixSeconds: number) => {
    const today = new Date();
    const release = new Date(unixSeconds * 1000);

    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);

    const diffMs = release.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const absDays = Math.abs(diffDays);
    const years = Math.floor(absDays / 365);
    const days = absDays % 365;

    if (diffDays === 0) return "Released today";
    if (diffDays === -1) return "Released yesterday";
    if (diffDays === 1) return "Releases tomorrow";

    if (years > 0) {
      const yearText = `${years} year${years > 1 ? "s" : ""}`;
      const dayText = days > 0 ? `, ${days} day${days > 1 ? "s" : ""}` : "";

      return diffDays > 0
        ? `Releases in ${yearText}${dayText}`
        : `${yearText}${dayText} ago`;
    }

    return diffDays > 0
      ? `Releases in ${absDays} day${absDays > 1 ? "s" : ""}`
      : `${absDays} day${absDays > 1 ? "s" : ""} ago`;
  };

  const customReleaseDate = parseReleaseDate(
    trackedGameData?.customReleaseTime?.releasesAt,
  );
  const hasStructuredReleasePhases = Boolean(
    game?.earlyAccessDate || game?.fullReleaseDate,
  );
  const automaticReleaseState = getAutomaticReleaseState(
    game?.earlyAccessDate
      ? game.earlyAccessDate * 1000
      : trackedGameData?.igdb?.earlyAccessDate,
    game?.fullReleaseDate
      ? game.fullReleaseDate * 1000
      : trackedGameData?.igdb?.fullReleaseDate,
    typeof game?.released === "number" ? game.released * 1000 : null,
  );
  const isReleased = customReleaseDate
    ? customReleaseDate.getTime() <= Date.now()
    : hasStructuredReleasePhases ||
        trackedGameData?.igdb?.releaseDateKind === "early-access" ||
        trackedGameData?.igdb?.releaseDateKind === "full-release"
      ? automaticReleaseState === "released"
      : hasConfirmedReleaseDay(
          typeof game?.released === "number" ? game.released * 1000 : null,
          game?.releaseDatePrecision,
        ) && game.released * 1000 <= Date.now();

  const countdownDate =
    customReleaseDate ??
    (hasConfirmedReleaseDay(
      typeof game?.released === "number" ? game.released * 1000 : null,
      game?.releaseDatePrecision,
    )
      ? new Date(game.released * 1000)
      : null);
  const automaticAvailabilityDate =
    parseReleaseDate(
      game?.earlyAccessDate
        ? game.earlyAccessDate * 1000
        : trackedGameData?.igdb?.earlyAccessDate,
    ) ??
    parseReleaseDate(
      typeof game?.released === "number" ? game.released * 1000 : null,
    );
  const unlockAt =
    customReleaseDate?.getTime() ??
    automaticAvailabilityDate?.getTime() ??
    null;

  useEffect(() => {
    if (!unlockAt) return;

    const remaining = unlockAt - Date.now();
    if (remaining <= 0) return;

    const timer = window.setTimeout(
      () => setReleaseClock((current) => current + 1),
      Math.min(remaining + 100, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [releaseClock, unlockAt]);

  const showReleaseCountdown = Boolean(
    countdownDate && countdownDate.getTime() > Date.now(),
  );

  const awardYear =
    typeof game?.released === "number"
      ? new Date(game.released * 1000).getFullYear()
      : new Date().getFullYear();

  // Official only makes sense if released
  const hasReleaseDate = Boolean(game?.released);
  const platformCount = Array.isArray(game?.platforms)
    ? game.platforms.length
    : 0;
  const resolvedFactNames = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0,
          )
          .join(", ")
      : typeof value === "string" && value.trim().length > 0
        ? value
        : "";
  const gameFacts = [
    { label: "Developer", value: resolvedFactNames(game?.developers) },
    { label: "Publisher", value: resolvedFactNames(game?.publishers) },
    { label: "Franchise", value: resolvedFactNames(game?.franchises) },
    { label: "Engine", value: resolvedFactNames(game?.game_engines) },
    { label: "Themes", value: resolvedFactNames(game?.themes) },
    {
      label: "Perspective",
      value: resolvedFactNames(game?.player_perspectives),
    },
    { label: "Age rating", value: resolvedFactNames(game?.age_ratings) },
    { label: "Status", value: resolvedFactNames(game?.game_status) },
  ].filter((fact) => Boolean(fact.value));
  const isAvailableToPlay = customReleaseDate
    ? customReleaseDate.getTime() <= Date.now()
    : isReleased || automaticReleaseState === "early-access";
  const showUnreleasedOverlay = !isAvailableToPlay;

  const trackingModalGame = useMemo<TrackedGame | null>(() => {
    if (!game?.id) return null;

    let coverUrl = "/placeholder-game.jpg";
    if (game.cover) {
      if (typeof game.cover === "string") {
        coverUrl = game.cover.includes("https:")
          ? game.cover
          : `https:${game.cover}`;
      } else if (game.cover.url) {
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_1080p")}`;
      }
    } else if (game.background_image) {
      coverUrl = game.background_image;
    }

    const releaseDate =
      typeof game.released === "number"
        ? new Date(game.released * 1000)
        : undefined;

    return {
      _docId: String(game.id),
      name: game.name,
      playtime: trackedGameData?.playtime ?? 0,
      my_rating: trackedGameData?.my_rating ?? null,
      status: trackedGameData?.status ?? currentStatus ?? "Playing",
      progress: trackedGameData?.progress ?? 0,
      review: trackedGameData?.review ?? {
        text: "",
        sticker: null,
      },
      favorite: trackedGameData?.favorite ?? isFavorited ?? false,
      playedSessions: trackedGameData?.playedSessions ?? [],
      playedOn: trackedGameData?.playedOn ?? [],
      notInterested: trackedGameData?.notInterested ?? false,
      preReleaseAccess: trackedGameData?.preReleaseAccess ?? null,
      customReleaseTime: trackedGameData?.customReleaseTime ?? null,
      igdb: {
        id: game.id,
        name: game.name,
        cover: coverUrl,
        rating: game.rating || 0,
        genres: normalizeGenres(game.genres),
        releaseDate,
        earlyAccessDate:
          trackedGameData?.igdb?.earlyAccessDate ??
          (typeof game.earlyAccessDate === "number"
            ? new Date(game.earlyAccessDate * 1000)
            : null),
        earlyAccessDatePrecision:
          trackedGameData?.igdb?.earlyAccessDatePrecision ??
          game.earlyAccessDatePrecision ??
          null,
        fullReleaseDate:
          trackedGameData?.igdb?.fullReleaseDate ??
          (typeof game.fullReleaseDate === "number"
            ? new Date(game.fullReleaseDate * 1000)
            : null),
        fullReleaseDatePrecision:
          trackedGameData?.igdb?.fullReleaseDatePrecision ??
          game.fullReleaseDatePrecision ??
          null,
        releaseDateKind:
          trackedGameData?.igdb?.releaseDateKind ??
          game.releaseDateKind ??
          null,
        releaseDatePrecision: game.releaseDatePrecision ?? null,
      },
    };
  }, [game, trackedGameData, currentStatus, isFavorited]);
  const hasTrackedEntry = Boolean(trackedGameData);

  const handleSaveTrackingModal = async (
    review: {
      text: string;
      sticker: string | null;
    },
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    notInterested: boolean,
    playedSessions: NonNullable<TrackedGame["playedSessions"]>,
    playedOn: TrackedGame["playedOn"],
    preReleaseAccess: TrackedGame["preReleaseAccess"],
  ) => {
    if (!user || !game || trackingSaving) return;

    try {
      setTrackingSaving(true);
      const reviewForSave = {
        ...review,
        createdAt: review.text.trim()
          ? (trackedGameData?.review?.createdAt ??
            (trackedGameData?.review?.text?.trim()
              ? trackedGameData.lastUpdated
              : null) ??
            new Date())
          : null,
        updatedAt: review.text.trim() ? new Date() : null,
      };
      await updateTrackedGame({
        review: reviewForSave,
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
        notInterested,
        playedSessions,
        playedOn,
        preReleaseAccess,
        lastUpdated: serverTimestamp(),
      });

      const communityReviewRef = doc(
        db,
        "communityReviews",
        `${user.uid}_${game.id}`,
      );
      const visibility =
        (userProfile?.privacy as { profile?: string } | undefined)?.profile ??
        "public";

      if (reviewForSave.text.trim() && visibility === "public") {
        await setDoc(
          communityReviewRef,
          {
            userId: user.uid,
            username:
              userProfile?.username ?? user.displayName ?? "PlayCrew User",
            gameId: Number(game.id),
            gameName: game.name,
            text: reviewForSave.text.trim(),
            sticker: reviewForSave.sticker ?? null,
            rating: typeof rating === "number" ? rating : null,
            playtime,
            status,
            progress,
            playedOn: playedOn ?? null,
            visibility: "public",
            createdAt: reviewForSave.createdAt,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ).catch((error) =>
          console.error("Failed to sync community review", error),
        );
      } else {
        await deleteDoc(communityReviewRef).catch(() => undefined);
      }
      setGameReviewsRefreshKey((key) => key + 1);

      setCurrentStatus(status);
      setIsFavorited(favorite);
      setTrackedGameData((prev: any) => ({
        ...(prev ?? {}),
        review: reviewForSave,
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
        notInterested,
        playedSessions,
        playedOn,
        preReleaseAccess,
      }));
      setTrackingModalOpen(false);
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">updated Successfully.</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save game.");
    } finally {
      setTrackingSaving(false);
    }
  };

  const handleRemoveTrackingEntry = async () => {
    if (!user || !game || trackingRemoving) return;

    try {
      setTrackingRemoving(true);
      await deleteDoc(
        doc(db, "users", user.uid, "games_igdb", game.id.toString()),
      );
      setTrackedGameData(null);
      setCurrentStatus(null);
      setIsFavorited(false);
      setTrackingModalOpen(false);
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">is now removed from your library.</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove game from library.");
    } finally {
      setTrackingRemoving(false);
    }
  };

  const hasAwards = !loadingWinnerAwards && gotyAwards.length > 0;
  const storyLimit = hasAwards ? 580 : 680;

  ///////////////////////////////////////// UI /////////////////////////////////////////////

  if (loadingGame) return <LoadingSpinner />;

  if (gameLoadError || !game) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="rounded-3xl border border-white/10 bg-black/25 px-8 py-10 backdrop-blur-xl">
          <p className="text-lg font-semibold text-white">Unable to load game</p>
          <p className="mt-2 text-sm text-white/55">
            {gameLoadError || "This game could not be found."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const reactToReview = async (reviewId: string, reaction: ReviewReaction) => {
    if (!user) {
      toast.error("Sign in to react to reviews.");
      return;
    }

    const current = gameReviews.find((review) => review.id === reviewId);
    if (!current) return;
    const previousReaction = current.myReaction;
    const nextReaction = previousReaction === reaction ? null : reaction;

    setGameReviews((reviews) =>
      reviews.map((review) => {
        if (review.id !== reviewId) return review;
        const counts = { ...review.reactions };
        if (previousReaction) {
          counts[previousReaction] = Math.max(0, counts[previousReaction] - 1);
        }
        if (nextReaction) counts[nextReaction] += 1;
        return { ...review, reactions: counts, myReaction: nextReaction };
      }),
    );

    const reactionRef = doc(
      db,
      "communityReviews",
      reviewId,
      "reactions",
      user.uid,
    );

    try {
      if (nextReaction) {
        await setDoc(reactionRef, {
          userId: user.uid,
          type: nextReaction,
          createdAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(reactionRef);
      }
    } catch (error) {
      console.error("Failed to react to review", error);
      setGameReviews((reviews) =>
        reviews.map((review) => (review.id === reviewId ? current : review)),
      );
      toast.error("Could not save your reaction.");
    }
  };

  if (loadingGame) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen bg-black text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </motion.div>
    );
  }

  return (
    <>
      {/* dynamic top padding: larger spacing when top nav is used, smaller for sidebar */}
      <div
        className={`relative min-h-screen text-white bg-transparent ${
          navbarLayout === "sidebar" ? "" : "pt-12 sm:pt-14 lg:pt-12"
        }`}
      >
        {/* HERO BACKGROUND */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src={posterImage}
            alt=""
            onLoad={() => setLoadedBackground(posterImage)}
            className={`absolute inset-0 h-full w-full object-cover blur-xl brightness-75 transition-opacity duration-700 ease-out ${
              loadedBackground === posterImage ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="absolute inset-0 bg-black/5" />
        </div>

        {/* MAIN CONTENT */}

        <motion.main
          className="relative z-10 mx-auto grid max-w-[1780px] gap-5 px-3 py-4 sm:px-4 lg:px-6 lg:py-6 2xl:grid-cols-[minmax(0,1fr)_300px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="flex min-w-0 flex-col gap-5">
            <section className="overflow-hidden rounded-4xl border border-white/12 bg-black/[0.08] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-md sm:p-5 xl:p-6">
              <div className="grid gap-5 xl:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[272px_minmax(0,1fr)]">
                <aside className="flex flex-col items-center gap-4 xl:sticky xl:top-24 xl:self-start">
                  {/* Poster */}
                  <div className="relative aspect-[2/3] w-44 sm:w-48 lg:w-70">
                    <img
                      src={posterImage}
                      alt={game.name || "Game poster"}
                      loading="eager"
                      fetchPriority="high"
                      className="h-full w-full rounded-[26px] object-cover shadow-[0_18px_60px_rgba(0,0,0,0.48)]"
                    />
                  </div>

                  {/* Compact stat grid */}
                  <div className="grid w-full max-w-[280px] grid-cols-1 gap-3">
                    {/* Personal rating */}
                    <div className="flex flex-col justify-evenly rounded-2xl border border-white/12 bg-white/2 p-3 text-center">
                      <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                        My Rating
                      </h3>

                      <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-white">
                        <FaStar
                          size={12}
                          className={
                            typeof trackedGameData?.my_rating === "number" &&
                            trackedGameData.my_rating > 0
                              ? "text-amber-300"
                              : "text-white/35"
                          }
                        />
                        <span>
                          {typeof trackedGameData?.my_rating === "number" &&
                          trackedGameData.my_rating > 0
                            ? `${Number(trackedGameData.my_rating.toFixed(2))} / 10`
                            : "Not rated"}
                        </span>
                      </div>

                      <p className="text-[10px] text-white/55">
                        {typeof trackedGameData?.my_rating === "number" &&
                        trackedGameData.my_rating > 0
                          ? "Your personal score"
                          : "Set in Manage Game"}
                      </p>
                    </div>

                    {/* Release */}
                    <div className="flex flex-col justify-evenly rounded-2xl border border-white/12 bg-white/2 p-3 text-center">
                      <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                        Release Date
                      </h3>

                      <div className="text-[12px] font-semibold text-white">
                        {game.released
                          ? formatReleaseDate(
                              game.released * 1000,
                              game.releaseDatePrecision,
                            )
                          : "TBA"}
                      </div>
                    </div>
                  </div>

                  {gameFacts.length > 0 && (
                    <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/12 bg-black/12 p-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
                      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/8 pb-2.5">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                          Game Facts
                        </h3>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee] shadow-[0_0_9px_rgba(34,211,238,0.7)]" />
                      </div>

                      <dl className="space-y-2.5">
                        {gameFacts.map((fact) => (
                          <div
                            key={fact.label}
                            className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 text-[10px] leading-4"
                          >
                            <dt className="text-white/35">{fact.label}</dt>
                            <dd
                              className="min-w-0 text-right font-semibold text-white/75"
                              title={fact.value}
                            >
                              {fact.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </aside>

                <div className="min-w-0 space-y-4 sm:space-y-5">
                  <div className="overflow-hidden rounded-[28px] border border-white/12 bg-black/12 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.24)] sm:p-5 xl:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-3">
                          <h1 className="wrap-break-words text-3xl font-extrabold leading-none drop-shadow-xl sm:text-4xl lg:text-5xl xl:text-[3.4rem]">
                            {game.name}
                          </h1>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                            {normalizeGenres(game.genres)
                              .slice(0, 4)
                              .map((genre) => (
                                <span
                                  key={genre}
                                  className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/74"
                                >
                                  {genre}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 xl:ml-auto xl:max-w-[320px] xl:justify-end">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <AnimatePresence initial={false}>
                              {hasTrackedEntry && (
                                <>
                                  <motion.button
                                    key="favorite"
                                    onClick={handleFavoriteToggle}
                                    whileHover={{ y: -2, scale: 1.03 }}
                                    whileTap={{ scale: 0.96 }}
                                    className={`relative flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-semibold ${
                                      isFavorited
                                        ? "border-red-400/45 bg-red-600 text-white"
                                        : "border-white/12 bg-transparent text-white/90 hover:bg-red-500 hover:text-white"
                                    }`}
                                    disabled={loadingFavorite}
                                  >
                                    {/* Main content (keeps width) */}
                                    <span
                                      className={`flex items-center gap-2 ${
                                        loadingFavorite
                                          ? "opacity-0"
                                          : "opacity-100"
                                      }`}
                                    >
                                      <FaHeart />
                                      {isFavorited ? "Favorited" : "Favorite"}
                                    </span>

                                    {/* Loader overlay */}
                                    {loadingFavorite && (
                                      <span className="absolute inset-0 flex items-center justify-center">
                                        <span className="loading loading-dots loading-sm" />
                                      </span>
                                    )}
                                  </motion.button>

                                  <motion.button
                                    key="edit-tracking"
                                    onClick={() => {
                                      if (!requireLogin()) return;
                                      setTrackingModalOpen(true);
                                    }}
                                    whileHover={{ y: -2, scale: 1.03 }}
                                    whileTap={{ scale: 0.96 }}
                                    className="inline-flex px-2 py-2 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-400/12 text-[13px] font-semibold text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.12)] hover:border-emerald-200/50 hover:bg-emerald-400/18"
                                  >
                                    <>
                                      <IoLogoGameControllerB size={15} />
                                      Manage Game
                                    </>
                                  </motion.button>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {statuses.map((s) => {
                          const isSelected =
                            currentStatus?.trim().toLowerCase() ===
                            s.label.toLowerCase();
                          return (
                            <motion.button
                              key={s.label}
                              onClick={() => {
                                if (!requireLogin()) return;
                                handleChangeStatus(s.label);
                              }}
                              whileHover={{ y: -2, scale: 1.03 }}
                              whileTap={{ scale: 0.96 }}
                              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] ${
                                isSelected
                                  ? `${s.color} border-transparent text-white`
                                  : "border-white/12 bg-transparent text-white/88 hover:bg-white/14"
                              }`}
                            >
                              <span className="relative inline-grid place-items-center">
                                <span
                                  className={`flex items-center gap-2 ${
                                    loadingStatus === s.label
                                      ? "opacity-0"
                                      : "opacity-100"
                                  }`}
                                >
                                  {s.icon && s.icon}
                                  <span>{s.label}</span>
                                </span>
                                {loadingStatus === s.label && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="loading loading-dots loading-sm" />
                                  </span>
                                )}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: loadingWinnerAwards ? 0.4 : 1,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="relative h-[112px] overflow-hidden rounded-[22px] border border-amber-200/15 bg-black/12 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.14),transparent_42%)]" />
                        {/* HEADER */}
                        <div className="relative mb-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-200/20 bg-amber-300/10 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.1)]">
                              <FaTrophy size={12} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
                                PlayCrew Awards
                              </p>
                              <p className="text-[8px] uppercase tracking-[0.15em] text-white/35">
                                Recognition archive
                              </p>
                            </div>
                          </div>

                          {!loadingWinnerAwards && (
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
                              {isReleased
                                ? `${winnerAwards.length} ${winnerAwards.length === 1 ? "win" : "wins"}`
                                : hasReleaseDate
                                  ? `Next awards · Dec 10, ${awardYear}`
                                  : "Date TBA"}
                            </span>
                          )}
                        </div>

                        {/* LOADING */}
                        {loadingWinnerAwards && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex h-8 items-center justify-center gap-2"
                          >
                            <span className="loading loading-infinity loading-sm" />
                          </motion.div>
                        )}

                        {/* NOT RELEASED YET */}
                        {!loadingWinnerAwards && !isReleased && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex h-10 items-center justify-center text-center text-[12px] leading-4 text-white/70"
                          >
                            {winnerAwards.length > 0 && hasReleaseDate ? (
                              <div className="flex w-full min-w-0 items-center">
                                <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
                                  <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-amber-200/60">
                                    Previous win
                                  </span>
                                  <div className="flex min-w-0 gap-1.5 overflow-hidden">
                                    {winnerAwards.map((award) => (
                                      <span
                                        key={`${award.year}-${award.category}-history`}
                                        className="truncate rounded-full border border-amber-200/15 bg-amber-300/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/75"
                                      >
                                        <strong className="text-amber-200">
                                          {award.year}
                                        </strong>{" "}
                                        {award.category}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="hidden">
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(103,232,249,0.8)]" />
                                  <div>
                                    <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-200/65">
                                      Next ceremony
                                    </p>
                                    <p className="text-[11px] font-bold text-white/85">
                                      {awardYear} · Dec 10
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : hasReleaseDate ? (
                              <>
                                {awardYear} PlayCrew Game Awards will be
                                announced on
                                <span className="font-semibold text-amber-200 pl-1">
                                  December 10th, {awardYear}
                                </span>
                                .
                              </>
                            ) : (
                              <span>This game is unannounced yet.</span>
                            )}
                          </motion.div>
                        )}

                        {/* RELEASED BUT NO AWARDS */}
                        {!loadingWinnerAwards &&
                          isReleased &&
                          winnerAwards.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex h-8 items-center justify-center text-center text-[12px] text-white/60"
                            >
                              No PlayCrew awards won
                            </motion.div>
                          )}

                        {/* AWARDS */}
                        {!loadingWinnerAwards &&
                          isReleased &&
                          winnerAwards.length > 0 && (
                            <>
                              <div
                                ref={genreContainerRef}
                                className="relative flex h-8 w-full max-w-full items-center overflow-hidden"
                              >
                                <motion.div
                                  className="flex w-max items-center gap-2 whitespace-nowrap"
                                  animate={
                                    genreShouldScroll && genreScrollDistance > 0
                                      ? { x: [0, -genreScrollDistance] }
                                      : { x: 0 }
                                  }
                                  transition={
                                    genreShouldScroll && genreScrollDistance > 0
                                      ? {
                                          duration: Math.max(
                                            14,
                                            genreScrollDistance / 34,
                                          ),
                                          repeat: Infinity,
                                          ease: "linear",
                                        }
                                      : { duration: 0 }
                                  }
                                >
                                  {/* ORIGINAL */}
                                  <div
                                    ref={genreTrackRef}
                                    className="flex shrink-0 items-center gap-2 whitespace-nowrap"
                                  >
                                    {winnerAwards.map((award) => (
                                      <span
                                        key={`${award.year}-${award.category}`}
                                        className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/84"
                                      >
                                        {award.year} {award.category}
                                      </span>
                                    ))}
                                  </div>

                                  {/* DUPLICATE FOR LOOP */}
                                  {genreShouldScroll && (
                                    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                                      {otherWinnerAwards.map((award) => (
                                        <span
                                          key={`${award.year}-${award.category}-loop`}
                                          className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/84"
                                        >
                                          {award.year} {award.category}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              </div>
                            </>
                          )}
                      </motion.div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      layout
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`grid gap-4 ${
                        hasAwards
                          ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]"
                          : showReleaseCountdown
                            ? "grid-cols-1"
                            : "grid-cols-1 lg:h-60"
                      }`}
                    >
                      <div className="flex min-w-0 flex-col gap-4">
                        {/* STORY */}
                        <motion.div
                          layout
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="flex-1 rounded-[28px] border border-white/12 bg-black/12 p-5"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-2xl font-bold text-white">
                              Story
                            </h2>

                            {description?.length > storyLimit && (
                              <button
                                className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline"
                                onClick={() => setAboutOpen(true)}
                              >
                                Read more
                              </button>
                            )}
                          </div>

                          <p className="text-[13px] leading-7 text-white/78">
                            {description
                              ? truncate(description, storyLimit)
                              : "No description found."}
                          </p>
                        </motion.div>

                        {showReleaseCountdown && countdownDate && (
                          <ReleaseCountdown date={countdownDate} />
                        )}
                      </div>

                      {/* AWARDS */}
                      <AnimatePresence>
                        {hasAwards && (
                          <motion.div
                            key="awards"
                            initial={{ opacity: 0, x: 70 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 70 }}
                            transition={{
                              duration: 0.4,
                              ease: "easeOut",
                              delay: 0.08,
                            }}
                            className="relative z-0 w-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.42),rgba(245,158,11,0.14)_38%,rgba(0,0,0,0.62)_82%)] px-4 pb-5 pt-4 text-center shadow-[0_24px_48px_rgba(0,0,0,0.34)]"
                          >
                            {/* Trophy */}
                            <div className="mx-auto mt-2 flex h-35 w-35 items-center justify-center">
                              <img
                                src="/GOTY-New.png"
                                alt=""
                                className="h-45 w-45 object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.42)]"
                              />
                            </div>

                            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-100/78">
                              PlayCrew Awards
                            </p>

                            <h3 className="mt-2 text-[16px] font-black uppercase tracking-[0.18em] text-amber-50">
                              Game of the Year
                            </h3>

                            <motion.div
                              className="mt-3 flex flex-wrap items-center justify-center gap-1.5"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.18 }}
                            >
                              {gotyAwards.map((award) => (
                                <span
                                  key={`${award.year}-${award.category}`}
                                  className="rounded-xl border border-amber-100/30 bg-amber-300/14 px-2.5 py-1 text-[12px] uppercase tracking-[0.08em] text-amber-50"
                                >
                                  {award.year} Winner
                                </span>
                              ))}
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <RatingAnalysis
                      score={game.total_rating}
                      totalCount={game.total_rating_count}
                    />
                    <TimeToBeat gameName={game.name} data={game.time_to_beat} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-4xl border border-white/12 bg-black/12 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:p-5 xl:p-6">
              <div className="mb-5 flex flex-wrap justify-center gap-2 text-[15px]">
                <motion.button
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={`rounded-full border px-4 py-2 ${
                    tab === "screenshots"
                      ? "border-[#67e8f9]/50 bg-[#22d3ee] text-black shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
                  onClick={() => setTab("screenshots")}
                >
                  Screenshots
                </motion.button>
                <motion.button
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={`rounded-full border px-4 py-2 ${
                    tab === "trailers"
                      ? "border-[#67e8f9]/50 bg-[#22d3ee] text-black shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
                  onClick={() => setTab("trailers")}
                >
                  Trailers
                </motion.button>
                <motion.button
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={`rounded-full border px-4 py-2 ${
                    tab === "similar"
                      ? "border-[#67e8f9]/50 bg-[#22d3ee] text-black shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
                  onClick={() => setTab("similar")}
                >
                  Similar Games
                </motion.button>
              </div>

              <AnimatePresence mode="wait">
                {tab === "screenshots" && (
                  <motion.div
                    key="screenshots"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <div className="relative">
                      {!screenshotsReady && (
                        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={`skeleton-shot-${idx}`}
                              className="h-48 rounded-lg bg-zinc-800/80 animate-pulse"
                            />
                          ))}
                        </div>
                      )}
                      <div
                        className={`transition-opacity duration-500 ${
                          screenshotsReady ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <ScreenshotsCarousel screenshots={screenshots} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {tab === "trailers" && (
                  <motion.div
                    key="trailers"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <VideoCarousel videos={videoThumbnails} />
                  </motion.div>
                )}
                {tab === "similar" && (
                  <motion.div
                    key="similar"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <SimilarGamesGrid games={similarGames} maxItems={20} />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          <aside className="w-full">
            {/* <div className="relative h-full overflow-hidden rounded-[30px] border border-white/12 bg-black/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5"> */}
            <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-black/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div>
                  <p className="text-[14px] font-bold uppercase tracking-[0.42em] text-white/55">
                    Platforms Hub
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4`}
                >
                  <h2 className="mb-3 text-lg font-bold">Official</h2>
                  <div className="relative mt-3">
                    <div
                      className={`space-y-3 transition ${platformCount > 6 ? "2xl:max-h-43 2xl:overflow-y-auto 2xl:pr-3 2xl:overscroll-contain" : ""}`}
                    >
                      {platformCount > 0 ? (
                        <>
                          {game.platforms
                            .flatMap((p: any) => {
                              if (!p?.platform?.name) return [];

                              const name = p.platform.name;
                              const lowerName = name.toLowerCase();

                              // PC gets both Steam + Epic
                              if (lowerName.includes("pc")) {
                                return [
                                  {
                                    key: "steam",
                                    platform: "steam",
                                    label: "Steam",
                                  },
                                  {
                                    key: "epic",
                                    platform: "epic",
                                    label: "Epic Games",
                                  },
                                ];
                              }

                              const platform = getParentPlatform(name);

                              // Ignore platforms we don't have a store mapping for
                              if (!platform) return [];

                              return [
                                {
                                  key: platform,
                                  platform,
                                  label: name,
                                },
                              ];
                            })
                            .map((item: any) => (
                              <motion.a
                                key={item.key}
                                href={getPlatformLink(item.platform, game.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ y: -2, scale: 1.02 }}
                                className="flex w-full items-center gap-2 rounded-xl bg-white/8 px-3 py-2 transition-colors duration-300 hover:bg-white/16"
                              >
                                {getPlatformIcon(item.platform)}

                                <span className="text-[12px]">
                                  {item.label}
                                </span>
                              </motion.a>
                            ))}
                        </>
                      ) : (
                        <p className="text-center text-sm text-white/50">
                          No official stores available.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4 ${platformCount > 6 ? "pr-7" : ""}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-lg font-bold">Cracked</h2>
                    <div className="group relative inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Cracked availability note"
                        className="inline-flex h-4 w-4 items-center justify-center text-white/55 transition-all hover:text-white/80 focus:outline-none"
                      >
                        <FaInfoCircle size={12} />
                      </button>
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[13px] font-medium leading-relaxed tracking-wide text-zinc-200 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100">
                        If the game has
                        <span className="text-red-500 pl-1">Denuvo</span>, it
                        most likely will not be cracked soon.
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <div
                      className={`space-y-3 transition ${
                        showUnreleasedOverlay
                          ? "pointer-events-none select-none blur-sm"
                          : ""
                      }`}
                    >
                      <a
                        href={`https://fitgirl-repacks.site/${encodeURIComponent(
                          game.name
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, ""),
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=fitgirl-repacks.site&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>FitGirl Repacks</span>
                      </a>

                      <a
                        href={`https://dodi-repacks.site/${encodeURIComponent(
                          game.name
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, ""),
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=dodi-repacks.site&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Dodi Repacks</span>
                      </a>
                      <a
                        href={`https://gamedrive.org/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=gamedrive.org&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>GameDrive</span>
                      </a>
                      <a
                        href={`https://www.skidrowreloaded.com/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=skidrowreloaded.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Skidrow Reloaded</span>
                      </a>
                      <a
                        href={`https://www.aimhaven.com/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=aimhaven.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>AimHaven</span>
                      </a>
                    </div>

                    {showUnreleasedOverlay && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 px-6 text-center">
                          <p className="text-xs uppercase tracking-wide leading-relaxed text-white/60">
                            Locked until
                            <br />
                            release day
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4 ${platformCount > 6 ? "pr-7" : ""}`}
                >
                  <h2 className="mb-3 text-lg font-bold">Mods</h2>
                  <div className="relative overflow-hidden rounded-xl">
                    <div
                      className={`transition ${
                        showUnreleasedOverlay
                          ? "pointer-events-none select-none blur-sm"
                          : ""
                      }`}
                    >
                      <a
                        href={`https://www.nexusmods.com/games?keyword=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=nexusmods.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Nexus Mods</span>
                      </a>
                    </div>

                    {showUnreleasedOverlay && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-sm">
                        <div className="flex w-full flex-col gap-3 px-6">
                          <p className="w-full text-center text-xs uppercase tracking-normal leading-relaxed text-white/60">
                            Locked until release day
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </motion.main>

        <section className="relative z-10 mx-auto mt-5 w-full max-w-[1780px] px-3 pb-8 sm:px-4 lg:px-6">
          <div className="relative overflow-hidden rounded-[34px] border border-white/12 bg-black/10 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-4">
            <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-cyan-400/[0.06] blur-3xl" />
            <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
            <div className="rounded-[26px] border border-white/10 bg-black/15 p-4 sm:p-5 xl:p-6">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#67e8f9]">
                    Community
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    User Reviews
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/65 sm:inline-flex">
                    {gameReviews.length} {gameReviews.length === 1 ? "review" : "reviews"}
                  </span>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous review"
                    disabled={
                      activeReviewIndex === 0 || gameReviews.length === 0
                    }
                    onClick={() =>
                      setActiveReviewIndex((current) =>
                        Math.max(0, current - 1),
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.035] text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-default disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-inherit"
                  >
                    <FaChevronLeft />
                  </button>
                  <span className="min-w-12 text-center text-xs tabular-nums text-white/55">
                    {gameReviews.length
                      ? `${activeReviewIndex + 1} / ${gameReviews.length}`
                      : "0 / 0"}
                  </span>
                  <button
                    type="button"
                    aria-label="Next review"
                    disabled={
                      gameReviews.length === 0 ||
                      activeReviewIndex >= gameReviews.length - 1
                    }
                    onClick={() =>
                      setActiveReviewIndex((current) =>
                        Math.min(gameReviews.length - 1, current + 1),
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.035] text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-default disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-inherit"
                  >
                    <FaChevronRight />
                  </button>
                  </div>
                </div>
              </div>

              {loadingGameReviews ? (
                <div
                  className="space-y-4"
                  aria-label="Loading community reviews"
                >
                  {[0].map((item) => (
                    <div
                      key={item}
                      className="h-[570px] animate-pulse overflow-hidden rounded-[26px] border border-white/10 bg-black/25 p-4 sm:h-[540px] sm:p-5 md:h-[410px]"
                    >
                      <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b border-white/8 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-13 w-13 rounded-full bg-white/8" />
                            <div className="space-y-2">
                              <div className="h-4 w-32 rounded bg-white/8" />
                              <div className="h-3 w-24 rounded bg-white/6" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-16 w-16 rounded-full bg-white/8" />
                            <div className="h-16 w-24 rounded-xl bg-white/8" />
                          </div>
                        </div>
                        <div className="grid h-[300px] shrink-0 gap-4 py-4 md:h-[176px] md:grid-cols-[minmax(0,1fr)_160px]">
                          <div className="space-y-2">
                            <div className="h-3 w-full rounded bg-white/8" />
                            <div className="h-3 w-5/6 rounded bg-white/8" />
                            <div className="h-3 w-2/3 rounded bg-white/8" />
                          </div>
                          <div className="hidden aspect-square rounded-2xl bg-white/7 md:block" />
                        </div>
                        <div className="h-10 border-t border-white/8 pt-3">
                          <div className="h-3 w-3/4 rounded bg-white/7" />
                        </div>
                        <div className="mt-3 flex gap-2 border-t border-white/6 pt-3">
                          {[0, 1, 2].map((reaction) => (
                            <div
                              key={reaction}
                              className="h-8 w-24 rounded-xl bg-white/7"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : gameReviewsError ? (
                <p className="rounded-2xl border border-dashed border-amber-400/20 bg-amber-500/[0.06] px-4 py-8 text-center text-sm text-amber-100/65">
                  Community reviews could not be loaded. Firestore denied the
                  cross-user review query.
                </p>
              ) : gameReviews.length > 0 ? (
                <div className="space-y-4">
                  {gameReviews
                    .slice(activeReviewIndex, activeReviewIndex + 1)
                    .map((review) => (
                      <motion.article
                        key={review.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="group relative h-[570px] overflow-hidden rounded-[26px] border border-white/12 bg-black/25 p-4 shadow-[0_16px_55px_rgba(0,0,0,0.22)] transition-[border-color] hover:border-white/30 sm:h-[540px] sm:p-5 md:h-[410px]"
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_36%)] opacity-70" />
                        <div className="relative flex h-full flex-col">
                          <header className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                              <Link
                                href={`/users/${review.username}`}
                                className="flex min-w-0 items-center gap-3.5"
                              >
                                <div className="h-13 w-13 shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-black/30 p-0.5">
                                  {review.avatar ? (
                                    <img
                                      src={review.avatar}
                                      alt={`${review.username}'s avatar`}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full border border-white/12 bg-white/10 text-xl font-black text-white">
                                      {review.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-black text-white hover:underline">
                                    @{review.username}
                                  </p>
                                  <p className="mt-1 text-xs text-white/55">
                                    Member since{" "}
                                    {formatCommunityDate(review.memberSince)}
                                  </p>
                                </div>
                              </Link>
                            </div>

                            <div className="flex items-stretch gap-2 self-end xl:self-auto">
                              <div
                                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                                style={{
                                  background: `conic-gradient(rgb(34, 211, 238) ${Math.max(0, Math.min(10, review.rating ?? 0)) * 10}%, rgba(255,255,255,0.08) 0)`,
                                }}
                              >
                                <div className="flex gap-0.5 h-13 w-13 items-center justify-center rounded-full bg-black/90">
                                  <span className="text-xl font-black text-white">
                                    {review.rating ?? "—"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex min-w-24 flex-col justify-center rounded-xl border border-white/12 bg-white/[0.055] px-3 py-2 text-center">
                                <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
                                  <FiClock /> Playtime
                                </p>
                                <p className="mt-1 text-base font-black text-white">
                                  {review.playtime > 0
                                    ? `${Number.isInteger(review.playtime) ? review.playtime : review.playtime.toFixed(1)}h`
                                    : "Not set"}
                                </p>
                              </div>
                            </div>
                          </header>

                          <div
                            className={`grid h-[300px] shrink-0 gap-4 py-4 md:h-[176px] ${review.sticker ? "md:grid-cols-[minmax(0,1fr)_160px]" : ""}`}
                          >
                            <p className="overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-7 text-white sm:text-base">
                              {review.text}
                            </p>
                            {review.sticker && (
                              <div className="flex aspect-square w-full max-w-[160px] items-center justify-center justify-self-center overflow-hidden p-2 md:justify-self-end">
                                <CommunityReviewSticker
                                  sticker={review.sticker}
                                />
                              </div>
                            )}
                          </div>

                          <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-white/10 pt-3 text-xs text-white/55">
                            <span className="inline-flex items-center gap-1.5">
                              <FiCalendar /> Posted{" "}
                              {formatCommunityDate(review.createdAt)}
                            </span>
                            |
                            <span className="inline-flex items-center gap-1.5">
                              <FiEdit3 /> Updated{" "}
                              {formatCommunityDate(review.updatedAt)}
                            </span>
                            |
                            {review.status && (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-[#67e8f9]">
                                {review.status === "Completed" ? (
                                  <div className="flex items-center gap-1.5">
                                    <FaTrophy />
                                  </div>
                                ) : (
                                  <FiCheckCircle />
                                )}
                                {review.status}
                              </span>
                            )}
                            |
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-4 w-4 rounded-full border border-white/20"
                                style={{
                                  background: `conic-gradient(rgb(34, 211, 238) ${Math.max(0, Math.min(100, review.progress))}%, rgba(255,255,255,0.08) 0)`,
                                }}
                                aria-hidden="true"
                              />
                              {review.progress}% progress
                            </span>
                            |
                            <span className="inline-flex items-center gap-1.5">
                              Played on:{" "}
                              {normalizePlayedOn(review.playedOn).map(
                                (platform) => (
                                  <PlayedOnPlatformIcon
                                    key={platform}
                                    value={platform}
                                    className="text-[#67e8f9]"
                                  />
                                ),
                              )}
                              {formatPlayedOn(review.playedOn)}
                            </span>
                          </footer>

                          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                            {[
                              {
                                type: "helpful" as const,
                                label: "Helpful",
                                icon: FiThumbsUp,
                              },
                              {
                                type: "funny" as const,
                                label: "Funny",
                                icon: FiSmile,
                              },
                              {
                                type: "100-percent" as const,
                                label: "100%",
                                icon: FaFire,
                              },
                              {
                                type: "glazzing" as const,
                                label: "Glazzing",
                                icon: FaCrown,
                              },
                            ].map((reaction) => {
                              const Icon = reaction.icon;
                              const active =
                                review.myReaction === reaction.type;
                              return (
                                <button
                                  key={reaction.type}
                                  type="button"
                                  onClick={() =>
                                    reactToReview(review.id, reaction.type)
                                  }
                                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                    active
                                      ? "border-[#22d3ee]/45 bg-[#22d3ee]/10 text-[#a5f3fc]"
                                      : "border-white/12 bg-white/[0.035] text-white/55 hover:bg-white/10 hover:text-white"
                                  }`}
                                  aria-pressed={active}
                                >
                                  <Icon /> {reaction.label}
                                  <span className="opacity-60">
                                    {review.reactions[reaction.type]}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.article>
                    ))}
                </div>
              ) : (
                <div className="relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] px-6 py-10 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.07),transparent_52%)]" />
                  <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] text-2xl text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
                    <FiMessageSquare />
                  </div>
                  <p className="relative mt-4 text-base font-bold text-white/85">
                    Start the conversation
                  </p>
                  <p className="relative mt-1 max-w-md text-sm leading-6 text-white/45">
                    No community reviews yet. Share what you thought about the game and be the first one here.
                  </p>
                </div>
              )}
            </div>
            <aside className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.09),transparent_48%)]" />
              <div className="relative">
                <header className="border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-[#67e8f9]">
                      My Review
                    </p>
                    <p className="mt-1 text-xs font-normal text-white">
                      for {game.name}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/12 bg-white/[0.055] px-3 py-3 text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        Playtime
                      </p>
                      <p className="text-lg font-black text-[#67e8f9]">
                        {trackedGameData?.playtime
                          ? `${Number.isInteger(trackedGameData.playtime) ? trackedGameData.playtime : trackedGameData.playtime.toFixed(1)}h`
                          : "0h"}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] px-3 py-3 text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        Played On
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white">
                        {normalizePlayedOn(trackedGameData?.playedOn).map(
                          (platform) => (
                            <PlayedOnPlatformIcon
                              key={platform}
                              value={platform}
                              className="text-[#67e8f9]"
                            />
                          ),
                        )}
                        {formatPlayedOn(trackedGameData?.playedOn)}
                      </p>
                    </div>
                  </div>
                </header>

                <p
                  className={`py-4 whitespace-pre-wrap text-sm leading-6 text-white/55 ${trackedGameData?.review?.text?.trim() ? "" : "italic"}`}
                >
                  {trackedGameData?.review?.text?.trim() ||
                    "You haven’t written a review for this game yet."}
                </p>

                <div className="flex w-full items-center justify-center overflow-hidden p-3">
                  {trackedGameData?.review?.sticker ? (
                    <CommunityReviewSticker
                      sticker={trackedGameData.review.sticker}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-center text-white/25">
                      <span className="text-2xl">⊘</span>
                      <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em]">
                        No sticker selected
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setTrackingModalOpen(true)}
                  disabled={!trackingModalGame}
                  className="mt-4 w-full rounded-xl border border-[#67e8f9]/45 bg-[#22d3ee] px-4 py-2.5 text-sm font-bold text-black shadow-[0_0_18px_rgba(34,211,238,0.14)] transition hover:bg-[#67e8f9] disabled:opacity-40"
                >
                  {trackedGameData?.review?.text?.trim()
                    ? "Edit my review"
                    : `Write a review for ${game.name}`}
                </button>
              </div>
            </aside>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {aboutOpen && (
            <>
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-999 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setAboutOpen(false)}
              />

              <motion.div
                key="modal"
                className="fixed inset-x-0 top-1/2 z-1000 mx-auto w-[94vw] max-w-2xl -translate-y-1/2 rounded-2xl border border-white/20 bg-black/75 p-4 shadow-2xl sm:w-[90vw] sm:p-5"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
              >
                <p className="max-h-[72vh] overflow-y-auto pr-6 text-sm leading-relaxed text-white/85">
                  {description}
                </p>

                <button
                  onClick={() => setAboutOpen(false)}
                  className="absolute right-3 top-3 text-white/70 hover:text-white"
                >
                  <IoCloseCircle size={30} />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {trackingModalGame && (
          <GameTrackingModal
            key={`${trackingModalGame._docId ?? trackingModalGame.igdb.id}-${trackingModalOpen ? "open" : "closed"}`}
            open={trackingModalOpen}
            onClose={() => setTrackingModalOpen(false)}
            onSave={handleSaveTrackingModal}
            onRemove={handleRemoveTrackingEntry}
            saving={trackingSaving}
            game={trackingModalGame}
            initialReview={
              trackingModalGame.review ?? {
                text: "",
                sticker: null,
              }
            }
            initialRating={trackingModalGame.my_rating ?? null}
            initialProgress={trackingModalGame.progress ?? 0}
            initialPlaytime={trackingModalGame.playtime ?? 0}
            initialPlayedSessions={trackingModalGame.playedSessions ?? []}
            initialStatus={trackingModalGame.status ?? "Playing"}
            initialFavorite={trackingModalGame.favorite ?? false}
            showStatus={true}
            showFavorite={true}
          />
        )}
      </div>
    </>
  );
}
