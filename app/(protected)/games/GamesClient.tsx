"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";

import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import Link from "next/link";
import {
  doc,
  deleteField,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { IoStarSharp } from "react-icons/io5";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiList,
  FiSearch,
  FiSliders,
  FiTrash,
} from "react-icons/fi";
import { useRouter } from "next/navigation";

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
import {
  clampGamesBgBlur,
  clampGamesBgOverlay,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  PAGE_SETTINGS_STORAGE_KEY,
} from "@/app/lib/gamesPageSettings";
import SortableGameCard from "@/app/components/SortableGameCard";
import { RiDraggable } from "react-icons/ri";
import {
  filterGames,
  getStatusCounts,
  sortGames,
  type ReleaseFilter,
  type SortBy,
  type SortOrder,
} from "./gamesPageUtils";
import {
  appendRecentGameActionSummary,
  getRecentGameActionSummary,
} from "@/app/lib/recentGameActions";

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

const getLastRecentAction = (summary: string | null | undefined) =>
  summary?.split(" • ").slice(-1)[0] ?? "";

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

  const uid = user?.uid as string | undefined;
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("Playing");
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>(
    selectedStatus === "Want To Play" ? "Released" : "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [lastStatus, setLastStatus] = useState("Playing");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  //Sorting
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [orderedFavorites, setOrderedFavorites] = useState<TrackedGame[]>([]);
  const [previousStatus, setPreviousStatus] = useState("Playing");

  const [previousReleaseFilter, setPreviousReleaseFilter] =
    useState<ReleaseFilter>("All");

  const previousIncludeOnlineGames = useRef<boolean | null>(null);
  const previousIncludeUnreleasedGames = useRef<boolean | null>(null);

  const [includeOnlineGames, setIncludeOnlineGames] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("games.includeOnlineGames");
    return stored === null ? true : stored === "true";
  });
  const STATUS_SORTS_KEY = "games.statusSorts";

  const [orderedWantGames, setOrderedWantGames] = useState<TrackedGame[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [originalWantOrder, setOriginalWantOrder] = useState<TrackedGame[]>([]);
  const [activeGame, setActiveGame] = useState<TrackedGame | null>(null);

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
  const [recentModalOpen, setRecentModalOpen] = useState(false);
  const [recentVisibleCount, setRecentVisibleCount] = useState(15);
  const [coverPreview, setCoverPreview] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  //NEW FADE ANIMATION
  const [idleModeEnabled, setIdleModeEnabled] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdmin = Boolean(localProfile?.admin ?? userProfile?.admin);

  useEffect(() => {
    if (!isAdmin || !idleModeEnabled) {
      setIsIdle(false);

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      return;
    }

    const resetIdleTimer = () => {
      setIsIdle(false);

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 1500);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetIdleTimer);
    });

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      events.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [isAdmin, idleModeEnabled]);

  const isDraggingRef = useRef(false);
  const canReorder =
    selectedStatus === "Want To Play" && releaseFilter === "Released";
  const includeOnlineLocked = selectedStatus !== "All";
  const compactStatusTabs =
    !showFavoritesOnly && selectedStatus === "Want To Play";

  const openCoverPreview = (src: string, alt: string) => {
    setCoverPreview({ src, alt });
  };

  const closeCoverPreview = () => {
    setCoverPreview(null);
  };

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
        trackedGames: updatedGames,
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to parse games page settings",
      );
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
      "Want To Play": [],
    };

    allGames.forEach((g) => {
      const status =
        g.status && g.status !== "Not Interested" && map[g.status]
          ? g.status
          : "Want To Play";
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

  const [includeUnreleasedGames, setIncludeUnreleasedGames] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("games.includeUnreleasedGames");
    return stored === null ? true : stored === "true";
  });

  const includeUnreleasedLocked = selectedStatus !== "All";

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      "games.includeUnreleasedGames",
      String(includeUnreleasedGames),
    );
  }, [includeUnreleasedGames]);

  useEffect(() => {
    if (showFavoritesOnly) {
      if (previousIncludeOnlineGames.current === null) {
        previousIncludeOnlineGames.current = includeOnlineGames;
      }

      if (previousIncludeUnreleasedGames.current === null) {
        previousIncludeUnreleasedGames.current = includeUnreleasedGames;
      }

      setIncludeOnlineGames(true);
      setIncludeUnreleasedGames(true);
      setCurrentPage(1);
      return;
    }

    if (previousIncludeOnlineGames.current !== null) {
      setIncludeOnlineGames(previousIncludeOnlineGames.current);
      previousIncludeOnlineGames.current = null;
    }

    if (previousIncludeUnreleasedGames.current !== null) {
      setIncludeUnreleasedGames(previousIncludeUnreleasedGames.current);
      previousIncludeUnreleasedGames.current = null;
    }
  }, [showFavoritesOnly, includeOnlineGames, includeUnreleasedGames]);

  const loadStatusSorts = () => {
    if (typeof window === "undefined") return {};

    try {
      return JSON.parse(localStorage.getItem(STATUS_SORTS_KEY) ?? "{}");
    } catch {
      return {};
    }
  };

  const saveStatusSort = (
    status: string,
    sortBy: SortBy,
    sortOrder: SortOrder,
  ) => {
    const sorts = loadStatusSorts();

    sorts[status] = {
      sortBy,
      sortOrder,
    };

    localStorage.setItem(STATUS_SORTS_KEY, JSON.stringify(sorts));
  };

  const playingSort =
    typeof window === "undefined" ? null : loadStatusSorts()["Playing"];

  const [sortBy, setSortBy] = useState<SortBy>(playingSort?.sortBy ?? "date");

  const [sortOrder, setSortOrder] = useState<SortOrder>(
    playingSort?.sortOrder ?? "desc",
  );

  // Filter and sort safely
  const filteredGames = useMemo(
    () =>
      sortGames({
        games: filterGames({
          allGames,
          gamesByStatus,
          selectedStatus,
          showFavoritesOnly,
          includeOnlineGames,
          includeUnreleasedGames,
          releaseFilter,
          searchQuery: debouncedSearch,
        }),
        sortBy,
        sortOrder,
      }),
    [
      allGames,
      gamesByStatus,
      selectedStatus,
      showFavoritesOnly,
      includeOnlineGames,
      includeUnreleasedGames,
      releaseFilter,
      debouncedSearch,
      sortBy,
      sortOrder,
    ],
  );

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

  useEffect(() => {
    if (selectedStatus !== "Want To Play" || releaseFilter !== "Released") {
      return;
    }

    setOrderedWantGames(filteredGames);
  }, [filteredGames, selectedStatus, releaseFilter]);

  const sortedRecentGames = useMemo(
    () =>
      [...allGames].sort(
        (a, b) =>
          (b.lastUpdated?.toMillis?.() ?? 0) -
          (a.lastUpdated?.toMillis?.() ?? 0),
      ),
    [allGames],
  );

  const recentGamesWithSummary = useMemo(
    () =>
      sortedRecentGames.filter((game) =>
        Boolean(game.recentActionSummary?.trim()),
      ),
    [sortedRecentGames],
  );

  const recentlyEditedGames = useMemo(
    () => recentGamesWithSummary.slice(0, 6),
    [recentGamesWithSummary],
  );

  const recentGames = useMemo(
    () => recentGamesWithSummary.slice(0, recentVisibleCount),
    [recentGamesWithSummary, recentVisibleCount],
  );

  const handleTabChange = (status: string) => {
    setLastStatus(status);
    setAnimationType("status");
    setSearchQuery("");
    setDebouncedSearch("");

    if (status === "Want To Play") {
      setReleaseFilter("Released");
      setSortBy("priority");
      setSortOrder("asc");
    } else {
      setReleaseFilter("All");

      const sorts = loadStatusSorts();
      const saved = sorts[status];

      if (saved) {
        setSortBy(saved.sortBy);
        setSortOrder(saved.sortOrder);
      }
    }

    setSelectedStatus(status);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (query.trim()) {
      if (selectedStatus !== "All") {
        if (
          selectedStatus === "Want To Play" &&
          releaseFilter === "Unreleased"
        ) {
          setIncludeUnreleasedGames(true);
        }
        setSelectedStatus("All");
      }
    } else {
      setSelectedStatus(lastStatus);
    }
  };

  // Counts for left column
  const {
    completedCount,
    onHoldCount,
    playingCount,
    droppedCount,
    onlineCount,
    wantCount,
  } = useMemo(() => getStatusCounts(allGames), [allGames]);

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

  const deleteRecentEditNote = async (game: TrackedGame) => {
    if (!user || !isAdmin) return;

    const docId =
      game._docId ||
      Object.keys(localProfile?.trackedGames ?? {}).find(
        (key) => localProfile?.trackedGames[key]?.igdb?.id === game.igdb.id,
      );

    if (!docId) {
      toast.error("Unable to find game to delete note.");
      return;
    }

    try {
      const gameRef = doc(db, "users", user.uid, "games_igdb", docId);

      await updateDoc(gameRef, {
        recentActionSummary: deleteField(),
      });

      setLocalProfile((prev) => {
        if (!prev) return prev;

        const existingGame = prev.trackedGames[docId];
        if (!existingGame) return prev;

        return {
          ...prev,
          trackedGames: {
            ...prev.trackedGames,
            [docId]: {
              ...existingGame,
              recentActionSummary: undefined,
            },
          },
        };
      });

      toast.success("Deleted recently edited note.");
    } catch {
      toast.error("Failed to delete note.");
    }
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = orderedWantGames.findIndex((g) => g.igdb.id === active.id);

    const newIndex = orderedWantGames.findIndex((g) => g.igdb.id === over.id);

    const newOrder = arrayMove(orderedWantGames, oldIndex, newIndex);

    setOrderedWantGames(newOrder);
  };

  const orderChanged = () => {
    return orderedWantGames.some(
      (game, index) => game.igdb.id !== originalWantOrder[index]?.igdb.id,
    );
  };

  const saveWantToPlayOrder = async () => {
    if (!user) return;

    await Promise.all(
      orderedWantGames.map((game, index) => {
        const ref = doc(
          db,
          "users",
          user.uid,
          "games_igdb",
          game._docId ?? String(game.igdb.id),
        );

        return setDoc(ref, { wantToPlayOrder: index }, { merge: true });
      }),
    );
  };

  useEffect(() => {
    const canReorder =
      selectedStatus === "Want To Play" && releaseFilter === "Released";

    if (!canReorder && reorderMode) {
      setReorderMode(false);
    }
  }, [selectedStatus, releaseFilter, reorderMode]);

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
        return;
      }

      const recentActionSummary = appendRecentGameActionSummary(
        prev.recentActionSummary,
        getRecentGameActionSummary(prev, {
          favorite,
          notInterested,
          status,
          progress,
          my_rating: typeof rating === "number" ? rating : null,
          review,
          playtime,
          playedSessions,
        }),
      );

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
    } catch {
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
        navbarLayout === "sidebar" ? `lg:pl-10 pt-14 lg:pt-5` : "pt-14"
      } overflow-y-auto bg-[var(--theme-bg)] theme-text lg:h-svh lg:overflow-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {loading || userLoading || gamesLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Blurred Background */}
          {wallpaperMedia && (
            // <div className="fixed inset-0 z-10 overflow-hidden bg-[var(--theme-bg)]">
            <div className="fixed inset-0 z-0 overflow-hidden bg-[var(--theme-bg)]">
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
              {/* <div
                className="absolute inset-0"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${bgOverlay / 100})`,
                }}
              /> */}

              {/* vignette */}
              {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85))]" /> */}
            </div>
          )}
          {/* <div
           className={`max-w-[1850px] mx-auto flex flex-col gap-4 sm:px-4 md:px-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8 lg:px-6`}
         > */}
          <motion.div
            animate={{
              opacity: isIdle ? 0 : 1,
            }}
            transition={{
              duration: 0.5,
              ease: "easeInOut",
            }}
            className="relative z-20"
          >
            <div
              className={`max-w-[1850px] mx-auto flex flex-col gap-4 sm:px-4 md:px-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8 lg:px-6`}
            >
              {/* Left Panel (Stats) */}
              <div className="w-full lg:w-72 lg:h-[calc(100svh-4.5rem)] shrink-0 px-4 relative z-10 pt-3">
                <div className="theme-panel border border-[var(--theme-border)] rounded-2xl p-3 sm:p-4 flex flex-col items-center shadow-xl max-w-[330px] mx-auto lg:mx-0 lg:h-full">
                  <div className="group">
                    {localProfile?.avatar || userProfile?.avatar ? (
                      <button
                        type="button"
                        onClick={() =>
                          openCoverPreview(
                            getMediaSrc(
                              localProfile?.avatar || userProfile?.avatar,
                            ) ?? "",
                            localProfile?.username ?? "User",
                          )
                        }
                        className="block rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
                        aria-label={`Preview avatar for ${
                          localProfile?.username ?? "User"
                        }`}
                      >
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
                      </button>
                    ) : (
                      <Link
                        href={`/profile/${profileUsername}`}
                        className="block rounded-full"
                      >
                        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full theme-panel flex items-center justify-center text-4xl sm:text-5xl theme-text-muted border-4 border-[var(--theme-border)] shadow-lg">
                          {localProfile?.username?.[0]?.toUpperCase()}
                        </div>
                      </Link>
                    )}
                  </div>

                  <div className="text-center mt-3.5 w-full">
                    <h3 className="font-extrabold text-2xl sm:text-3xl theme-text capitalize truncate px-2">
                      {localProfile?.username ||
                        userProfile?.username ||
                        "Player"}
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
                    {isAdmin && (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIdleModeEnabled((prev) => !prev)}
                          className={`theme-surface inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                            idleModeEnabled
                              ? "border-cyan-500 bg-cyan-500 text-black"
                              : "theme-text"
                          }`}
                        >
                          {idleModeEnabled
                            ? "Idle Wallpaper: ON"
                            : "Idle Wallpaper: OFF"}
                        </button>
                      </div>
                    )}
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
                        ["Want To Play", wantCount],
                      ].map(([label, value]) => (
                        <div
                          key={label?.toString()}
                          className="flex justify-between w-full px-3 py-2 rounded-lg hover:bg-[var(--theme-panel-alt)] transition-colors duration-200"
                        >
                          <span className="font-medium">{label}</span>
                          <span className="font-semibold theme-text">
                            {value}
                          </span>
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

                              setSelectedStatus(previousStatus);
                              setReleaseFilter(previousReleaseFilter);

                              setCurrentPage(1);
                            }}
                            className="group gap-2 theme-accent-soft-bg inline-flex h-7 shrink-0 items-center justify-center rounded-xl border px-2 text-xs font-semibold transition-all ease-in-out duration-500 hover:shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.25)]"
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

                                if (status === "Want To Play") {
                                  setReleaseFilter("Released");
                                } else {
                                  setReleaseFilter("All");
                                }
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
                              {["All", "Released", "Unreleased"].map(
                                (filter) => (
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

                                      if (nextFilter === "Released") {
                                        setSortBy("priority");
                                        setSortOrder("asc");
                                      } else if (nextFilter === "Unreleased") {
                                        setSortBy("release");
                                        setSortOrder("asc");
                                      } else {
                                        // All
                                        const saved =
                                          loadStatusSorts()["Want To Play"];

                                        if (
                                          saved &&
                                          saved.sortBy !== "priority"
                                        ) {
                                          setSortBy(saved.sortBy);
                                          setSortOrder(saved.sortOrder);
                                        } else {
                                          // Fallback if priority was accidentally saved
                                          setSortBy("date");
                                          setSortOrder("desc");
                                        }
                                      }

                                      setCurrentPage(1);
                                    }}
                                  >
                                    {filter}
                                  </button>
                                ),
                              )}
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
                          value={canReorder ? "priority" : sortBy}
                          disabled={canReorder}
                          onChange={(e) => {
                            const value = e.target.value as SortBy;

                            setSortBy(value);
                            saveStatusSort(selectedStatus, value, sortOrder);

                            setCurrentPage(1);
                          }}
                          className={`
                        theme-surface-alt
                        h-8
                        min-w-[158px]
                        appearance-none
                        rounded-xl
                        border
                        pl-3
                        pr-9
                        text-sm
                        font-medium
                        theme-text
                        outline-none
                        transition
                        focus:border-cyan-300/65
                        focus:bg-white/[0.07]
                        ${canReorder ? "cursor-not-allowed opacity-70" : ""}
                      `}
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
                          {canReorder && (
                            <option
                              className="bg-[var(--theme-panel-alt)] theme-text"
                              value="priority"
                            >
                              My Play Order
                            </option>
                          )}
                          <option
                            className="bg-[var(--theme-panel-alt)] theme-text"
                            value="progress"
                          >
                            Progress
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

                    {canReorder ? (
                      <button
                        onClick={async () => {
                          if (!reorderMode) {
                            // Entering reorder mode
                            setOrderedWantGames(filteredGames);
                            setOriginalWantOrder(filteredGames);
                            setReorderMode(true);
                            return;
                          }

                          // Leaving reorder mode
                          if (!orderChanged()) {
                            toast("Nothing changed.");
                          } else {
                            await saveWantToPlayOrder();
                            toast.success("Play order updated.");
                          }

                          setReorderMode(false);
                        }}
                        className={`
                        theme-surface
                        theme-hover-surface
                        inline-flex
                        h-9
                        items-center
                        gap-2
                        rounded-xl
                        border
                        px-4
                        text-sm
                        font-semibold
                        transition
                        ${reorderMode ? "border-cyan-500 bg-cyan-500 text-black" : ""}
                      `}
                      >
                        {reorderMode ? (
                          <>
                            <FiCheck size={16} />
                            Done
                          </>
                        ) : (
                          <>
                            <RiDraggable size={16} />
                            Reorder Games
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <AnimatePresence mode="wait">
                          {selectedStatus === "All" && !showFavoritesOnly && (
                            <motion.div
                              key="all-toggles"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 6 }}
                              transition={{ duration: 0.2 }}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <div
                                className={`theme-surface group relative flex h-9 items-center gap-3 rounded-xl border px-3 transition ${
                                  includeUnreleasedLocked
                                    ? "pointer-events-none opacity-50"
                                    : ""
                                }`}
                              >
                                <span className={styles.toggleLabel}>
                                  Include Unreleased
                                </span>

                                <label
                                  className={styles.switch}
                                  aria-label="Include unreleased games"
                                  title={
                                    includeUnreleasedLocked
                                      ? "Only available in the All tab"
                                      : includeUnreleasedGames
                                        ? "Unreleased games visible"
                                        : "Unreleased games hidden"
                                  }
                                >
                                  <input
                                    className={styles.checkbox}
                                    type="checkbox"
                                    checked={includeUnreleasedGames}
                                    disabled={includeUnreleasedLocked}
                                    onChange={(e) => {
                                      setIncludeUnreleasedGames(
                                        e.target.checked,
                                      );
                                      setCurrentPage(1);
                                    }}
                                  />

                                  <div className={styles.container}>
                                    <div className={styles.button}>
                                      <div className={styles.circles}>
                                        {Array.from({ length: 12 }).map(
                                          (_, index) => (
                                            <div
                                              key={index}
                                              className={styles.circle}
                                            />
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </label>
                              </div>
                              <div
                                className={`theme-surface group relative flex h-9 items-center gap-3 rounded-xl border px-3 transition ${includeOnlineLocked ? "pointer-events-none opacity-50" : ""}`}
                              >
                                <span className={styles.toggleLabel}>
                                  Include Online
                                </span>
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
                                        {Array.from({ length: 12 }).map(
                                          (_, index) => (
                                            <div
                                              key={index}
                                              className={styles.circle}
                                            />
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <button
                          onClick={() => {
                            const nextOrder =
                              sortOrder === "asc" ? "desc" : "asc";

                            setSortOrder(nextOrder);
                            saveStatusSort(selectedStatus, sortBy, nextOrder);
                          }}
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
                                  : sortBy === "progress"
                                    ? sortOrder === "asc"
                                      ? "Lowest to Highest"
                                      : "Highest to Lowest"
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
                    )}
                  </div>
                </div>
                {/* Game Grid */}
                <div className="overflow-visible lg:h-[calc(100svh-235px)]">
                  <AnimatePresence
                    mode="wait"
                    custom={{ type: animationType, direction: pageDirection }}
                  >
                    <motion.div
                      key={`${selectedStatus}-${currentPage}-${sortBy}-${sortOrder}-${releaseFilter}-${debouncedSearch}-${showFavoritesOnly}-${includeOnlineGames}-${includeUnreleasedGames}`}
                      custom={{ type: animationType, direction: pageDirection }}
                      variants={pageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="relative mx-auto grid w-fit grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                    >
                      {reorderMode && canReorder ? (
                        <DndContext
                          collisionDetection={closestCenter}
                          onDragStart={({ active }) => {
                            const game = orderedWantGames.find(
                              (g) => g.igdb.id === active.id,
                            );

                            setActiveGame(game ?? null);
                          }}
                          onDragEnd={(event) => {
                            handleDragEnd(event);

                            setActiveGame(null);
                          }}
                          onDragCancel={() => setActiveGame(null)}
                        >
                          <SortableContext
                            items={orderedWantGames.map((g) => g.igdb.id)}
                            strategy={rectSortingStrategy}
                          >
                            <>
                              {orderedWantGames.map((game) => (
                                <SortableGameCard
                                  key={game.igdb.id}
                                  game={game}
                                  reorderMode={reorderMode}
                                  selectedStatus={selectedStatus}
                                  releaseFilter={releaseFilter}
                                  openEditModal={openEditModal}
                                  openConfirmModal={openConfirmModal}
                                />
                              ))}
                            </>
                          </SortableContext>

                          <DragOverlay>
                            {activeGame ? (
                              <GameCard
                                game={activeGame}
                                sortable={false}
                                reorderMode
                                selectedStatus={selectedStatus}
                                releaseFilter={releaseFilter}
                                openEditModal={openEditModal}
                                openConfirmModal={openConfirmModal}
                                sortBy={sortBy}
                              />
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                      ) : (
                        visibleGames.map((game) => (
                          <GameCard
                            key={game.igdb.id}
                            game={game}
                            openEditModal={openEditModal}
                            openConfirmModal={openConfirmModal}
                            selectedStatus={selectedStatus}
                            releaseFilter={releaseFilter}
                            reorderMode={reorderMode}
                            sortBy={sortBy}
                          />
                        ))
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              {/* Right Panel (Favorites + Recently Edited) */}
              <div className="relative z-10 w-full shrink-0 px-1 pt-3 flex flex-col gap-3 sm:px-2 md:px-3 lg:h-[calc(100svh-5.5rem)] lg:w-64 lg:px-0 xl:w-74">
                {/* Favorites */}
                <div className="theme-panel rounded-2xl border p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[45vh] min-h-[45vh]">
                  <div className="flex items-center justify-between py-2">
                    <h3 className="theme-text font-bold text-lg">
                      Favorite Games
                    </h3>
                    {!showFavoritesOnly && (
                      <motion.button
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0, ease: "easeOut" }}
                        onClick={() => {
                          setPreviousStatus(selectedStatus);
                          setPreviousReleaseFilter(releaseFilter);

                          setShowFavoritesOnly(true);
                          setSelectedStatus("All");
                          setReleaseFilter("All");

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
                              className="flex items-center gap-2 rounded-xl py-2 cursor-pointer group theme-hover-surface transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                              <img
                                className="w-12 h-16 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                                src={g.igdb.cover}
                                alt={g.name}
                              />
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <span className="block max-w-full truncate theme-text font-medium text-[13px] transition-colors duration-300">
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
                  <div className="flex items-center justify-between py-1">
                    <h3 className="theme-text font-bold text-lg">
                      Notifications Box
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
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <span className="block max-w-full truncate theme-text font-bold text-[12px] transition">
                                  {g.name}
                                </span>
                                <p className="mt-1.5 break-words text-[11px] font-medium text-cyan-100/85 group-hover:text-cyan-50">
                                  {getLastRecentAction(g.recentActionSummary)}
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
          </motion.div>
        </>
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
                    <h2 className="mt-1 text-3xl font-black">
                      Notification Box
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

                      <div className="group relative flex cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-400/30 hover:bg-white/[0.05]">
                        <Link
                          href={`/game/${g.igdb.id}`}
                          onClick={() => setRecentModalOpen(false)}
                          className="flex flex-1"
                        >
                          <div className="flex gap-4 w-full">
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
                        </Link>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openConfirmModal(
                                `Delete recently edited note for ${g.name}?`,
                                () => deleteRecentEditNote(g),
                              );
                            }}
                            className="ml-4 self-start rounded-full border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/15 hover:text-red-100"
                          >
                            <FiTrash size={16} />
                          </button>
                        )}
                      </div>
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

      <AnimatePresence>
        {coverPreview && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCoverPreview}
          >
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeCoverPreview();
              }}
              className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            >
              Close
            </motion.button>

            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.82, opacity: 0, y: 18 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className="max-h-[88vh] max-w-[92vw] overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950 shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={coverPreview.src}
                alt={coverPreview.alt}
                className="max-h-[88vh] max-w-[92vw] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
