"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { IoStarSharp } from "react-icons/io5";

import { db } from "@/app/lib/firebase";
import { useUser } from "../../context/UserContext";
import PosterImage from "@/app/components/PosterImages";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import HoldToRefreshButton from "@/app/components/HoldToRefreshButton";

import { MdEdit } from "react-icons/md";
import toast from "react-hot-toast";
import Image from "next/image";

const STATUSES = [
  "All",
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Not Interested",
  "Want to Play",
];

const sortOrder = "newest";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(true);
  const lastCardRef = useRef<HTMLDivElement | null>(null);

  //Editing Games
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<TrackedGame | null>(null);
  const [saving, setSaving] = useState(false);

  // Firestore subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      if (!data) return;
      const trackedGames = data.trackedGames as Record<string, TrackedGame>;
      setLoading(true);
      setGamesLoading(true);
      setTimeout(() => {
        setLocalProfile({
          uid: user.uid,
          username: userProfile?.username || "",
          email: userProfile?.email || "",
          displayName: userProfile?.displayName || null,
          avatarUrl: userProfile?.avatarUrl,
          avatarBase64: userProfile?.avatarBase64,
          trackedGames: trackedGames || {},
          creationTime: new Date(user.metadata.creationTime),
          lastSignInTime: new Date(user.metadata.lastSignInTime),
        });
        setLoading(false);
        setGamesLoading(false);
      }, 300);
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
      "Not Interested": [],
      "Want to Play": [],
    };

    allGames.forEach((g) => {
      const status = g.status && map[g.status] ? g.status : "Want to Play";
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
    let games =
      selectedStatus === "All"
        ? gamesByStatus.All
        : gamesByStatus[selectedStatus] || [];

    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      games = games.filter(
        (g) => g.name && g.name.toLowerCase().includes(lower)
      );
    }

    // Safe sorting
    games.sort((a, b) => {
      const aTime = a.lastUpdated?.toMillis?.() ?? 0;
      const bTime = b.lastUpdated?.toMillis?.() ?? 0;
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return games;
  }, [gamesByStatus, selectedStatus, debouncedSearch]);

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
  const wantCount = useMemo(
    () => allGames.filter((g) => g.status === "Want to Play").length,
    [allGames]
  );
  const notInterstedCount = useMemo(
    () => allGames.filter((g) => g.status === "Not Interested").length,
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
  }, [debouncedSearch, selectedStatus]);

  //Update Fields
  const openEditModal = (game: TrackedGame) => {
    setEditingGame(game);
    setModalOpen(true);
    console.log("Editing game:", game);
  };

  const updateTrackedGame = async (
    gameId: number,
    patch: Partial<TrackedGame>
  ) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const trackedGames = snap.exists() ? snap.data().trackedGames || {} : {};

    const merged = {
      ...(trackedGames[String(gameId)] || {}),
      ...patch,
      id: gameId,
    };

    await updateDoc(ref, {
      trackedGames: { ...trackedGames, [String(gameId)]: merged },
    });

    return merged;
  };

  const handleSaveModal = async (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean
  ) => {
    if (!editingGame || saving) return; // prevent double saves

    setSaving(true); // start page-level saving
    try {
      const updatedGame = await updateTrackedGame(editingGame.id, {
        rating,
        progress,
        playtime,
        notes,
        status,
        favorite,
        lastUpdated: new Date(),
      });

      // Update local profile to refresh UI
      setLocalProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          trackedGames: {
            ...prev.trackedGames,
            [editingGame.id]: {
              ...prev.trackedGames[editingGame.id],
              ...updatedGame,
            },
          },
        };
      });
      toast.success("Notes Saved!");
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save notes.");
    } finally {
      setSaving(false);
    }
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
        <div className="max-w-[1850px] mx-auto flex flex-col lg:flex-row gap-8 lg:gap-22 pt-23">
          {/* Left Panel (Stats) */}
          <div className="w-full lg:w-81 flex flex-col p-4 max-h-[90vh]">
            <div className="bg-zinc-900 rounded-2xl flex flex-col items-center p-3 shadow-xl h-full">
              {/* Avatar */}
              <Link href={`/profile/${userProfile!.username}`}>
                {localProfile?.avatarBase64 || localProfile?.avatarUrl ? (
                  <img
                    src={localProfile.avatarBase64 ?? localProfile.avatarUrl}
                    alt={localProfile?.username ?? "User"}
                    className="w-36 h-36 rounded-full object-cover shadow-lg"
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
                <p className="cursor-default text-sm text-zinc-300 mt-1 blur-sm hover:blur-none transition">
                  {localProfile?.email}
                </p>
              </div>

              {/* Divider */}
              <hr className="my-6 w-full border-zinc-700" />

              {/* Stats */}
              <div className="w-full flex flex-col gap-4 text-sm text-zinc-300 overflow-y-auto px-2">
                {[
                  ["Member Since", formattedDate],
                  ["Total Games", allGames.length],
                  ["Completed", completedCount],
                  ["On Hold", onHoldCount],
                  ["Playing", playingCount],
                  ["Dropped", droppedCount],
                  ["Not Intersted", notInterstedCount],
                  ["Want to Play", wantCount],
                ].map(([label, value]) => (
                  <div
                    key={label?.toString()}
                    className="flex justify-between w-full px-2 py-1 rounded-lg hover:bg-white/10 transition-colors duration-200"
                  >
                    <span className="font-medium">{label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <hr className="my-6 w-full border-zinc-700" />

              {/* Level / Badge */}
              <div className="flex flex-col items-center gap-3">
                <h3 className="flex flex-col font-extrabold text-2xl text-center text-white">
                  領域展開
                  <span>(Ryōiki Tenkai)</span>
                </h3>
                <Image
                  src="/maxLevelSign.png"
                  alt="Max Level"
                  width={80}
                  height={80}
                  className=""
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 px-6 lg:px-0">
            {/* Tabs */}
            <div className="flex flex-wrap justify-center gap-3 mb-5">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  className={`px-4 py-2 rounded-full font-semibold transition ${
                    selectedStatus === status
                      ? "bg-linear-to-r from-cyan-400 to-blue-500 text-black"
                      : "bg-zinc-800 text-white hover:bg-zinc-700"
                  }`}
                  onClick={() => handleTabChange(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Pagination and Search */}
            <div className="flex justify-between my-8 gap-4 items-center">
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
                placeholder={`Search for a game in ${selectedStatus}`}
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
                    {/* Hold-to-refresh button */}
                    <div className="absolute top-2 left-2 z-40">
                      <HoldToRefreshButton
                        gameId={game.id}
                        gameName={game.name}
                        trackedGames={localProfile!.trackedGames}
                        size={40} // optional, default 40
                      />
                    </div>
                    {/* Entire card clickable */}
                    <Link href={`/game/${game.id}`} prefetch={false}>
                      <div className="relative w-full h-56 cursor-pointer">
                        <PosterImage
                          src={game.background_image || "/placeholder-game.jpg"}
                          alt={game.name}
                        />

                        {game.screenshots && game.screenshots.length > 0 && (
                          <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex overflow-x-auto p-2 bg-black bg-opacity-50 rounded-2xl">
                            {game.screenshots.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Screenshot ${idx + 1}`}
                                className="h-full w-auto object-cover mx-1 rounded-md"
                              />
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </Link>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(game);
                      }}
                      className="absolute top-2 right-2 z-30 px-2 py-2 bg-black/40 text-white/80 rounded-full cursor-pointer hover:bg-black/60 hover:scale-110 transition-all duration-300 group"
                    >
                      <MdEdit
                        size={18}
                        className="group-hover:animate-[wiggle_0.8s_infinite]"
                      />
                    </button>

                    {/* Game Info clickable */}
                    <Link href={`/game/${game.id}`} prefetch={false}>
                      <div className="p-4 flex flex-col gap-1 text-white cursor-pointer">
                        <h3 className="font-bold text-lg truncate">
                          {game.name}
                        </h3>
                        <p className="text-sm text-zinc-400">
                          Playtime:
                          <span className="pl-1">
                            {game.playtime
                              ? `
                              ${Math.floor(game.playtime)}h 
                              ${Math.round((game.playtime % 1) * 60)}m
                              `
                              : "0h 0m"}
                          </span>
                        </p>
                        <p className="text-sm text-yellow-400">
                          Rating: {Math.round(game.rating ?? 0)} / 5
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          </div>

          {/* Right Panel (Favorites + Recently Edited) */}
          <div className="w-full lg:w-80 shrink-0 mt-6 lg:mt-0 flex flex-col gap-6">
            {/* Favorites */}
            <div className="bg-zinc-900 p-4 rounded-2xl flex flex-col gap-3 overflow-y-auto custom-scrollbar max-h-[43vh]">
              <h3 className="font-bold text-xl mb-4 text-white/90">
                Favorite Games
              </h3>
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
            <div className="bg-zinc-900 p-4 rounded-2xl flex flex-col gap-3 max-h-[43vh] mb-8 lg:mb-0">
              <h3 className="font-bold text-xl mb-4 text-white/90">
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
                            <span className="text-white/90 font-medium text-sm group-hover:text-white transition">
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
          initialNotes={editingGame.notes ?? ""}
          initialRating={editingGame.rating ?? 0}
          initialProgress={editingGame.progress ?? 0}
          initialPlaytime={editingGame.playtime ?? 0}
          initialStatus={editingGame.status ?? "Playing"}
          initialFavorite={editingGame.favorite ?? false}
          showStatus={true}
          showFavorite={true}
        />
      )}
    </motion.main>
  );
}
