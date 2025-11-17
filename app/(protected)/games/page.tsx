"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useUser } from "../../context/UserContext";
import PosterImage from "@/app/components/PosterImages";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

const STATUSES = [
  "All",
  "Playing",
  "Completed",
  "On Hold",
  "Dropped",
  "Want to Play",
];
const INITIAL_COUNT = 9;
const LOAD_MORE_COUNT = 9;

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
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  emailVerified?: boolean; // new field
  displayName?: string | null;
  avatarUrl?: string;
  avatarBase64?: string;
  trackedGames: Record<string, TrackedGame>;
  createdAt?: Date;
  lastLoginAt?: Date;
}

export default function GamesPage() {
  const { profile: userProfile, loading: userLoading, user } = useUser();
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [displayCount, setDisplayCount] = useState(INITIAL_COUNT);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastCardRef = useRef<HTMLDivElement | null>(null);

  // Firestore subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      if (data) {
        const trackedGames = data.trackedGames as Record<string, TrackedGame>;
        setLoading(true);
        setTimeout(() => {
          setLocalProfile({
            uid: user.uid,
            username: userProfile?.username || "",
            email: userProfile?.email || "",
            emailVerified: userProfile?.emailVerified ?? false, // store verification status
            displayName: userProfile?.displayName || null,
            avatarUrl: userProfile?.avatarUrl,
            avatarBase64: userProfile?.avatarBase64,
            trackedGames: trackedGames || {},

            createdAt: new Date(Number(data.metadata?.createdAt) || Date.now()),
            lastLoginAt: new Date(
              Number(data.metadata?.lastLoginAt) || Date.now()
            ),
          });

          setLoading(false);
        }, 300);
      }
    });
    return () => unsubscribe();
  }, [user, userProfile]);

  // Convert trackedGames to array
  const allGames: TrackedGame[] = useMemo(() => {
    if (!localProfile?.trackedGames) return [];
    return Object.values(localProfile.trackedGames).filter(Boolean);
  }, [localProfile?.trackedGames]);

  // Status mapping
  const gamesByStatus = useMemo(() => {
    const map: Record<string, TrackedGame[]> = {
      All: [],
      Playing: [],
      Completed: [],
      "On Hold": [],
      Dropped: [],
      "Want to Play": [],
    };
    allGames.forEach((g) => {
      const status = g.status && map[g.status] ? g.status : "Want to Play";
      map[status].push(g);
      map.All.push(g);
    });
    return map;
  }, [allGames]);

  // Filter, search, sort
  const filteredGames = useMemo(() => {
    let games =
      selectedStatus === "All"
        ? gamesByStatus.All
        : gamesByStatus[selectedStatus] || [];
    if (searchQuery)
      games = games.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    games.sort((a, b) => {
      const aTime = a.lastUpdated?.toMillis ? a.lastUpdated.toMillis() : 0;
      const bTime = b.lastUpdated?.toMillis ? b.lastUpdated.toMillis() : 0;
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
    return games;
  }, [gamesByStatus, selectedStatus, searchQuery, sortOrder]);

  const visibleGames = filteredGames.slice(0, displayCount);

  // Favorites and Recently Edited
  const favoriteGames = useMemo(
    () => allGames.filter((g) => g.favorite).slice(0, 6),
    [allGames]
  );
  const recentlyEditedGames = useMemo(
    () =>
      [...allGames]
        .sort((a, b) => {
          const aTime = a.lastUpdated?.toMillis ? a.lastUpdated.toMillis() : 0;
          const bTime = b.lastUpdated?.toMillis ? b.lastUpdated.toMillis() : 0;
          return bTime - aTime;
        })
        .slice(0, 6),
    [allGames]
  );

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

  // Handlers
  const handleTabChange = (status: string) => {
    setSelectedStatus(status);
    setDisplayCount(INITIAL_COUNT);
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setDisplayCount(INITIAL_COUNT);
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

  const handleLoadMore = () => {
    if (!lastCardRef.current) return;
    setLoadingMore(true);
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
    requestAnimationFrame(() => {
      lastCardRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      setLoadingMore(false);
    });
  };

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

  if (userLoading || !user) return <LoadingSpinner />;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-[1600px] mx-auto flex gap-8 relative">
        {/* Left Column (User stats) */}
        <div className="hidden md:flex flex-col gap-6 w-64 h-screen fixed top-[20%] left-45 z-30 overflow-y-auto">
          <div className="bg-zinc-900 p-4 rounded-xl flex flex-col items-center gap-4">
            {/* Avatar */}
            {localProfile?.avatarBase64 || localProfile?.avatarUrl ? (
              <img
                src={localProfile.avatarBase64 ?? localProfile.avatarUrl}
                alt={localProfile?.username ?? "User"}
                className="w-50 h-50 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center text-2xl text-zinc-400">
                {localProfile?.username?.[0]?.toUpperCase()}
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col justify-center p-2 gap-[0.5]">
              <h3 className="font-bold text-center">
                {localProfile?.username}
              </h3>
              <h2 className="text-center">{localProfile?.email}</h2>
              <h1 className="text-center text-sm">
                {localProfile?.emailVerified ? "Verified" : "Not Verified"}
              </h1>
            </div>

            {/* Stats */}
            <div className="w-full flex flex-col gap-2 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span>Member Since</span>
                <span>
                  {localProfile?.createdAt
                    ? localProfile.createdAt.toDateString()
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Games</span>
                <span>{allGames.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span>{completedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>On Hold</span>
                <span>{onHoldCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Playing</span>
                <span>{playingCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Dropped</span>
                <span>{droppedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Want to Play</span>
                <span>{wantCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 md:ml-72 md:mr-80">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-4 mb-4">
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

          {/* Search & Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="px-4 py-2 rounded-md bg-zinc-800 text-white w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                🔍
              </span>
            </div>
            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as "newest" | "oldest")
              }
              className="px-4 py-2 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="newest">Newest Updated</option>
              <option value="oldest">Oldest Updated</option>
            </select>
          </div>

          {/* Game Grid */}
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && filteredGames.length > 0 ? (
              renderSkeletons(Math.min(displayCount, filteredGames.length))
            ) : visibleGames.length === 0 ? (
              <p className="text-center text-zinc-400 col-span-full mt-10">
                No games found.
              </p>
            ) : (
              visibleGames.map((game, idx) => (
                <motion.div
                  key={game.id}
                  ref={idx === visibleGames.length - 1 ? lastCardRef : null}
                  className="group relative rounded-xl bg-zinc-900 shadow-lg overflow-hidden cursor-pointer min-h-[350px]"
                  whileHover={{ scale: 1.03 }}
                >
                  <Link href={`/game/${game.id}`}>
                    <div className="relative w-full h-56">
                      <PosterImage
                        src={game.background_image || "/placeholder-game.jpg"}
                        alt={game.name}
                      />
                      {game.screenshots && game.screenshots.length > 0 && (
                        <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex overflow-x-auto p-2 bg-black bg-opacity-50">
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
                    <div className="p-4 flex flex-col gap-1 text-white">
                      <h3 className="font-bold text-lg truncate">
                        {game.name}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        Playtime: {Math.round(game.playtime ?? 0)} hrs
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

          {/* Load More */}
          {displayCount < filteredGames.length && (
            <div className="flex justify-center mt-8 items-center gap-4">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 bg-linear-to-r from-cyan-400 to-blue-500 rounded-full font-semibold hover:brightness-110 transition"
                disabled={loadingMore}
              >
                Load More
              </button>
              {loadingMore && <LoadingSpinner />}
            </div>
          )}
        </div>

        {/* Right Column (Favorites & Recently Edited) */}
        <div className="hidden md:flex flex-col gap-6 w-80 h-screen fixed top-0 right-6 overflow-y-auto">
          {/* Favorites */}
          <div className="bg-zinc-900 p-4 rounded-xl flex-1 flex flex-col">
            <h3 className="font-bold text-lg mb-2">Favorite Games</h3>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1">
              {loading ? (
                renderSkeletons(3, true)
              ) : favoriteGames.length === 0 ? (
                <p className="text-zinc-400">No favorite games.</p>
              ) : (
                favoriteGames.map((g) => (
                  <Link key={g.id} href={`/game/${g.id}`}>
                    <div className="flex gap-2 items-center cursor-pointer group">
                      <PosterImage
                        src={g.background_image || "/placeholder-game.jpg"}
                        alt={g.name}
                        className="w-20 h-12 rounded-md object-cover"
                      />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="truncate">{g.name}</span>
                        <span className="text-sm text-zinc-400">
                          {Math.round(g.playtime ?? 0)} hrs
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recently Edited */}
          <div className="bg-zinc-900 p-4 rounded-xl flex-1 flex flex-col">
            <h3 className="font-bold text-lg mb-2">Recently Edited</h3>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1">
              {loading ? (
                renderSkeletons(3, true)
              ) : recentlyEditedGames.length === 0 ? (
                <p className="text-zinc-400">No recent games.</p>
              ) : (
                recentlyEditedGames.map((g) => (
                  <Link key={g.id} href={`/game/${g.id}`}>
                    <div className="flex flex-col gap-1 cursor-pointer group">
                      <PosterImage
                        src={g.background_image || "/placeholder-game.jpg"}
                        alt={g.name}
                        className="w-full h-20 rounded-md object-cover"
                      />
                      <span className="truncate">{g.name}</span>
                      <div className="w-full bg-zinc-700 h-2 rounded">
                        <div
                          className="bg-cyan-500 h-2 rounded"
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
    </main>
  );
}
