"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { collection, getDocs } from "firebase/firestore";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";

import { auth, db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import { useAuthModal } from "@/app/context/AuthModalContext";
import AuthModal from "@/app/components/auth/AuthModal";
import ConfirmModal from "@/app/components/ConfirmModal";
import OverviewPanel from "@/app/components/mainMenu/OverviewPanel";
import AboutPanel from "@/app/components/mainMenu/AboutPanel";
import LoadingSpinner from "../explore/loading";
import { useMusic } from "@/app/context/MusicContext";
import { useUI } from "@/app/context/UIContext";

/* ───────────────── Types ───────────────── */
type Panel = "none" | "about" | "overview";

type StatusKey = "All" | "Completed" | "Playing" | "On Hold" | "Dropped";

const canContinue =
  typeof window !== "undefined" && !!localStorage.getItem("lastPage");

interface ModalGame {
  id: string;
  name: string;
  playtime?: number;
  status?: "Playing" | "Completed" | "Dropped" | "On Hold" | string;
  lastUpdated?: any;
  favorite?: boolean;
  [key: string]: any;
}

export default function Dashboard() {
  const { profile, loading, user } = useUser();
  const { playerVisible, togglePlayerVisible } = useMusic();
  const router = useRouter();
  const pathname = usePathname();
  const { open } = useAuthModal();
  const { panelOpen, setPanelOpen, startRouteLoading } = useUI();

  const [active, setActive] = useState(0);
  const [openPanel, setOpenPanel] = useState<Panel>("none");

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [games, setGames] = useState<ModalGame[]>([]);
  const [bgVideo, setBgVideo] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setPanelOpen(openPanel !== "none");
  }, [openPanel, setPanelOpen]);

  //   /* ───────────────── LOGIC ───────────────── */
  const gameStats = useMemo(() => {
    const stats: Record<StatusKey, number> = {
      All: games.length,
      Completed: 0,
      Playing: 0,
      "On Hold": 0,
      Dropped: 0,
    };

    games.forEach((game) => {
      const status = (game.status || "Playing") as StatusKey;
      if (status in stats) stats[status] += 1;
    });

    return stats;
  }, [games]);

  //   /* background video */
  useEffect(() => {
    const vids = Array.from({ length: 20 }, (_, i) => `/videos/${i + 1}.mp4`);
    const chosen = vids[Math.floor(Math.random() * vids.length)];
    setBgVideo(chosen);

    const v = document.createElement("video");
    v.src = chosen;
    v.onloadeddata = () => setVideoReady(true);
  }, []);

  //   fetch games
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "users", user.uid, "games_igdb")).then((snap) => {
      setGames(snap.docs.map((d) => d.data() as ModalGame));
    });
  }, [user]);

  // XP calculation
  const gameXP = useMemo(() => {
    return games.map((game) => {
      const hours = Number(game.playtime) || 0;
      const baseXP = Math.round(hours * 8);

      let displayXP = 0;
      switch (game.status) {
        case "Playing":
        case "Completed":
          displayXP = baseXP;
          break;
        case "Dropped":
          displayXP = Math.round(baseXP * 0.5);
          break;
        case "On Hold":
          displayXP = Math.round(baseXP * 0.25);
          break;
        default:
          displayXP = Math.round(baseXP * 0.1);
      }

      return { ...game, displayXP };
    });
  }, [games]);

  // Total XP (Completed + Dropped logic)
  const totalXP = useMemo(() => {
    return gameXP.reduce((acc, game) => {
      if (game.status === "Completed") return acc + game.displayXP;
      if (game.status === "Dropped") return acc - game.displayXP;
      return acc;
    }, 0);
  }, [gameXP]);

  const level = Math.max(1, Math.floor(totalXP / 1000) + 1);

  const menuItems = [
    { label: "Continue", action: "continue" },
    { label: "New Game", action: "explore" },
    { label: "My Games", action: "games" },
    user && { label: "Overview", action: "overview" },
    { label: "About", action: "about" },
    playerVisible
      ? { label: "Soundtrack", action: "soundtrack" }
      : { label: "Soundtrack", action: "soundtrack" },
    user
      ? { label: "Settings", action: "settings" }
      : { label: "Login / Signup", action: "account" },
    { label: "Exit", action: "exit" },
  ].filter(Boolean) as { label: string; action: string }[];

  const handleAction = (action: string) => {
    if (action !== "about" && action !== "overview") {
      setOpenPanel("none");
    }

    switch (action) {
      case "continue": {
        if (!canContinue) {
          toast("No previous session found.", {
            icon: "ℹ️",
          });
          return;
        }

        const lastPage = localStorage.getItem("lastPage")!;
        startRouteLoading();
        router.push(lastPage);
        break;
      }

      case "explore":
        startRouteLoading();
        router.push("/explore");
        break;
      case "games":
        startRouteLoading();
        router.push("/games");
        break;
      case "settings":
        startRouteLoading();
        router.push(`/profile/${profile?.username}`);
        break;
      case "account":
        open("login");
        break;
      case "about":
        setOpenPanel((p) => (p === "about" ? "none" : "about"));
        break;
      case "overview":
        setOpenPanel((p) => (p === "overview" ? "none" : "overview"));
        break;
      case "overview":
        setOpenPanel((p) => (p === "overview" ? "none" : "overview"));
        break;
      case "soundtrack": {
        togglePlayerVisible();
        break;
      }
      case "exit": {
        if (!user) {
          toast.error("You’re not logged in.");
          return;
        }

        setShowLogoutModal(true);
        break;
      }
      default:
        break;
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    startRouteLoading();
    router.push("/dashboard");
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const pageVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  if (loading || !videoReady) return <LoadingSpinner />;

  return (
    <>
      <Helmet>
        <title>PlayCrew</title>
      </Helmet>

      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="relative min-h-screen w-full overflow-hidden bg-black text-white"
      >
        {/* Background Video */}
        <div className="absolute inset-0 z-0">
          <video
            src={bgVideo!}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-50 scale-105"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* MENU COLUMN */}
        <motion.div
          animate={{ x: openPanel === "none" ? 0 : -80 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`
            relative z-10
            flex flex-col
            mt-20 sm:mt-24 md:mt-28
            px-4 sm:px-6 md:px-10 lg:px-16
            md:max-w-[640px]
            lg:translate-x-20
            xl:translate-x-[120px]
            ${playerVisible ? "pt-24 sm:pt-20 md:pt-0" : ""}
          `}
        >
          {user && profile && (
            <motion.div
              layout
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{
                opacity: panelOpen ? 0 : 1,
                scale: panelOpen ? 0.95 : 1,
                y: panelOpen ? -20 : 0,
                x: panelOpen ? 80 : 0,
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                startRouteLoading();
                router.push(`/profile/${profile.username}`);
              }}
              className={`
                  relative mb-6 w-fit self-start
                  sm:absolute sm:-top-16 sm:right-0
                  md:-top-16 md:-right-38
                  lg:-top-20 lg:-right-330
                  ${playerVisible ? "md:translate-y-18 lg:translate-y-21 lg:translate-x-10" : "md:translate-y-0 lg:translate-y-0"}
                  group cursor-pointer
                  origin-top-right
                `}
            >
              <div
                className="
                  relative
                  flex items-center justify-between
                  w-60 sm:w-[260px] md:w-[270px]
                  px-4 sm:px-5 md:px-6 py-3 sm:py-4
                  rounded-2xl
                  bg-linear-to-br from-[#0b1a24]/90 to-[#071118]/90
                  backdrop-blur-xl
                  border border-cyan-400/20
                  shadow-[0_10px_40px_rgba(0,0,0,0.6)]
                  transition-all duration-300
                  group-hover:scale-105
                  group-hover:border-cyan-400/40
                  group-hover:shadow-[0_15px_60px_rgba(0,255,255,0.15)]
                "
              >
                {/* LEFT SIDE TEXT */}
                <div className="flex flex-col max-w-[110px] sm:max-w-[120px]">
                  <span className="text-sm sm:text-base font-semibold text-white capitalize truncate">
                    {profile.username}
                  </span>

                  <span className="text-xs sm:text-sm text-cyan-300 font-medium truncate">
                    Level {level}
                  </span>

                  <span className="text-[11px] sm:text-xs text-white/60 mt-1 tracking-wide sm:tracking-widest truncate">
                    {profile.bio ? profile.bio : `XP ${totalXP}`}
                  </span>
                </div>

                {/* RIGHT SIDE AVATAR */}
                <div className="relative">
                  <img
                    src={profile.avatar.data}
                    alt={profile.username}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-white/30"
                  />

                  {/* Online Dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-black" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Title */}
          <h1
            className={`
              flex items-center gap-3
              text-2xl sm:text-4xl md:text-5xl
              font-semibold tracking-[0.18em] sm:tracking-[0.22em] md:tracking-[0.25em]
              text-zinc-100
              mb-10 sm:mb-12 md:mb-16
            `}
          >
            PLAY
            <img
              src="/logo.png"
              alt="PlayCrew"
              className="w-14 h-10 sm:w-16 sm:h-12 md:w-20 md:h-14 mr-1 sm:mr-2 md:mr-4"
            />
            CREW
          </h1>

          {/* Menu */}
          <ul className="space-y-4 sm:space-y-5 md:space-y-7">
            {menuItems.map((item, index) => {
              const isActive = active === index;
              const isContinue = item.action === "continue";
              const isDisabled = isContinue && !canContinue;

              return (
                <li key={item.label}>
                  <button
                    onMouseEnter={() => {
                      if (!isDisabled) setActive(index);
                    }}
                    onClick={() => {
                      if (!isDisabled) handleAction(item.action);
                    }}
                    className="group relative flex items-center gap-3 sm:gap-4 md:gap-5 text-left"
                  >
                    {/* Hover glass background */}
                    <span
                      className="
                          absolute -inset-y-1.5
                          -left-6 -right-8
                          rounded-xl
                          bg-linear-to-r
                            from-white/10
                            via-white/20
                            to-white/10
                          backdrop-blur-md
                          opacity-0
                          scale-x-75
                          origin-center
                          transition-all duration-300 ease-out
                          group-hover:opacity-100
                          group-hover:scale-x-100
                        "
                    />

                    {/* Text */}
                    <span
                      className={`
                          relative z-10
                          text-base sm:text-xl md:text-2xl tracking-wide transition-all duration-300
                          ${
                            isDisabled
                              ? "text-zinc-700"
                              : isActive
                                ? "text-white"
                                : "text-zinc-400 group-hover:text-white group-hover:translate-x-1"
                          }
                        `}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.div>

        {/* SLIDE-OUT PANEL */}
        {openPanel !== "none" && (
          <div
            className="absolute inset-0 z-10"
            onClick={() => setOpenPanel("none")}
          />
        )}

        <motion.div
          initial={false}
          animate={{
            opacity: openPanel === "none" ? 0 : 1,
            x: openPanel === "none" ? 120 : 0,
            pointerEvents: openPanel === "none" ? "none" : "auto",
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="
            absolute inset-x-2 sm:inset-x-4 md:inset-x-8
            top-1/2 -translate-y-1/2
            lg:left-[64%] lg:inset-x-auto lg:-translate-x-1/2
            w-auto lg:w-full lg:max-w-5xl
            z-20
          "
        >
          <AnimatePresence mode="wait">
            {openPanel !== "none" && (
              <motion.div
                key={openPanel}
                className="
                  absolute left-0 right-0 top-1/2
                  -translate-y-1/2
                  lg:left-1/2 lg:right-auto lg:-translate-x-1/2
                  w-full lg:max-w-5xl
                  z-20
                "
              >
                {openPanel === "about" && (
                  <AboutPanel
                    containerVariants={containerVariants}
                    itemVariants={itemVariants}
                    onClose={() => setOpenPanel("none")}
                  />
                )}

                {openPanel === "overview" && user && (
                  <OverviewPanel
                    level={level}
                    totalXP={totalXP}
                    gameStats={gameStats}
                    gameXP={gameXP}
                    onClose={() => setOpenPanel("none")}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {typeof window !== "undefined" &&
          createPortal(
            <ConfirmModal
              open={showLogoutModal}
              title="Are You Sure?"
              message="You are about to log out and lose access to your dashboard and games. You can log back in anytime to restore everything."
              confirmText="Logout"
              cancelText="Cancel"
              onCancel={() => setShowLogoutModal(false)}
              onConfirm={async () => {
                setShowLogoutModal(false);
                await handleLogout();
              }}
            />,
            document.body,
          )}

        <AuthModal />
      </motion.div>
    </>
  );
}

// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { motion, type Variants } from "framer-motion";
// import { collection, getDocs } from "firebase/firestore";
// import { Helmet } from "react-helmet-async";

// import { useUser } from "@/app/context/UserContext";
// import { useAuthModal } from "@/app/context/AuthModalContext";
// import { db } from "@/app/lib/firebase";

// import AuthModal from "@/app/components/auth/AuthModal";
// import LoadingSpinner from "../explore/loading";

// import { SlGameController } from "react-icons/sl";
// import { PiArrowFatLinesUpDuotone } from "react-icons/pi";
// import { LuCalendarClock } from "react-icons/lu";
// import { GiAbdominalArmor } from "react-icons/gi";
// import { MdExplore } from "react-icons/md";

// /* ───────────────── Types ───────────────── */

// interface ModalGame {
//   id: string;
//   name: string;
//   playtime?: number;
//   status?: "Playing" | "Completed" | "Dropped" | "On Hold" | string;
//   lastUpdated?: any;
//   favorite?: boolean;
//   [key: string]: any;
// }
// /* ───────────────── Motion (TS-safe) ───────────────── */

// const containerVariants: Variants = {
//   hidden: { opacity: 0, y: 32 },
//   visible: {
//     opacity: 1,
//     y: 0,
//     transition: {
//       staggerChildren: 0.15,
//       delayChildren: 0.1,
//     },
//   },
// };

// const itemVariants: Variants = {
//   hidden: { opacity: 0, y: 20 },
//   visible: {
//     opacity: 1,
//     y: 0,
//     transition: {
//       duration: 0.45,
//       ease: [0.22, 1, 0.36, 1],
//     },
//   },
// };

// const iconVariants: Variants = {
//   animate: {
//     y: [0, -6, 0],
//     transition: {
//       duration: 2.2,
//       repeat: Infinity,
//       ease: [0.22, 1, 0.36, 1],
//     },
//   },
// };

// /* ───────────────── Page ───────────────── */

// export default function DashboardPage() {
//   const { profile, loading, user } = useUser();
//   const { open } = useAuthModal();

//   const [games, setGames] = useState<ModalGame[]>([]);
//   const [bgVideo, setBgVideo] = useState("");
//   const [videoReady, setVideoReady] = useState(false);

//   const username = profile?.username || "Player";

//   type StatusKey = "All" | "Completed" | "Playing" | "On Hold" | "Dropped";

//   /* ───────────────── LOGIC ───────────────── */
//   const gameStats = useMemo(() => {
//     const stats: Record<StatusKey, number> = {
//       All: games.length,
//       Completed: 0,
//       Playing: 0,
//       "On Hold": 0,
//       Dropped: 0,
//     };

//     games.forEach((game) => {
//       const status = (game.status || "Playing") as StatusKey;
//       if (status in stats) stats[status] += 1;
//     });

//     return stats;
//   }, [games]);

//   /* background video */
//   useEffect(() => {
//     const vids = Array.from({ length: 12 }, (_, i) => `/videos/${i + 1}.mp4`);
//     const chosen = vids[Math.floor(Math.random() * vids.length)];
//     setBgVideo(chosen);

//     const v = document.createElement("video");
//     v.src = chosen;
//     v.onloadeddata = () => setVideoReady(true);
//   }, []);

//   /* fetch games */
//   useEffect(() => {
//     if (!user) return;
//     getDocs(collection(db, "users", user.uid, "games_igdb")).then((snap) => {
//       setGames(snap.docs.map((d) => d.data() as ModalGame));
//     });
//   }, [user]);

//   /* XP */
//   // XP calculation
//   const gameXP = useMemo(() => {
//     return games.map((game) => {
//       const hours = Number(game.playtime) || 0;
//       const baseXP = Math.round(hours * 8);

//       let displayXP = 0;
//       switch (game.status) {
//         case "Playing":
//         case "Completed":
//           displayXP = baseXP;
//           break;
//         case "Dropped":
//           displayXP = Math.round(baseXP * 0.5);
//           break;
//         case "On Hold":
//           displayXP = Math.round(baseXP * 0.25);
//           break;
//         default:
//           displayXP = Math.round(baseXP * 0.1);
//       }

//       return { ...game, displayXP };
//     });
//   }, [games]);

//   // Total XP (Completed + Dropped logic)
//   const totalXP = useMemo(() => {
//     return gameXP.reduce((acc, game) => {
//       if (game.status === "Completed") return acc + game.displayXP;
//       if (game.status === "Dropped") return acc - game.displayXP;
//       return acc;
//     }, 0);
//   }, [gameXP]);

//   const level = Math.max(1, Math.floor(totalXP / 1000) + 1);

//   if (loading || !videoReady) return <LoadingSpinner />;

//   return (
//     <>
//       <Helmet>
//         <title>PlayCrew</title>
//       </Helmet>

//       {/* ───────── LOCKED VIEWPORT ───────── */}
//       <motion.main className="relative min-h-screen w-full bg-black text-white pt-[150px]">
//         {/* Background video */}
//         <video
//           src={bgVideo}
//           autoPlay
//           loop
//           muted
//           playsInline
//           className="fixed inset-0 w-screen h-screen object-cover opacity-50 z-0"
//         />

//         {/* Immersive overlays */}
//         {/* <div className="absolute inset-0 bg-linear-to-r from-black/40 via-black/50 to-black/60" /> */}
//         <div className="absolute inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.9)]" />

//         {/* ───────── CONTENT ───────── */}
//         <div className="relative z-10 h-full flex flex-col items-center justify-start px-6">
//           {/* Hero */}
//           <div className="text-center pb-18">
//             <motion.h1
//               className="text-5xl sm:text-6xl font-extrabold text-cyan-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.6)] capitalize"
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//             >
//               {user ? `Welcome back, ${username}` : "Welcome to PlayCrew"}
//             </motion.h1>

//             <motion.p
//               className="mt-4 max-w-xl mx-auto text-zinc-300"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               transition={{ delay: 0.25 }}
//             >
//               Track your games, earn XP from playtime, and turn your gaming
//               habits into progression.
//             </motion.p>
//           </div>

//           {/* ───────── SYSTEM CARDS (NO SCROLL) ───────── */}
//           {!user && (
//             <motion.section
//               className="mt-10 w-full max-w-7xl mx-auto overflow-visible"
//               variants={containerVariants}
//               initial="hidden"
//               animate="visible"
//             >
//               <div className="flex flex-wrap justify-center gap-8">
//                 {[
//                   {
//                     icon: <MdExplore size={26} />,
//                     title: "Explore",
//                     desc: "Explore upcoming and trending games to grow your collection and XP.",
//                   },
//                   {
//                     icon: <SlGameController size={26} />,
//                     title: "Track Games",
//                     desc: "Build your PlayCrew with games you play or plan to play.",
//                   },
//                   {
//                     icon: <LuCalendarClock size={26} />,
//                     title: "Release Radar",
//                     desc: "Track upcoming games and earn XP by adding them.",
//                   },
//                   {
//                     icon: <GiAbdominalArmor size={26} />,
//                     title: "Earn XP",
//                     desc: "Playtime and status directly impact your XP.",
//                   },
//                   {
//                     icon: <PiArrowFatLinesUpDuotone size={26} />,
//                     title: "Level Up",
//                     desc: "Turn habits into long-term progression and stats.",
//                   },
//                 ].map((item) => (
//                   <motion.div
//                     key={item.title}
//                     variants={itemVariants}
//                     className="
//             relative
//             flex-1
//             min-w-[300px]
//             max-w-[300px]
//             bg-zinc-950/70 backdrop-blur-md
//             border border-zinc-800 rounded-2xl p-6
//             hover:border-cyan-500/40 hover:-translate-y-1.5
//             transition-all duration-300 ease-in-out
//             cursor-default
//           "
//                   >
//                     <motion.div
//                       variants={iconVariants}
//                       animate="animate"
//                       className="
//               w-12 h-12 mb-4 flex items-center justify-center
//               rounded-xl bg-cyan-500/10 text-cyan-400
//               shadow-[0_0_25px_rgba(34,211,238,0.2)]
//             "
//                     >
//                       {item.icon}
//                     </motion.div>

//                     <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
//                     <p className="text-sm text-zinc-400">{item.desc}</p>
//                   </motion.div>
//                 ))}
//               </div>
//             </motion.section>
//           )}

//           {/* ───────── USER PROGRESSION (SAME SCREEN) ───────── */}
//           {/* XP */}
//           {user && (
//             <motion.div className="relative z-20 my-8 w-full max-w-md mx-auto flex items-center justify-around bg-zinc-900/70 backdrop-blur-md p-6 rounded-2xl border border-cyan-500/20">
//               <div className="text-center">
//                 <p className="text-4xl font-bold text-cyan-400">Level</p>

//                 <p className="text-4xl font-extrabold text-cyan-400">{level}</p>
//               </div>

//               <div className="text-center border-l border-cyan-500/10 pl-6">
//                 <p className="text-3xl font-bold text-cyan-400">
//                   {Math.round(totalXP)}
//                 </p>
//                 <p className="text-sm text-zinc-400">XP</p>
//               </div>
//             </motion.div>
//           )}

//           {user && (
//             <motion.div className="relative z-20 w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-8 bg-zinc-900/70 backdrop-blur-md p-8 rounded-2xl border border-cyan-500/20">
//               {Object.entries(gameStats).map(([label, value]) => {
//                 const categoryXP = gameXP
//                   .filter((g) => g.status === label)
//                   .reduce((acc, g) => acc + g.displayXP, 0);
//                 return (
//                   <div key={label} className="text-center min-w-[100px]">
//                     <p className="text-3xl font-bold text-cyan-400">{value}</p>
//                     <p className="text-sm text-zinc-400">{label}</p>

//                     {user && label !== "All" && (
//                       <p className="text-sm text-zinc-500">
//                         <span className="pr-[3px]">
//                           {label === "Dropped" && "-"}
//                           {label === "On Hold" && "±"}
//                           {categoryXP}
//                         </span>
//                         XP
//                       </p>
//                     )}
//                   </div>
//                 );
//               })}
//             </motion.div>
//           )}

//           {!user && <div className="h-[200px] w-full shrink-0" />}
//         </div>

//         {/* ───────── CTA ───────── */}
//         {!user && (
//           <motion.div
//             initial={{ opacity: 0, y: 32 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
//             className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50
//               bg-zinc-900/80 backdrop-blur-md
//               px-8 py-4 rounded-2xl
//               border border-cyan-500/30
//               shadow-[0_0_40px_rgba(34,211,238,0.15)]"
//           >
//             <p className="text-xs text-zinc-400 mb-4 text-center uppercase tracking-[0.3em]">
//               Begin Your Progression
//             </p>

//             <div className="flex gap-4">
//               <button
//                 onClick={() => open("signup")}
//                 className="bg-cyan-500 text-black px-6 py-2 rounded-full font-semibold
//                   hover:bg-cyan-400 hover:-translate-y-0.5 transition cursor-pointer"
//               >
//                 Get Started
//               </button>

//               <button
//                 onClick={() => open("login")}
//                 className="border border-cyan-500 text-cyan-400 px-6 py-2 rounded-full
//                   hover:bg-cyan-400 hover:text-black hover:-translate-y-0.5 transition cursor-pointer"
//               >
//                 Log in
//               </button>
//             </div>
//           </motion.div>
//         )}

//         <AuthModal />
//       </motion.main>
//     </>
//   );
// }
