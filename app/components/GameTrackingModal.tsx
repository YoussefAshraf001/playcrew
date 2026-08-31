"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { MdBookmarkRemove } from "react-icons/md";
import {
  FaBan,
  FaChevronDown,
  FaCrown,
  FaGamepad,
  FaHeart,
  FaRegHeart,
  FaSearch,
  FaSkullCrossbones,
  FaStar,
  FaTimes,
  FaEraser,
  FaTrash,
  FaWindows,
  FaXbox,
} from "react-icons/fa";
import {
  SiBattledotnet,
  SiEa,
  SiEpicgames,
  SiGogdotcom,
  SiNintendo,
  SiPlaystation,
  SiRiotgames,
  SiSteam,
  SiUbisoft,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { FaUnlockKeyhole } from "react-icons/fa6";

import ConfirmModal from "./ConfirmModal";
import {
  PlayedOnPlatform,
  PlaySession,
  PreReleaseAccess,
  PreReleaseAccessType,
  TrackedGame,
} from "../types/trackedGame";
import {
  appendPlaySession,
  formatSessionDuration,
  normalizePlaySessions,
  normalizeSessionDate,
} from "../lib/playSessions";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";
import PreReleaseBadge from "@/app/components/PreReleaseBadge";
import { GAME_STICKERS } from "../lib/gameStickers";
import { IoMdAdd } from "react-icons/io";
import { useUser } from "../context/UserContext";
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import SteamAssetsModal, { type SteamAsset } from "./SteamAssetsModal";

interface GameTrackingModalProps {
  open: boolean;
  game: TrackedGame | null;
  initialReview: {
    text: string;
    sticker: string | null;
  };
  initialSticker?: string | null;
  initialRating: number | null;
  initialProgress: number;
  initialPlaytime: number;
  initialPlayedSessions?: PlaySession[];
  initialStatus: string;
  initialFavorite: boolean;
  showStatus: boolean;
  showFavorite: boolean;
  saving: boolean;
  loading?: boolean;
  removing?: boolean;
  onClose: () => void;
  onHeaderClose?: () => void;
  onRemove?: () => Promise<void> | void;
  onSave: (
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
    playedSessions: PlaySession[],
    playedOn: PlayedOnPlatform[],
    preReleaseAccess: PreReleaseAccess | null,
  ) => Promise<void> | void;
}

const ACCESS_OPTIONS: Array<{
  type: PreReleaseAccessType;
  label: string;
  description: string;
}> = [
  {
    type: "early-access",
    label: "Early Access",
    description: "An official, playable work-in-progress release.",
  },
  {
    type: "advanced-access",
    label: "Advanced Access",
    description: "Official access shortly before the public launch.",
  },
  {
    type: "leaked",
    label: "Leaked",
    description: "An unofficial pre-release build.",
  },
];

const PLAYED_ON_OPTIONS: Array<{
  value: PlayedOnPlatform;
  label: string;
  icon: IconType;
  color: string;
}> = [
  { value: "steam", label: "Steam", icon: SiSteam, color: "#66c0f4" },
  {
    value: "epic-games",
    label: "Epic Games",
    icon: SiEpicgames,
    color: "#ffffff",
  },
  { value: "gog", label: "GOG", icon: SiGogdotcom, color: "#a855f7" },
  { value: "xbox-360", label: "Xbox 360", icon: FaXbox, color: "#107c10" },
  { value: "xbox-one", label: "Xbox One", icon: FaXbox, color: "#107c10" },
  {
    value: "xbox-series",
    label: "Xbox Series X/S",
    icon: FaXbox,
    color: "#107c10",
  },
  {
    value: "xbox-game-pass-pc",
    label: "Xbox Game Pass for PC",
    icon: FaXbox,
    color: "#107c10",
  },
  {
    value: "playstation",
    label: "PlayStation",
    icon: SiPlaystation,
    color: "#0070d1",
  },
  {
    value: "playstation-2",
    label: "PlayStation 2",
    icon: SiPlaystation,
    color: "#0070d1",
  },
  {
    value: "playstation-3",
    label: "PlayStation 3",
    icon: SiPlaystation,
    color: "#0070d1",
  },
  {
    value: "playstation-4",
    label: "PlayStation 4",
    icon: SiPlaystation,
    color: "#0070d1",
  },
  {
    value: "playstation-5",
    label: "PlayStation 5",
    icon: SiPlaystation,
    color: "#0070d1",
  },
  { value: "psp", label: "PSP", icon: SiPlaystation, color: "#0070d1" },
  { value: "ps-vita", label: "PS Vita", icon: SiPlaystation, color: "#0070d1" },
  { value: "nintendo", label: "Nintendo", icon: SiNintendo, color: "#e60012" },
  { value: "ea-app", label: "EA app", icon: SiEa, color: "#ff4747" },
  {
    value: "ubisoft-connect",
    label: "Ubisoft Connect",
    icon: SiUbisoft,
    color: "#0070ff",
  },
  {
    value: "battle-net",
    label: "Battle.net",
    icon: SiBattledotnet,
    color: "#148eff",
  },
  {
    value: "riot-games",
    label: "Riot Games",
    icon: SiRiotgames,
    color: "#d32936",
  },
  {
    value: "offline-activation",
    label: "Offline Activation",
    icon: FaUnlockKeyhole,
    color: "#f59e0b",
  },
  {
    value: "pirated",
    label: "Pirated",
    icon: FaSkullCrossbones,
    color: "#9ca3af",
  },
];

const MODAL_THEME = {
  border: "border-white/12",
  button:
    "from-amber-200 via-white to-zinc-200 text-black shadow-[0_12px_28px_rgba(255,255,255,0.16)]",
} as const;

const RATING_PRESETS = [
  { label: "Poor", value: 2 },
  { label: "Fair", value: 4 },
  { label: "Good", value: 6 },
  { label: "Excellent", value: 8 },
  { label: "Masterpiece", value: 10 },
] as const;

const GIPHY_PAGE_SIZE = 12;
const MAX_GIPHY_RESULTS = 36;

type GiphySticker = {
  id: string;
  title: string;
  previewUrl: string;
  imageUrl: string;
};

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

const getRatingLabel = (rating: number | null) => {
  if (rating === null) return "Unrated";
  if (rating >= 9.5) return "Masterpiece";
  if (rating >= 8.5) return "Excellent";
  if (rating >= 7) return "Great";
  if (rating >= 5) return "Okay";
  if (rating >= 3) return "Weak";
  return "Awful";
};

const getInitialRatingValue = (initialRating: number | null) => {
  if (typeof initialRating === "number" && Number.isFinite(initialRating)) {
    return Math.max(0, Math.min(10, Math.round(initialRating * 10) / 10));
  }

  return null;
};

export default function GameTrackingModal(props: GameTrackingModalProps) {
  const {
    open,
    game,
    onClose,
    onSave,
    initialReview,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialPlayedSessions,
    initialStatus,
    initialFavorite,
    showStatus,
    showFavorite,
    saving,
    removing = false,
    loading,
    onRemove,
  } = props;

  const { user, profile: userProfile } = useUser();
  const isAdmin = Boolean(userProfile?.admin);

  const [notes, setNotes] = useState(initialReview.text ?? "");
  const [stickerDrawerOpen, setStickerDrawerOpen] = useState(false);
  const [sticker, setSticker] = useState<string | null>(
    initialReview.sticker ?? null,
  );
  const [giphyQuery, setGiphyQuery] = useState("");
  const [debouncedGiphyQuery, setDebouncedGiphyQuery] = useState("");
  const [giphyStickers, setGiphyStickers] = useState<GiphySticker[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [giphyLoadingMore, setGiphyLoadingMore] = useState(false);
  const [giphyError, setGiphyError] = useState<string | null>(null);
  const [giphyOffset, setGiphyOffset] = useState(0);
  const [giphyHasMore, setGiphyHasMore] = useState(false);

  const [rating, setRating] = useState<number | null>(
    getInitialRatingValue(initialRating),
  );
  const [progress, setProgress] = useState(initialProgress ?? 0);
  const [hours, setHours] = useState(Math.floor(initialPlaytime ?? 0));
  const [minutes, setMinutes] = useState(
    Math.round(((initialPlaytime ?? 0) % 1) * 60),
  );
  const [status, setStatus] = useState(initialStatus ?? "Playing");
  const [favorite, setFavorite] = useState(initialFavorite ?? false);
  const [notInterested, setNotInterested] = useState(
    game?.notInterested === true ||
      initialStatus === "Not Interested" ||
      initialStatus === "Lost Interest",
  );
  const [confirmNotInterestedOpen, setConfirmNotInterestedOpen] =
    useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [playedSessions, setPlayedSessions] = useState<PlaySession[]>(
    normalizePlaySessions(initialPlayedSessions),
  );
  const [playedOn, setPlayedOn] = useState<PlayedOnPlatform[]>(
    Array.isArray(game?.playedOn)
      ? game.playedOn
      : game?.playedOn
        ? [game.playedOn]
        : [],
  );
  const [playedOnMenuOpen, setPlayedOnMenuOpen] = useState(false);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<
    number | null
  >(null);
  const [preReleaseAccess, setPreReleaseAccess] =
    useState<PreReleaseAccess | null>(game?.preReleaseAccess ?? null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [pendingAccessType, setPendingAccessType] =
    useState<PreReleaseAccessType | null>(null);
  const [unreleasedEditApprovedFor, setUnreleasedEditApprovedFor] = useState<
    number | null
  >(null);
  const [coverOverride, setCoverOverride] = useState<string | null>(null);
  const [posterMenuPosition, setPosterMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [steamAssetsOpen, setSteamAssetsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  useEffect(() => {
    setNotes(initialReview.text ?? "");
    setSticker(initialReview.sticker ?? null);
  }, [initialReview]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedGiphyQuery(giphyQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [giphyQuery]);

  useEffect(() => {
    if (!stickerDrawerOpen || !debouncedGiphyQuery) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        if (giphyOffset === 0) setGiphyLoading(true);
        else setGiphyLoadingMore(true);
        setGiphyError(null);
      }
    });

    fetch(
      `/api/giphy/stickers?q=${encodeURIComponent(debouncedGiphyQuery)}&offset=${giphyOffset}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data = (await response.json()) as {
          stickers?: GiphySticker[];
          hasMore?: boolean;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load stickers.");
        setGiphyStickers((previous) =>
          giphyOffset === 0
            ? (data.stickers ?? [])
            : [...previous, ...(data.stickers ?? [])].slice(
                0,
                MAX_GIPHY_RESULTS,
              ),
        );
        setGiphyHasMore(data.hasMore ?? false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setGiphyError("Unable to load GIPHY stickers.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          if (giphyOffset === 0) setGiphyLoading(false);
          else setGiphyLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [debouncedGiphyQuery, giphyOffset, stickerDrawerOpen]);

  const sessionHistory = useMemo(() => {
    return normalizePlaySessions(playedSessions);
  }, [playedSessions]);

  const displayedRating = rating;
  const dialRating = displayedRating ?? 0;
  const dialMin = 0;
  const dialMax = 10;
  const arcSpanDeg = 260;
  const dialStartAngle = -220;
  const dialRadius = 92;
  const dialCenter = 112;
  const dialStroke = 12;
  const circumference = 2 * Math.PI * dialRadius;
  const arcLength = (arcSpanDeg / 360) * circumference;
  const dialProgress =
    dialRating > 0 ? (dialRating - dialMin) / (dialMax - dialMin) : 0;
  const dialOffset = arcLength * (1 - dialProgress);

  const handleSave = async () => {
    const totalPlaytime = Number((hours + minutes / 60).toFixed(2));
    const nextPlayedSessions =
      totalPlaytime > initialPlaytime
        ? appendPlaySession(playedSessions, initialPlaytime, totalPlaytime)
        : playedSessions;

    await onSave(
      {
        text: notes,
        sticker,
      },
      rating,
      progress,
      totalPlaytime,
      status,
      favorite,
      notInterested,
      nextPlayedSessions,
      playedOn,
      preReleaseAccess,
    );
  };

  const handleClean = async () => {
    await onSave(
      {
        text: "",
        sticker: null,
      },
      null,
      0,
      0,
      "Want To Play",
      false,
      false,
      [],
      [],
      null,
    );
    setConfirmCleanOpen(false);
    setUnreleasedEditApprovedFor(null);
    onClose();
  };

  const getProgressText = (value: number) => {
    if (value >= 100) return "Journey Finished";
    if (value >= 85) return "Final stretch";
    if (value >= 60) return "Midway through the story";
    if (value >= 35) return "Getting into it";
    if (value >= 10) return "Starting out";
    if (value >= 5) return "Lets do it";
    return "Just beginning";
  };

  const applyNotInterested = () => {
    setNotInterested(true);
    setRating(null);
  };

  const clearNotInterested = () => {
    setNotInterested(false);
    if (status === "Not Interested" || status === "Lost Interest") {
      setStatus("Want To Play");
    }
  };

  const isNotInterested = notInterested;

  const handleNotInterested = () => {
    if (isNotInterested) {
      clearNotInterested();
      return;
    }

    if (rating !== null) {
      setConfirmNotInterestedOpen(true);
      return;
    }

    applyNotInterested();
  };

  const handleClearRating = () => {
    setRating(null);
  };

  const normalizeDate = (value?: unknown) => parseReleaseDate(value);

  const bgUrl =
    coverOverride || game?.igdb.cover || "/placeholder-game.jpg";
  const releaseDate = normalizeDate(game?.igdb.releaseDate);
  const gameIsReleased = !!releaseDate && releaseDate <= new Date();
  // Temporarily disabled: unreleased-game edit confirmation gate.
  const showUnreleasedEditGate =
    false &&
    !gameIsReleased &&
    !preReleaseAccess &&
    unreleasedEditApprovedFor !== game?.igdb.id;
  const handleModalClose = () => {
    setUnreleasedEditApprovedFor(null);
    onClose();
  };
  const openPosterMenu = (event: MouseEvent<HTMLImageElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPosterMenuPosition({
      x: Math.min(event.clientX, window.innerWidth - 230),
      y: Math.min(event.clientY, window.innerHeight - 70),
    });
  };
  const useSteamAssetAsCover = async (asset: SteamAsset) => {
    if (!game) return;
    if (!user) {
      toast.error("You need to be signed in to change the cover.");
      return;
    }

    const gameDocId = game._docId || String(game.igdb.id);
    try {
      await updateDoc(doc(db, "users", user.uid, "games_igdb", gameDocId), {
        "igdb.cover": asset.url,
        protectCustomCoverFromRefresh: true,
      });
      setCoverOverride(asset.url);
      toast.success(`${asset.label} set as the cover. Cover lock enabled.`);
    } catch (error) {
      console.error("Failed to apply Steam cover", error);
      toast.error("Could not set the Steam image as the cover.");
      throw error;
    }
  };
  const accessLabel = ACCESS_OPTIONS.find(
    (option) => option.type === preReleaseAccess?.type,
  )?.label;
  const chooseAccessDate = (dateSource: "unlock" | "official") => {
    if (!pendingAccessType) return;

    setPreReleaseAccess({
      type: pendingAccessType,
      unlockedAt: new Date(),
      dateSource,
    });
    setPendingAccessType(null);
    setAccessDialogOpen(false);
    toast.success("Pre-release access added. Save to apply it.");
  };

  const progressRadius = 40;
  const progressStroke = 8;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset =
    progressCircumference - (progress / 100) * progressCircumference;
  const progressAngle = (progress / 100) * Math.PI * 2 - Math.PI / 2;
  const progressHandleX = 50 + progressRadius * Math.cos(progressAngle);
  const progressHandleY = 50 + progressRadius * Math.sin(progressAngle);

  const updateProgressFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const clockwiseAngle = (Math.atan2(y, x) * 180) / Math.PI + 90 + 360;
    const nextProgress = Math.round((clockwiseAngle % 360) / 3.6);

    setProgress((currentProgress) => {
      if (currentProgress >= 75 && nextProgress <= 25) return 100;
      if (currentProgress <= 25 && nextProgress >= 75) return 0;
      return nextProgress;
    });
  };

  const handleProgressKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setProgress((current) => Math.min(100, current + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setProgress((current) => Math.max(0, current - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setProgress(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setProgress(100);
    }
  };

  const handleDeleteSession = async (index: number, deductTime: boolean) => {
    const removed = playedSessions[index];
    const updated = playedSessions.filter((_, i) => i !== index);

    let newHours = hours;
    let newMinutes = minutes;

    if (deductTime && removed) {
      const removedHours = removed.durationHours || 0;

      const currentTotal = hours + minutes / 60;
      const newTotal = Math.max(0, currentTotal - removedHours);

      newHours = Math.floor(newTotal);
      newMinutes = Math.round((newTotal % 1) * 60);

      setHours(newHours);
      setMinutes(newMinutes);
    }

    // ✅ update local state immediately
    setPlayedSessions(updated);

    toast.success(
      deductTime ? "Session removed & time deducted" : "Session removed",
    );
  };

  const selectedSticker = GAME_STICKERS.find((s) => s.id === sticker);
  const selectedStickerImage = selectedSticker?.image ?? sticker;
  const selectedStickerLabel = selectedSticker?.label ?? "Selected sticker";

  if (!game) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-2 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={bgUrl}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 25 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`relative my-2 h-[calc(100dvh-1rem)]  md:h-[min(97dvh,880px)] w-full max-w-6xl overflow-hidden rounded-[28px] border sm:my-0 sm:rounded-[32px] ${MODAL_THEME.border} shadow-[0_30px_80px_rgba(0,0,0,0.72)]`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(135deg,rgba(0,0,0,0.3),rgba(0,0,0,0.72))] backdrop-blur-md" />

            <AnimatePresence>
              {showUnreleasedEditGate && (
                <motion.div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="unreleased-edit-title"
                  aria-describedby="unreleased-edit-description"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex items-center justify-center bg-black/88 p-5 backdrop-blur-xl"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-full max-w-md rounded-[28px] border border-amber-300/25 bg-zinc-950/95 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.75)] sm:p-8"
                  >
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 text-3xl text-amber-200">
                      <FaUnlockKeyhole aria-hidden="true" />
                    </div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-200/70">
                      Unreleased game
                    </p>
                    <h2
                      id="unreleased-edit-title"
                      className="text-2xl font-black text-white"
                    >
                      Are you sure you want to edit it?
                    </h2>
                    <p
                      id="unreleased-edit-description"
                      className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-300"
                    >
                      {game.name} has not been released or unlocked through
                      Early Access, Advanced Access, or a leaked build yet.
                    </p>
                    <div className="mt-7 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleModalClose}
                        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        Go back
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setUnreleasedEditApprovedFor(game.igdb.id)
                        }
                        autoFocus
                        className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200"
                      >
                        Edit anyway
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3 p-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-y sm:gap-4 sm:p-6">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-32 rounded-full bg-amber-200/10 blur-3xl" />

              <header className="grid gap-3 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={bgUrl}
                    alt={game?.name || "Game cover"}
                    onContextMenu={openPosterMenu}
                    title="Right-click for cover options"
                    className="h-16 w-12 shrink-0 rounded-xl border border-white/20 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white sm:text-[1.35rem]">
                      {game?.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold text-white ${
                          gameIsReleased
                            ? "border-emerald-300 bg-emerald-500/25"
                            : "border-red-400 bg-red-500/25"
                        }`}
                      >
                        {gameIsReleased
                          ? `Released in: ${formatReleaseDate(
                              game?.igdb.releaseDate,
                              game?.igdb.releaseDatePrecision,
                            )}`
                          : `Releasing in: ${formatReleaseDate(
                              game?.igdb.releaseDate,
                              game?.igdb.releaseDatePrecision,
                            )}`}
                      </span>
                      {!gameIsReleased && !preReleaseAccess && (
                        <button
                          type="button"
                          onClick={() => setAccessDialogOpen(true)}
                          className="rounded-full border border-amber-300/55 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-100 transition hover:bg-amber-500/35"
                        >
                          Unlock
                        </button>
                      )}
                      {preReleaseAccess && (
                        <span className="inline-flex items-center gap-2">
                          <PreReleaseBadge
                            type={preReleaseAccess.type}
                            label={accessLabel}
                          />
                          {!gameIsReleased && (
                            <button
                              type="button"
                              onClick={() => setAccessDialogOpen(true)}
                              className="text-white/65 underline hover:text-white"
                            >
                              Change
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreReleaseAccess(null)}
                            className="text-white/65 underline hover:text-white"
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex max-w-[500px] flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                  {showStatus && (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="h-9 cursor-pointer min-w-[118px] rounded-xl border border-white/15 bg-black/35 px-3 text-xs text-white shadow-inner shadow-black/20"
                    >
                      <option value="Playing">Playing</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Dropped">Dropped</option>
                      <option value="Online">Online</option>
                      <option value="Want To Play">Want To Play</option>
                    </select>
                  )}

                  {showFavorite && (
                    <motion.button
                      onClick={() => setFavorite((f) => !f)}
                      whileHover={{ y: -2, scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: favorite ? [1, 1.08, 1] : 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 cursor-pointer rounded-xl border px-3 text-[11px] font-medium whitespace-nowrap transition ${
                        favorite
                          ? "border-red-300/60 bg-red-500/22 text-red-100 shadow-[0_10px_24px_rgba(239,68,68,0.15)]"
                          : "border-white/15 bg-black/35 text-white hover:bg-white/10"
                      }`}
                    >
                      {favorite ? <FaHeart /> : <FaRegHeart />}
                      <span>{favorite ? "Favorited" : "Favorite"}</span>
                    </motion.button>
                  )}

                  <motion.button
                    onClick={() => setConfirmCleanOpen(true)}
                    whileHover={{ y: -2, scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="relative inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-300/35 bg-amber-500/12 px-3 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/22 disabled:opacity-60"
                    disabled={saving || removing}
                    type="button"
                  >
                    <FaEraser />
                    <span>Clean Game</span>
                  </motion.button>

                  {onRemove && (
                    <motion.button
                      onClick={() => setConfirmRemoveOpen(true)}
                      whileHover={{ y: -2, scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="relative rounded-xl border border-red-300/35 bg-red-500/12 px-3 py-2 text-[11px] font-medium text-red-100 transition hover:bg-red-500/22 disabled:opacity-60 whitespace-nowrap"
                      disabled={saving || removing}
                    >
                      <span
                        className={`flex items-center justify-center gap-2 cursor-pointer ${removing ? "opacity-0" : ""}`}
                      >
                        <MdBookmarkRemove /> Remove Game from collection
                      </span>
                    </motion.button>
                  )}
                </div>
              </header>

              <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
                <div
                  className={`relative grid gap-3 md:grid-cols-[1.2fr_0.8fr] md:items-stretch ${
                    playedOnMenuOpen ? "z-30" : "z-0"
                  }`}
                >
                  <section className="grid gap-3 sm:min-h-0">
                    <div
                      className={`relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 backdrop-blur-xl`}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-100/35 to-transparent" />
                      <div className="grid mt-6 gap-4">
                        <div className="rounded-[24px] border border-white/12 bg-black/20 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
                            <div className="flex-col justify-center mx-auto w-full max-w-[260px]">
                              <div className="relative mx-auto h-56 w-56">
                                <svg
                                  className="h-full w-full"
                                  viewBox="0 0 224 224"
                                >
                                  <circle
                                    cx={dialCenter}
                                    cy={dialCenter}
                                    r={dialRadius}
                                    fill="none"
                                    stroke="rgba(251,191,36,0.14)"
                                    strokeWidth={dialStroke}
                                    strokeLinecap="round"
                                    strokeDasharray={`${arcLength} ${circumference}`}
                                    transform={`rotate(${dialStartAngle} ${dialCenter} ${dialCenter})`}
                                  />

                                  <circle
                                    cx={dialCenter}
                                    cy={dialCenter}
                                    r={dialRadius}
                                    fill="none"
                                    stroke="url(#ratingDialGradient)"
                                    strokeWidth={dialStroke}
                                    strokeLinecap="round"
                                    strokeDasharray={`${arcLength} ${circumference}`}
                                    strokeDashoffset={dialOffset}
                                    transform={`rotate(${dialStartAngle} ${dialCenter} ${dialCenter})`}
                                    style={{
                                      transition:
                                        "stroke-dashoffset 200ms ease",
                                    }}
                                  />
                                  <defs>
                                    <linearGradient
                                      id="ratingDialGradient"
                                      x1="0%"
                                      y1="0%"
                                      x2="100%"
                                      y2="100%"
                                    >
                                      <stop offset="0%" stopColor="#f59e0b" />
                                      <stop offset="55%" stopColor="#fbbf24" />
                                      <stop offset="100%" stopColor="#fde68a" />
                                    </linearGradient>
                                  </defs>
                                </svg>

                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/75">
                                    Rating
                                  </p>
                                  <div className="mt-1 flex items-end justify-center gap-1 leading-none">
                                    <span className="flex items-center justify-center text-5xl font-bold tracking-tight text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.3)]">
                                      {rating === 10 ? (
                                        <FaCrown
                                          className="text-6xl drop-shadow-[0_0_18px_rgba(251,191,36,0.75)]"
                                          style={{ color: "#fbbf24" }}
                                        />
                                      ) : (
                                        formatRating(rating ?? 0)
                                      )}
                                    </span>
                                    <span className="pb-1 text-sm text-zinc-400">
                                      /10
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="mx-auto flex w-38 items-center justify-center gap-1.5 rounded-full border border-[#d9a928] bg-[rgba(180,125,15,0.28)] px-3 py-1.5 text-[11px] font-bold text-[#ffe29a] shadow-[0_0_18px_rgba(245,158,11,0.16)]">
                                <FaStar className="text-sm text-[#fbbf24]" />
                                <span>{getRatingLabel(rating)}</span>
                              </div>
                            </div>

                            <div className="grid gap-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                                    Your Rating
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-300">
                                    Use the slider to set the score.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleNotInterested}
                                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition ${
                                    isNotInterested
                                      ? "border-cyan-300/45 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/26"
                                      : "border-red-300/35 bg-red-500/12 text-red-100 hover:bg-red-500/22"
                                  } ${
                                    isNotInterested
                                      ? "opacity-45"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  <FaBan
                                    className={`text-sm ${isNotInterested ? "text-cyan-300" : "text-red-500"}`}
                                  />
                                  <span>
                                    {isNotInterested
                                      ? "Restore"
                                      : "Lost Interest"}
                                  </span>
                                </button>
                              </div>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={handleClearRating}
                                  disabled={rating === null || isNotInterested}
                                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <FaEraser className="text-xs" />
                                  <span>Clear Rating</span>
                                </button>
                              )}

                              <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                                <input
                                  type="range"
                                  min={0}
                                  max={10}
                                  step={0.1}
                                  value={rating ?? 0}
                                  disabled={isNotInterested}
                                  onChange={(e) => {
                                    if (isNotInterested) return;
                                    setRating(Number(e.target.value));
                                  }}
                                  style={
                                    {
                                      "--slider-progress": `${((rating ?? 0) / 10) * 100}%`,
                                    } as CSSProperties
                                  }
                                  className="rating-slider h-2.5 w-full accent-amber-400"
                                />
                              </div>

                              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                                {RATING_PRESETS.map((preset) => {
                                  const isActive =
                                    rating !== null &&
                                    preset.value ===
                                      RATING_PRESETS.reduce(
                                        (closest, current) =>
                                          Math.abs(rating - current.value) <
                                          Math.abs(rating - closest.value)
                                            ? current
                                            : closest,
                                      ).value;

                                  return (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      disabled={isNotInterested}
                                      onClick={() => {
                                        if (isNotInterested) return;
                                        setRating(preset.value);
                                      }}
                                      className={`text-left transition ${
                                        isActive
                                          ? "text-amber-200"
                                          : "text-zinc-400 hover:text-zinc-200"
                                      } ${
                                        isNotInterested
                                          ? "opacity-45"
                                          : "cursor-pointer"
                                      }`}
                                    >
                                      <span className="ml-2">
                                        {preset.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside
                    className={`relative grid gap-2 sm:grid-cols-2 md:min-h-0 md:grid-cols-1 ${
                      playedOnMenuOpen ? "z-30" : "z-0"
                    }`}
                  >
                    <div
                      className={`flex h-full min-h-[300px] flex-col rounded-[28px] border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-4 backdrop-blur-xl lg:min-h-[360px] lg:p-5`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/55">
                            {getProgressText(progress)}
                          </p>
                          <p className="mt-2 text-3xl font-bold tracking-tight text-white lg:mt-3 lg:text-4xl">
                            {hours}h {minutes}m
                          </p>
                          <button
                            type="button"
                            onClick={() => setSessionsOpen(true)}
                            className="mt-2 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/16"
                          >
                            View Sessions{" "}
                            {sessionHistory.length
                              ? `(${sessionHistory.length})`
                              : ""}
                          </button>
                        </div>

                        <div className="flex shrink-0 flex-col items-center text-center">
                          <div
                            role="slider"
                            tabIndex={0}
                            aria-label="Completion percentage"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                            onKeyDown={handleProgressKeyDown}
                            onPointerDown={(event) => {
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                              updateProgressFromPointer(event);
                            }}
                            onPointerMove={(event) => {
                              if (
                                event.currentTarget.hasPointerCapture(
                                  event.pointerId,
                                )
                              ) {
                                updateProgressFromPointer(event);
                              }
                            }}
                            onPointerUp={(event) =>
                              event.currentTarget.releasePointerCapture(
                                event.pointerId,
                              )
                            }
                            className="relative h-24 w-24 cursor-grab touch-none select-none rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] active:cursor-grabbing lg:h-28 lg:w-28"
                          >
                            <svg
                              viewBox="0 0 100 100"
                              className="h-full w-full overflow-visible drop-shadow-[0_0_14px_rgba(var(--theme-accent-rgb),0.3)]"
                              aria-hidden="true"
                            >
                              <circle
                                cx="50"
                                cy="50"
                                r={progressRadius}
                                fill="rgba(0,0,0,0.32)"
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth={progressStroke}
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r={progressRadius}
                                fill="none"
                                stroke="var(--theme-accent)"
                                strokeWidth={progressStroke}
                                strokeLinecap="round"
                                strokeDasharray={progressCircumference}
                                strokeDashoffset={progressOffset}
                                transform="rotate(-90 50 50)"
                              />
                              <circle
                                cx={progressHandleX}
                                cy={progressHandleY}
                                r="5"
                                fill="white"
                                stroke="var(--theme-accent)"
                                strokeWidth="3"
                              />
                            </svg>
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-black text-white lg:text-2xl">
                              {progress}%
                            </span>
                          </div>
                          <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                            Drag completion
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid content-start gap-3 lg:mt-5 lg:gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="h-16 rounded-xl border border-white/12 bg-white/4 px-3 py-1">
                            <span className="block text-[10px] uppercase leading-4 tracking-[0.18em] text-zinc-500">
                              Hours
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={hours}
                              onChange={(e) =>
                                setHours(Math.max(0, Number(e.target.value)))
                              }
                              className="h-10 w-full bg-transparent text-lg font-semibold leading-5 text-white outline-none"
                            />
                          </label>
                          <label className="h-16 rounded-xl border border-white/12 bg-white/4 px-3 py-1">
                            <span className="block text-[10px] uppercase leading-4 tracking-[0.18em] text-zinc-500">
                              Minutes
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={minutes}
                              onChange={(e) =>
                                setMinutes(
                                  Math.max(
                                    0,
                                    Math.min(59, Number(e.target.value)),
                                  ),
                                )
                              }
                              className="h-10 w-full bg-transparent text-lg font-semibold leading-5 text-white outline-none"
                            />
                          </label>
                        </div>
                        <div className="relative flex h-15 flex-col justify-center rounded-xl border border-white/12 bg-white/4 px-3 py-1">
                          <span className="block text-[8px] uppercase leading-4 tracking-[0.18em] text-zinc-500">
                            Played on
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPlayedOnMenuOpen((current) => !current)
                            }
                            aria-haspopup="listbox"
                            aria-expanded={playedOnMenuOpen}
                            className="flex h-5 w-full items-center justify-between gap-3 text-left text-sm font-semibold leading-5 text-white outline-none"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex shrink-0 items-center gap-1">
                                {playedOn.length ? (
                                  PLAYED_ON_OPTIONS.filter((option) =>
                                    playedOn.includes(option.value),
                                  ).map((option) => {
                                    const PlatformIcon = option.icon;
                                    return (
                                      <PlatformIcon
                                        key={option.value}
                                        className="text-base"
                                        style={{ color: option.color }}
                                      />
                                    );
                                  })
                                ) : (
                                  <FaGamepad className="text-zinc-500" />
                                )}
                              </span>
                              <span className="truncate">
                                {playedOn.length
                                  ? PLAYED_ON_OPTIONS.filter((option) =>
                                      playedOn.includes(option.value),
                                    )
                                      .map((option) => option.label)
                                      .join(", ")
                                  : "Not specified"}
                              </span>
                            </span>
                            <FaChevronDown
                              className={`shrink-0 text-xs text-zinc-500 transition-transform ${
                                playedOnMenuOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {playedOnMenuOpen && (
                            <>
                              <button
                                type="button"
                                aria-label="Close played-on menu"
                                onClick={() => setPlayedOnMenuOpen(false)}
                                className="fixed inset-0 z-40 cursor-default"
                              />
                              <div
                                role="listbox"
                                aria-multiselectable="true"
                                className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl"
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={playedOn.length === 0}
                                  onClick={() => {
                                    setPlayedOn([]);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
                                >
                                  <FaGamepad className="shrink-0" />
                                  Not specified
                                </button>
                                {PLAYED_ON_OPTIONS.map((option) => {
                                  const PlatformIcon = option.icon;

                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={playedOn.includes(
                                        option.value,
                                      )}
                                      onClick={() => {
                                        setPlayedOn((current) =>
                                          current.includes(option.value)
                                            ? current.filter(
                                                (value) =>
                                                  value !== option.value,
                                              )
                                            : [...current, option.value],
                                        );
                                        setPlayedOnMenuOpen(false);
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition hover:bg-white/10 ${
                                        playedOn.includes(option.value)
                                          ? "bg-white/10 text-white"
                                          : "text-zinc-200"
                                      }`}
                                    >
                                      <PlatformIcon
                                        className="shrink-0 text-base"
                                        style={{ color: option.color }}
                                      />
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="relative z-0 grid gap-3 md:grid-cols-[1fr_280px]">
                  {/* REVIEW */}

                  <div className="grid min-h-[170px] grid-rows-[auto_1fr] rounded-[24px] border border-white/12 bg-white/8 p-3.5 backdrop-blur-xl md:min-h-[220px]">
                    <label className="pb-2 text-xs uppercase tracking-[0.16em] text-zinc-200">
                      Review
                    </label>

                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Write your thoughts..."
                      className="h-full min-h-[120px] resize-none rounded-[20px] border border-white/12 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-white/30 md:min-h-[150px]"
                    />
                  </div>

                  {/* STICKER */}

                  <div className="flex h-full flex-col rounded-[25px] border border-dashed border-white/15 bg-black/20 p-4">
                    <label className="pb-2 block text-xs uppercase tracking-[0.16em] text-zinc-200 text-center">
                      Got me feeling like
                    </label>

                    <div
                      onClick={() => setStickerDrawerOpen(true)}
                      className="
                        group
                        relative
                        flex
                        h-full
                        cursor-pointer
                        flex-col
                        items-center
                        justify-center
                        rounded-[18px]
                        text-center
                        transition
                        hover:border-white/20
                      "
                    >
                      {selectedStickerImage ? (
                        <img
                          src={selectedStickerImage}
                          alt={selectedStickerLabel}
                          className="h-50 w-50 object-contain rounded-lg"
                        />
                      ) : (
                        <>
                          <div className="text-5xl opacity-50 grayscale">
                            🥺
                          </div>

                          <p className="mt-3 text-xs">
                            No sticker selected for this game
                          </p>
                        </>
                      )}

                      {/* Overlay */}

                      <div
                        className="
                          absolute
                          inset-0
                          flex
                          items-center
                          justify-center
                          rounded-[25px]
                          bg-zinc-800/90
                          opacity-0
                          transition
                          group-hover:opacity-100
                        "
                      >
                        <div className="flex flex-col items-center gap-2">
                          <IoMdAdd size={50} />

                          <span className="text-sm font-medium text-white">
                            {selectedSticker
                              ? "Edit Sticker"
                              : "Choose Sticker"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="flex flex-col gap-2 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-300">
                  {isNotInterested
                    ? "Unmark as Lost Interest to rate this game."
                    : "Your library, your rules."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleModalClose}
                    className="rounded-xl border border-white/15 bg-black/35 px-3.5 py-2 text-sm text-white transition hover:bg-white/14"
                    disabled={saving || removing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await handleSave();
                      handleModalClose();
                    }}
                    disabled={saving || removing}
                    className={`rounded-xl bg-linear-to-r px-4 py-2 text-sm font-bold transition hover:brightness-105 disabled:opacity-60 ${MODAL_THEME.button}`}
                  >
                    {saving ? (
                      <div className="flex w-full items-center justify-center gap-2">
                        <span className="loading loading-dots loading-xs" />
                      </div>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </footer>

              <AnimatePresence>
                {sessionsOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: 8 }}
                      className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Play Sessions
                          </p>
                          <p className="text-xs text-zinc-400">
                            Each playtime increase creates a dated session
                            entry.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSessionsOpen(false)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/12"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        {sessionHistory.length ? (
                          sessionHistory.map((session, index) => {
                            const playedAt = normalizeSessionDate(
                              session.playedAt,
                            );
                            return (
                              <div
                                key={`${playedAt?.toISOString?.() ?? "session"}-${index}`}
                                className="group relative rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {playedAt
                                        ? playedAt.toLocaleDateString(
                                            undefined,
                                            {
                                              weekday: "long",
                                              month: "long",
                                              day: "numeric",
                                              year: "numeric",
                                            },
                                          )
                                        : "Session date unavailable"}
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                      {playedAt
                                        ? playedAt.toLocaleTimeString(
                                            undefined,
                                            {
                                              hour: "numeric",
                                              minute: "2-digit",
                                            },
                                          )
                                        : "Unknown time"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-emerald-300">
                                      +
                                      {formatSessionDuration(
                                        session.durationHours,
                                      )}
                                    </p>

                                    {/* 🗑 Delete (appears on hover) */}
                                    <button
                                      onClick={() =>
                                        setPendingDeleteSession(index)
                                      }
                                      className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300"
                                    >
                                      <FaTrash size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-zinc-400">
                            No play sessions yet. Increase playtime and save to
                            log one.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {(loading || saving) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                >
                  <span className="loading loading-dots loading-lg text-white" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CONFIRM TO SET GAME AS NOT INTERESTED */}
            <ConfirmModal
              open={confirmNotInterestedOpen}
              title="Are you sure?"
              message="Marking this game as Lost Interest means this game did not click with you. Doing so will clear your rating for this game."
              confirmText="Yes, Clear"
              cancelText="Cancel"
              onCancel={() => setConfirmNotInterestedOpen(false)}
              onConfirm={() => {
                applyNotInterested();
                setConfirmNotInterestedOpen(false);
              }}
            />

            {/* DELETE GAME ENTRY */}
            <ConfirmModal
              open={confirmCleanOpen}
              title="Clean game?"
              message="This will clear the review, sticker, rating, progress, playtime, played-on platform, play sessions, favorite, not-interested status, and pre-release access. The game will remain in your collection."
              confirmText={saving ? "Cleaning..." : "Yes, Clean"}
              cancelText="Cancel"
              onCancel={() => {
                if (!saving && !removing) setConfirmCleanOpen(false);
              }}
              onConfirm={handleClean}
            />

            {/* DELETE GAME ENTRY */}
            <ConfirmModal
              open={confirmRemoveOpen}
              title="Remove entry?"
              message="This will remove the game from your library entry, including tracking data saved for it."
              confirmText={removing ? "Removing..." : "Yes, Remove"}
              cancelText="Cancel"
              onCancel={() => {
                if (!removing) setConfirmRemoveOpen(false);
              }}
              onConfirm={async () => {
                if (!onRemove) return;
                await onRemove();
                setConfirmRemoveOpen(false);
              }}
            />

            {/* DELETE SESSION */}
            <ConfirmModal
              open={pendingDeleteSession !== null}
              title="Remove session?"
              message="Do you want to remove this session only, or also deduct its time from total playtime?"
              confirmText="Remove & Deduct"
              cancelText="Remove Only"
              onCancel={() => {
                if (pendingDeleteSession === null) return;

                const index = pendingDeleteSession;
                setPendingDeleteSession(null);
                handleDeleteSession(index, false);
              }}
              onConfirm={() => {
                if (pendingDeleteSession === null) return;

                const index = pendingDeleteSession;
                setPendingDeleteSession(null);
                handleDeleteSession(index, true);
              }}
            />

            <AnimatePresence>
              {stickerDrawerOpen && (
                <>
                  {/* Backdrop */}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setStickerDrawerOpen(false)}
                    className="absolute inset-0 z-30 bg-black/30"
                  />

                  {/* Drawer */}

                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{
                      type: "spring",
                      damping: 30,
                      stiffness: 300,
                    }}
                    className="absolute right-0 top-0 z-40 h-full w-full max-w-[400px] border-l border-[var(--theme-border)] bg-[var(--theme-surface-strong)] shadow-2xl backdrop-blur-md"
                  >
                    <div className="flex h-full flex-col">
                      {/* Header */}

                      <div className="border-b border-white/10 px-5 pb-4 pt-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
                              Sticker picker
                            </p>
                            <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
                              Find your vibe
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStickerDrawerOpen(false)}
                            aria-label="Close sticker picker"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                          >
                            <FaTimes className="text-sm" />
                          </button>
                        </div>
                        <label className="relative mt-5 block">
                          <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500" />
                          <input
                            type="search"
                            value={giphyQuery}
                            onChange={(event) => {
                              setGiphyQuery(event.target.value);
                              setGiphyOffset(0);
                              setGiphyHasMore(false);
                              setGiphyStickers([]);
                            }}
                            placeholder="Search GIPHY stickers"
                            className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-400/60 focus:bg-black/45 focus:ring-4 focus:ring-violet-400/10"
                          />
                        </label>
                        {/* 
                        <button
                          onClick={() => setStickerDrawerOpen(false)}
                          className="text-zinc-400 hover:text-white"
                        >
                          ✕
                        </button> */}
                      </div>

                      {/* Stickers */}
                      <div className="flex-1 overflow-y-auto px-5 py-5">
                        {giphyQuery && (
                          <>
                            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Search results
                            </p>
                            {giphyError ? (
                              <p className="rounded-2xl border border-red-400/15 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                                {giphyError}
                              </p>
                            ) : giphyLoading ? (
                              <div className="flex justify-center py-12">
                                <span className="loading loading-spinner loading-md text-white" />
                              </div>
                            ) : (
                              <div className="mb-5 grid grid-cols-2 gap-3">
                                {giphyStickers.map((giphySticker) => (
                                  <button
                                    key={giphySticker.id}
                                    type="button"
                                    onClick={() => {
                                      setSticker(giphySticker.imageUrl);
                                      setStickerDrawerOpen(false);
                                    }}
                                    className={`group relative aspect-square overflow-hidden rounded-xl transition duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${
                                      sticker === giphySticker.imageUrl &&
                                      "bg-violet-300/10 ring-2 ring-violet-300/30"
                                    }`}
                                  >
                                    <div className="relative flex h-full w-full items-center justify-center bg-white/[0.03]">
                                      <img
                                        src={giphySticker.previewUrl}
                                        alt={giphySticker.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full rounded-lg object-contain p-1.5 transition duration-300 group-hover:scale-110"
                                      />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {giphyHasMore &&
                              giphyStickers.length < MAX_GIPHY_RESULTS && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGiphyOffset(
                                      (offset) => offset + GIPHY_PAGE_SIZE,
                                    )
                                  }
                                  disabled={giphyLoadingMore}
                                  className="mb-5 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {giphyLoadingMore ? "Loading…" : "Load more"}
                                </button>
                              )}

                            <a
                              href="https://giphy.com"
                              target="_blank"
                              rel="noreferrer"
                              className="mb-5 block text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-300"
                            >
                              Powered by GIPHY
                            </a>
                          </>
                        )}

                        {!giphyQuery && (
                          <>
                            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              PlayCrew originals
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {GAME_STICKERS.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    setSticker(s.id);
                                    setStickerDrawerOpen(false);
                                  }}
                                  className={`group relative aspect-square overflow-hidden rounded-xl transition duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${
                                    sticker === s.id &&
                                    "bg-violet-300/10 ring-2 ring-violet-300/30"
                                  }`}
                                >
                                  <div className="relative flex h-full w-full items-center justify-center bg-white/[0.03]">
                                    <img
                                      src={s.image}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full rounded-lg object-contain p-1.5 transition duration-300 group-hover:scale-110"
                                    />
                                  </div>
                                  {/* <p className="mt-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                                {s?.label}
                              </p> */}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Footer */}

                      <div className="flex gap-3 border-t border-white/10 bg-black/10 px-5 py-4">
                        <button
                          onClick={() => setSticker(null)}
                          disabled={!sticker}
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setStickerDrawerOpen(false)}
                          className="flex-1 rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {accessDialogOpen && (
              <motion.div
                className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setAccessDialogOpen(false);
                  setPendingAccessType(null);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full max-w-lg rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl"
                >
                  {!pendingAccessType ? (
                    <>
                      <h3 className="text-xl font-bold text-white">
                        How are you accessing this game?
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        Choose the ribbon that will stay with this game.
                      </p>
                      <div className="mt-5 grid gap-3">
                        {ACCESS_OPTIONS.map((option) => (
                          <button
                            key={option.type}
                            type="button"
                            onClick={() => setPendingAccessType(option.type)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-300/50 hover:bg-amber-500/10"
                          >
                            <span className="block font-bold text-white">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-sm text-zinc-400">
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-white">
                        Which date should your timeline use?
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        The official IGDB release date will remain unchanged.
                      </p>
                      <div className="mt-5 grid gap-3">
                        <button
                          type="button"
                          onClick={() => chooseAccessDate("unlock")}
                          className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-left transition hover:bg-amber-500/20"
                        >
                          <span className="block font-bold text-amber-100">
                            Use today&apos;s unlock date
                          </span>
                          <span className="mt-1 block text-sm text-zinc-400">
                            Best for tracking when you actually started access.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => chooseAccessDate("official")}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                        >
                          <span className="block font-bold text-white">
                            Use the official release date
                          </span>
                          <span className="mt-1 block text-sm text-zinc-400">
                            Keep the official date as the personal timeline
                            date.
                          </span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingAccessType(null)}
                        className="mt-5 text-sm text-zinc-400 underline hover:text-white"
                      >
                        Back
                      </button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {posterMenuPosition && (
              <>
                <button
                  type="button"
                  aria-label="Close poster menu"
                  onClick={() => setPosterMenuPosition(null)}
                  className="fixed inset-0 z-[10040] cursor-default"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  style={{
                    left: posterMenuPosition.x,
                    top: posterMenuPosition.y,
                  }}
                  className="fixed z-[10050] w-56 overflow-hidden rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPosterMenuPosition(null);
                      setSteamAssetsOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <SiSteam className="text-lg text-[#66c0f4]" />
                    Use SteamDB images
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <SteamAssetsModal
            open={steamAssetsOpen}
            igdbId={game.igdb.id}
            gameName={game.name}
            currentCoverUrl={bgUrl}
            onClose={() => setSteamAssetsOpen(false)}
            onUseAsset={useSteamAssetAsCover}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
