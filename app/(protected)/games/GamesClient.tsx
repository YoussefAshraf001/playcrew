"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import Link from "next/link";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { IoStarSharp } from "react-icons/io5";

import { db } from "@/app/lib/firebase";
import { useUser } from "../../context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import GameTrackingModal from "@/app/components/GameTrackingModal";

import toast from "react-hot-toast";
import ConfirmModal from "@/app/components/ConfirmModal";
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiList,
  FiSearch,
  FiSliders,
  FiX,
} from "react-icons/fi";
import GameCard from "@/app/components/GameCard";
import GameQuote from "@/app/components/GameQuote";
import { useGames } from "@/app/context/GameContext";
import styles from "./OnlineToggle.module.css";
import { CategoryRatings, TrackedGame } from "@/app/types/trackedGame";
import { useRouter } from "next/navigation";

const STATUSES = [
  "All",
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Online",
  "Want To Play",
];

const formatRating = (rating: number) =>
  Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  bio?: string;
  emailVerified?: boolean;
  avatar?: {
    type: "image" | "gif";
    data: string;
    crop?: { x: number; y: number; zoom: number };
  };

  wallpaper?: {
    type: "image" | "gif";
    data: string;
    crop?: { x: number; y: number; zoom: number };
  };

  trackedGames: Record<string, TrackedGame>;
  creationTime?: Date;
  lastSignInTime?: Date;
}

const PAGE_SETTINGS_STORAGE_KEY = "games.pageSettings";
const DEFAULT_BG_BLUR = 12;
const DEFAULT_BG_OVERLAY = 50;

export default function GamesPage() {
  const { profile: userProfile, loading: userLoading, user } = useUser();
  const { games: sharedGames, gamesLoading } = useGames();
  const router = useRouter();
  const uid = user?.uid as string | undefined;
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("Playing");
  const [releaseFilter, setReleaseFilter] = useState<
    "All" | "Released" | "Unreleased"
  >("Released");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  //Sorting
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [orderedFavorites, setOrderedFavorites] = useState<TrackedGame[]>([]);
  const [includeOnlineGames, setIncludeOnlineGames] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("games.includeOnlineGames");
    return stored === null ? true : stored === "true";
  });

  const [sortBy, setSortBy] = useState<
    "name" | "date" | "tier" | "release" | "playtime"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bgBlur, setBgBlur] = useState(DEFAULT_BG_BLUR);
  const [bgOverlay, setBgOverlay] = useState(DEFAULT_BG_OVERLAY);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [wallpaperLoaded, setWallpaperLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const [animationType, setAnimationType] = useState<"page" | "status">("page");

  //Editing Games
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<TrackedGame | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!uid) {
      setLocalProfile(null);
      setLoading(false);
      return;
    }

    const updatedGames: Record<string, TrackedGame> = {};

    sharedGames.forEach((entry) => {
      const data = entry as unknown as TrackedGame;

      updatedGames[entry.id] = {
        ...data,
        igdb: {
          ...data.igdb,
          releaseDate:
            data.igdb?.releaseDate instanceof Timestamp
              ? data.igdb.releaseDate.toDate()
              : data.igdb?.releaseDate,
        },
      };
    });

    setLocalProfile((prev) => {
      if (!prev) {
        return {
          uid,
          username: userProfile?.username || "",
          bio: userProfile?.bio || "",
          email: userProfile?.email || "",
          avatar: userProfile?.avatar,
          wallpaper: userProfile?.wallpaper,
          trackedGames: updatedGames,
          creationTime: user?.metadata?.creationTime
            ? new Date(user.metadata.creationTime)
            : undefined,
          lastSignInTime: user?.metadata?.lastSignInTime
            ? new Date(user.metadata.lastSignInTime)
            : undefined,
        };
      }
      return {
        ...prev,
        trackedGames: updatedGames, // 🔥 THIS LINE
      };
    });

    setLoading(false);
  }, [uid, sharedGames, userProfile, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "games.includeOnlineGames",
      String(includeOnlineGames),
    );
  }, [includeOnlineGames]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY);
    if (!stored) {
      setSettingsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        bgBlur?: number;
        bgOverlay?: number;
      };

      if (typeof parsed.bgBlur === "number") {
        setBgBlur(Math.min(24, Math.max(0, parsed.bgBlur)));
      }

      if (typeof parsed.bgOverlay === "number") {
        setBgOverlay(Math.min(85, Math.max(0, parsed.bgOverlay)));
      }
    } catch (error) {
      console.error("Failed to parse games page settings", error);
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !settingsHydrated) return;

    window.localStorage.setItem(
      PAGE_SETTINGS_STORAGE_KEY,
      JSON.stringify({ bgBlur, bgOverlay }),
    );
  }, [bgBlur, bgOverlay, settingsHydrated]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  const getMediaSrc = (media?: any, legacy?: string) => {
    if (!media && legacy) return legacy;
    if (!media) return undefined;
    return media.data;
  };

  const getMediaStyle = (media?: any) => {
    if (!media || media.type !== "gif" || !media.crop) return undefined;

    const { x, y, zoom } = media.crop;
    return {
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    };
  };

  // Convert trackedGames to array - only include games with valid igdb.id
  const allGames: TrackedGame[] = useMemo(() => {
    const games = Object.values(localProfile?.trackedGames || {}).filter(
      (game): game is TrackedGame => {
        if (!game) return false;
        if (!game.igdb || !game.igdb.id) {
          console.error(game);
          return false;
        }
        return true;
      },
    );
    return games;
  }, [localProfile?.trackedGames]);

  // Categorize by status
  const gamesByStatus = useMemo(() => {
    const map: Record<string, TrackedGame[]> = {
      All: [],
      Playing: [],
      Completed: [],
      "On Hold": [],
      Dropped: [],
      Online: [],
      "Want To Play": [],
    };

    allGames.forEach((g) => {
      const status = g.status && map[g.status] ? g.status : "Want To Play";
      map[status].push(g);
      map.All.push(g);
    });

    return map;
  }, [allGames]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const getReleaseTime = (value: any): number => {
    if (!value) return Infinity;

    // Firestore Timestamp
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate().getTime();
    }

    // ISO string fallback
    const date = new Date(value);
    return isNaN(date.getTime()) ? Infinity : date.getTime();
  };

  // Filter and sort safely
  const filteredGames = useMemo(() => {
    let list = showFavoritesOnly
      ? allGames
      : selectedStatus === "All"
        ? gamesByStatus.All
        : gamesByStatus[selectedStatus] || [];

    // Clone before mutation
    list = [...list];

    if (!includeOnlineGames && selectedStatus !== "Online") {
      list = list.filter((g) => g.status !== "Online");
    }

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, " ") // removes :, -, etc
        .replace(/\s+/g, " ")
        .trim();

    if (debouncedSearch) {
      const normalizedQuery = normalize(debouncedSearch);

      list = list.filter(
        (g) => g.name && normalize(g.name).includes(normalizedQuery),
      );
    }

    if (releaseFilter !== "All") {
      const now = new Date();

      list = list.filter((g) => {
        const release = g.igdb?.releaseDate;

        if (!release) return releaseFilter === "Unreleased";

        if (releaseFilter === "Released") return release <= now;
        if (releaseFilter === "Unreleased") return release > now;

        return true;
      });
    }

    if (showFavoritesOnly) {
      list = list.filter((g) => g.favorite);
    }

    list.sort((a, b) => {
      // Special case: unreleased sorting
      if (releaseFilter === "Unreleased") {
        const aDate = getReleaseTime(a.igdb?.releaseDate);
        const bDate = getReleaseTime(b.igdb?.releaseDate);
        return aDate - bDate;
      }

      switch (sortBy) {
        case "name":
          return sortOrder === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);

        case "tier": {
          const aRating =
            typeof a.my_rating === "number" && Number.isFinite(a.my_rating)
              ? a.my_rating
              : Number.NEGATIVE_INFINITY;

          const bRating =
            typeof b.my_rating === "number" && Number.isFinite(b.my_rating)
              ? b.my_rating
              : Number.NEGATIVE_INFINITY;

          return sortOrder === "asc" ? aRating - bRating : bRating - aRating;
        }

        case "playtime": {
          const aTime = a.playtime ?? 0;
          const bTime = b.playtime ?? 0;

          return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
        }

        case "release": {
          const aVal = getReleaseTime(a.igdb?.releaseDate);
          const bVal = getReleaseTime(b.igdb?.releaseDate);
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }

        case "date":
        default: {
          const aVal = a.lastUpdated?.toMillis?.() ?? 0;
          const bVal = b.lastUpdated?.toMillis?.() ?? 0;
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
      }
    });

    return list;
  }, [
    gamesByStatus,
    selectedStatus,
    debouncedSearch,
    releaseFilter,
    showFavoritesOnly,
    sortBy,
    sortOrder,
    includeOnlineGames,
  ]);

  //Games Pages
  const validGames = filteredGames.filter((g) => g.name);
  const totalPages = Math.ceil(validGames.length / PAGE_SIZE);

  const visibleGames = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return validGames.slice(start, end);
  }, [validGames, currentPage]);

  const favoriteGames = useMemo(
    () =>
      allGames
        .filter((g) => g.favorite)
        .sort((a, b) => (a.favoriteOrder ?? 9999) - (b.favoriteOrder ?? 9999)),
    [allGames],
  );

  useEffect(() => {
    setOrderedFavorites(favoriteGames);
  }, [favoriteGames]);

  const recentlyEditedGames = useMemo(
    () =>
      [...allGames]
        .sort(
          (a, b) =>
            (b.lastUpdated?.toMillis?.() ?? 0) -
            (a.lastUpdated?.toMillis?.() ?? 0),
        )
        .slice(0, 6),
    [allGames],
  );

  const handleTabChange = (status: string) => {
    setAnimationType("status");
    setSelectedStatus(status);
  };

  const handleSearchChange = (query: string) => setSearchQuery(query);

  // Counts for left column
  const completedCount = useMemo(
    () => allGames.filter((g) => g.status === "Completed").length,
    [allGames],
  );

  const onHoldCount = useMemo(
    () => allGames.filter((g) => g.status === "On Hold").length,
    [allGames],
  );

  const playingCount = useMemo(
    () => allGames.filter((g) => g.status === "Playing").length,
    [allGames],
  );

  const droppedCount = useMemo(
    () => allGames.filter((g) => g.status === "Dropped").length,
    [allGames],
  );

  const onlineCount = useMemo(
    () => allGames.filter((g) => g.status === "Online").length,
    [allGames],
  );

  const notInterestedCount = useMemo(
    () => allGames.filter((g) => g.notInterested).length,
    [allGames],
  );

  const wantCount = useMemo(
    () => allGames.filter((g) => g.status === "Want To Play").length,
    [allGames],
  );

  type SkeletonVariant = "favorite" | "recent" | "grid";

  const renderSkeletons = (count: number, variant: SkeletonVariant = "grid") =>
    Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className={`rounded-xl bg-zinc-900 shadow-lg w-full mb-2 animate-pulse ${
          variant === "grid" ? "min-h-[350px]" : "min-h-[60px]"
        }`}
      >
        {/* FAVORITE */}
        {variant === "favorite" && (
          <div className="flex items-center gap-4 p-3">
            <div className="w-15 h-20 bg-zinc-700 rounded" />

            <div className="flex-1 flex flex-col justify-center gap-2">
              <div className="h-5 w-3/4 bg-zinc-700 rounded" />
              <div className="flex gap-3">
                <div className="h-4 w-11 bg-zinc-700 rounded" />
                <div className="h-4 w-11 bg-zinc-700 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* RECENT */}
        {variant === "recent" && (
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-zinc-900 animate-pulse">
            {/* Top row */}
            <div className="flex items-center gap-3">
              {/* Cover */}
              <div className="w-14 h-20 bg-zinc-700 rounded-md shrink-0" />

              {/* Text */}
              <div className="flex flex-col gap-2 flex-1">
                {/* Title */}
                <div className="h-4 w-2/3 bg-zinc-700 rounded" />

                {/* Playtime */}
                <div className="h-3 w-16 bg-zinc-700 rounded" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
              <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-linear-to-r from-zinc-600 via-zinc-500 to-zinc-600 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* GRID */}
        {variant === "grid" && (
          <>
            <div className="h-56 bg-zinc-700 w-full" />
            <div className="p-4 space-y-2">
              <div className="h-6 bg-zinc-700 rounded w-3/4" />
              <div className="h-4 bg-zinc-700 rounded w-1/2" />
              <div className="h-4 bg-zinc-700 rounded w-1/4" />
            </div>
          </>
        )}
      </div>
    ));

  const formattedDate = localProfile?.creationTime?.toLocaleDateString("en-GB");
  const profileUsername =
    localProfile?.username || userProfile?.username || "profile";
  const wallpaperMedia = localProfile?.wallpaper || userProfile?.wallpaper;

  useEffect(() => {
    setWallpaperLoaded(false);
  }, [wallpaperMedia?.data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, releaseFilter]);

  useEffect(() => {
    if (selectedStatus === "Want To Play") {
      setReleaseFilter("Released");
      setSortBy("date");
    }
  }, [selectedStatus]);

  const openEditModal = (game: TrackedGame) => {
    setEditingGame({
      ...game,
      my_rating: game.my_rating,
      progress: game.progress ?? 0,
      playtime: game.playtime ?? 0,
      notes: game.notes ?? "",
      categoryRatings: game.categoryRatings,
    });
    setModalOpen(true);
  };

  const updateTrackedGame = async (
    gameId: string | number,
    patch: Partial<TrackedGame>,
  ) => {
    if (!user) return;

    const gameRef = doc(db, "users", user.uid, "games_igdb", String(gameId));
    const snap = await getDoc(gameRef);

    const updated = {
      ...(snap.exists() ? snap.data() : {}),
      ...patch,
    };

    await setDoc(gameRef, updated, { merge: true });
    return updated as TrackedGame;
  };

  const reorderFavorites = async (reordered: TrackedGame[]) => {
    if (!user) return;

    const updates = reordered.map((game, index) => {
      const ref = doc(
        db,
        "users",
        user.uid,
        "games_igdb",
        game._docId ?? String(game.igdb.id),
      );

      return setDoc(ref, { favoriteOrder: index }, { merge: true });
    });

    await Promise.all(updates);
  };

  const handleSaveModal = async (
    notes: string,
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
    playedSessions: NonNullable<TrackedGame["playedSessions"]>,
    save?: TrackedGame["save"],
  ) => {
    if (!editingGame || saving) return;

    setSaving(true);

    try {
      const targetDocId = editingGame._docId ?? String(editingGame.igdb.id);

      const prev = editingGame;

      const safeCategoryRatings = {
        graphics: categoryRatings.graphics ?? null,
        gameplay: categoryRatings.gameplay ?? null,
        story: categoryRatings.story ?? null,
        ost: categoryRatings.ost ?? null,
        cinematics: categoryRatings.cinematics ?? null,
        voiceActing: categoryRatings.voiceActing ?? null,
      };

      /* ---------------- Determine recent action ---------------- */

      let recentActionSummary = "Game Updated";

      // 🧠 SAVE LOGIC FIRST (before everything else)
      if (!prev.save && save) {
        recentActionSummary = "Save file uploaded";
      } else if (prev.save && !save) {
        recentActionSummary = "Save file deleted";
      } else if (prev.save && save) {
        if (prev.save.storageKey !== save.storageKey) {
          recentActionSummary = "Save overwritten";
        }
      }

      if (!prev.notInterested && notInterested) {
        recentActionSummary = "Marked as Not Interested";
      } else if (prev.notInterested && !notInterested) {
        recentActionSummary = "Removed from Not Interested";
      } else if (prev.status !== status) {
        recentActionSummary = `Status changed to ${status}`;
      }
      if (prev.my_rating !== rating) {
        recentActionSummary =
          rating === null
            ? "Rating cleared"
            : prev.my_rating === null
              ? `Rating set to ${rating}`
              : `Rating changed ${prev.my_rating} -> ${rating}`;
      } else if (prev.progress !== progress) {
        recentActionSummary = `Progress updated ${prev.progress ?? 0}% -> ${progress}%`;
      } else if (prev.playtime !== playtime) {
        const diff = playtime - (prev.playtime ?? 0);

        const hours = Math.floor(Math.abs(diff));
        const minutes = Math.round((Math.abs(diff) % 1) * 60);

        const formatted = `${hours}h ${minutes}m`;

        if (diff > 0) {
          recentActionSummary = `Playtime increased by ${formatted}`;
        } else {
          recentActionSummary = `Playtime decreased by ${formatted}`;
        }
      } else if (prev.favorite !== favorite) {
        recentActionSummary = favorite
          ? "Added to Favorites"
          : "Removed from Favorites";
      } else if (prev.notes !== notes) {
        recentActionSummary = "Notes Updated";
      }

      /* ---------------- Save to Firestore ---------------- */

      const updatedGame = await updateTrackedGame(targetDocId, {
        my_rating: typeof rating === "number" ? rating : null,
        progress,
        playtime,
        status,
        favorite,
        notInterested,
        notes,
        categoryRatings: safeCategoryRatings,
        playedSessions,
        ...(save !== undefined ? { save } : {}),
        lastUpdated: new Date(),
        recentActionSummary,
      });

      /* ---------------- Fix timestamp locally ---------------- */

      const updatedGameForLocal = {
        ...updatedGame,
        lastUpdated: Timestamp.fromDate(new Date()),
      };

      /* ---------------- Update local profile ---------------- */

      setLocalProfile((prevProfile) => {
        if (!prevProfile) return prevProfile;

        return {
          ...prevProfile,
          trackedGames: {
            ...prevProfile.trackedGames,
            [targetDocId]: {
              ...prevProfile.trackedGames[targetDocId],
              ...updatedGameForLocal,
            },
          },
        };
      });

      toast.success(
        <span>
          <span className="font-bold pr-1">{editingGame.name ?? "Game"}</span>
          <span className="text-black">updated successfully.</span>
        </span>,
      );

      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save game.");
    } finally {
      setSaving(false);
    }
  };

  const openConfirmModal = (
    message: string,
    action: () => void | Promise<void>,
  ) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const pageVariants = {
    enter: (custom: { type: "page" | "status"; direction: number }) => ({
      x: custom.type === "page" ? (custom.direction > 0 ? 80 : -80) : 0,
      y: custom.type === "status" ? 40 : 0,
      opacity: 0,
    }),

    center: {
      x: 0,
      y: 0,
      opacity: 1,
    },

    exit: (custom: { type: "page" | "status"; direction: number }) => ({
      x: custom.type === "page" ? (custom.direction > 0 ? -80 : 80) : 0,
      y: custom.type === "status" ? 40 : 0,
      opacity: 0,
    }),
  };

  if (!user) {
    return (
      <motion.main
        className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <h2 className="text-3xl font-bold mb-4 text-center">
          This Page Is For Tracking Your Gamelist.
        </h2>
        <p className="text-zinc-400 mb-6 text-center">
          Hence, You Must Be Logged In To Enjoy The App To The Fullest.
        </p>

        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-full border-2 border-cyan-500 hover:bg-cyan-400 transition-all duration-300 ease-in-out hover:-translate-y-1.5 font-semibold"
          >
            Go Back To Dashboard
          </Link>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      className={`min-h-screen overflow-y-auto bg-black text-white lg:h-svh lg:overflow-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {loading || userLoading || gamesLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="max-w-[1850px] mx-auto flex flex-col gap-4 px-3 pt-14 sm:px-4 md:px-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8 lg:px-6">
          {/* Blurred Background */}
          {wallpaperMedia && (
            <div className="fixed inset-0 z-10 overflow-hidden bg-black">
              <img
                src={getMediaSrc(wallpaperMedia)}
                onLoad={() => setWallpaperLoaded(true)}
                style={{
                  ...getMediaStyle(wallpaperMedia),
                  filter: `blur(${bgBlur}px) brightness(0.75)`,
                }}
                alt=""
                className={`w-full h-full object-cover transition-opacity duration-700 ease-out ${
                  wallpaperLoaded ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* dark overlay */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(0, 0, 0, ${bgOverlay / 100})` }}
              />

              {/* vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85))]" />
            </div>
          )}

          {/* Left Panel (Stats) */}
          <div className="w-full lg:w-72 lg:h-[calc(100svh-4.5rem)] shrink-0 px-4 relative z-10 pt-3">
            <div className="bg-zinc-900/55 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center shadow-xl max-w-[330px] mx-auto lg:mx-0 lg:h-full">
              {/* Avatar */}
              <Link href={`/profile/${profileUsername}`} className="group">
                {localProfile?.avatar || userProfile?.avatar ? (
                  <img
                    src={getMediaSrc(
                      localProfile?.avatar || userProfile?.avatar,
                    )}
                    style={getMediaStyle(
                      localProfile?.avatar || userProfile?.avatar,
                    )}
                    alt={localProfile?.username ?? "User"}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover shadow-lg transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-700 flex items-center justify-center text-4xl sm:text-5xl text-zinc-400 border-4 border-cyan-400 shadow-lg">
                    {localProfile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>

              {/* Username / Email */}
              <div className="text-center mt-3.5 w-full">
                <h3 className="font-extrabold text-2xl sm:text-3xl text-white capitalize truncate px-2">
                  {localProfile?.username || userProfile?.username || "Player"}
                </h3>
                <p className="hidden sm:block text-sm text-zinc-300 py-1 cursor-default blur-xs hover:blur-none transition">
                  {localProfile?.email}
                </p>
                <p className="text-[12px] text-zinc-300 mt-1 max-w-[230px] mx-auto">
                  Joined On: {formattedDate}
                </p>
                {/* <p className="text-sm capitalize text-zinc-300 mt-1 max-w-[230px] mx-auto line-clamp-2">
                  {localProfile?.bio ||
                    userProfile?.bio ||
                    "No bio yet. Click to edit in profile settings!"}
                </p> */}
              </div>

              <hr className="my-4 sm:my-6 w-full border-zinc-700" />

              {/* Stats */}
              <div className="w-full overflow-y-auto px-1">
                <div className="w-full flex flex-col gap-0.5 text-sm text-zinc-300 overflow-y-auto p-1">
                  {[
                    // ["Member Since", formattedDate],
                    ["Total Games", allGames.length],
                    ["Completed", completedCount],
                    ["On Hold", onHoldCount],
                    ["Playing", playingCount],
                    ["Dropped", droppedCount],
                    ["Online", onlineCount],
                    ["Not Interested", notInterestedCount],
                    ["Want To Play", wantCount],
                  ].map(([label, value]) => (
                    <div
                      key={label?.toString()}
                      className="flex justify-between w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-3 sm:my-4 w-full border-zinc-700" />

              {/* Quote Section */}
              <div className="mt-1 sm:mt-2 lg:pt-[clamp(0.5rem,2vh,1.5rem)] flex w-full flex-1 items-center">
                <GameQuote />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex-1 min-w-0 px-6 lg:px-0 lg:h-full">
            {/* Tabs */}
            <div className="relative w-full pt-5">
              <motion.div
                layout
                className="relative mx-auto flex w-full max-w-full flex-wrap items-center justify-center gap-2 overflow-visible rounded-2xl border border-white/10 bg-zinc-900/55 p-2 backdrop-blur-sm lg:w-fit lg:flex-nowrap lg:overflow-x-auto"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 210,
                  damping: 30,
                  layout: { duration: 0.24, ease: "easeInOut" },
                }}
              >
                {showFavoritesOnly ? (
                  <div className="max-w-full">
                    <div className="flex items-center py-0.5 gap-3 rounded-2xl border border-cyan-300/20 bg-linear-to-r from-cyan-500/18 via-sky-400/10 to-transparent shadow-[0_0_24px_rgba(34,211,238,0.08)]">
                      <div className="min-w-0 text-left pr-3 pl-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                          Favorites Collection
                        </p>
                        {/* <p className="text-xs text-white/60">
                          Showing only your saved favorites.
                        </p> */}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFavoritesOnly(false);
                          setSelectedStatus("All");
                          setCurrentPage(1);
                        }}
                        className="inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-black/25 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/10"
                      >
                        <FiList size={14} />
                        Back to Library
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {STATUSES.map((status) => (
                      <div
                        key={status}
                        className="relative flex shrink-0 items-center gap-2"
                      >
                        <button
                          className={`rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${
                            selectedStatus === status
                              ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.22)]"
                              : "border-cyan-300/12 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(14,18,28,0.92)_38%,rgba(14,18,28,0.98))] text-cyan-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-cyan-300/24 hover:bg-[linear-gradient(90deg,rgba(34,211,238,0.16),rgba(18,24,36,0.95)_42%,rgba(18,24,36,1))] hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                          }`}
                          onClick={() => {
                            handleTabChange(status);
                            if (status !== "Want To Play")
                              setReleaseFilter("All");
                          }}
                          disabled={selectedStatus === status}
                        >
                          {status}
                        </button>
                      </div>
                    ))}

                    <AnimatePresence mode="wait">
                      {selectedStatus === "Want To Play" && (
                        <motion.div
                          key="release-filter"
                          layout
                          className="flex shrink-0 flex-wrap items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-1 lg:flex-nowrap"
                          initial={{ opacity: 0, width: 0, x: -8 }}
                          animate={{ opacity: 1, width: "auto", x: 0 }}
                          exit={{
                            opacity: 0,
                            width: 0,
                            x: -8,
                            padding: 0,
                            borderWidth: 0,
                          }}
                          transition={{ duration: 0.22, ease: "easeInOut" }}
                        >
                          {["All", "Released", "Unreleased"].map((filter) => (
                            <button
                              key={filter}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200 ${
                                releaseFilter === filter
                                  ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_16px_rgba(34,211,238,0.18)]"
                                  : "border-cyan-300/12 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),rgba(14,18,28,0.92)_38%,rgba(14,18,28,0.98))] text-cyan-50/90 hover:border-cyan-300/24 hover:bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(18,24,36,0.95)_42%,rgba(18,24,36,1))]"
                              }`}
                              onClick={() =>
                                setReleaseFilter(
                                  filter as "All" | "Released" | "Unreleased",
                                )
                              }
                            >
                              {filter}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-zinc-900/55 p-2.5 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setAnimationType("page");
                    setPageDirection(-1);
                    setCurrentPage((prev) => prev - 1);
                  }}
                  className={`inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition ${
                    currentPage === 1
                      ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-white/40"
                      : "cursor-pointer border-cyan-400/70 bg-black/20 text-white hover:border-cyan-300 hover:bg-cyan-500/10"
                  }`}
                >
                  <FiChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <div className="relative min-w-0 flex-1">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <input
                    type="text"
                    placeholder={`${
                      showFavoritesOnly
                        ? "Search for a favorite game"
                        : "Search for a game in " + selectedStatus
                    }`}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="h-9 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/70 focus:outline-none"
                  />
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setAnimationType("page");
                    setPageDirection(1);
                    setCurrentPage((prev) => prev + 1);
                  }}
                  className={`inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition ${
                    currentPage === totalPages
                      ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-white/40"
                      : "cursor-pointer border-cyan-400/70 bg-black/20 text-white hover:border-cyan-300 hover:bg-cyan-500/10"
                  }`}
                >
                  Next
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="group relative inline-flex h-10 items-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,26,0.96),rgba(10,10,14,0.92))] pl-2 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-cyan-300/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.12)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/8 text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <FiSliders className="h-3.5 w-3.5" />
                  </div>
                  <div className="ml-2 mr-3 flex flex-col leading-none">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
                      Sort
                    </span>
                    <span className="mt-1 text-[11px] text-white/72">
                      Order
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as any);
                        setCurrentPage(1);
                      }}
                      className="h-8 min-w-[158px] appearance-none rounded-xl border border-white/10 bg-white/4 pl-3 pr-9 text-sm font-medium text-white outline-none transition focus:border-cyan-300/65 focus:bg-white/[0.07]"
                    >
                      <option className="bg-zinc-800 text-white" value="name">
                        Name
                      </option>
                      <option
                        className="bg-zinc-800 text-white"
                        value="playtime"
                      >
                        Playtime
                      </option>
                      <option className="bg-zinc-800 text-white" value="tier">
                        Rating
                      </option>
                      <option
                        className="bg-zinc-800 text-white"
                        value="release"
                      >
                        Release Date
                      </option>
                      <option className="bg-zinc-800 text-white" value="date">
                        Latest Changes
                      </option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/45 transition group-hover:text-cyan-200/80">
                      <FiChevronRight className="h-3.5 w-3.5 rotate-90" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 text-xs font-semibold tracking-wide text-white/90 transition hover:border-cyan-300/35 hover:bg-cyan-500/10 hover:text-cyan-100"
                  >
                    <FiSliders className="h-3.5 w-3.5" />
                    Page Settings
                  </button>
                  <div
                    className={`group relative flex h-9 items-center gap-3 rounded-xl border border-white/15 px-3 transition ${selectedStatus === "Online" && "pointer-events-none opacity-50"}`}
                  >
                    <span className={styles.toggleLabel}>Include Online</span>
                    <label
                      className={`${styles.switch}`}
                      aria-label="Exclude online games"
                      title={
                        includeOnlineGames
                          ? "Online games visible"
                          : "Online games hidden"
                      }
                    >
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={includeOnlineGames}
                        disabled={selectedStatus === "Online"}
                        onChange={(e) => {
                          setIncludeOnlineGames(e.target.checked);
                          setCurrentPage(1);
                        }}
                      />
                      <div className={styles.container}>
                        <div className={styles.button}>
                          <div className={styles.circles}>
                            {Array.from({ length: 12 }).map((_, index) => (
                              <div key={index} className={styles.circle} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                  <button
                    onClick={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    className="h-9 rounded-xl border border-white/15 bg-black/25 px-4 text-xs font-semibold tracking-wide text-white/90 transition hover:border-white/25 hover:bg-white/10"
                  >
                    {sortBy === "name"
                      ? sortOrder === "asc"
                        ? "A to Z"
                        : "Z to A"
                      : sortBy === "date" || sortBy === "release"
                        ? sortOrder === "asc"
                          ? "Oldest to Newest"
                          : "Newest to Oldest"
                        : sortBy === "playtime"
                          ? sortOrder === "asc"
                            ? "Least Played"
                            : "Most Played"
                          : sortBy === "tier"
                            ? sortOrder === "asc"
                              ? "Lowest to Highest"
                              : "Highest to Lowest"
                            : "Sort"}
                  </button>

                  {(sortBy === "tier" || sortBy === "playtime") && (
                    <div className="relative group">
                      <span className="flex h-8 w-8 cursor-help select-none items-center justify-center rounded-full border border-white/15 bg-black/25 text-xs text-white/70">
                        i
                      </span>

                      <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden whitespace-nowrap rounded-lg border border-white/15 bg-zinc-900 px-3 py-1 text-xs text-white shadow-lg group-hover:block">
                        {sortBy === "tier"
                          ? "Only rated games are shown (Want To Play excluded)"
                          : "Only played games are shown (Want To Play excluded)"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Game Grid */}
            <div className="overflow-visible lg:h-[calc(100svh-235px)] lg:overflow-hidden">
              <AnimatePresence
                mode="wait"
                custom={{ type: animationType, direction: pageDirection }}
              >
                <motion.div
                  key={`${selectedStatus}-${currentPage}-${sortBy}-${sortOrder}-${releaseFilter}-${debouncedSearch}-${showFavoritesOnly}-${includeOnlineGames}`}
                  custom={{ type: animationType, direction: pageDirection }}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="mx-auto grid w-fit grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                >
                  {visibleGames.map((game) => (
                    <GameCard
                      key={game.igdb.id}
                      game={game}
                      openEditModal={openEditModal}
                      openConfirmModal={openConfirmModal}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right Panel (Favorites + Recently Edited) */}
          <div className="relative z-10 w-full shrink-0 px-1 pt-3 flex flex-col gap-3 sm:px-2 md:px-3 lg:h-[calc(100svh-5.5rem)] lg:w-64 lg:px-0 xl:w-72">
            {/* Favorites */}
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-2.5 overflow-y-auto custom-scrollbar max-h-[45vh] min-h-[45vh]">
              <div className="flex items-center justify-between py-2">
                <h3 className="font-bold text-lg text-white/90">
                  Favorite Games
                </h3>
                {!showFavoritesOnly && (
                  <motion.button
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0, ease: "easeOut" }}
                    onClick={() => {
                      setShowFavoritesOnly((prev) => !prev);
                      setSelectedStatus("All");
                      setCurrentPage(1);
                    }}
                    className={`group px-3 rounded-md text-white font-bold flex items-center justify-center hover:bg-cyan-500 hover:border-cyan-500 hover:text-black transition-all duration-300 ease-in-out cursor-pointer ${
                      showFavoritesOnly
                        ? "bg-cyan-500 border-2 border-cyan-500"
                        : "bg-transparent border-2 border-cyan-400"
                    }`}
                  >
                    <FiArrowRight
                      size={14}
                      className="transition-transform duration-300 group-hover:mr-[5px]"
                    />

                    <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[60px] group-hover:opacity-100 whitespace-nowrap">
                      View
                    </span>
                  </motion.button>
                )}
              </div>
              <div
                className={`${
                  favoriteGames.length > 0
                    ? "overflow-y-auto custom-scrollbar"
                    : ""
                } flex-1 pr-2`}
              >
                {loading ? (
                  renderSkeletons(4, "favorite")
                ) : favoriteGames.length === 0 ? (
                  <div className="h-[35vh] flex justify-center items-center">
                    <p className="text-zinc-500">No Favorite Games</p>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={orderedFavorites}
                    onReorder={(newOrder) => {
                      setOrderedFavorites(newOrder);
                      reorderFavorites(newOrder);
                    }}
                    className="flex flex-col gap-3"
                  >
                    {orderedFavorites.map((g) => (
                      <Reorder.Item
                        key={g.igdb.id}
                        value={g}
                        drag="y"
                        onDragStart={() => (isDraggingRef.current = true)}
                        onDragEnd={() => {
                          setTimeout(
                            () => (isDraggingRef.current = false),
                            120,
                          );
                        }}
                        whileDrag={{
                          scale: 1.03,
                          zIndex: 50,
                          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                        }}
                        className="rounded-xl"
                      >
                        <div
                          onClick={(e) => {
                            if (isDraggingRef.current) {
                              e.preventDefault();
                              return;
                            }

                            router.push(`/game/${g.igdb.id}`);
                          }}
                          className="flex items-center gap-2 p-1 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          <img
                            className="w-12 h-16 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                            src={g.igdb.cover}
                            alt={g.name}
                          />
                          <div className="flex-1 flex flex-col justify-center">
                            <span className="text-white/90 font-medium text-[13px] group-hover:text-white transition-colors duration-300 truncate max-w-[130px]">
                              {g.name}
                            </span>

                            <div className="flex gap-1.5 mt-1">
                              <span className="text-[11px] font-semibold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
                                {g.playtime
                                  ? `${Math.floor(g.playtime)}h ${Math.round(
                                      (g.playtime % 1) * 60,
                                    )}m`
                                  : "0h 0m"}
                              </span>

                              <span
                                className={`flex items-center gap-1 text-[11px] font-semibold bg-white/10 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 transition-colors duration-300 ${
                                  g.notInterested
                                    ? "text-red-300 group-hover:text-red-200"
                                    : "text-white/70 group-hover:text-white"
                                }`}
                              >
                                {g.notInterested ? (
                                  "Not Interested"
                                ) : (
                                  <>
                                    <IoStarSharp className="w-3 h-3 text-amber-400" />
                                    {typeof g.my_rating === "number" &&
                                    Number.isFinite(g.my_rating)
                                      ? formatRating(g.my_rating)
                                      : "---"}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          <div
                            className="cursor-grab active:cursor-grabbing px-2 text-white/40"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            ☰
                          </div>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </div>
            </div>

            {/* Recently Edited */}
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-3 max-h-[45vh] min-h-[45vh] mb-8 lg:mb-0">
              <h3 className="font-bold text-lg pt-2 pl-1 text-white/90">
                Recently Edited
              </h3>
              <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
                {loading ? (
                  renderSkeletons(3, "recent")
                ) : recentlyEditedGames.length === 0 ? (
                  <div className="h-[35vh] flex justify-center items-center">
                    <p className="text-zinc-500">No recent games</p>
                  </div>
                ) : (
                  recentlyEditedGames.map((g) => (
                    <Link key={g.igdb.id} href={`/game/${g.igdb?.id}`}>
                      <div className="flex flex-col gap-1.5 p-2 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-200">
                        <div className="flex items-center gap-2">
                          <img
                            className="w-12 h-16 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
                            src={g.igdb.cover}
                            alt={g.name}
                          />
                          <div className="flex-1 flex flex-col justify-center">
                            <span className="text-white/90 font-bold text-[12px] group-hover:text-white transition max-w-[200px] line-clamp-2">
                              {g.name}
                            </span>
                            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-cyan-100/85 group-hover:text-cyan-50">
                              {g.recentActionSummary ?? "Game Updated"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close page settings"
              className="fixed inset-0 z-1400 bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setSettingsOpen(false)}
            />

            <motion.aside
              initial={{ opacity: 0, x: 120 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 120 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-1410 flex h-svh w-full max-w-md"
            >
              <div className="relative ml-auto flex h-full w-full flex-col border-l border-cyan-300/15 bg-[linear-gradient(180deg,rgba(7,12,19,0.96),rgba(5,8,14,0.98))] p-5 shadow-[-24px_0_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/65">
                      My Games
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-white">
                      Page Settings
                    </h2>
                    <p className="mt-2 max-w-sm text-sm text-white/62">
                      Adjust the wallpaper blur and dark overlay for this page.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75 transition hover:border-cyan-300/35 hover:bg-cyan-500/10 hover:text-cyan-100"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-8 space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Background Blur
                        </h3>
                        <p className="mt-1 text-xs text-white/55">
                          Controls how soft the wallpaper looks behind the page.
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                        {bgBlur}px
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="1"
                      value={bgBlur}
                      onChange={(event) =>
                        setBgBlur(Number(event.target.value))
                      }
                      className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-400"
                    />
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Overlay Opacity
                        </h3>
                        <p className="mt-1 text-xs text-white/55">
                          Darkens the background to help the content stand out.
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                        {bgOverlay}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="85"
                      step="1"
                      value={bgOverlay}
                      onChange={(event) =>
                        setBgOverlay(Number(event.target.value))
                      }
                      className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-400"
                    />
                  </section>

                  <button
                    type="button"
                    onClick={() => {
                      setBgBlur(DEFAULT_BG_BLUR);
                      setBgOverlay(DEFAULT_BG_OVERLAY);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-black/25 px-4 text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/8"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {editingGame && (
        <GameTrackingModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveModal}
          saving={saving}
          game={editingGame}
          initialNotes={editingGame.notes ?? ""}
          initialRating={editingGame.my_rating ?? null}
          initialCategoryRatings={editingGame.categoryRatings}
          initialProgress={editingGame.progress ?? 0}
          initialPlaytime={editingGame.playtime ?? 0}
          initialPlayedSessions={editingGame.playedSessions}
          initialStatus={editingGame.status ?? "Playing"}
          initialFavorite={editingGame.favorite ?? false}
          showStatus={true}
          showFavorite={true}
        />
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Are you sure?"
        message={confirmMessage}
        onConfirm={async () => {
          setConfirmOpen(false);
          await confirmAction();
        }}
        onCancel={() => setConfirmOpen(false)}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </motion.main>
  );
}

// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { AnimatePresence, motion, Reorder } from "framer-motion";
// import Link from "next/link";
// import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
// import { IoStarSharp } from "react-icons/io5";

// import { db } from "@/app/lib/firebase";
// import { useUser } from "../../context/UserContext";
// import LoadingSpinner from "@/app/components/LoadingSpinner";
// import GameTrackingModal from "@/app/components/GameTrackingModal";

// import toast from "react-hot-toast";
// import ConfirmModal from "@/app/components/ConfirmModal";
// import {
//   FiArrowRight,
//   FiChevronLeft,
//   FiChevronRight,
//   FiList,
//   FiSearch,
//   FiSliders,
//   FiX,
// } from "react-icons/fi";
// import GameCard from "@/app/components/GameCard";
// import GameQuote from "@/app/components/GameQuote";
// import { useGames } from "@/app/context/GameContext";
// import styles from "./OnlineToggle.module.css";
// import { CategoryRatings, TrackedGame } from "@/app/types/trackedGame";
// import { useRouter } from "next/navigation";

// const STATUSES = [
//   "All",
//   "Playing",
//   "Completed",
//   "On Hold",
//   "Dropped",
//   "Online",
//   "Want To Play",
// ];

// const formatRating = (rating: number) =>
//   Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

// interface UserProfile {
//   uid: string;
//   username: string;
//   email: string;
//   bio?: string;
//   emailVerified?: boolean;
//   avatar?: {
//     type: "image" | "gif";
//     data: string;
//     crop?: { x: number; y: number; zoom: number };
//   };

//   wallpaper?: {
//     type: "image" | "gif";
//     data: string;
//     crop?: { x: number; y: number; zoom: number };
//   };

//   trackedGames: Record<string, TrackedGame>;
//   creationTime?: Date;
//   lastSignInTime?: Date;
// }

// const PAGE_SETTINGS_STORAGE_KEY = "games.pageSettings";
// const DEFAULT_BG_BLUR = 12;
// const DEFAULT_BG_OVERLAY = 50;

// export default function GamesPage() {
//   const { profile: userProfile, loading: userLoading, user } = useUser();
//   const { games: sharedGames, gamesLoading } = useGames();
//   const router = useRouter();
//   const uid = user?.uid as string | undefined;
//   const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
//   const [selectedStatus, setSelectedStatus] = useState("Playing");
//   const [releaseFilter, setReleaseFilter] = useState<
//     "All" | "Released" | "Unreleased"
//   >("Released");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

//   const [currentPage, setCurrentPage] = useState(1);
//   const PAGE_SIZE = 10;

//   //Sorting
//   const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
//   const [orderedFavorites, setOrderedFavorites] = useState<TrackedGame[]>([]);
//   const [includeOnlineGames, setIncludeOnlineGames] = useState(() => {
//     if (typeof window === "undefined") return true;
//     const stored = window.localStorage.getItem("games.includeOnlineGames");
//     return stored === null ? true : stored === "true";
//   });

//   const [sortBy, setSortBy] = useState<
//     "name" | "date" | "tier" | "release" | "playtime"
//   >("date");
//   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
//   const [settingsOpen, setSettingsOpen] = useState(false);
//   const [bgBlur, setBgBlur] = useState(DEFAULT_BG_BLUR);
//   const [bgOverlay, setBgOverlay] = useState(DEFAULT_BG_OVERLAY);
//   const [settingsHydrated, setSettingsHydrated] = useState(false);
//   const [wallpaperLoaded, setWallpaperLoaded] = useState(false);

//   const [loading, setLoading] = useState(true);
//   const [pageDirection, setPageDirection] = useState<1 | -1>(1);
//   const [animationType, setAnimationType] = useState<"page" | "status">("page");

//   //Editing Games
//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingGame, setEditingGame] = useState<TrackedGame | null>(null);
//   const [saving, setSaving] = useState(false);

//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [confirmMessage, setConfirmMessage] = useState("");
//   const [confirmAction, setConfirmAction] = useState<
//     () => void | Promise<void>
//   >(() => {});

//   const isDraggingRef = useRef(false);

//   // Hydrate local profile from shared games context
//   useEffect(() => {
//     if (!uid) {
//       setLocalProfile(null);
//       setLoading(false);
//       return;
//     }

//     const updatedGames: Record<string, TrackedGame> = {};

//     sharedGames.forEach((entry) => {
//       const data = entry as unknown as TrackedGame;

//       updatedGames[entry.id] = {
//         ...data,
//         _docId: entry.id,
//         igdb: {
//           ...data.igdb,
//           releaseDate:
//             data.igdb?.releaseDate instanceof Timestamp
//               ? data.igdb.releaseDate.toDate()
//               : data.igdb?.releaseDate,
//         },
//       };
//     });

//     setLocalProfile((prev) => {
//       if (!prev) {
//         return {
//           uid,
//           username: userProfile?.username || "",
//           bio: userProfile?.bio || "",
//           email: userProfile?.email || "",
//           avatar: userProfile?.avatar,
//           wallpaper: userProfile?.wallpaper,
//           trackedGames: updatedGames,
//           creationTime: user?.metadata?.creationTime
//             ? new Date(user.metadata.creationTime)
//             : undefined,
//           lastSignInTime: user?.metadata?.lastSignInTime
//             ? new Date(user.metadata.lastSignInTime)
//             : undefined,
//         };
//       }

//       return {
//         ...prev,
//         username: userProfile?.username || prev.username,
//         bio: userProfile?.bio || prev.bio,
//         email: userProfile?.email || prev.email,
//         avatar: userProfile?.avatar || prev.avatar,
//         wallpaper: userProfile?.wallpaper || prev.wallpaper,
//         trackedGames: updatedGames,
//       };
//     });

//     setLoading(false);
//   }, [uid, sharedGames, userProfile, user]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     window.localStorage.setItem(
//       "games.includeOnlineGames",
//       String(includeOnlineGames),
//     );
//   }, [includeOnlineGames]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const stored = window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY);
//     if (!stored) {
//       setSettingsHydrated(true);
//       return;
//     }

//     try {
//       const parsed = JSON.parse(stored) as {
//         bgBlur?: number;
//         bgOverlay?: number;
//       };

//       if (typeof parsed.bgBlur === "number") {
//         setBgBlur(Math.min(24, Math.max(0, parsed.bgBlur)));
//       }

//       if (typeof parsed.bgOverlay === "number") {
//         setBgOverlay(Math.min(85, Math.max(0, parsed.bgOverlay)));
//       }
//     } catch (error) {
//       console.error("Failed to parse games page settings", error);
//     } finally {
//       setSettingsHydrated(true);
//     }
//   }, []);

//   useEffect(() => {
//     if (typeof window === "undefined" || !settingsHydrated) return;

//     window.localStorage.setItem(
//       PAGE_SETTINGS_STORAGE_KEY,
//       JSON.stringify({ bgBlur, bgOverlay }),
//     );
//   }, [bgBlur, bgOverlay, settingsHydrated]);

//   useEffect(() => {
//     if (!settingsOpen) return;

//     const handleKeyDown = (event: KeyboardEvent) => {
//       if (event.key === "Escape") {
//         setSettingsOpen(false);
//       }
//     };

//     window.addEventListener("keydown", handleKeyDown);
//     return () => window.removeEventListener("keydown", handleKeyDown);
//   }, [settingsOpen]);

//   const getMediaSrc = (media?: any, legacy?: string) => {
//     if (!media && legacy) return legacy;
//     if (!media) return undefined;
//     return media.data;
//   };

//   const getMediaStyle = (media?: any) => {
//     if (!media || media.type !== "gif" || !media.crop) return undefined;

//     const { x, y, zoom } = media.crop;
//     return {
//       transform: `translate(${x}px, ${y}px) scale(${zoom})`,
//     };
//   };

//   // Convert trackedGames to array - only include games with valid igdb.id
//   const allGames: TrackedGame[] = useMemo(() => {
//     const games = Object.values(localProfile?.trackedGames || {}).filter(
//       (game): game is TrackedGame => {
//         if (!game) return false;
//         if (!game.igdb || !game.igdb.id) {
//           console.error(game);
//           return false;
//         }
//         return true;
//       },
//     );
//     return games;
//   }, [localProfile?.trackedGames]);

//   // Categorize by status
//   const gamesByStatus = useMemo(() => {
//     const map: Record<string, TrackedGame[]> = {
//       All: [],
//       Playing: [],
//       Completed: [],
//       "On Hold": [],
//       Dropped: [],
//       Online: [],
//       "Want To Play": [],
//     };

//     allGames.forEach((g) => {
//       const status = g.status && map[g.status] ? g.status : "Want To Play";
//       map[status].push(g);
//       map.All.push(g);
//     });

//     return map;
//   }, [allGames]);

//   // Debounce search
//   useEffect(() => {
//     const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
//     return () => clearTimeout(handler);
//   }, [searchQuery]);

//   const getReleaseTime = (value: any): number => {
//     if (!value) return Infinity;

//     // Firestore Timestamp
//     if (typeof value === "object" && typeof value.toDate === "function") {
//       return value.toDate().getTime();
//     }

//     // ISO string fallback
//     const date = new Date(value);
//     return isNaN(date.getTime()) ? Infinity : date.getTime();
//   };

//   // Filter and sort safely
//   const filteredGames = useMemo(() => {
//     let list = showFavoritesOnly
//       ? allGames
//       : selectedStatus === "All"
//         ? gamesByStatus.All
//         : gamesByStatus[selectedStatus] || [];

//     // Clone before mutation
//     list = [...list];

//     if (!includeOnlineGames && selectedStatus !== "Online") {
//       list = list.filter((g) => g.status !== "Online");
//     }

//     const normalize = (str: string) =>
//       str
//         .toLowerCase()
//         .replace(/[^\w\s]/g, " ") // removes :, -, etc
//         .replace(/\s+/g, " ")
//         .trim();

//     if (debouncedSearch) {
//       const normalizedQuery = normalize(debouncedSearch);

//       list = list.filter(
//         (g) => g.name && normalize(g.name).includes(normalizedQuery),
//       );
//     }

//     if (releaseFilter !== "All") {
//       const now = new Date();

//       list = list.filter((g) => {
//         const release = g.igdb?.releaseDate;

//         if (!release) return releaseFilter === "Unreleased";

//         if (releaseFilter === "Released") return release <= now;
//         if (releaseFilter === "Unreleased") return release > now;

//         return true;
//       });
//     }

//     if (showFavoritesOnly) {
//       list = list.filter((g) => g.favorite);
//     }

//     list.sort((a, b) => {
//       // Special case: unreleased sorting
//       if (releaseFilter === "Unreleased") {
//         const aDate = getReleaseTime(a.igdb?.releaseDate);
//         const bDate = getReleaseTime(b.igdb?.releaseDate);
//         return aDate - bDate;
//       }

//       switch (sortBy) {
//         case "name":
//           return sortOrder === "asc"
//             ? a.name.localeCompare(b.name)
//             : b.name.localeCompare(a.name);

//         case "tier": {
//           const aRating =
//             typeof a.my_rating === "number" && Number.isFinite(a.my_rating)
//               ? a.my_rating
//               : Number.NEGATIVE_INFINITY;

//           const bRating =
//             typeof b.my_rating === "number" && Number.isFinite(b.my_rating)
//               ? b.my_rating
//               : Number.NEGATIVE_INFINITY;

//           return sortOrder === "asc" ? aRating - bRating : bRating - aRating;
//         }

//         case "playtime": {
//           const aTime = a.playtime ?? 0;
//           const bTime = b.playtime ?? 0;

//           return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
//         }

//         case "release": {
//           const aVal = getReleaseTime(a.igdb?.releaseDate);
//           const bVal = getReleaseTime(b.igdb?.releaseDate);
//           return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
//         }

//         case "date":
//         default: {
//           const aVal = a.lastUpdated?.toMillis?.() ?? 0;
//           const bVal = b.lastUpdated?.toMillis?.() ?? 0;
//           return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
//         }
//       }
//     });

//     return list;
//   }, [
//     gamesByStatus,
//     selectedStatus,
//     debouncedSearch,
//     releaseFilter,
//     showFavoritesOnly,
//     sortBy,
//     sortOrder,
//     includeOnlineGames,
//   ]);

//   //Games Pages
//   const validGames = filteredGames.filter((g) => g.name);
//   const totalPages = Math.ceil(validGames.length / PAGE_SIZE);

//   const visibleGames = useMemo(() => {
//     const start = (currentPage - 1) * PAGE_SIZE;
//     const end = start + PAGE_SIZE;
//     return validGames.slice(start, end);
//   }, [validGames, currentPage]);

//   const favoriteGames = useMemo(
//     () =>
//       allGames
//         .filter((g) => g.favorite)
//         .sort((a, b) => (a.favoriteOrder ?? 9999) - (b.favoriteOrder ?? 9999)),
//     [allGames],
//   );

//   useEffect(() => {
//     setOrderedFavorites(favoriteGames);
//   }, [favoriteGames]);

//   const recentlyEditedGames = useMemo(
//     () =>
//       [...allGames]
//         .sort(
//           (a, b) =>
//             (b.lastUpdated?.toMillis?.() ?? 0) -
//             (a.lastUpdated?.toMillis?.() ?? 0),
//         )
//         .slice(0, 6),
//     [allGames],
//   );

//   const handleTabChange = (status: string) => {
//     setAnimationType("status");
//     setSelectedStatus(status);
//   };

//   const handleSearchChange = (query: string) => setSearchQuery(query);

//   // Counts for left column
//   const completedCount = useMemo(
//     () => allGames.filter((g) => g.status === "Completed").length,
//     [allGames],
//   );

//   const onHoldCount = useMemo(
//     () => allGames.filter((g) => g.status === "On Hold").length,
//     [allGames],
//   );

//   const playingCount = useMemo(
//     () => allGames.filter((g) => g.status === "Playing").length,
//     [allGames],
//   );

//   const droppedCount = useMemo(
//     () => allGames.filter((g) => g.status === "Dropped").length,
//     [allGames],
//   );

//   const onlineCount = useMemo(
//     () => allGames.filter((g) => g.status === "Online").length,
//     [allGames],
//   );

//   const notInterestedCount = useMemo(
//     () => allGames.filter((g) => g.notInterested).length,
//     [allGames],
//   );

//   const wantCount = useMemo(
//     () => allGames.filter((g) => g.status === "Want To Play").length,
//     [allGames],
//   );

//   type SkeletonVariant = "favorite" | "recent" | "grid";

//   const renderSkeletons = (count: number, variant: SkeletonVariant = "grid") =>
//     Array.from({ length: count }).map((_, idx) => (
//       <div
//         key={idx}
//         className={`rounded-xl bg-zinc-900 shadow-lg w-full mb-2 animate-pulse ${
//           variant === "grid" ? "min-h-[350px]" : "min-h-[60px]"
//         }`}
//       >
//         {/* FAVORITE */}
//         {variant === "favorite" && (
//           <div className="flex items-center gap-4 p-3">
//             <div className="w-15 h-20 bg-zinc-700 rounded" />

//             <div className="flex-1 flex flex-col justify-center gap-2">
//               <div className="h-5 w-3/4 bg-zinc-700 rounded" />
//               <div className="flex gap-3">
//                 <div className="h-4 w-11 bg-zinc-700 rounded" />
//                 <div className="h-4 w-11 bg-zinc-700 rounded" />
//               </div>
//             </div>
//           </div>
//         )}

//         {/* RECENT */}
//         {variant === "recent" && (
//           <div className="flex flex-col gap-3 p-3 rounded-xl bg-zinc-900 animate-pulse">
//             {/* Top row */}
//             <div className="flex items-center gap-3">
//               {/* Cover */}
//               <div className="w-14 h-20 bg-zinc-700 rounded-md shrink-0" />

//               {/* Text */}
//               <div className="flex flex-col gap-2 flex-1">
//                 {/* Title */}
//                 <div className="h-4 w-2/3 bg-zinc-700 rounded" />

//                 {/* Playtime */}
//                 <div className="h-3 w-16 bg-zinc-700 rounded" />
//               </div>
//             </div>

//             {/* Progress bar */}
//             <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
//               <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
//                 <div className="h-full w-1/3 bg-linear-to-r from-zinc-600 via-zinc-500 to-zinc-600 animate-pulse rounded-full" />
//               </div>
//             </div>
//           </div>
//         )}

//         {/* GRID */}
//         {variant === "grid" && (
//           <>
//             <div className="h-56 bg-zinc-700 w-full" />
//             <div className="p-4 space-y-2">
//               <div className="h-6 bg-zinc-700 rounded w-3/4" />
//               <div className="h-4 bg-zinc-700 rounded w-1/2" />
//               <div className="h-4 bg-zinc-700 rounded w-1/4" />
//             </div>
//           </>
//         )}
//       </div>
//     ));

//   const formattedDate = localProfile?.creationTime?.toLocaleDateString("en-GB");
//   const profileUsername =
//     localProfile?.username || userProfile?.username || "profile";
//   const wallpaperMedia = localProfile?.wallpaper || userProfile?.wallpaper;

//   useEffect(() => {
//     setWallpaperLoaded(false);
//   }, [wallpaperMedia?.data]);

//   useEffect(() => {
//     setCurrentPage(1);
//   }, [debouncedSearch, selectedStatus, releaseFilter]);

//   useEffect(() => {
//     if (selectedStatus === "Want To Play") {
//       setReleaseFilter("Released");
//       setSortBy("date");
//     }
//   }, [selectedStatus]);

//   const openEditModal = (game: TrackedGame) => {
//     setEditingGame({
//       ...game,
//       my_rating: game.my_rating,
//       progress: game.progress ?? 0,
//       playtime: game.playtime ?? 0,
//       notes: game.notes ?? "",
//       categoryRatings: game.categoryRatings,
//     });
//     setModalOpen(true);
//   };

//   const updateTrackedGame = async (
//     gameId: string | number,
//     patch: Partial<TrackedGame>,
//   ) => {
//     if (!user) return;

//     const gameRef = doc(db, "users", user.uid, "games_igdb", String(gameId));
//     const snap = await getDoc(gameRef);

//     const updated = {
//       ...(snap.exists() ? snap.data() : {}),
//       ...patch,
//     };

//     await setDoc(gameRef, updated, { merge: true });
//     return updated as TrackedGame;
//   };

//   const reorderFavorites = async (reordered: TrackedGame[]) => {
//     if (!user) return;

//     const updates = reordered.map((game, index) => {
//       const ref = doc(
//         db,
//         "users",
//         user.uid,
//         "games_igdb",
//         game._docId ?? String(game.igdb.id),
//       );

//       return setDoc(ref, { favoriteOrder: index }, { merge: true });
//     });

//     await Promise.all(updates);
//   };

//   const handleSaveModal = async (
//     notes: string,
//     rating: number | null,
//     progress: number,
//     playtime: number,
//     status: string,
//     favorite: boolean,
//     categoryRatings: CategoryRatings,
//     notInterested: boolean,
//     playedSessions: NonNullable<TrackedGame["playedSessions"]>,
//     save?: TrackedGame["save"],
//   ) => {
//     if (!editingGame || saving) return;

//     setSaving(true);

//     try {
//       const targetDocId = editingGame._docId ?? String(editingGame.igdb.id);

//       const prev = editingGame;

//       const safeCategoryRatings = {
//         graphics: categoryRatings.graphics ?? null,
//         gameplay: categoryRatings.gameplay ?? null,
//         story: categoryRatings.story ?? null,
//         ost: categoryRatings.ost ?? null,
//         cinematics: categoryRatings.cinematics ?? null,
//         voiceActing: categoryRatings.voiceActing ?? null,
//       };

//       /* ---------------- Determine recent action ---------------- */

//       let recentActionSummary = "Game Updated";

//       // 🧠 SAVE LOGIC FIRST (before everything else)
//       if (!prev.save && save) {
//         recentActionSummary = "Save file uploaded";
//       } else if (prev.save && !save) {
//         recentActionSummary = "Save file deleted";
//       } else if (prev.save && save) {
//         if (prev.save.storageKey !== save.storageKey) {
//           recentActionSummary = "Save overwritten";
//         }
//       }

//       if (!prev.notInterested && notInterested) {
//         recentActionSummary = "Marked as Not Interested";
//       } else if (prev.notInterested && !notInterested) {
//         recentActionSummary = "Removed from Not Interested";
//       } else if (prev.status !== status) {
//         recentActionSummary = `Status changed to ${status}`;
//       }
//       if (prev.my_rating !== rating) {
//         recentActionSummary =
//           rating === null
//             ? "Rating cleared"
//             : prev.my_rating === null
//               ? `Rating set to ${rating}`
//               : `Rating changed ${prev.my_rating} -> ${rating}`;
//       } else if (prev.progress !== progress) {
//         recentActionSummary = `Progress updated ${prev.progress ?? 0}% -> ${progress}%`;
//       } else if (prev.playtime !== playtime) {
//         const diff = playtime - (prev.playtime ?? 0);

//         const hours = Math.floor(Math.abs(diff));
//         const minutes = Math.round((Math.abs(diff) % 1) * 60);

//         const formatted = `${hours}h ${minutes}m`;

//         if (diff > 0) {
//           recentActionSummary = `Playtime increased by ${formatted}`;
//         } else {
//           recentActionSummary = `Playtime decreased by ${formatted}`;
//         }
//       } else if (prev.favorite !== favorite) {
//         recentActionSummary = favorite
//           ? "Added to Favorites"
//           : "Removed from Favorites";
//       } else if (prev.notes !== notes) {
//         recentActionSummary = "Notes Updated";
//       }

//       /* ---------------- Save to Firestore ---------------- */

//       const updatedGame = await updateTrackedGame(targetDocId, {
//         my_rating: typeof rating === "number" ? rating : null,
//         progress,
//         playtime,
//         status,
//         favorite,
//         notInterested,
//         notes,
//         categoryRatings: safeCategoryRatings,
//         playedSessions,
//         ...(save !== undefined ? { save } : {}),
//         lastUpdated: new Date(),
//         recentActionSummary,
//       });

//       /* ---------------- Fix timestamp locally ---------------- */

//       const updatedGameForLocal = {
//         ...updatedGame,
//         lastUpdated: Timestamp.fromDate(new Date()),
//       };

//       /* ---------------- Update local profile ---------------- */

//       setLocalProfile((prevProfile) => {
//         if (!prevProfile) return prevProfile;

//         return {
//           ...prevProfile,
//           trackedGames: {
//             ...prevProfile.trackedGames,
//             [targetDocId]: {
//               ...prevProfile.trackedGames[targetDocId],
//               ...updatedGameForLocal,
//             },
//           },
//         };
//       });

//       toast.success(
//         <span>
//           <span className="font-bold pr-1">{editingGame.name ?? "Game"}</span>
//           <span className="text-black">updated successfully.</span>
//         </span>,
//       );

//       setModalOpen(false);
//     } catch (err) {
//       console.error(err);
//       toast.error("Failed to save game.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const openConfirmModal = (
//     message: string,
//     action: () => void | Promise<void>,
//   ) => {
//     setConfirmMessage(message);
//     setConfirmAction(() => action);
//     setConfirmOpen(true);
//   };

//   const pageVariants = {
//     enter: (custom: { type: "page" | "status"; direction: number }) => ({
//       x: custom.type === "page" ? (custom.direction > 0 ? 80 : -80) : 0,
//       y: custom.type === "status" ? 40 : 0,
//       opacity: 0,
//     }),

//     center: {
//       x: 0,
//       y: 0,
//       opacity: 1,
//     },

//     exit: (custom: { type: "page" | "status"; direction: number }) => ({
//       x: custom.type === "page" ? (custom.direction > 0 ? -80 : 80) : 0,
//       y: custom.type === "status" ? 40 : 0,
//       opacity: 0,
//     }),
//   };

//   if (!user) {
//     return (
//       <motion.main
//         className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4"
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         transition={{ duration: 0.6, ease: "easeInOut" }}
//       >
//         <h2 className="text-3xl font-bold mb-4 text-center">
//           This Page Is For Tracking Your Gamelist.
//         </h2>
//         <p className="text-zinc-400 mb-6 text-center">
//           Hence, You Must Be Logged In To Enjoy The App To The Fullest.
//         </p>

//         <div className="flex gap-4">
//           <Link
//             href="/dashboard"
//             className="px-6 py-3 rounded-full border-2 border-cyan-500 hover:bg-cyan-400 transition-all duration-300 ease-in-out hover:-translate-y-1.5 font-semibold"
//           >
//             Go Back To Dashboard
//           </Link>
//         </div>
//       </motion.main>
//     );
//   }

//   return (
//     <motion.main
//       className={`min-h-screen overflow-y-auto bg-black text-white lg:h-svh lg:overflow-hidden`}
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       transition={{ duration: 0.6, ease: "easeInOut" }}
//     >
//       {loading || userLoading || gamesLoading ? (
//         <LoadingSpinner />
//       ) : (
//         <div className="max-w-[1850px] mx-auto flex flex-col gap-4 px-3 pt-14 sm:px-4 md:px-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8 lg:px-6">
//           {/* Blurred Background */}
//           {wallpaperMedia && (
//             <div className="fixed inset-0 z-10 overflow-hidden bg-black">
//               <img
//                 src={getMediaSrc(wallpaperMedia)}
//                 onLoad={() => setWallpaperLoaded(true)}
//                 style={{
//                   ...getMediaStyle(wallpaperMedia),
//                   filter: `blur(${bgBlur}px) brightness(0.75)`,
//                 }}
//                 alt=""
//                 className={`w-full h-full object-cover transition-opacity duration-700 ease-out ${
//                   wallpaperLoaded ? "opacity-100" : "opacity-0"
//                 }`}
//               />

//               {/* dark overlay */}
//               <div
//                 className="absolute inset-0"
//                 style={{ backgroundColor: `rgba(0, 0, 0, ${bgOverlay / 100})` }}
//               />

//               {/* vignette */}
//               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85))]" />
//             </div>
//           )}

//           {/* Left Panel (Stats) */}
//           <div className="w-full lg:w-72 lg:h-[calc(100svh-4.5rem)] shrink-0 px-4 relative z-10 pt-3">
//             <div className="bg-zinc-900/55 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center shadow-xl max-w-[330px] mx-auto lg:mx-0 lg:h-full">
//               {/* Avatar */}
//               <Link href={`/profile/${profileUsername}`} className="group">
//                 {localProfile?.avatar || userProfile?.avatar ? (
//                   <img
//                     src={getMediaSrc(
//                       localProfile?.avatar || userProfile?.avatar,
//                     )}
//                     style={getMediaStyle(
//                       localProfile?.avatar || userProfile?.avatar,
//                     )}
//                     alt={localProfile?.username ?? "User"}
//                     className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover shadow-lg transition-transform duration-200 group-hover:scale-105"
//                   />
//                 ) : (
//                   <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-700 flex items-center justify-center text-4xl sm:text-5xl text-zinc-400 border-4 border-cyan-400 shadow-lg">
//                     {localProfile?.username?.[0]?.toUpperCase()}
//                   </div>
//                 )}
//               </Link>

//               {/* Username / Email */}
//               <div className="text-center mt-3.5 w-full">
//                 <h3 className="font-extrabold text-2xl sm:text-3xl text-white capitalize truncate px-2">
//                   {localProfile?.username || userProfile?.username || "Player"}
//                 </h3>
//                 <p className="hidden sm:block text-sm text-zinc-300 py-1 cursor-default blur-xs hover:blur-none transition">
//                   {localProfile?.email}
//                 </p>
//                 <p className="text-[12px] text-zinc-300 mt-1 max-w-[230px] mx-auto">
//                   Joined On: {formattedDate}
//                 </p>
//                 {/* <p className="text-sm capitalize text-zinc-300 mt-1 max-w-[230px] mx-auto line-clamp-2">
//                   {localProfile?.bio ||
//                     userProfile?.bio ||
//                     "No bio yet. Click to edit in profile settings!"}
//                 </p> */}
//               </div>

//               <hr className="my-4 sm:my-6 w-full border-zinc-700" />

//               {/* Stats */}
//               <div className="w-full overflow-y-auto px-1">
//                 <div className="w-full flex flex-col gap-0.5 text-sm text-zinc-300 overflow-y-auto p-1">
//                   {[
//                     // ["Member Since", formattedDate],
//                     ["Total Games", allGames.length],
//                     ["Completed", completedCount],
//                     ["On Hold", onHoldCount],
//                     ["Playing", playingCount],
//                     ["Dropped", droppedCount],
//                     ["Online", onlineCount],
//                     ["Not Interested", notInterestedCount],
//                     ["Want To Play", wantCount],
//                   ].map(([label, value]) => (
//                     <div
//                       key={label?.toString()}
//                       className="flex justify-between w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
//                     >
//                       <span className="font-medium">{label}</span>
//                       <span className="font-semibold text-white">{value}</span>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <hr className="my-3 sm:my-4 w-full border-zinc-700" />

//               {/* Quote Section */}
//               <div className="mt-1 sm:mt-2 lg:pt-[clamp(0.5rem,2vh,1.5rem)] flex w-full flex-1 items-center">
//                 <GameQuote />
//               </div>
//             </div>
//           </div>

//           {/* Main Content */}
//           <div className="relative z-10 flex-1 min-w-0 px-6 lg:px-0 lg:h-full">
//             {/* Tabs */}
//             <div className="relative w-full pt-5">
//               <motion.div
//                 layout
//                 className="relative mx-auto flex w-full max-w-full flex-wrap items-center justify-center gap-2 overflow-visible rounded-2xl border border-white/10 bg-zinc-900/55 p-2 backdrop-blur-sm lg:w-fit lg:flex-nowrap lg:overflow-x-auto"
//                 initial={false}
//                 transition={{
//                   type: "spring",
//                   stiffness: 210,
//                   damping: 30,
//                   layout: { duration: 0.24, ease: "easeInOut" },
//                 }}
//               >
//                 {showFavoritesOnly ? (
//                   <div className="max-w-full">
//                     <div className="flex items-center py-0.5 gap-3 rounded-2xl border border-cyan-300/20 bg-linear-to-r from-cyan-500/18 via-sky-400/10 to-transparent shadow-[0_0_24px_rgba(34,211,238,0.08)]">
//                       <div className="min-w-0 text-left pr-3 pl-5">
//                         <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
//                           Favorites Collection
//                         </p>
//                         {/* <p className="text-xs text-white/60">
//                           Showing only your saved favorites.
//                         </p> */}
//                       </div>
//                       <button
//                         type="button"
//                         onClick={() => {
//                           setShowFavoritesOnly(false);
//                           setSelectedStatus("All");
//                           setCurrentPage(1);
//                         }}
//                         className="inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-black/25 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/10"
//                       >
//                         <FiList size={14} />
//                         Back to Library
//                       </button>
//                     </div>
//                   </div>
//                 ) : (
//                   <>
//                     {STATUSES.map((status) => (
//                       <div
//                         key={status}
//                         className="relative flex shrink-0 items-center gap-2"
//                       >
//                         <button
//                           className={`rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${
//                             selectedStatus === status
//                               ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.22)]"
//                               : "border-cyan-300/12 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(14,18,28,0.92)_38%,rgba(14,18,28,0.98))] text-cyan-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-cyan-300/24 hover:bg-[linear-gradient(90deg,rgba(34,211,238,0.16),rgba(18,24,36,0.95)_42%,rgba(18,24,36,1))] hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]"
//                           }`}
//                           onClick={() => {
//                             handleTabChange(status);
//                             if (status !== "Want To Play")
//                               setReleaseFilter("All");
//                           }}
//                           disabled={selectedStatus === status}
//                         >
//                           {status}
//                         </button>
//                       </div>
//                     ))}

//                     <AnimatePresence mode="wait">
//                       {selectedStatus === "Want To Play" && (
//                         <motion.div
//                           key="release-filter"
//                           layout
//                           className="flex shrink-0 flex-wrap items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-1 lg:flex-nowrap"
//                           initial={{ opacity: 0, width: 0, x: -8 }}
//                           animate={{ opacity: 1, width: "auto", x: 0 }}
//                           exit={{
//                             opacity: 0,
//                             width: 0,
//                             x: -8,
//                             padding: 0,
//                             borderWidth: 0,
//                           }}
//                           transition={{ duration: 0.22, ease: "easeInOut" }}
//                         >
//                           {["All", "Released", "Unreleased"].map((filter) => (
//                             <button
//                               key={filter}
//                               className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200 ${
//                                 releaseFilter === filter
//                                   ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_16px_rgba(34,211,238,0.18)]"
//                                   : "border-cyan-300/12 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),rgba(14,18,28,0.92)_38%,rgba(14,18,28,0.98))] text-cyan-50/90 hover:border-cyan-300/24 hover:bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(18,24,36,0.95)_42%,rgba(18,24,36,1))]"
//                               }`}
//                               onClick={() =>
//                                 setReleaseFilter(
//                                   filter as "All" | "Released" | "Unreleased",
//                                 )
//                               }
//                             >
//                               {filter}
//                             </button>
//                           ))}
//                         </motion.div>
//                       )}
//                     </AnimatePresence>
//                   </>
//                 )}
//               </motion.div>
//             </div>

//             <div className="mb-4 rounded-2xl border border-white/10 bg-zinc-900/55 p-2.5 backdrop-blur-sm">
//               <div className="flex min-w-0 items-center gap-2">
//                 <button
//                   disabled={currentPage === 1}
//                   onClick={() => {
//                     setAnimationType("page");
//                     setPageDirection(-1);
//                     setCurrentPage((prev) => prev - 1);
//                   }}
//                   className={`inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition ${
//                     currentPage === 1
//                       ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-white/40"
//                       : "cursor-pointer border-cyan-400/70 bg-black/20 text-white hover:border-cyan-300 hover:bg-cyan-500/10"
//                   }`}
//                 >
//                   <FiChevronLeft className="h-4 w-4" />
//                   Prev
//                 </button>

//                 <div className="relative min-w-0 flex-1">
//                   <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
//                   <input
//                     type="text"
//                     placeholder={`${
//                       showFavoritesOnly
//                         ? "Search for a favorite game"
//                         : "Search for a game in " + selectedStatus
//                     }`}
//                     value={searchQuery}
//                     onChange={(e) => handleSearchChange(e.target.value)}
//                     className="h-9 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/70 focus:outline-none"
//                   />
//                 </div>

//                 <button
//                   disabled={currentPage === totalPages}
//                   onClick={() => {
//                     setAnimationType("page");
//                     setPageDirection(1);
//                     setCurrentPage((prev) => prev + 1);
//                   }}
//                   className={`inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition ${
//                     currentPage === totalPages
//                       ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-white/40"
//                       : "cursor-pointer border-cyan-400/70 bg-black/20 text-white hover:border-cyan-300 hover:bg-cyan-500/10"
//                   }`}
//                 >
//                   Next
//                   <FiChevronRight className="h-4 w-4" />
//                 </button>
//               </div>

//               <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
//                 <div className="group relative inline-flex h-10 items-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,26,0.96),rgba(10,10,14,0.92))] pl-2 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-cyan-300/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.12)]">
//                   <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/8 text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
//                     <FiSliders className="h-3.5 w-3.5" />
//                   </div>
//                   <div className="ml-2 mr-3 flex flex-col leading-none">
//                     <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
//                       Sort
//                     </span>
//                     <span className="mt-1 text-[11px] text-white/72">
//                       Order
//                     </span>
//                   </div>
//                   <div className="relative">
//                     <select
//                       value={sortBy}
//                       onChange={(e) => {
//                         setSortBy(e.target.value as any);
//                         setCurrentPage(1);
//                       }}
//                       className="h-8 min-w-[158px] appearance-none rounded-xl border border-white/10 bg-white/4 pl-3 pr-9 text-sm font-medium text-white outline-none transition focus:border-cyan-300/65 focus:bg-white/[0.07]"
//                     >
//                       <option className="bg-zinc-800 text-white" value="name">
//                         Name
//                       </option>
//                       <option
//                         className="bg-zinc-800 text-white"
//                         value="playtime"
//                       >
//                         Playtime
//                       </option>
//                       <option className="bg-zinc-800 text-white" value="tier">
//                         Rating
//                       </option>
//                       <option
//                         className="bg-zinc-800 text-white"
//                         value="release"
//                       >
//                         Release Date
//                       </option>
//                       <option className="bg-zinc-800 text-white" value="date">
//                         Latest Changes
//                       </option>
//                     </select>
//                     <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/45 transition group-hover:text-cyan-200/80">
//                       <FiChevronRight className="h-3.5 w-3.5 rotate-90" />
//                     </span>
//                   </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <button
//                     type="button"
//                     onClick={() => setSettingsOpen(true)}
//                     className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 text-xs font-semibold tracking-wide text-white/90 transition hover:border-cyan-300/35 hover:bg-cyan-500/10 hover:text-cyan-100"
//                   >
//                     <FiSliders className="h-3.5 w-3.5" />
//                     Page Settings
//                   </button>
//                   <div
//                     className={`group relative flex h-9 items-center gap-3 rounded-xl border border-white/15 px-3 transition ${selectedStatus === "Online" && "pointer-events-none opacity-50"}`}
//                   >
//                     <span className={styles.toggleLabel}>Include Online</span>
//                     <label
//                       className={`${styles.switch}`}
//                       aria-label="Exclude online games"
//                       title={
//                         includeOnlineGames
//                           ? "Online games visible"
//                           : "Online games hidden"
//                       }
//                     >
//                       <input
//                         className={styles.checkbox}
//                         type="checkbox"
//                         checked={includeOnlineGames}
//                         disabled={selectedStatus === "Online"}
//                         onChange={(e) => {
//                           setIncludeOnlineGames(e.target.checked);
//                           setCurrentPage(1);
//                         }}
//                       />
//                       <div className={styles.container}>
//                         <div className={styles.button}>
//                           <div className={styles.circles}>
//                             {Array.from({ length: 12 }).map((_, index) => (
//                               <div key={index} className={styles.circle} />
//                             ))}
//                           </div>
//                         </div>
//                       </div>
//                     </label>
//                   </div>
//                   <button
//                     onClick={() =>
//                       setSortOrder(sortOrder === "asc" ? "desc" : "asc")
//                     }
//                     className="h-9 rounded-xl border border-white/15 bg-black/25 px-4 text-xs font-semibold tracking-wide text-white/90 transition hover:border-white/25 hover:bg-white/10"
//                   >
//                     {sortBy === "name"
//                       ? sortOrder === "asc"
//                         ? "A to Z"
//                         : "Z to A"
//                       : sortBy === "date" || sortBy === "release"
//                         ? sortOrder === "asc"
//                           ? "Oldest to Newest"
//                           : "Newest to Oldest"
//                         : sortBy === "playtime"
//                           ? sortOrder === "asc"
//                             ? "Least Played"
//                             : "Most Played"
//                           : sortBy === "tier"
//                             ? sortOrder === "asc"
//                               ? "Lowest to Highest"
//                               : "Highest to Lowest"
//                             : "Sort"}
//                   </button>

//                   {(sortBy === "tier" || sortBy === "playtime") && (
//                     <div className="relative group">
//                       <span className="flex h-8 w-8 cursor-help select-none items-center justify-center rounded-full border border-white/15 bg-black/25 text-xs text-white/70">
//                         i
//                       </span>

//                       <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden whitespace-nowrap rounded-lg border border-white/15 bg-zinc-900 px-3 py-1 text-xs text-white shadow-lg group-hover:block">
//                         {sortBy === "tier"
//                           ? "Only rated games are shown (Want To Play excluded)"
//                           : "Only played games are shown (Want To Play excluded)"}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//             {/* Game Grid */}
//             <div className="overflow-visible lg:h-[calc(100svh-235px)] lg:overflow-hidden">
//               <AnimatePresence
//                 mode="wait"
//                 custom={{ type: animationType, direction: pageDirection }}
//               >
//                 <motion.div
//                   key={`${selectedStatus}-${currentPage}-${sortBy}-${sortOrder}-${releaseFilter}-${debouncedSearch}-${showFavoritesOnly}-${includeOnlineGames}`}
//                   custom={{ type: animationType, direction: pageDirection }}
//                   variants={pageVariants}
//                   initial="enter"
//                   animate="center"
//                   exit="exit"
//                   transition={{ duration: 0.35, ease: "easeOut" }}
//                   className="mx-auto grid w-fit grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
//                 >
//                   {visibleGames.map((game) => (
//                     <GameCard
//                       key={game.igdb.id}
//                       game={game}
//                       openEditModal={openEditModal}
//                       openConfirmModal={openConfirmModal}
//                     />
//                   ))}
//                 </motion.div>
//               </AnimatePresence>
//             </div>
//           </div>

//           {/* Right Panel (Favorites + Recently Edited) */}
//           <div className="relative z-10 w-full shrink-0 px-1 pt-3 flex flex-col gap-3 sm:px-2 md:px-3 lg:h-[calc(100svh-5.5rem)] lg:w-64 lg:px-0 xl:w-72">
//             {/* Favorites */}
//             <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-2.5 overflow-y-auto custom-scrollbar max-h-[45vh] min-h-[45vh]">
//               <div className="flex items-center justify-between py-2">
//                 <h3 className="font-bold text-lg text-white/90">
//                   Favorite Games
//                 </h3>
//                 {!showFavoritesOnly && (
//                   <motion.button
//                     initial={{ scale: 0.6, opacity: 0 }}
//                     animate={{ scale: 1, opacity: 1 }}
//                     exit={{ scale: 0.6, opacity: 0 }}
//                     transition={{ duration: 0, ease: "easeOut" }}
//                     onClick={() => {
//                       setShowFavoritesOnly((prev) => !prev);
//                       setSelectedStatus("All");
//                       setCurrentPage(1);
//                     }}
//                     className={`group px-3 rounded-md text-white font-bold flex items-center justify-center hover:bg-cyan-500 hover:border-cyan-500 hover:text-black transition-all duration-300 ease-in-out cursor-pointer ${
//                       showFavoritesOnly
//                         ? "bg-cyan-500 border-2 border-cyan-500"
//                         : "bg-transparent border-2 border-cyan-400"
//                     }`}
//                   >
//                     <FiArrowRight
//                       size={14}
//                       className="transition-transform duration-300 group-hover:mr-[5px]"
//                     />

//                     <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[60px] group-hover:opacity-100 whitespace-nowrap">
//                       View
//                     </span>
//                   </motion.button>
//                 )}
//               </div>
//               <div
//                 className={`${
//                   favoriteGames.length > 0
//                     ? "overflow-y-auto custom-scrollbar"
//                     : ""
//                 } flex-1 pr-2`}
//               >
//                 {loading ? (
//                   renderSkeletons(4, "favorite")
//                 ) : favoriteGames.length === 0 ? (
//                   <div className="h-[35vh] flex justify-center items-center">
//                     <p className="text-zinc-500">No Favorite Games</p>
//                   </div>
//                 ) : (
//                   <Reorder.Group
//                     axis="y"
//                     values={orderedFavorites}
//                     onReorder={(newOrder) => {
//                       setOrderedFavorites(newOrder);
//                       reorderFavorites(newOrder);
//                     }}
//                     className="flex flex-col gap-3"
//                   >
//                     {orderedFavorites.map((g) => (
//                       <Reorder.Item
//                         key={g.igdb.id}
//                         value={g}
//                         drag="y"
//                         onDragStart={() => (isDraggingRef.current = true)}
//                         onDragEnd={() => {
//                           setTimeout(
//                             () => (isDraggingRef.current = false),
//                             120,
//                           );
//                         }}
//                         whileDrag={{
//                           scale: 1.03,
//                           zIndex: 50,
//                           boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
//                         }}
//                         className="rounded-xl"
//                       >
//                         <div
//                           onClick={(e) => {
//                             if (isDraggingRef.current) {
//                               e.preventDefault();
//                               return;
//                             }

//                             router.push(`/game/${g.igdb.id}`);
//                           }}
//                           className="flex items-center gap-2 p-1 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md"
//                         >
//                           <img
//                             className="w-12 h-16 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
//                             src={g.igdb.cover}
//                             alt={g.name}
//                           />
//                           <div className="flex-1 flex flex-col justify-center">
//                             <span className="text-white/90 font-medium text-[13px] group-hover:text-white transition-colors duration-300 truncate max-w-[130px]">
//                               {g.name}
//                             </span>

//                             <div className="flex gap-1.5 mt-1">
//                               <span className="text-[11px] font-semibold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
//                                 {g.playtime
//                                   ? `${Math.floor(g.playtime)}h ${Math.round(
//                                       (g.playtime % 1) * 60,
//                                     )}m`
//                                   : "0h 0m"}
//                               </span>

//                               <span
//                                 className={`flex items-center gap-1 text-[11px] font-semibold bg-white/10 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 transition-colors duration-300 ${
//                                   g.notInterested
//                                     ? "text-red-300 group-hover:text-red-200"
//                                     : "text-white/70 group-hover:text-white"
//                                 }`}
//                               >
//                                 {g.notInterested ? (
//                                   "Not Interested"
//                                 ) : (
//                                   <>
//                                     <IoStarSharp className="w-3 h-3 text-amber-400" />
//                                     {typeof g.my_rating === "number" &&
//                                     Number.isFinite(g.my_rating)
//                                       ? formatRating(g.my_rating)
//                                       : "---"}
//                                   </>
//                                 )}
//                               </span>
//                             </div>
//                           </div>
//                           <div
//                             className="cursor-grab active:cursor-grabbing px-2 text-white/40"
//                             onPointerDown={(e) => e.stopPropagation()}
//                           >
//                             ☰
//                           </div>
//                         </div>
//                       </Reorder.Item>
//                     ))}
//                   </Reorder.Group>
//                 )}
//               </div>
//             </div>

//             {/* Recently Edited */}
//             <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-3 max-h-[45vh] min-h-[45vh] mb-8 lg:mb-0">
//               <h3 className="font-bold text-lg pt-2 pl-1 text-white/90">
//                 Recently Edited
//               </h3>
//               <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
//                 {loading ? (
//                   renderSkeletons(3, "recent")
//                 ) : recentlyEditedGames.length === 0 ? (
//                   <div className="h-[35vh] flex justify-center items-center">
//                     <p className="text-zinc-500">No recent games</p>
//                   </div>
//                 ) : (
//                   recentlyEditedGames.map((g) => (
//                     <Link key={g.igdb.id} href={`/game/${g.igdb?.id}`}>
//                       <div className="flex flex-col gap-1.5 p-2 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-200">
//                         <div className="flex items-center gap-2">
//                           <img
//                             className="w-12 h-16 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
//                             src={g.igdb.cover}
//                             alt={g.name}
//                           />
//                           <div className="flex-1 flex flex-col justify-center">
//                             <span className="text-white/90 font-bold text-[12px] group-hover:text-white transition max-w-[200px] line-clamp-2">
//                               {g.name}
//                             </span>
//                             <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-cyan-100/85 group-hover:text-cyan-50">
//                               {g.recentActionSummary ?? "Game Updated"}
//                             </p>
//                           </div>
//                         </div>
//                       </div>
//                     </Link>
//                   ))
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       <AnimatePresence>
//         {settingsOpen && (
//           <>
//             <motion.button
//               type="button"
//               aria-label="Close page settings"
//               className="fixed inset-0 z-1400 bg-black/55 backdrop-blur-sm"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               transition={{ duration: 0.2, ease: "easeOut" }}
//               onClick={() => setSettingsOpen(false)}
//             />

//             <motion.aside
//               initial={{ opacity: 0, x: 120 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: 120 }}
//               transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
//               className="fixed right-0 top-0 z-1410 flex h-svh w-full max-w-md"
//             >
//               <div className="relative ml-auto flex h-full w-full flex-col border-l border-cyan-300/15 bg-[linear-gradient(180deg,rgba(7,12,19,0.96),rgba(5,8,14,0.98))] p-5 shadow-[-24px_0_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
//                 <div className="flex items-start justify-between gap-4">
//                   <div>
//                     <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/65">
//                       My Games
//                     </p>
//                     <h2 className="mt-2 text-2xl font-bold text-white">
//                       Page Settings
//                     </h2>
//                     <p className="mt-2 max-w-sm text-sm text-white/62">
//                       Adjust the wallpaper blur and dark overlay for this page.
//                     </p>
//                   </div>

//                   <button
//                     type="button"
//                     onClick={() => setSettingsOpen(false)}
//                     className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75 transition hover:border-cyan-300/35 hover:bg-cyan-500/10 hover:text-cyan-100"
//                   >
//                     <FiX className="h-4 w-4" />
//                   </button>
//                 </div>

//                 <div className="mt-8 space-y-5">
//                   <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
//                     <div className="flex items-center justify-between gap-3">
//                       <div>
//                         <h3 className="text-sm font-semibold text-white">
//                           Background Blur
//                         </h3>
//                         <p className="mt-1 text-xs text-white/55">
//                           Controls how soft the wallpaper looks behind the page.
//                         </p>
//                       </div>
//                       <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
//                         {bgBlur}px
//                       </span>
//                     </div>

//                     <input
//                       type="range"
//                       min="0"
//                       max="24"
//                       step="1"
//                       value={bgBlur}
//                       onChange={(event) => setBgBlur(Number(event.target.value))}
//                       className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-400"
//                     />
//                   </section>

//                   <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
//                     <div className="flex items-center justify-between gap-3">
//                       <div>
//                         <h3 className="text-sm font-semibold text-white">
//                           Overlay Opacity
//                         </h3>
//                         <p className="mt-1 text-xs text-white/55">
//                           Darkens the background to help the content stand out.
//                         </p>
//                       </div>
//                       <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
//                         {bgOverlay}%
//                       </span>
//                     </div>

//                     <input
//                       type="range"
//                       min="0"
//                       max="85"
//                       step="1"
//                       value={bgOverlay}
//                       onChange={(event) =>
//                         setBgOverlay(Number(event.target.value))
//                       }
//                       className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-400"
//                     />
//                   </section>

//                   <button
//                     type="button"
//                     onClick={() => {
//                       setBgBlur(DEFAULT_BG_BLUR);
//                       setBgOverlay(DEFAULT_BG_OVERLAY);
//                     }}
//                     className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-black/25 px-4 text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/8"
//                   >
//                     Reset to Default
//                   </button>
//                 </div>
//               </div>
//             </motion.aside>
//           </>
//         )}
//       </AnimatePresence>

//       {editingGame && (
//         <GameTrackingModal
//           open={modalOpen}
//           onClose={() => setModalOpen(false)}
//           onSave={handleSaveModal}
//           saving={saving}
//           game={editingGame}
//           initialNotes={editingGame.notes ?? ""}
//           initialRating={editingGame.my_rating ?? null}
//           initialCategoryRatings={editingGame.categoryRatings}
//           initialProgress={editingGame.progress ?? 0}
//           initialPlaytime={editingGame.playtime ?? 0}
//           initialPlayedSessions={editingGame.playedSessions}
//           initialStatus={editingGame.status ?? "Playing"}
//           initialFavorite={editingGame.favorite ?? false}
//           showStatus={true}
//           showFavorite={true}
//         />
//       )}

//       <ConfirmModal
//         open={confirmOpen}
//         title="Are you sure?"
//         message={confirmMessage}
//         onConfirm={async () => {
//           setConfirmOpen(false);
//           await confirmAction();
//         }}
//         onCancel={() => setConfirmOpen(false)}
//         confirmText="Confirm"
//         cancelText="Cancel"
//       />
//     </motion.main>
//   );
// }
