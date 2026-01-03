"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
import PosterImage from "@/app/components/PosterImages";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import GameTrackingModal from "@/app/components/GameTrackingModal";

import toast from "react-hot-toast";
import GameActionsDropdown from "@/app/components/GameActionsDropdown";
import ConfirmModal from "@/app/components/ConfirmModal";
import { Helmet } from "react-helmet-async";
import { FiArrowRight, FiX } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import TenStarRating from "@/app/components/TenStarRating";
import AllTimeFavoriteModal from "@/app/components/AllTimeFavoriteModal";

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
  id: number;
  name: string;
  slug: string;
  background_image?: string;
  screenshots?: string[];
  playtime?: number;
  rating?: number;
  status?: string | null;
  favorite?: boolean;
  progress?: number;
  lastUpdated?: any;
  notes?: string;
  categoryRatings?: CategoryRatings;
  released: string;
  favoriteAllTime?: boolean;
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  displayName?: string | null;
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
  const PAGE_SIZE = 6;

  //Sorting
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "date" | "tier" | "release">(
    "date"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(true);
  const lastCardRef = useRef<HTMLDivElement | null>(null);

  //Editing Games
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<TrackedGame | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  //ALL TIME FAV
  const [selectingFavoriteAllTime, setSelectingFavoriteAllTime] =
    useState(false);

  const [favoriteGameModal, setFavoriteGameModal] = useState(false);

  // Real-time Firestore subscription
  useEffect(() => {
    if (!user || !userProfile) return;

    const gamesCol = collection(db, "users", user.uid, "games");

    const unsubscribe = onSnapshot(gamesCol, (snapshot) => {
      const updatedGames: Record<string, TrackedGame> = {};
      snapshot.forEach((doc) => {
        updatedGames[doc.id] = doc.data() as TrackedGame;
      });

      // Initialize or update localProfile safely
      setLocalProfile((prev) => {
        if (!prev) {
          return {
            uid: user.uid,
            username: userProfile.username || "",
            email: userProfile.email || "",
            displayName: userProfile.displayName || null,
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
      setGamesLoading(false);
    });

    return () => unsubscribe();
  }, [user, userProfile]);

  // Convert trackedGames to array
  const allGames: TrackedGame[] = useMemo(
    () => Object.values(localProfile?.trackedGames || {}).filter(Boolean),
    [localProfile?.trackedGames]
  );

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

  // Filter and sort safely
  const filteredGames = useMemo(() => {
    let list =
      selectedStatus === "All"
        ? gamesByStatus.All
        : gamesByStatus[selectedStatus] || [];

    // IMPORTANT: clone before mutating
    list = [...list];

    // Search filter
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      list = list.filter((g) => g.name && g.name.toLowerCase().includes(lower));
    }

    // Release filter
    if (releaseFilter !== "All") {
      const now = new Date();
      list = list.filter((g) => {
        if (!g.released) return false;

        const releaseDate = new Date(g.released);

        if (releaseFilter === "Released") {
          return releaseDate <= now; // Released games
        }

        // Unreleased filter
        if (releaseFilter === "Unreleased") {
          return g.released === "TBA" || releaseDate > now; // TBA or future games
        }

        // Custom date range filter (add your own logic here, e.g. for the last 6 months, etc.)
        if (releaseFilter === "Last 6 months") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          return releaseDate >= sixMonthsAgo;
        }

        if (releaseFilter === "This year") {
          return releaseDate.getFullYear() === now.getFullYear();
        }

        return true; // Default: no filter
      });
    }

    // Favorites filter
    if (showFavoritesOnly) {
      list = list.filter((g) => g.favorite);
    }

    // Sorting
    list.sort((a, b) => {
      // Special case: unreleased → soonest first
      if (releaseFilter === "Unreleased") {
        const aDate =
          a.released && a.released !== "TBA"
            ? new Date(a.released).getTime()
            : Infinity;
        const bDate =
          b.released && b.released !== "TBA"
            ? new Date(b.released).getTime()
            : Infinity;
        return aDate - bDate;
      }

      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() ?? "";
          bVal = b.name?.toLowerCase() ?? "";
          break;

        case "tier":
          const normalize = (v: any) => (v == null ? -1 : v);
          aVal = normalize(a.rating);
          bVal = normalize(b.rating);
          break;

        case "release":
          aVal = new Date(a.released)?.getTime() ?? 0;
          bVal = new Date(b.released)?.getTime() ?? 0;
          break;

        case "date":
        default:
          aVal = new Date(a.lastUpdated)?.getTime() ?? 0;
          bVal = new Date(b.lastUpdated)?.getTime() ?? 0;
          break;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;

      return 0;
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
    [allGames]
  );

  const recentlyEditedGames = useMemo(
    () =>
      [...allGames]
        .sort(
          (a, b) =>
            (b.lastUpdated?.toMillis?.() ?? 0) -
            (a.lastUpdated?.toMillis?.() ?? 0)
        )
        .slice(0, 6),
    [allGames]
  );

  const handleTabChange = (status: string) => {
    setSelectedStatus(status);
    setGamesLoading(true);
    setTimeout(() => setGamesLoading(false), 200);
  };

  const handleSearchChange = (query: string) => setSearchQuery(query);

  // Counts for left column
  const completedCount = useMemo(
    () => allGames.filter((g) => g.status === "Completed").length,
    [allGames]
  );

  const onHoldCount = useMemo(
    () => allGames.filter((g) => g.status === "On Hold").length,
    [allGames]
  );

  const playingCount = useMemo(
    () => allGames.filter((g) => g.status === "Playing").length,
    [allGames]
  );

  const droppedCount = useMemo(
    () => allGames.filter((g) => g.status === "Dropped").length,
    [allGames]
  );

  const notInterstedCount = useMemo(
    () => allGames.filter((g) => g.status === "Online").length,
    [allGames]
  );

  const wantCount = useMemo(
    () => allGames.filter((g) => g.status === "Want To Play").length,
    [allGames]
  );

  const favoriteOfAllTime = useMemo(
    () => allGames.find((g) => g.favoriteAllTime),
    [allGames]
  );

  const renderSkeletons = (count: number, small = false) =>
    Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className={`rounded-xl bg-zinc-900 shadow-lg animate-pulse ${
          small ? "min-h-[60px] flex items-center gap-2 p-2" : "min-h-[350px]"
        } w-full mb-2`}
      >
        {small ? (
          <>
            <div className="w-16 h-10 bg-zinc-700 rounded"></div>
            <div className="flex-1 h-4 bg-zinc-700 rounded"></div>
          </>
        ) : (
          <>
            <div className="h-56 bg-zinc-700 w-full" />
            <div className="p-4 space-y-2">
              <div className="h-6 bg-zinc-700 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-700 rounded w-1/2"></div>
              <div className="h-4 bg-zinc-700 rounded w-1/4"></div>
            </div>
          </>
        )}
      </div>
    ));

  const formattedDate = localProfile?.creationTime?.toLocaleDateString("en-GB");

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, releaseFilter]);

  const openEditModal = (game: TrackedGame) => {
    setEditingGame({
      ...game,
      rating: game.rating ?? 0,
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
    patch: Partial<TrackedGame>
  ) => {
    if (!user) return;

    const gameRef = doc(db, "users", user.uid, "games", String(gameId));
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
    categoryRatings: CategoryRatings
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

      const updatedGame = await updateTrackedGame(editingGame.id, {
        rating,
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
            [editingGame.id]: {
              ...prev.trackedGames[editingGame.id],
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
    action: () => void | Promise<void>
  ) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
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
    <>
      <Helmet>
        <title>PlayCrew</title>
      </Helmet>

      <motion.main
        className={`min-h-screen bg-black text-white`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {loading || userLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="max-w-[1850px] mx-auto flex flex-col lg:flex-row gap-8 lg:gap-22 pt-20">
            {/* Blurred Background */}
            {userProfile?.wallpaperBase64 && (
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xs"
                style={{
                  backgroundImage: `url(${userProfile.wallpaperBase64})`,
                }}
              />
            )}

            {/* Optional overlay to darken it a bit */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Left Panel (Stats) */}
            <div className="w-full lg:w-80 shrink-0 px-4 relative z-10">
              <div className="bg-zinc-900 rounded-2xl p-5 flex flex-col items-center shadow-xl h-full">
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

                {/* Favorite of All Time */}
                <div className="flex flex-col items-center w-full gap-3">
                  <h3 className="font-extrabold text-[22px] text-center text-yellow-300">
                    Favorite Game of <br /> All Time
                  </h3>
                  {!favoriteOfAllTime ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectingFavoriteAllTime(true);
                      }}
                      className="w-full max-w-xl h-38 rounded-xl border-2 border-dashed border-zinc-600 flex items-center justify-center text-zinc-500 hover:border-cyan-400 hover:text-cyan-400 transition"
                    >
                      <span className="text-4xl font-light">+</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFavoriteGameModal(true);
                      }}
                      className="flex flex-col cursor-pointer w-full max-w-xl rounded-xl overflow-hidden border border-zinc-700 shadow-lg hover:scale-[1.02] transition-transform duration-200"
                    >
                      {/* Image */}
                      <div className="shrink-0 w-full h-38 relative">
                        <img
                          src={favoriteOfAllTime.background_image}
                          alt={favoriteOfAllTime.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>
                  )}
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
                  marginLeft:
                    selectedStatus === "Want To Play" ? "0px" : "120px",
                }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
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
                          if (status !== "Want To Play")
                            setReleaseFilter("All");
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
                              {["All", "Released", "Unreleased"].map(
                                (filter) => (
                                  <button
                                    key={filter}
                                    className={`px-3 py-1 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                                      releaseFilter === filter
                                        ? "bg-linear-to-r from-cyan-400 to-blue-500 text-black"
                                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                                    }`}
                                    onClick={() =>
                                      setReleaseFilter(filter as any)
                                    }
                                  >
                                    {filter}
                                  </button>
                                )
                              )}
                            </motion.div>
                          )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </motion.div>

              {/* Pagination and Search */}
              <div className="flex justify-between mb-4 gap-4 items-center">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                  className={`cursor-pointer px-4 py-2 border-2 border-cyan-400 text-white rounded-lg transition ${
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
                  className="px-4 py-2 rounded-full bg-zinc-800 text-white w-1/2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className={`cursor-pointer px-4 py-2 border-2 border-cyan-400 text-white rounded-lg transition ${
                    currentPage === totalPages
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-zinc-700"
                  }`}
                >
                  Next
                </button>
              </div>

              <div className="flex justify-center gap-6 mb-4 items-center">
                <label className="text-sm text-zinc-300 font-semibold">
                  Sort By:
                </label>

                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
                >
                  <option value="name">Name</option>
                  <option value="date">Date Added</option>
                  <option value="tier">Rating</option>
                  <option value="release">Release Date</option>
                </select>

                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="px-4 py-2 rounded-lg bg-zinc-700 text-white text-xs font-medium hover:bg-zinc-600 transition duration-200 ease-in-out"
                >
                  {sortBy === "name"
                    ? sortOrder === "asc"
                      ? "A → Z"
                      : "Z → A"
                    : sortBy === "date" || sortBy === "release"
                    ? sortOrder === "asc"
                      ? "Oldest to Newest"
                      : "Newest to Oldest"
                    : sortBy === "tier"
                    ? sortOrder === "asc"
                      ? "Lowest to Highest"
                      : "Highest to Lowest"
                    : "Tier (Rating)"}
                </button>
              </div>

              {/* Game Grid */}
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gamesLoading && filteredGames.length > 0 ? (
                  renderSkeletons(Math.min(PAGE_SIZE, filteredGames.length))
                ) : visibleGames.length === 0 ? (
                  <p className="text-center text-zinc-400 col-span-full mt-10">
                    No games found.
                  </p>
                ) : (
                  visibleGames.map((game, idx) => (
                    <motion.div
                      key={game.id}
                      ref={idx === visibleGames.length - 1 ? lastCardRef : null}
                      className="group relative rounded-2xl bg-zinc-900 shadow-lg overflow-hidden min-h-[350px]"
                      whileHover={{ scale: 1.03 }}
                    >
                      <GameActionsDropdown
                        game={game}
                        trackedGames={localProfile!.trackedGames}
                        openEditModal={openEditModal}
                        openConfirmModal={openConfirmModal}
                      />

                      {/* Entire card clickable */}
                      <Link href={`/game/${game.id}`} prefetch={false}>
                        <div className={`relative w-full h-56 cursor-pointer`}>
                          <PosterImage
                            src={
                              game.background_image || "/placeholder-game.jpg"
                            }
                            alt={game.name}
                          />
                        </div>
                      </Link>

                      {/* Game Info clickable */}
                      <Link href={`/game/${game.id}`} prefetch={false}>
                        <div className="p-4 flex flex-row justify-between text-white cursor-pointer gap-4">
                          {/* LEFT SIDE */}
                          <div className="flex flex-col gap-2 flex-1">
                            <h3 className="font-bold text-lg truncate max-w-[300px]">
                              {game.name}
                            </h3>

                            <p className="text-sm text-zinc-400">
                              Playtime:
                              <span className="text-zinc-200 pl-1">
                                {game.playtime
                                  ? `${Math.floor(game.playtime)}h ${Math.round(
                                      (game.playtime % 1) * 60
                                    )}m`
                                  : "0h 0m"}
                              </span>
                            </p>

                            <p className="text-sm text-yellow-400">
                              <TenStarRating rating={game.rating} />

                              {/* Rating: {Math.round(game.rating ?? 0)} / 10 */}
                            </p>

                            {selectedStatus === "All" && (
                              <p className="text-sm">
                                Status:
                                <span className="text-cyan-400 pl-1">
                                  {game.status}
                                </span>
                              </p>
                            )}

                            {/* Show progress bar or release date */}
                            {selectedStatus ===
                            "All" ? null : selectedStatus === "Want To Play" &&
                              releaseFilter === "Unreleased" ? (
                              <p className="text-xs text-center font-semibold bg-white/10 text-white/70 py-1 rounded-lg">
                                {game.released ?? "TBA"}
                              </p>
                            ) : (
                              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-2 bg-cyan-500 rounded-full transition-all"
                                  style={{ width: `${game.progress ?? 0}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))
                )}
              </motion.div>
            </div>

            {/* Right Panel (Favorites + Recently Edited) */}
            <div className="relative z-10 w-full lg:w-80 shrink-0 flex flex-col gap-6">
              {/* Favorites */}
              <div className="bg-zinc-900 p-4 rounded-2xl flex flex-col gap-3 overflow-y-auto custom-scrollbar max-h-[43vh]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xl text-white/90">
                    Favorite Games
                  </h3>
                  <button
                    onClick={() => {
                      setShowFavoritesOnly((prev) => !prev);
                      setSelectedStatus("All");
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
                    renderSkeletons(3, true)
                  ) : favoriteGames.length === 0 ? (
                    <div className="h-[36vh] flex justify-center items-center">
                      <p className="text-zinc-500">No favorite games</p>
                    </div>
                  ) : (
                    favoriteGames.map((g) => (
                      <Link key={g.id} href={`/game/${g.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md">
                          <img
                            className="w-14 h-14 object-cover rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"
                            src={g.background_image}
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
                                      (g.playtime % 1) * 60
                                    )}m`
                                  : "0h 0m"}
                              </span>

                              <span className="flex items-center gap-1 text-xs font-semibold bg-white/10 text-white/70 px-2 py-0.5 rounded-full group-hover:bg-white/20 group-hover:text-white transition-colors duration-300">
                                {Math.round(g.rating ?? 0)}{" "}
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
              <div className="bg-zinc-900 p-4 rounded-2xl flex flex-col gap-3 max-h-[44vh] mb-8 lg:mb-0">
                <h3 className="font-bold text-xl mb-2 text-white/90">
                  Recent Games
                </h3>
                <div className="flex-1 pr-2 overflow-y-auto custom-scrollbar">
                  {loading ? (
                    renderSkeletons(3, true)
                  ) : recentlyEditedGames.length === 0 ? (
                    <div className="h-[35vh] flex justify-center items-center">
                      <p className="text-zinc-500">No recent games</p>
                    </div>
                  ) : (
                    recentlyEditedGames.map((g) => (
                      <Link key={g.id} href={`/game/${g.id}`}>
                        <div className="flex flex-col gap-2 p-3 rounded-xl cursor-pointer group hover:bg-white/10 transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <img
                              className="w-20 h-12 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
                              src={g.background_image}
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
                                        (g.playtime % 1) * 60
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
            initialRating={editingGame.rating ?? 0}
            initialCategoryRatings={editingGame.categoryRatings}
            initialProgress={editingGame.progress ?? 0}
            initialPlaytime={editingGame.playtime ?? 0}
            initialStatus={editingGame.status ?? "Playing"}
            initialFavorite={editingGame.favorite ?? false}
            showStatus={true}
            showFavorite={true}
          />
        )}

        {/* All-Time Favorite Modal */}
        <AllTimeFavoriteModal
          open={selectingFavoriteAllTime}
          onClose={() => setSelectingFavoriteAllTime(false)}
        />

        {/* Top-level All-Time Favorite Modal */}
        <AnimatePresence>
          {favoriteGameModal && favoriteOfAllTime && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                {/* Background Image */}
                <div className="absolute inset-0">
                  <img
                    src={favoriteOfAllTime.background_image}
                    alt={favoriteOfAllTime.name}
                    className="w-full h-full object-cover brightness-80"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/50 to-transparent"></div>
                </div>

                {/* Content */}
                <div className="relative p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex flex-col items-center justify-between ">
                      <h2 className="text-2xl font-extrabold text-white drop-shadow-lg">
                        {favoriteOfAllTime.name}
                      </h2>
                      <p className="font-semibold text-yellow-400 text-lg drop-shadow-sm text-center">
                        ⭐ {favoriteOfAllTime.rating} / 10
                      </p>
                    </div>
                    {favoriteOfAllTime.notes ? (
                      <p className="text-zinc-200 text-sm md:text-base leading-relaxed">
                        {favoriteOfAllTime.notes}
                      </p>
                    ) : (
                      <p className="text-zinc-200 text-sm md:text-base leading-relaxed">
                        No notes about the game
                      </p>
                    )}

                    {/* Select New Favorite Button */}
                    <button
                      onClick={() => {
                        setFavoriteGameModal(false);
                        setSelectingFavoriteAllTime(true);
                      }}
                      className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-xl shadow-lg shadow-yellow-500/50 hover:scale-105 transition-transform duration-200"
                    >
                      Select A New Favorite Game
                    </button>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  className="absolute top-4 right-4 text-zinc-200 hover:text-white text-3xl transition-transform hover:scale-110"
                  onClick={() => setFavoriteGameModal(false)}
                >
                  ×
                </button>

                {/* Subtle floating glows */}
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
    </>
  );
}
