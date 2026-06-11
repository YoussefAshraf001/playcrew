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
import ConfirmModal from "@/app/components/ConfirmModal";
import OverviewPanel from "@/app/components/mainMenu/OverviewPanel";
import AboutPanel from "@/app/components/mainMenu/AboutPanel";
import LoadingSpinner from "../explore/loading";
import { useMusic } from "@/app/context/MusicContext";
import { useUI } from "@/app/context/UIContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import {
  RiCheckboxBlankLine,
  RiCloseLine,
  RiSubtractLine,
} from "react-icons/ri";

/* ───────────────── Types ───────────────── */
type Panel = "none" | "about" | "overview";

type StatusKey = "All" | "Completed" | "Playing" | "On Hold" | "Dropped";

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
  const [isLg, setIsLg] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const desktop = isTauri();

  useEffect(() => {
    document.title = "Main Menu • PlayCrew";
  }, []);

  useEffect(() => {
    setPanelOpen(openPanel !== "none");
  }, [openPanel, setPanelOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const syncCanContinue = () => {
      setCanContinue(!!localStorage.getItem("lastPage"));
    };

    syncCanContinue();
    window.addEventListener("storage", syncCanContinue);
    window.addEventListener("focus", syncCanContinue);

    return () => {
      window.removeEventListener("storage", syncCanContinue);
      window.removeEventListener("focus", syncCanContinue);
    };
  }, []);

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
  const accountY = panelOpen ? -20 : playerVisible ? 88 : 0;
  const accountX = panelOpen ? 40 : playerVisible && isLg ? 52 : 0;

  const menuItems = [
    { label: "Continue", action: "continue" },
    { label: "New Game", action: "explore" },
    { label: "My Games", action: "games" },
    { label: "Explore", action: "explore" },
    { label: "Gallery", action: "gallery" },
    user && { label: "Overview", action: "overview" },
    { label: "About", action: "about" },
  ].filter(Boolean) as { label: string; action: string }[];

  const handleAction = async (action: string) => {
    if (action !== "about" && action !== "overview") {
      setOpenPanel("none");
    }

    switch (action) {
      case "continue": {
        const lastPage = localStorage.getItem("lastPage");
        if (!lastPage) {
          toast("No previous session found.", {
            icon: "ℹ️",
          });
          return;
        }

        let targetPath = lastPage;
        if (lastPage.startsWith("http://") || lastPage.startsWith("https://")) {
          try {
            targetPath = new URL(lastPage).pathname;
          } catch {
            targetPath = lastPage;
          }
        }

        const isAccountRelated =
          targetPath.startsWith("/profile") ||
          targetPath.startsWith("/account");

        if (!user && isAccountRelated) {
          toast("Log in to continue from your account page.");
          open("login");
          return;
        }

        startRouteLoading();
        router.push(targetPath);
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
      case "explore":
        startRouteLoading();
        router.push("/explore");
        break;
      case "gallery":
        startRouteLoading();
        router.push("/screenshots");
        break;
      case "settings":
        startRouteLoading();
        router.push(`/profile/${profile?.username}`);
        break;
      case "signup":
        open("signup");
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

      default:
        break;
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    if (pathname !== "/dashboard") {
      startRouteLoading();
      router.push("/dashboard");
      return;
    }

    router.refresh();
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

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Helmet>
        <title>Command Center • PlayCrew</title>
        <meta
          name="description"
          content="Your PlayCrew dashboard for tracking progress, activity, and updates."
        />
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
          {bgVideo && (
            <video
              src={bgVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-50 scale-105"
            />
          )}
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {user && profile ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{
              opacity: panelOpen ? 0 : 1,
              scale: panelOpen ? 0.95 : 1,
              y: accountY,
              x: accountX,
            }}
            transition={{
              x: { type: "spring", stiffness: 220, damping: 26 },
              y: { type: "spring", stiffness: 220, damping: 26 },
              opacity: { duration: 0.25 },
              scale: { duration: 0.25 },
            }}
            onClick={() => {
              startRouteLoading();
              router.push(`/profile/${profile.username}`);
            }}
            className={`
              absolute top-6 right-3 sm:top-7 sm:right-6 md:top-17 md:right-10 lg:right-14 xl:right-4
              z-20
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
                  {profile.bio &&
                  typeof profile.bio === "string" &&
                  profile.bio.trim()
                    ? profile.bio
                    : `XP ${totalXP}`}
                </span>
              </div>

              {/* RIGHT SIDE AVATAR */}
              <div className="relative">
                <img
                  src={profile.avatar?.data || user?.photoURL || "/logo.png"}
                  alt={profile.username}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-white/30"
                />

                {/* Online Dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-black" />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{
              opacity: panelOpen ? 0 : 1,
              scale: panelOpen ? 0.95 : 1,
              y: accountY,
              x: accountX,
            }}
            transition={{
              x: { type: "spring", stiffness: 220, damping: 26 },
              y: { type: "spring", stiffness: 220, damping: 26 },
              opacity: { duration: 0.25 },
              scale: { duration: 0.25 },
            }}
            className={`
              absolute top-6 right-3 sm:top-7 sm:right-6 md:top-8 md:right-10 lg:right-14 xl:right-20
              z-20
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
              "
            >
              <div className="flex flex-col max-w-[140px]">
                <span className="text-sm sm:text-base font-semibold text-white truncate">
                  Guest
                </span>
                <span className="text-xs sm:text-sm text-cyan-300 font-medium truncate">
                  Hello There!
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => open("login")}
                    className="rounded-md border border-white/20 bg-zinc-900/70 px-2 py-1 text-[10px] sm:text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => open("signup")}
                    className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] sm:text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <div className="relative">
                <img
                  src="/logo.png"
                  alt="PlayCrew"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-contain"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* MENU COLUMN */}
        <motion.div
          animate={{ x: openPanel === "none" ? 0 : -80 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`
            relative z-10
            flex flex-col
            mt-34 sm:mt-28 md:mt-42
            px-4 sm:px-6 md:px-10 lg:px-16
            md:max-w-[640px]
            lg:translate-x-20
            xl:translate-x-[120px]
            ${playerVisible ? "pt-24 sm:pt-20 md:pt-0" : ""}
          `}
        >
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
              const isExit = item.action === "exit";
              const isHardDisabled = isContinue && !canContinue;
              const isSoftDisabled = isExit && !user;

              return (
                <li key={item.label}>
                  <button
                    onMouseEnter={() => {
                      if (!isHardDisabled && !isSoftDisabled) setActive(index);
                    }}
                    onClick={() => {
                      if (!isHardDisabled) handleAction(item.action);
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
                          text-xl md:text-2xl tracking-wide transition-all duration-300
                          ${
                            isHardDisabled || isSoftDisabled
                              ? "text-zinc-500/85"
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

        {desktop && (
          <div className="fixed top-4 right-4 z-[100]">
            <div className="theme-nav flex items-center gap-1 rounded-2xl border px-2 py-1 backdrop-blur-md">
              <button
                onClick={() => getCurrentWindow().minimize()}
                className="flex h-8 w-10 items-center justify-center rounded-xl text-zinc-500 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                <RiSubtractLine size={18} />
              </button>

              <button
                onClick={() => getCurrentWindow().toggleMaximize()}
                className="flex h-8 w-10 items-center justify-center rounded-xl text-zinc-500 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                <RiCheckboxBlankLine size={10} />
              </button>

              <button
                onClick={() => getCurrentWindow().close()}
                className="flex h-8 w-10 items-center justify-center rounded-xl text-zinc-500 transition-all duration-200 hover:bg-red-600 hover:text-white"
              >
                <RiCloseLine size={18} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
