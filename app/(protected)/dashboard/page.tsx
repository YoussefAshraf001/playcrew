"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

import { useUser } from "@/app/context/UserContext";

export default function DashboardPage() {
  const { profile, loading, user } = useUser();

  const [gameXP, setGameXP] = useState<any[]>([]);

  const username = profile?.username || user?.displayName || "Player";

  // Memoize trackedGames to prevent infinite loop
  const trackedGames = useMemo(() => {
    return profile?.trackedGames ? Object.values(profile.trackedGames) : [];
  }, [profile?.trackedGames]);

  const friendsCount = profile?.friends
    ? Object.keys(profile.friends).length
    : 0;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [0, 1], ["-5deg", "5deg"]);
  const rotateY = useTransform(mouseX, [0, 1], ["5deg", "-5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    mouseX.set(x);
    mouseY.set(y);
  };

  // Fetch HLTB XP for each tracked game
  useEffect(() => {
    const fetchXP = async () => {
      const xpData = await Promise.all(
        trackedGames.map(async (game: any) => {
          if (!game.name) return { ...game, displayXP: 25 };
          try {
            const res = await fetch(
              `/api/hlbt?game=${encodeURIComponent(game.name)}`
            );
            const data = await res.json();
            const xp = data.hours ? Math.floor(data.hours * 10) : 25;
            return { ...game, displayXP: xp };
          } catch (err) {
            console.error("HLTB fetch error:", err);
            return { ...game, displayXP: 25 };
          }
        })
      );
      setGameXP(xpData);
    };

    if (trackedGames.length > 0) fetchXP();
  }, [trackedGames]);

  // Assign default status if missing and ensure displayXP exists
  const processedGames = gameXP.map((game) => ({
    ...game,
    status: game.status || "Not Set",
    displayXP: game.displayXP ?? 25,
  }));

  // Compute total XP
  const totalXP = gameXP.reduce((acc, game) => {
    switch (game.status) {
      case "Completed":
        return acc + game.displayXP;
      case "Dropped":
        return acc - game.displayXP;
      case "On Hold":
        return acc;
      default: // null / undefined / Not Set
        return acc + game.displayXP;
    }
  }, 0);

  // Build game stats
  const gameStats = {
    All: processedGames.length,
    Completed: processedGames.filter((g) => g.status === "Completed").length,
    "On Hold": processedGames.filter((g) => g.status === "On Hold").length,
    Dropped: processedGames.filter((g) => g.status === "Dropped").length,
    "Not Set Yet": processedGames.filter((g) => g.status === "Not Set").length,
  };

  if (loading || !user) {
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
    <motion.main
      className="relative min-h-screen bg-black text-white overflow-hidden cursor-default"
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Parallax Background */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-50"
          src="/dashboard_bg.mp4"
        />
      </motion.div>

      {/* Hero Section */}
      <div className="relative z-20 flex flex-col items-center justify-center text-center pt-48 pb-24 px-6">
        <motion.h1
          className="text-6xl sm:text-7xl font-extrabold text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Welcome back, {username}
        </motion.h1>
        <motion.p
          className="mt-6 max-w-2xl text-zinc-300 text-lg sm:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          The darkness awaits — track your games, discover new worlds, and
          embrace the thrill.
        </motion.p>
      </div>

      {/* Friends + Total XP */}
      <motion.div
        className="relative z-20 my-8 w-full max-w-md mx-auto flex justify-around bg-zinc-900/70 backdrop-blur-md p-6 rounded-2xl border border-cyan-500/20 shadow-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <div className="text-center">
          <p className="text-3xl font-bold text-cyan-400">{friendsCount}</p>
          <p className="text-sm text-zinc-400">Friends</p>
        </div>
        <div className="text-center border-l border-cyan-500/10 pl-6">
          <p className="text-3xl font-bold text-cyan-400">{totalXP}</p>
          <p className="text-sm text-zinc-400">XP</p>
        </div>
      </motion.div>

      {/* Stats Section */}
      <motion.div
        className="relative z-20 w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-8 bg-zinc-900/70 backdrop-blur-md p-8 rounded-2xl border border-cyan-500/20 shadow-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {Object.entries(gameStats).map(([label, value]) => {
          const categoryXP =
            label === "All" || label === "Not Set Yet"
              ? 0
              : gameXP.reduce((acc, game) => {
                  if (label === "Completed" && game.status === "Completed")
                    return acc + game.displayXP;
                  if (label === "Dropped" && game.status === "Dropped")
                    return acc - game.displayXP;
                  return acc;
                }, 0);

          const displayXP =
            label === "On Hold" ? `(${categoryXP})` : categoryXP;

          return (
            <div key={label} className="text-center min-w-[100px]">
              <p className="text-3xl font-bold text-cyan-400">{value}</p>
              <p className="text-sm text-zinc-400">{label}</p>
              {label !== "All" && label !== "Not Set Yet" && (
                <p className="text-sm text-zinc-500">{displayXP} XP</p>
              )}
            </div>
          );
        })}
      </motion.div>
    </motion.main>
  );
}
