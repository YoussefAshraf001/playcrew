"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  FiSearch,
  FiSliders,
  FiX,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import GameCard from "@/app/components/GameCard";
import GameQuote from "@/app/components/GameQuote";
import { useGames } from "@/app/context/GameContext";

const STATUSES = [
  "All",
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Online",
  "Want To Play",
];

type StoredRating = number | "excluded";

interface CategoryRatings {
  graphics: StoredRating;
  gameplay: StoredRating;
  story: StoredRating;
  ost: StoredRating;
  cinematics: StoredRating;
  voiceActing: StoredRating;
}

interface TrackedGame {
  _docId: string;

  name: string;

  // User data
  playtime?: number;
  my_rating?: number;
  status?: string;
  progress?: number;
  notes?: string;
  categoryRatings?: CategoryRatings;
  favorite?: boolean;
  favoriteAllTime?: boolean;
  notInterested?: boolean;
  lastUpdated?: any;

  // IGDB data
  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    genres?: string[];
    releaseDate?: Date;
  };
}

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

export default function GamesPage() {
  const { profile: userProfile, loading: userLoading, user } = useUser();
  const { games: sharedGames, gamesLoading } = useGames();
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
  const [sortBy, setSortBy] = useState<
    "name" | "date" | "tier" | "release" | "playtime"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  // Hydrate local profile from shared games context
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
        _docId: entry.id,
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
        username: userProfile?.username || prev.username,
        bio: userProfile?.bio || prev.bio,
        email: userProfile?.email || prev.email,
        avatar: userProfile?.avatar || prev.avatar,
        wallpaper: userProfile?.wallpaper || prev.wallpaper,
        trackedGames: updatedGames,
      };
    });

    setLoading(false);
  }, [uid, sharedGames, userProfile, user]);

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
          console.error(
            `❌ Invalid game without igdb.id - Name: "${game.name}", Full data:`,
            game,
          );
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

    // 🔍 Search
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      list = list.filter((g) => g.name && g.name.toLowerCase().includes(lower));
    }

    // 📅 Release filter
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

    // ⭐ Favorites only
    if (showFavoritesOnly) {
      list = list.filter((g) => g.favorite);
    }

    // 🚫 Exclude unrated games when sorting by rating
    if (sortBy === "tier") {
      list = list.filter(
        (g) => g.status !== "Want To Play" && typeof g.my_rating === "number",
      );
    }

    if (sortBy === "playtime") {
      list = list.filter(
        (g) =>
          g.status !== "Want To Play" &&
          typeof g.playtime === "number" &&
          g.playtime > 0,
      );
    }

    // 🔃 Sorting
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
          const aRating = a.my_rating!;
          const bRating = b.my_rating!;

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
    () => allGames.filter((g) => g.favorite),
    [allGames],
  );

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

  const notInterstedCount = useMemo(
    () => allGames.filter((g) => g.status === "Online").length,
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
      my_rating: game.my_rating ?? 0,
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

  const handleSaveModal = async (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
  ) => {
    if (!editingGame || saving) return;

    setSaving(true);
    try {
      const targetDocId = editingGame._docId ?? String(editingGame.igdb.id);

      const safeCategoryRatings = {
        graphics: categoryRatings.graphics ?? 0,
        gameplay: categoryRatings.gameplay ?? 0,
        story: categoryRatings.story ?? 0,
        ost: categoryRatings.ost ?? 0,
        cinematics: categoryRatings.cinematics ?? 0,
        voiceActing: categoryRatings.voiceActing ?? 0,
      };

      const updatedGame = await updateTrackedGame(targetDocId, {
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
        notInterested,
        notes,
        categoryRatings: safeCategoryRatings,
        lastUpdated: new Date(),
      });

      // Make lastUpdated Firestore-timestamp-like for local sorting
      const updatedGameForLocal = {
        ...updatedGame,
        lastUpdated: Timestamp.fromDate(new Date()),
      };

      setLocalProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          trackedGames: {
            ...prev.trackedGames,
            [targetDocId]: {
              ...prev.trackedGames[targetDocId],
              ...updatedGameForLocal,
            },
          },
        };
      });

      toast.success("Game saved!");
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
        <div className="max-w-[1850px] mx-auto flex flex-col gap-4 pt-14 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8">
          {/* Blurred Background */}
          {userProfile?.wallpaper && (
            <div className="fixed inset-0 z-10 overflow-hidden blur-sm brightness-25">
              <img
                src={getMediaSrc(userProfile.wallpaper)}
                style={getMediaStyle(userProfile.wallpaper)}
                alt="Wallpaper"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Left Panel (Stats) */}
          <div className="w-full lg:w-72 lg:h-[calc(100svh-5.5rem)] shrink-0 px-4 relative z-10 pt-3">
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
                <p className="text-sm capitalize text-zinc-300 mt-1 max-w-[230px] mx-auto line-clamp-2">
                  {localProfile?.bio ||
                    userProfile?.bio ||
                    "No bio yet. Click to edit in profile settings!"}
                </p>
                <p className="hidden sm:block text-sm capitalize text-zinc-300 py-1 cursor-default blur-xs hover:blur-none transition">
                  {localProfile?.email}
                </p>
              </div>

              <hr className="my-4 sm:my-6 w-full border-zinc-700" />

              {/* Stats */}
              <div className="w-full flex flex-col gap-0.5 text-sm text-zinc-300 overflow-y-auto px-1">
                {[
                  ["Member Since", formattedDate],
                  ["Total Games", allGames.length],
                  ["Completed", completedCount],
                  ["On Hold", onHoldCount],
                  ["Playing", playingCount],
                  ["Dropped", droppedCount],
                  ["Online", notInterstedCount],
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

              <hr className="my-3 sm:my-4 w-full border-zinc-700" />

              {/* Quote Section */}
              <div className="mt-1 sm:mt-2 lg:pt-[clamp(0.5rem,2vh,1.5rem)] w-full">
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
                className="relative flex w-fit max-w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/55 p-2 backdrop-blur-sm"
                initial={false}
                animate={{
                  left: selectedStatus === "Want To Play" ? "44%" : "50%",
                  x: "-50%",
                }}
                transition={{
                  type: "spring",
                  stiffness: 210,
                  damping: 30,
                  layout: { duration: 0.24, ease: "easeInOut" },
                }}
              >
                {showFavoritesOnly ? (
                  <div className="flex mx-auto items-center pr-30">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold bg-cyan-500 text-black"
                      disabled
                    >
                      <FaHeart className="w-4 h-4 text-red-700" /> Favorite
                      Games
                      <FaHeart className="w-4 h-4 text-red-700" />
                    </button>
                  </div>
                ) : (
                  <>
                    {STATUSES.map((status) => (
                      <div
                        key={status}
                        className="relative flex shrink-0 items-center gap-2"
                      >
                        <button
                          className={`rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide whitespace-nowrap transition ${
                            selectedStatus === status
                              ? "border-cyan-300/70 bg-linear-to-r from-cyan-300 to-sky-400 text-black shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                              : "border-white/10 bg-zinc-800/80 text-white hover:border-white/20 hover:bg-zinc-700/80"
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
                          className="flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-1"
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
                              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition ${
                                releaseFilter === filter
                                  ? "border-cyan-300/70 bg-linear-to-r from-cyan-300 to-sky-400 text-black"
                                  : "border-white/10 bg-zinc-800/70 text-white hover:border-white/20 hover:bg-zinc-700/70"
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
                <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2">
                  <FiSliders className="h-4 w-4 text-cyan-300/90" />
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-white/10 bg-zinc-900/70 px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                  >
                    <option className="bg-zinc-800 text-white" value="name">
                      Name
                    </option>
                    {selectedStatus !== "Want To Play" && (
                      <option
                        className="bg-zinc-800 text-white"
                        value="playtime"
                      >
                        Playtime
                      </option>
                    )}
                    {selectedStatus !== "Want To Play" && (
                      <option className="bg-zinc-800 text-white" value="tier">
                        Rating
                      </option>
                    )}
                    <option className="bg-zinc-800 text-white" value="release">
                      Release Date
                    </option>
                    <option className="bg-zinc-800 text-white" value="date">
                      Latest Changes
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
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
            <div className="lg:h-[calc(100svh-260px)] overflow-hidden">
              <AnimatePresence
                mode="wait"
                custom={{ type: animationType, direction: pageDirection }}
              >
                <motion.div
                  key={`${selectedStatus}-${currentPage}-${sortBy}-${sortOrder}-${releaseFilter}-${debouncedSearch}-${showFavoritesOnly}`}
                  custom={{ type: animationType, direction: pageDirection }}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
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
          <div className="relative pt-3 z-10 w-full lg:h-[calc(100svh-5.5rem)] shrink-0 flex flex-col gap-3 lg:w-64 xl:w-72">
            {/* Favorites */}
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-2.5 overflow-y-auto custom-scrollbar max-h-[45vh] min-h-[45vh]">
              <div className="flex items-center justify-between py-2">
                <h3 className="font-bold text-lg text-white/90">
                  Favorite Games
                </h3>
                <button
                  onClick={() => {
                    setShowFavoritesOnly((prev) => !prev);
                    setSelectedStatus("All");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-md border-2 border-cyan-400 text-white font-bold flex items-center justify-center gap-2 hover:bg-cyan-500 hover:border-cyan-500 transition-all duration-300 ease-in-out cursor-pointer ${
                    showFavoritesOnly
                      ? "bg-cyan-500 animate-pulse"
                      : "bg-transparent"
                  }`}
                >
                  {showFavoritesOnly ? (
                    <FiX size={18} />
                  ) : (
                    <FiArrowRight size={18} />
                  )}
                </button>
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
                  favoriteGames.map((g) => (
                    <Link key={g.igdb.id} href={`/game/${g.igdb.id}`}>
                      <div className="flex items-center gap-2 p-2 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md">
                        <img
                          className="w-12 h-16 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                          src={g.igdb.cover}
                          alt={g.name}
                        />
                        <div className="flex-1 flex flex-col justify-center">
                          <span className="text-white/90 font-medium text-[11px] group-hover:text-white transition-colors duration-300">
                            {g.name}
                          </span>
                          <div className="flex gap-1.5 mt-1">
                            <span className="text-[9px] font-semibold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
                              {g.playtime
                                ? `${Math.floor(g.playtime)}h ${Math.round(
                                    (g.playtime % 1) * 60,
                                  )}m`
                                : "0h 0m"}
                            </span>

                            <span
                              className={`flex items-center gap-1 text-[9px] font-semibold bg-white/10 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 transition-colors duration-300 ${
                                g.notInterested
                                  ? "text-red-300 group-hover:text-red-200"
                                  : "text-white/70 group-hover:text-white"
                              }`}
                            >
                              {g.notInterested ? (
                                "Not Interested"
                              ) : (
                                <>
                                  <IoStarSharp className="w-3 h-3 text-amber-400" />{" "}
                                  {(g.my_rating ?? 0).toFixed(1)}
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Recently Edited */}
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-3 max-h-[45vh] min-h-[45vh] mb-8 lg:mb-0">
              <h3 className="font-bold text-lg pt-2 pl-1 text-white/90">
                Recent Games
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
                            <span className="text-white/90 font-bold text-[11px] group-hover:text-white transition max-w-[200px] line-clamp-2">
                              {g.name}
                            </span>

                            <div className="flex gap-1.5 mt-1.5">
                              <span className="text-[9px] font-semibold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
                                {g.playtime
                                  ? `${Math.floor(g.playtime)}h ${Math.round(
                                      (g.playtime % 1) * 60,
                                    )}m`
                                  : "0h 0m"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-2 bg-cyan-500 rounded-full transition-all"
                            style={{ width: `${g.progress ?? 0}%` }}
                          ></div>
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
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveModal}
          saving={saving}
          game={editingGame}
          initialNotes={editingGame.notes ?? ""}
          initialRating={editingGame.my_rating ?? 0}
          initialCategoryRatings={editingGame.categoryRatings}
          initialProgress={editingGame.progress ?? 0}
          initialPlaytime={editingGame.playtime ?? 0}
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
