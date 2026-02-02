"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { IoStarSharp } from "react-icons/io5";

import { db } from "@/app/lib/firebase";
import { useUser } from "../../context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import GameTrackingModal from "@/app/components/GameTrackingModal";

import toast from "react-hot-toast";
import ConfirmModal from "@/app/components/ConfirmModal";
import { FiArrowRight, FiX } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import GameCard from "@/app/components/GameCard";
import GameQuote from "@/app/components/GameQuote";

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
  emailVerified?: boolean;
  avatarUrl?: string;
  avatarBase64?: string;
  trackedGames: Record<string, TrackedGame>;
  creationTime?: Date;
  lastSignInTime?: Date;
}

export default function GamesPage() {
  const { profile: userProfile, loading: userLoading, user } = useUser();
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("Playing");
  const [releaseFilter, setReleaseFilter] = useState<
    "All" | "Released" | "Unreleased"
  >("Released");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

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

  // Real-time Firestore subscription
  useEffect(() => {
    if (!user || !userProfile) return;

    const gamesCol = collection(db, "users", user.uid, "games_igdb");

    const unsubscribe = onSnapshot(gamesCol, (snapshot) => {
      const updatedGames: Record<string, TrackedGame> = {};

      snapshot.forEach((doc) => {
        const data = doc.data() as TrackedGame;

        updatedGames[doc.id] = {
          ...data,
          _docId: doc.id,

          igdb: {
            ...data.igdb,

            // ✅ Normalize Firestore Timestamp → Date ONCE
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
            uid: user.uid,
            username: userProfile.username || "",
            email: userProfile.email || "",
            avatarUrl: userProfile.avatarUrl,
            avatarBase64: userProfile.avatarBase64,
            trackedGames: updatedGames,
            creationTime: new Date(user.metadata.creationTime),
            lastSignInTime: new Date(user.metadata.lastSignInTime),
          };
        }

        return {
          ...prev,
          trackedGames: updatedGames,
        };
      });

      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userProfile]);

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
      my_rating: game.igdb.rating ?? 0,
      progress: game.progress ?? 0,
      playtime: game.playtime ?? 0,
      notes: game.notes ?? "",
      categoryRatings: game.categoryRatings ?? {
        graphics: 0,
        gameplay: 0,
        story: 0,
        ost: 0,
        cinematics: 0,
        voiceActing: 0,
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

  const handleSaveModal = async (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
  ) => {
    if (!editingGame || saving) return;

    setSaving(true);
    try {
      const safeCategoryRatings = {
        graphics: categoryRatings.graphics ?? 0,
        gameplay: categoryRatings.gameplay ?? 0,
        story: categoryRatings.story ?? 0,
        ost: categoryRatings.ost ?? 0,
        cinematics: categoryRatings.cinematics ?? 0,
        voiceActing: categoryRatings.voiceActing ?? 0,
      };

      const updatedGame = await updateTrackedGame(editingGame.igdb.id, {
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
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
            [editingGame.igdb.id]: {
              ...prev.trackedGames[editingGame.igdb.id],
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
            href="/login"
            className="px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 transition font-semibold"
          >
            Log In
          </Link>

          <Link
            href="/signup"
            className="px-6 py-3 rounded-full border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-400 hover:text-black transition font-semibold"
          >
            Sign Up
          </Link>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      className={`min-h-screen bg-black text-white`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {loading || userLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="max-w-[1850px] mx-auto flex flex-col lg:flex-row gap-8 lg:gap-22 pt-18">
          {/* Blurred Background */}
          {userProfile?.wallpaperBase64 && (
            <div className="fixed inset-0 z-10 overflow-hidden blur-sm brightness-25">
              <img
                src={userProfile.wallpaperBase64}
                alt="Wallpaper"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Left Panel (Stats) */}
          <div className="w-full lg:w-80 shrink-0 px-4 relative z-10">
            <div className="bg-zinc-900/50 rounded-2xl p-5 flex flex-col items-center shadow-xl h-full">
              {/* Avatar */}
              <Link
                href={`/profile/${userProfile!.username}`}
                className="group"
              >
                {localProfile?.avatarBase64 || localProfile?.avatarUrl ? (
                  <img
                    src={localProfile.avatarBase64 ?? localProfile.avatarUrl}
                    alt={localProfile?.username ?? "User"}
                    className="w-36 h-36 rounded-full object-cover shadow-lg transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-full bg-zinc-700 flex items-center justify-center text-5xl text-zinc-400 border-4 border-cyan-400 shadow-lg">
                    {localProfile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>

              {/* Username / Email */}
              <div className="text-center mt-4">
                <h3 className="font-extrabold text-3xl text-white">
                  {localProfile?.username}
                </h3>
                <p className="text-sm capitalize text-zinc-300 mt-1 cursor-default blur-sm hover:blur-none transition">
                  {localProfile?.email}
                </p>
              </div>

              <hr className="my-6 w-full border-zinc-700" />

              {/* Stats */}
              <div className="w-full flex flex-col gap-[7px] text-sm text-zinc-300 h-84 overflow-y-auto px-1">
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

              <hr className="my-3 w-full border-zinc-700" />

              {/* Quote Section */}
              <div className="mt-0 lg:pt-12">
                <GameQuote />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 relative z-10 px-6 lg:px-0">
            {/* Tabs */}
            <motion.div
              className="flex flex-wrap gap-3 mb-5 items-center relative"
              initial={false}
              animate={{
                marginLeft: selectedStatus === "Want To Play" ? "0px" : "120px",
              }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            >
              {showFavoritesOnly ? (
                <div className="flex mx-auto items-center pr-30">
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold bg-cyan-500 text-black"
                    disabled
                  >
                    <FaHeart className="w-4 h-4 text-red-700" /> Favorite Games
                    <FaHeart className="w-4 h-4 text-red-700" />
                  </button>
                </div>
              ) : (
                STATUSES.map((status) => (
                  <div
                    key={status}
                    className="relative flex items-center gap-2"
                  >
                    <button
                      className={`px-4 py-2 rounded-full font-semibold transition whitespace-nowrap ${
                        selectedStatus === status
                          ? "bg-linear-to-r from-cyan-400 to-blue-500 text-black"
                          : "bg-zinc-800 text-white hover:bg-zinc-700"
                      }`}
                      onClick={() => {
                        handleTabChange(status);
                        if (status !== "Want To Play") setReleaseFilter("All");
                      }}
                      disabled={selectedStatus === status}
                    >
                      {status}
                    </button>

                    {/* Sub-filters */}
                    <AnimatePresence>
                      {status === "Want To Play" &&
                        selectedStatus === "Want To Play" && (
                          <motion.div
                            key="release-filter"
                            className="mt-2 lg:mt-0 flex flex-col lg:flex-row flex-wrap lg:flex-nowrap gap-2
                         lg:bg-zinc-900 lg:rounded-xl lg:p-1 lg:shadow-lg
                         relative lg:absolute lg:left-full lg:ml-2"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {["All", "Released", "Unreleased"].map((filter) => (
                              <button
                                key={filter}
                                className={`px-3 py-1 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                                  releaseFilter === filter
                                    ? "bg-linear-to-r from-cyan-400 to-blue-500 text-black"
                                    : "bg-zinc-800 text-white hover:bg-zinc-700"
                                }`}
                                onClick={() => setReleaseFilter(filter as any)}
                              >
                                {filter}
                              </button>
                            ))}
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </motion.div>

            {/* Pagination and Search */}
            <div className="flex justify-between mb-2 gap-4 items-center">
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setAnimationType("page");
                  setPageDirection(-1);
                  setCurrentPage((prev) => prev - 1);
                }}
                className={`cursor-pointer placeholder:pl-2 px-4 py-2 border-2 border-cyan-400 text-white rounded-lg transition ${
                  currentPage === 1
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-zinc-700"
                }`}
              >
                Prev
              </button>

              <input
                type="text"
                placeholder={`${
                  showFavoritesOnly
                    ? "Search for a favorite game"
                    : "Search for a game in " + selectedStatus
                }`}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-6 px-4 py-2 rounded-full bg-zinc-800 text-white w-1/2 focus:outline-none"
              />

              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setAnimationType("page");
                  setPageDirection(1);
                  setCurrentPage((prev) => prev + 1);
                }}
                className={`cursor-pointer px-4 py-2 border-2 border-cyan-400 text-white rounded-lg transition ${
                  currentPage === totalPages
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-zinc-700"
                }`}
              >
                Next
              </button>
            </div>

            <div className="relative w-full flex items-center justify-center mb-4">
              <div className="bg-zinc-800 rounded-full px-4 py-1 flex items-center gap-5">
                {/* Label */}
                <label className="text-sm text-white whitespace-nowrap ml-2">
                  Sort By:
                </label>

                {/* Select */}
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="border-2 border-zinc-600 bg-zinc-800 text-white px-4 py-2 rounded-lg
             focus:outline-none transition duration-200 ease-in-out cursor-pointer"
                >
                  <option className="bg-zinc-800 text-white" value="name">
                    Name
                  </option>

                  {selectedStatus !== "Want To Play" && (
                    <option className="bg-zinc-800 text-white" value="playtime">
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

                {/* Sort Order Button */}
                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="px-4 py-2 rounded-lg border-2 border-zinc-600 text-white text-xs font-medium
                 hover:bg-zinc-600 transition duration-200 ease-in-out cursor-pointer"
                >
                  {sortBy === "name"
                    ? sortOrder === "asc"
                      ? "A → Z"
                      : "Z → A"
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

                {/* Info Tooltip */}
                {(sortBy === "tier" || sortBy === "playtime") && (
                  <div className="relative group">
                    <span className="text-zinc-400 text-xs cursor-help select-none">
                      ⓘ
                    </span>

                    <div
                      className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            hidden group-hover:block
            bg-zinc-900 text-white text-xs px-3 py-1 rounded
            shadow-lg whitespace-nowrap z-50
          "
                    >
                      {sortBy === "tier"
                        ? "Only rated games are shown (Want To Play excluded)"
                        : "Only played games are shown (Want To Play excluded)"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Game Grid */}
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
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6"
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

          {/* Right Panel (Favorites + Recently Edited) */}
          <div className="relative z-10 w-full lg:w-80 shrink-0 flex flex-col gap-6">
            {/* Favorites */}
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-3 overflow-y-auto custom-scrollbar max-h-[43vh]">
              <div className="flex items-center justify-between py-2">
                <h3 className="font-bold text-xl text-white/90">
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
                      <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md">
                        <img
                          className="w-15 h-20 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                          src={g.igdb.cover}
                          alt={g.name}
                        />
                        <div className="flex-1 flex flex-col justify-center">
                          <span className="text-white/90 font-medium text-sm group-hover:text-white transition-colors duration-300">
                            {g.name}
                          </span>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs font-semibold bg-white/10 text-white/70 px-2 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
                              {g.playtime
                                ? `${Math.floor(g.playtime)}h ${Math.round(
                                    (g.playtime % 1) * 60,
                                  )}m`
                                : "0h 0m"}
                            </span>

                            <span className="flex items-center gap-1 text-xs font-semibold bg-white/10 text-white/70 px-2 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition-colors duration-300">
                              {Math.round(g.my_rating ?? 0)}{" "}
                              <IoStarSharp className="w-3 h-3 text-amber-400" />
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
            <div className="bg-zinc-800/40 p-4 rounded-2xl flex flex-col gap-3 max-h-[45.2vh] mb-8 lg:mb-0">
              <h3 className="font-bold text-xl pt-2 pl-1 text-white/90">
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
                      <div className="flex flex-col gap-2 p-3 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-200 h-[35vh]">
                        <div className="flex items-center gap-3">
                          <img
                            className="w-15 h-20 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
                            src={g.igdb.cover}
                            alt={g.name}
                          />
                          <div className="flex-1 flex flex-col justify-center">
                            <span className="text-white/90 font-medium text-sm group-hover:text-white transition max-w-[200px] line-clamp-2">
                              {g.name}
                            </span>

                            <div className="flex gap-2 mt-2">
                              <span className="text-xs font-semibold bg-white/10 text-white/70 px-2 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition">
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
          initialRating={editingGame.igdb.rating ?? 0}
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
