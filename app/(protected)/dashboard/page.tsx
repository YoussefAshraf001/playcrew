"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useUser } from "@/app/context/UserContext";
import Head from "next/head";
import Glitch from "@/app/components/Glitch";

export default function DashboardPage() {
  const { profile, loading, user } = useUser();

  const [gameXP, setGameXP] = useState<any[]>([]);

  // 🎥 Background videos
  const videoList = [
    "/videos/1.mp4",
    "/videos/2.mp4",
    "/videos/3.mp4",
    "/videos/4.mp4",
    "/videos/5.mp4",
    "/videos/6.mp4",
    "/videos/7.mp4",
    "/videos/8.mp4",
    "/videos/9.mp4",
    "/videos/10.mp4",
  ];

  const [bgVideo, setBgVideo] = useState("");

  useEffect(() => {
    const random = videoList[Math.floor(Math.random() * videoList.length)];
    setBgVideo(random);
  }, []);

  const username = profile?.username || user?.displayName || "Player";

  const trackedGames = useMemo(() => {
    return profile?.trackedGames ? Object.values(profile.trackedGames) : [];
  }, [profile?.trackedGames]);

  // 🕹 Calculate XP
  useEffect(() => {
    if (!trackedGames || trackedGames.length === 0) return;

    const calculateXP = (game: any) => {
      const hours = Number(game.playtime) || 0;
      const baseXP = Math.round(hours * 8);

      switch (game.status) {
        case "Playing":
          return baseXP;
        case "Completed":
          return baseXP;
        case "Dropped":
          return Math.round(baseXP * 0.5);
        case "On Hold":
          return Math.round(baseXP * 0.25);
        default:
          return Math.round(baseXP * 0.1);
      }
    };

    const xpData = trackedGames.map((game: any) => ({
      ...game,
      displayXP: calculateXP(game),
      potentialXP:
        game.status === "On Hold" ? Math.round(Number(game.playtime) * 8) : 0,
    }));

    setGameXP(xpData);
  }, [trackedGames]);

  // Process games
  const processedGames = gameXP.map((game) => ({
    ...game,
    status: game.status, // no Not Set
    displayXP: game.displayXP ?? 25,
  }));

  // 🔹 Total XP: only Completed + Dropped
  const totalXP = gameXP.reduce((acc, game) => {
    if (game.status === "Completed") return acc + game.displayXP;
    if (game.status === "Dropped") return acc - game.displayXP;
    return acc;
  }, 0);

  const gameStats = {
    All: processedGames.length,
    Completed: processedGames.filter((g) => g.status === "Completed").length,
    Playing: processedGames.filter((g) => g.status === "Playing").length,
    "On Hold": processedGames.filter((g) => g.status === "On Hold").length,
    Dropped: processedGames.filter((g) => g.status === "Dropped").length,
  };

  if (loading) {
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
    <>
      <Head>
        <title>PlayCrew - Dashboard</title>{" "}
        {/* Default title for the entire app */}
      </Head>

      <motion.main
        className="relative min-h-screen bg-black text-white overflow-hidden cursor-default"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Background */}
        <motion.div className="absolute inset-0 will-change-transform">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            src={bgVideo}
          />
        </motion.div>

        {/* Hero */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center pt-48 pb-24 px-6">
          <motion.h1
            className="text-6xl sm:text-7xl font-extrabold text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            {user ? <>Welcome back, {username}</> : "Welcome, Player"}
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

        {/* "Friends" + Total XP */}
        <motion.div
          className="relative z-20 my-8 w-full max-w-md mx-auto flex items-center justify-around bg-zinc-900/70 backdrop-blur-md p-6 rounded-2xl border border-cyan-500/20 shadow-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="text-center">
            <p
              className="text-4xl font-bold text-cyan-400"
              style={{
                fontFamily: "SoloLevelDemo",
                letterSpacing: "0.3em",
                lineHeight: "1.2",
              }}
            >
              Solo
            </p>
            <p
              className="text-2xl md:text-3xl text-zinc-400"
              style={{
                fontFamily: "SoloLevelDemo",
                letterSpacing: "0.08em",
                lineHeight: "1.2",
              }}
            >
              Leveling
            </p>
          </div>

          <div className="text-center border-l border-cyan-500/10 pl-6">
            <p className="text-3xl font-bold text-cyan-400">
              {user ? (
                totalXP
              ) : (
                <Glitch text="0" className="text-3xl font-bold text-cyan-400" />
              )}
            </p>
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
              label === "Completed"
                ? gameXP
                    .filter((g) => g.status === "Completed")
                    .reduce((acc, g) => acc + g.displayXP, 0)
                : label === "Dropped"
                ? gameXP
                    .filter((g) => g.status === "Dropped")
                    .reduce((acc, g) => acc - g.displayXP, 0)
                : label === "On Hold"
                ? gameXP
                    .filter((g) => g.status === "On Hold")
                    .reduce((acc, g) => acc + g.potentialXP, 0)
                : label === "Playing"
                ? gameXP
                    .filter((g) => g.status === "Playing")
                    .reduce((acc, g) => acc + g.displayXP, 0)
                : 0;

            return (
              <div key={label} className="text-center min-w-[100px]">
                {user ? (
                  <>
                    <p className="text-3xl font-bold text-cyan-400">{value}</p>
                    <p className="text-sm text-zinc-400">{label}</p>
                  </>
                ) : (
                  <>
                    <Glitch
                      text={value}
                      className="text-3xl font-bold text-cyan-400"
                    />
                    <p className="text-sm text-zinc-400">{label}</p>
                  </>
                )}

                {user && label !== "All" && (
                  <p className="text-sm text-zinc-500">
                    <span className="pr-[3px]">{categoryXP}</span>
                    XP
                  </p>
                )}
              </div>
            );
          })}
          {!user && (
            <motion.p
              className=" mt-6 max-w-2xl bg-black/20 text-zinc-100 text-sm border border-cyan-500/60 shadow-xl p-4 rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              To View Your XP, Please Log in or make an account if you are new
              here.
            </motion.p>
          )}
        </motion.div>
      </motion.main>
    </>
  );
}
