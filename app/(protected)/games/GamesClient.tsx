"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import Link from "next/link";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { IoStarSharp } from "react-icons/io5";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiList,
  FiSearch,
  FiSliders,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { isTauri } from "@tauri-apps/api/core";

import { db } from "@/app/lib/firebase";
import { useUser } from "../../context/UserContext";
import { useUI } from "@/app/context/UIContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import ConfirmModal from "@/app/components/ConfirmModal";
import GameCard from "@/app/components/GameCard";
import GameQuote from "@/app/components/GameQuote";
import { useGames } from "@/app/context/GameContext";
import { TrackedGame } from "@/app/types/trackedGame";
import styles from "./OnlineToggle.module.css";
import { refreshGameData, type RefreshableGame } from "@/app/utils/refreshGame";
import RefreshModal, { type RefreshField } from "@/app/components/RefreshModal";
import {
  clampGamesBgBlur,
  clampGamesBgOverlay,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  PAGE_SETTINGS_STORAGE_KEY,
} from "@/app/lib/gamesPageSettings";

const STATUSES = [
  "All",
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Online",
  "Try Again?",
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
  admin?: boolean;
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

type ProfileMedia = UserProfile["avatar"] | UserProfile["wallpaper"];

export default function GamesPage() {
  const { profile: userProfile, loading: userLoading, user } = useUser();
  const { games: sharedGames, gamesLoading } = useGames();
  const { navbarLayout } = useUI();
  const router = useRouter();
  const desktop = isTauri();

  const uid = user?.uid as string | undefined;
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("Playing");
  const [releaseFilter, setReleaseFilter] = useState<
    "All" | "Released" | "Unreleased"
  >("Released");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastStatus, setLastStatus] = useState("Playing");
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
  const STATUS_SORTS_KEY = "games.statusSorts";

  const [sortBy, setSortBy] = useState<
    "name" | "date" | "tier" | "release" | "playtime"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
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
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [recentModalOpen, setRecentModalOpen] = useState(false);
  const [recentVisibleCount, setRecentVisibleCount] = useState(15);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  const isDraggingRef = useRef(false);
  const includeOnlineLocked = selectedStatus !== "All";
  const compactStatusTabs =
    !showFavoritesOnly && selectedStatus === "Want To Play";

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
        setBgBlur(clampGamesBgBlur(parsed.bgBlur));
      }

      if (typeof parsed.bgOverlay === "number") {
        setBgOverlay(clampGamesBgOverlay(parsed.bgOverlay));
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

  const getMediaSrc = (media?: ProfileMedia, legacy?: string) => {
    if (!media && legacy) return legacy;
    if (!media) return undefined;
    return media.data;
  };

  const getMediaStyle = (media?: ProfileMedia) => {
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
      "Try Again?": [],
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

  const getReleaseTime = (value: unknown): number => {
    if (!value) return Infinity;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? Infinity : value.getTime();
    }

    if (typeof value === "object" && value !== null && "seconds" in value) {
      return (value as { seconds: number }).seconds * 1000;
    }

    // Firestore Timestamp
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate: unknown }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().getTime();
    }

    // ISO string or number fallback
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return isNaN(date.getTime()) ? Infinity : date.getTime();
    }

    return Infinity;
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
      const now = Date.now();

      list = list.filter((g) => {
        const releaseTime = getReleaseTime(g.igdb?.releaseDate);

        if (releaseTime === Infinity) {
          return releaseFilter === "Unreleased";
        }

        const isReleased = releaseTime <= now;

        return releaseFilter === "Released" ? isReleased : !isReleased;
      });
    }

    if (showFavoritesOnly) {
      list = list.filter((g) => g.favorite);
    }

    list.sort((a, b) => {
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

  const loadStatusSorts = () => {
    if (typeof window === "undefined") return {};

    try {
      return JSON.parse(localStorage.getItem(STATUS_SORTS_KEY) ?? "{}");
    } catch {
      return {};
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sorts = loadStatusSorts();

    sorts[selectedStatus] = {
      sortBy,
      sortOrder,
    };

    localStorage.setItem(STATUS_SORTS_KEY, JSON.stringify(sorts));
  }, [selectedStatus, sortBy, sortOrder]);

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

  const sortedRecentGames = useMemo(
    () =>
      [...allGames].sort(
        (a, b) =>
          (b.lastUpdated?.toMillis?.() ?? 0) -
          (a.lastUpdated?.toMillis?.() ?? 0),
      ),
    [allGames],
  );

  const recentlyEditedGames = useMemo(
    () => sortedRecentGames.slice(0, 6),
    [sortedRecentGames],
  );

  const recentGames = useMemo(
    () => sortedRecentGames.slice(0, recentVisibleCount),
    [sortedRecentGames, recentVisibleCount],
  );

  const handleTabChange = (status: string) => {
    setLastStatus(status);

    setAnimationType("status");

    const sorts = loadStatusSorts();
    const saved = sorts[status];

    if (saved) {
      setSortBy(saved.sortBy);
      setSortOrder(saved.sortOrder);
    }

    setSelectedStatus(status);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (query.trim()) {
      if (selectedStatus !== "All") {
        setSelectedStatus("All");
      }
    } else {
      setSelectedStatus(lastStatus);
    }
  };

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

  const tryAgainCount = useMemo(
    () => allGames.filter((g) => g.status === "Try Again?").length,
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

  const isRefreshableGame = (
    game: TrackedGame,
  ): game is TrackedGame & RefreshableGame => typeof game.igdb?.id === "number";

  useEffect(() => {
    setWallpaperLoaded(false);
  }, [wallpaperMedia?.data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, releaseFilter]);

  useEffect(() => {
    if (selectedStatus === "Want To Play") {
      setReleaseFilter("Released");
    }
  }, [selectedStatus]);

  const openEditModal = (game: TrackedGame) => {
    setEditingGame({
      ...game,
      my_rating: game.my_rating,
      progress: game.progress ?? 0,
      playtime: game.playtime ?? 0,
      review: game.review ?? {
        text: "",
        sticker: null,
      },
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

  const handleBulkRefreshUnreleased = async (
    fields: Record<RefreshField, boolean>,
  ) => {
    if (!uid || bulkRefreshing) return;

    const unreleasedGames = filteredGames.filter(isRefreshableGame);
    if (!unreleasedGames.length) {
      toast("No unreleased games to refresh right now.");
      return;
    }

    setBulkRefreshing(true);
    const loadingToast = toast.loading("Bulk refreshing games...");

    try {
      const results = await Promise.allSettled(
        unreleasedGames.map((game) =>
          refreshGameData(
            uid,
            game,
            fields,
            game._docId ?? String(game.igdb.id),
          ),
        ),
      );

      const refreshedCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedCount = results.length - refreshedCount;

      toast.dismiss(loadingToast);

      if (failedCount > 0) {
        toast.error(
          `Refreshed ${refreshedCount} game${refreshedCount === 1 ? "" : "s"}, ${failedCount} failed.`,
        );
      } else {
        toast.success(
          `Refreshed ${refreshedCount} game${refreshedCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      console.error("Bulk refresh failed", error);
      toast.dismiss(loadingToast);
      toast.error("Bulk refresh failed.");
    } finally {
      setBulkRefreshing(false);
      setBulkModalOpen(false);
    }
  };

  const handleSaveModal = async (
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
  ) => {
    if (!editingGame || saving) return;

    setSaving(true);

    try {
      const targetDocId = editingGame._docId ?? String(editingGame.igdb.id);

      const prev = editingGame;

      let recentActionSummary = "Game Updated";

      const nothingChanged =
        prev.my_rating === rating &&
        (prev.progress ?? 0) === progress &&
        (prev.playtime ?? 0) === playtime &&
        (prev.status ?? "Want To Play") === status &&
        (prev.favorite ?? false) === favorite &&
        (prev.notInterested ?? false) === notInterested &&
        (prev.review?.text ?? "") === review.text &&
        (prev.review?.sticker ?? null) === review.sticker &&
        JSON.stringify(prev.playedSessions ?? []) ===
          JSON.stringify(playedSessions ?? []);

      if (nothingChanged) {
        setModalOpen(false);
        setSaving(false);

        toast("No changes detected.");
        return;
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
      } else if (
        (prev.review?.text ?? "") !== review.text &&
        (prev.review?.sticker ?? null) !== review.sticker
      ) {
        recentActionSummary = "Review Updated";
      } else if ((prev.review?.text ?? "") !== review.text) {
        recentActionSummary = "Review Updated";
      } else if ((prev.review?.sticker ?? null) !== review.sticker) {
        if (!prev.review?.sticker && review.sticker) {
          recentActionSummary = "Sticker Added";
        } else if (prev.review?.sticker && !review.sticker) {
          recentActionSummary = "Sticker Removed";
        } else {
          recentActionSummary = "Sticker Changed";
        }
      }

      /* ---------------- Save to Firestore ---------------- */

      const updatedGame = await updateTrackedGame(targetDocId, {
        my_rating: typeof rating === "number" ? rating : null,
        progress,
        playtime,
        status,
        favorite,
        notInterested,
        review,
        playedSessions,
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

  if (userLoading) {
    return null;
  }
  if (!user) {
    return (
      <motion.main
        className="min-h-screen flex flex-col items-center justify-center bg-[var(--theme-bg)] theme-text px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <h2 className="text-3xl font-bold mb-4 text-center">
          This Page Is For Tracking Your Gamelist.
        </h2>
        <p className="theme-text-muted mb-6 text-center">
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
      className={`min-h-screen ${
        navbarLayout === "sidebar"
          ? `lg:pl-10 ${desktop ? "pt-15" : "pt-5"}`
          : "pt-14"
      } overflow-y-auto bg-[var(--theme-bg)] theme-text lg:h-svh lg:overflow-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {loading || userLoading || gamesLoading ? (
        <LoadingSpinner />
      ) : (
        <div
          className={`max-w-[1850px] mx-auto flex flex-col gap-4 sm:px-4 md:px-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8 lg:px-6`}
        >
          {/* Blurred Background */}
          {wallpaperMedia && (
            <div className="fixed inset-0 z-10 overflow-hidden bg-[var(--theme-bg)]">
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
            <div className="theme-panel border border-[var(--theme-border)] rounded-2xl p-3 sm:p-4 flex flex-col items-center shadow-xl max-w-[330px] mx-auto lg:mx-0 lg:h-full">
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
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full theme-panel flex items-center justify-center text-4xl sm:text-5xl theme-text-muted border-4 border-[var(--theme-border)] shadow-lg">
                    {localProfile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>

              <div className="text-center mt-3.5 w-full">
                <h3 className="font-extrabold text-2xl sm:text-3xl theme-text capitalize truncate px-2">
                  {localProfile?.username || userProfile?.username || "Player"}
                </h3>
                <p
                  className="hidden blur-xs hover:blur-none transition-all duration-200 sm:block w-full max-w-full min-w-0 px-2 py-1 text-sm leading-tight tracking-[-0.02em] theme-text-muted cursor-default truncate"
                  title={localProfile?.email}
                >
                  {localProfile?.email || userProfile?.email}
                </p>
                <p className="text-[12px] theme-text-muted mt-1 max-w-[230px] mx-auto">
                  Joined On: {formattedDate}
                </p>
              </div>

              <hr className="my-4 sm:my-6 w-full border-[var(--theme-border)]" />

              <div className="w-full overflow-y-auto px-1">
                <div className="w-full flex flex-col gap-0.5 text-sm theme-text-muted overflow-y-auto p-1">
                  {[
                    ["Total Games", allGames.length],
                    ["Completed", completedCount],
                    ["On Hold", onHoldCount],
                    ["Playing", playingCount],
                    ["Dropped", droppedCount],
                    ["Online", onlineCount],
                    ["Try Again?", tryAgainCount],
                    ["Not Interested", notInterestedCount],
                    ["Want To Play", wantCount],
                  ].map(([label, value]) => (
                    <div
                      key={label?.toString()}
                      className="flex justify-between w-full px-3 py-2 rounded-lg hover:bg-[var(--theme-panel-alt)] transition-colors duration-200"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="font-semibold theme-text">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-3 sm:my-4 w-full border-[var(--theme-border)]" />

              <div className="mt-1 sm:mt-2 lg:pt-[clamp(0.5rem,2vh,1.5rem)] flex w-full flex-1 items-center">
                <GameQuote />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex-1 min-w-0 px-6 lg:px-0 lg:h-full">
            {/* Tabs */}
            <div className="relative w-full pt-5 pb-2">
              <motion.div
                layout
                className={`relative mx-auto flex w-full max-w-full flex-wrap items-center justify-center overflow-visible rounded-2xl border border-[var(--theme-border)] theme-panel backdrop-blur-sm transition-all duration-200 lg:w-fit lg:flex-nowrap lg:overflow-x-auto ${
                  compactStatusTabs ? "gap-1.5 p-1.5" : "gap-2 p-2"
                }`}
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
                    <div className="theme-surface flex items-center gap-3 rounded-2xl border py-0.5 shadow-[0_0_24px_rgba(var(--theme-accent-rgb),0.08)]">
                      <div className="min-w-0 text-left pr-3 pl-5">
                        <p className="theme-accent-soft-text text-[10px] font-semibold uppercase tracking-[0.22em]">
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
                        className="theme-accent-soft-bg inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition hover:bg-[rgba(var(--theme-accent-rgb),0.18)]"
                      >
                        <FiList size={14} />
                        Back to Library
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {STATUSES.map((status) => (
                      <motion.div
                        layout
                        key={status}
                        className="relative flex shrink-0 items-center gap-2"
                      >
                        <motion.button
                          layout
                          initial={false}
                          animate={{
                            scale: compactStatusTabs ? 0.94 : 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 24,
                          }}
                          className={`rounded-full border font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${
                            compactStatusTabs
                              ? "px-3 py-1.5 text-[13px]"
                              : "px-4 py-1.5 text-sm"
                          } ${
                            selectedStatus === status
                              ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.22)]"
                              : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)] theme-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-cyan-300/24 hover:bg-[rgba(var(--theme-accent-rgb),0.1)] hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                          }`}
                          onClick={() => {
                            handleTabChange(status);
                            if (status !== "Want To Play")
                              setReleaseFilter("All");
                          }}
                          disabled={selectedStatus === status}
                        >
                          {status}
                        </motion.button>
                      </motion.div>
                    ))}

                    <AnimatePresence mode="wait">
                      {selectedStatus === "Want To Play" && (
                        <motion.div
                          key="release-filter"
                          layout
                          className="theme-surface flex shrink-0 flex-wrap items-center justify-center gap-2 overflow-hidden rounded-xl border p-1 lg:flex-nowrap"
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
                          {/* bulk refresh icon moved to toolbar before Include Online */}

                          {["All", "Released", "Unreleased"].map((filter) => (
                            <button
                              key={filter}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-200 ${
                                releaseFilter === filter
                                  ? "border-cyan-300/40 bg-cyan-500 text-black shadow-[0_0_16px_rgba(34,211,238,0.18)]"
                                  : "border-[var(--theme-border)] bg-[var(--theme-panel-alt)] theme-text hover:border-cyan-300/24 hover:bg-[rgba(var(--theme-accent-rgb),0.08)]"
                              }`}
                              onClick={() => {
                                const nextFilter = filter as
                                  | "All"
                                  | "Released"
                                  | "Unreleased";

                                setReleaseFilter(nextFilter);

                                if (nextFilter === "Unreleased") {
                                  setSortBy("release");
                                  setSortOrder("asc");
                                }
                              }}
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
            <div className="mb-4 rounded-2xl border border-[var(--theme-border)] theme-panel p-2.5 backdrop-blur-sm">
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
                      ? "cursor-not-allowed border-[var(--theme-border)] bg-[var(--theme-panel-alt)] text-[color:rgba(var(--theme-accent-rgb),0.45)] opacity-60"
                      : "cursor-pointer border-cyan-400/70 bg-[var(--theme-panel-alt)] theme-text hover:border-cyan-300 hover:bg-cyan-500/10"
                  }`}
                >
                  <FiChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <div className="relative min-w-0 flex-1">
                  <FiSearch className="theme-text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={`${
                      showFavoritesOnly
                        ? "Search for a favorite game"
                        : "Search for a game in " + selectedStatus
                    }`}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="theme-surface-alt h-9 w-full rounded-xl border pl-9 pr-3 text-sm theme-text placeholder:theme-text-muted focus:border-cyan-300/70 focus:outline-none"
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
                      ? "cursor-not-allowed border-[var(--theme-border)] bg-[var(--theme-panel-alt)] text-[color:rgba(var(--theme-accent-rgb),0.45)] opacity-60"
                      : "cursor-pointer border-cyan-400/70 bg-[var(--theme-panel-alt)] theme-text hover:border-cyan-300 hover:bg-cyan-500/10"
                  }`}
                >
                  Next
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="theme-surface group relative inline-flex h-10 items-center overflow-hidden rounded-2xl border pl-2 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-cyan-300/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.12)]">
                  <div className="theme-accent-soft-bg flex h-8 w-8 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <FiSliders className="h-3.5 w-3.5" />
                  </div>
                  <div className="ml-2 mr-3 flex flex-col leading-none">
                    <span className="theme-text-muted text-[10px] font-semibold uppercase tracking-[0.22em]">
                      Sort
                    </span>
                    <span className="theme-text-muted mt-1 text-[11px]">
                      Order
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(
                          e.target.value as
                            | "name"
                            | "date"
                            | "tier"
                            | "release"
                            | "playtime",
                        );
                        setCurrentPage(1);
                      }}
                      className="theme-surface-alt h-8 min-w-[158px] appearance-none rounded-xl border pl-3 pr-9 text-sm font-medium theme-text outline-none transition focus:border-cyan-300/65 focus:bg-white/[0.07]"
                    >
                      <option
                        className="bg-[var(--theme-panel-alt)] theme-text"
                        value="name"
                      >
                        Name
                      </option>
                      <option
                        className="bg-[var(--theme-panel-alt)] theme-text"
                        value="playtime"
                      >
                        Playtime
                      </option>
                      <option
                        className="bg-[var(--theme-panel-alt)] theme-text"
                        value="tier"
                      >
                        Rating
                      </option>
                      <option
                        className="bg-[var(--theme-panel-alt)] theme-text"
                        value="release"
                      >
                        Release Date
                      </option>
                      <option
                        className="bg-[var(--theme-panel-alt)] theme-text"
                        value="date"
                      >
                        Latest Changes
                      </option>
                    </select>
                    <span className="theme-text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center transition group-hover:text-cyan-200/80">
                      <FiChevronRight className="h-3.5 w-3.5 rotate-90" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {releaseFilter === "Unreleased" && (
                    <div className="flex items-center mr-2">
                      <button
                        type="button"
                        onClick={() => setBulkModalOpen(true)}
                        disabled={bulkRefreshing || !filteredGames.length}
                        title="Bulk refresh unreleased"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[var(--theme-panel-alt)] text-zinc-300 hover:border-cyan-300/30 hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M23 4v6h-6" />
                          <path d="M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0114.13-3.36L23 10" />
                          <path d="M20.49 15a9 9 0 01-14.13 3.36L1 14" />
                        </svg>
                      </button>
                      <span className="text-xs theme-text-muted ml-2">
                        {filteredGames.filter(isRefreshableGame).length}
                      </span>
                    </div>
                  )}
                  <div
                    className={`theme-surface group relative flex h-9 items-center gap-3 rounded-xl border px-3 transition ${includeOnlineLocked ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className={styles.toggleLabel}>Include Online</span>
                    <label
                      className={styles.switch}
                      aria-label="Include online games"
                      title={
                        includeOnlineLocked
                          ? "Only available in the All tab"
                          : includeOnlineGames
                            ? "Online games visible"
                            : "Online games hidden"
                      }
                    >
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={includeOnlineGames}
                        disabled={includeOnlineLocked}
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
                    className="theme-surface theme-hover-surface h-9 rounded-xl border px-4 text-xs font-semibold tracking-wide theme-text transition"
                  >
                    {sortBy === "name"
                      ? sortOrder === "asc"
                        ? "A to Z"
                        : "Z to A"
                      : sortBy === "date"
                        ? sortOrder === "asc"
                          ? "Oldest to Newest"
                          : "Newest to Oldest"
                        : sortBy === "release"
                          ? releaseFilter === "Unreleased"
                            ? sortOrder === "asc"
                              ? "Closest to Furthest"
                              : "Furthest to Closest"
                            : sortOrder === "asc"
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
                      <span className="theme-surface inline-flex h-8 w-8 cursor-help select-none items-center justify-center rounded-full border text-xs theme-text-muted">
                        i
                      </span>

                      <div className="theme-panel pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden whitespace-nowrap rounded-lg border px-3 py-1 text-xs theme-text shadow-lg group-hover:block">
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
            <div className="overflow-visible lg:h-[calc(100svh-235px)]">
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
          <div className="relative z-10 w-full shrink-0 px-1 pt-3 flex flex-col gap-3 sm:px-2 md:px-3 lg:h-[calc(100svh-5.5rem)] lg:w-64 lg:px-0 xl:w-74">
            {/* Favorites */}
            <div
              className={`theme-panel rounded-2xl border p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar ${desktop ? "max-h-[45.5vh] min-h-[45.5vh]" : "max-h-[45vh] min-h-[45vh]"}`}
            >
              <div className="flex items-center justify-between py-2">
                <h3 className="theme-text font-bold text-lg">Favorite Games</h3>
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
                    className={`group flex items-center justify-center rounded-md px-3 py-0.5 font-bold transition-all duration-300 ease-in-out cursor-pointer ${
                      showFavoritesOnly
                        ? "bg-cyan-500 border-2 border-cyan-500 text-black"
                        : "theme-accent-soft-bg border-2 border-cyan-400 theme-text hover:bg-cyan-500 hover:text-black"
                    }`}
                  >
                    <FiArrowRight
                      size={14}
                      className="transition-transform duration-300 group-hover:mr-[5px]"
                    />

                    <span className="text-sm max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[60px] group-hover:opacity-100 whitespace-nowrap">
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
                    <p className="theme-text-muted">No Favorite Games</p>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={orderedFavorites}
                    onReorder={(newOrder) => {
                      setOrderedFavorites(newOrder);
                      reorderFavorites(newOrder);
                    }}
                    className="flex flex-col"
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
                          className="flex items-center gap-2 rounded-xl p-2 cursor-pointer group theme-hover-surface transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          <img
                            className="w-12 h-16 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                            src={g.igdb.cover}
                            alt={g.name}
                          />
                          <div className="flex-1 flex flex-col justify-center">
                            <span className="theme-text font-medium text-[13px] transition-colors duration-300  truncate max-w-[200px]">
                              {g.name}
                            </span>

                            <div className="flex gap-1.5 mt-1">
                              <span className="theme-surface-alt theme-text-muted rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition group-hover:bg-white/20">
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
                                    : "theme-text-muted"
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
                            className="theme-text-muted cursor-grab active:cursor-grabbing px-2"
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
            <div className="theme-panel mb-8 rounded-2xl border p-4 flex flex-col gap-3 max-h-[45vh] min-h-[45vh] lg:mb-0">
              <div className="flex items-center justify-between py-2">
                <h3 className="theme-text font-bold text-lg">
                  Recently Edited
                </h3>

                <button
                  onClick={() => setRecentModalOpen(true)}
                  className="group flex items-center justify-center rounded-md px-3 py-0.5 font-bold transition-all duration-300 ease-in-out cursor-pointer theme-accent-soft-bg border-2 border-cyan-400 theme-text hover:bg-cyan-500 hover:text-black"
                >
                  <FiArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:mr-[5px]"
                  />

                  <span className="text-sm max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[60px] group-hover:opacity-100 whitespace-nowrap">
                    View
                  </span>
                </button>
              </div>
              <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
                {loading ? (
                  renderSkeletons(3, "recent")
                ) : recentlyEditedGames.length === 0 ? (
                  <div className="h-[35vh] flex justify-center items-center">
                    <p className="theme-text-muted">No recent games</p>
                  </div>
                ) : (
                  recentlyEditedGames.map((g) => (
                    <Link key={g.igdb.id} href={`/game/${g.igdb?.id}`}>
                      <div className="theme-hover-surface flex flex-col gap-1.5 rounded-xl p-2 cursor-pointer group transition-all duration-200">
                        <div className="flex items-center gap-2">
                          <img
                            className="w-12 h-16 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
                            src={g.igdb.cover}
                            alt={g.name}
                          />
                          <div className="flex-1 flex flex-col justify-center">
                            <span className="theme-text font-bold text-[12px] transition max-w-[200px] line-clamp-2">
                              {g.name}
                            </span>
                            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-cyan-100/85 group-hover:text-cyan-50">
                              {g.recentActionSummary}
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

      {editingGame && (
        <GameTrackingModal
          key={`${editingGame._docId ?? editingGame.igdb.id}-${modalOpen ? "open" : "closed"}`}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveModal}
          saving={saving}
          game={editingGame}
          initialReview={
            editingGame.review ?? {
              text: "",
              sticker: null,
            }
          }
          initialRating={editingGame.my_rating ?? null}
          initialProgress={editingGame.progress ?? 0}
          initialPlaytime={editingGame.playtime ?? 0}
          initialPlayedSessions={editingGame.playedSessions}
          initialStatus={editingGame.status ?? "Playing"}
          initialFavorite={editingGame.favorite ?? false}
          showStatus={true}
          showFavorite={true}
        />
      )}

      {bulkModalOpen && (
        <RefreshModal
          open={bulkModalOpen}
          title="Bulk Refresh Unreleased"
          count={filteredGames.filter(isRefreshableGame).length}
          onClose={() => setBulkModalOpen(false)}
          onConfirm={handleBulkRefreshUnreleased}
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

      <AnimatePresence>
        {recentModalOpen && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRecentModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 26,
              }}
              onClick={(e) => e.stopPropagation()}
              className="theme-panel w-full max-w-5xl h-[85vh] rounded-3xl border border-[var(--theme-border)] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 z-20 border-b border-white/10 backdrop-blur-xl px-8 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                      Activity Feed
                    </p>
                    ```
                    <h2 className="mt-1 text-3xl font-black">
                      Recently Edited Games
                    </h2>
                    <p className="theme-text-muted mt-1 text-sm">
                      Latest changes across your game library
                    </p>
                  </div>

                  <button
                    onClick={() => setRecentModalOpen(false)}
                    className="h-11 w-11 rounded-xl border border-white/10 transition hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="h-[calc(85vh-95px)] overflow-y-auto custom-scrollbar p-8">
                <div className="relative max-w-4xl mx-auto">
                  <div className="absolute left-[22px] top-0 bottom-0 w-px bg-cyan-500/20" />

                  {recentGames.map((g, index) => (
                    <motion.div
                      key={`${g.igdb.id}-${index}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.02,
                      }}
                      className="relative mb-6 pl-16"
                    >
                      <div className="absolute left-[10px] top-8 h-6 w-6 rounded-full border-4 border-[var(--theme-bg)] bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.7)]" />

                      <Link
                        href={`/game/${g.igdb.id}`}
                        onClick={() => setRecentModalOpen(false)}
                      >
                        <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-400/30 hover:bg-white/[0.05]">
                          <div className="flex gap-4">
                            <img
                              src={g.igdb.cover}
                              alt={g.name}
                              className="h-28 w-20 rounded-xl object-cover shadow-lg transition-transform duration-300 group-hover:scale-105"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h3 className="line-clamp-2 text-lg font-bold">
                                    {g.name}
                                  </h3>

                                  <p className="mt-2 text-sm font-medium text-cyan-300">
                                    {g.recentActionSummary}
                                  </p>
                                </div>

                                <span className="whitespace-nowrap text-xs text-zinc-500">
                                  {g.lastUpdated
                                    ? new Date(
                                        g.lastUpdated.toMillis(),
                                      ).toLocaleString()
                                    : "Unknown"}
                                </span>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                                  {g.status}
                                </span>

                                {typeof g.my_rating === "number" && (
                                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                                    ★ {g.my_rating}
                                  </span>
                                )}

                                {(g.playtime ?? 0) > 0 && (
                                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                                    {Math.floor(g.playtime ?? 0)}h
                                  </span>
                                )}
                              </div>

                              {g.review?.text && (
                                <p className="mt-3 line-clamp-2 text-sm text-zinc-400">
                                  {g.review?.text}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}

                  {recentVisibleCount < sortedRecentGames.length && (
                    <div className="relative pb-8 pl-16">
                      <div className="absolute left-[22px] top-0 h-full w-px bg-cyan-500/20" />

                      <div className="absolute left-[10px] top-4 h-6 w-6 rounded-full border-4 border-[var(--theme-bg)] bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.7)]" />

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
                        <div className="flex flex-col items-center gap-4">
                          <div className="h-px w-full bg-white/10" />

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setRecentVisibleCount((prev) => prev + 15);
                            }}
                            className="rounded-xl border border-cyan-400/30 px-6 py-3 text-sm font-semibold transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-500 hover:text-black"
                          >
                            Load 15 More Activities
                          </button>

                          <span className="text-xs text-zinc-500">
                            Showing {recentGames.length} of{" "}
                            {sortedRecentGames.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}{" "}
      </AnimatePresence>
    </motion.main>
  );
}
