"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/app/lib/firebase";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  FaHome,
  FaSignOutAlt,
  FaCog,
  FaSearch,
  FaExclamation,
  FaUser,
  FaCalendarAlt,
  FaUserPlus,
  FaImages,
  FaBars,
  FaTimes,
  FaPlay,
  FaPause,
  FaStepBackward,
  FaStepForward,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { GiGamepad } from "react-icons/gi";
import {
  MdAutoAwesome,
  MdExplore,
  MdMusicNote,
  MdMusicOff,
} from "react-icons/md";
import { GiTrophiesShelf } from "react-icons/gi";
import { CiLogin } from "react-icons/ci";

import { useGames } from "@/app/context/GameContext";
import { useUser } from "../context/UserContext";
import { useMusic } from "../context/MusicContext";
import { useUI } from "../context/UIContext";
import { useAuthModal } from "../context/AuthModalContext";
import ConfirmModal from "./ConfirmModal";
import SearchModal from "./SearchModal";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const isDashboard = pathname.includes("/dashboard");
  const { open } = useAuthModal();
  const { startRouteLoading, navbarLayout } = useUI();
  const { profile, user, loading } = useUser();

  const { games } = useGames();

  const newUserImage = user?.photoURL;
  const avatarSrc = profile?.avatar?.data || newUserImage || "";
  const [loadedAvatarSrc, setLoadedAvatarSrc] = useState<string | null>(null);
  const avatarLoaded = !avatarSrc || loadedAvatarSrc === avatarSrc;

  const {
    playerVisible,
    togglePlayerVisible,
    closePlayer,
    currentTrack,
    isPlaying,
    togglePlay,
    playPrev,
    playNext,
    volume,
    setVolume,
  } = useMusic();

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [updatesModalOpen, setUpdatesModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [enableDesktopHoverNav, setEnableDesktopHoverNav] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const lastVolumeRef = useRef(0.5);

  const navItems = [
    { href: "/dashboard", icon: FaHome, label: "Dashboard" },
    { href: "/explore", icon: MdExplore, label: "Explore" },
    { href: "/for-you", icon: MdAutoAwesome, label: "For You" },
    { href: "/games", icon: GiGamepad, label: "My Games" },
    { href: "/calendar", icon: FaCalendarAlt, label: "Releases Calendar" },
    {
      href: "/playcrewawards",
      icon: GiTrophiesShelf,
      label: "PlayCrew Awards",
    },
    { href: "/screenshots", icon: FaImages, label: "Screenshots" },
    {
      href: null,
      icon: FaSearch,
      label: "Search",
      onClick: () => {
        setAccountOpen(false);
        setSearchModalOpen(true);
      },
    },
  ];
  const mobileMainLabels = ["Dashboard", "My Games", "Calendar", "Screenshots"];
  const mobileExtraLabels = ["Explore", "For You", "Shelf"];
  const mobileMainItems = navItems.filter((item) =>
    mobileMainLabels.includes(item.label),
  );
  const mobileExtraItems = navItems.filter((item) =>
    mobileExtraLabels.includes(item.label),
  );
  const mobileSearchItem = navItems.find((item) => item.label === "Search");
  const MobileSearchIcon = mobileSearchItem?.icon ?? null;
  const utilityHoverOffset = navItems.length;

  const accountHoverSpanClass =
    navbarLayout === "top"
      ? "theme-panel-strong absolute right-full top-1/2 z-[100] mr-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
      : "theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none";

  const accountHoverX = navbarLayout === "top" ? -12 : 12;

  const handleLogout = async () => {
    if (!user) return;
    await auth.signOut();
    startRouteLoading();
    router.push("/dashboard");
  };

  useEffect(() => {
    const update = () => {
      setEnableDesktopHoverNav(window.matchMedia("(hover: hover)").matches);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    // Clear any hovered nav label when the route changes
    setHoveredIndex(null);
  }, [pathname]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    closePlayer();
  }, [mobileMenuOpen, closePlayer]);

  return (
    <>
      {!isDashboard && (
        <>
          <motion.nav
            className="
              fixed top-0 left-0 right-0 z-90
              theme-nav backdrop-blur-md
              border-b-3 border-x
              px-3 py-1.5
              flex items-center justify-between
              transition-colors duration-300
              rounded-b-xl
              lg:hidden
            "
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex w-full items-center justify-between">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2"
              >
                <img src="/logo.png" alt="PlayCrew" className="h-7 w-9" />
                <span className="theme-text text-base font-semibold uppercase tracking-[0.08em]">
                  Play<span className="theme-accent-text font-black">Crew</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="theme-surface theme-hover-surface inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
          </motion.nav>

          <AnimatePresence mode="sync" initial={false}>
            {navbarLayout === "sidebar" ? (
              <motion.nav
                key="sidebar"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{
                  duration: 0.25,
                  ease: "easeInOut",
                }}
                className="
                  theme-nav fixed left-4 top-1/2 z-90
                  hidden -translate-y-1/2
                  rounded-[999px] border px-2 py-4
                  shadow-[0_24px_60px_rgba(0,0,0,0.38)]
                  backdrop-blur-md overflow-visible
                  lg:flex lg:w-16 lg:flex-col lg:items-center
                "
              >
                <Link
                  href="/dashboard"
                  className="mb-9 inline-flex h-10 w-10 items-center justify-center"
                >
                  <img src="/logo.png" alt="PlayCrew" className="h-8 w-10" />
                </Link>

                <div className="flex flex-1 flex-col items-center gap-3">
                  {navItems.map(
                    ({ href, icon: Icon, label, onClick }, index) => (
                      <motion.div
                        key={label}
                        className={`relative flex items-center ${
                          enableDesktopHoverNav && hoveredIndex === index
                            ? "z-[90]"
                            : "z-10"
                        }`}
                        onMouseEnter={() => {
                          if (enableDesktopHoverNav) setHoveredIndex(index);
                        }}
                        onMouseLeave={() => {
                          if (enableDesktopHoverNav) setHoveredIndex(null);
                        }}
                        animate={{ x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 25,
                        }}
                      >
                        {href ? (
                          <Link
                            href={href}
                            className="theme-hover-surface flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition"
                          >
                            <Icon className="text-lg" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={onClick}
                            className="theme-hover-surface flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition"
                          >
                            <Icon className="text-lg" />
                          </button>
                        )}

                        <AnimatePresence>
                          {enableDesktopHoverNav && hoveredIndex === index && (
                            <motion.span
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 12 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                            >
                              {label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ),
                  )}
                </div>

                <div className="mt-9 flex flex-col items-center gap-3">
                  <div className="hidden flex-col items-center gap-2 lg:flex">
                    <div
                      className={`relative flex items-center ${
                        enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 1
                          ? "z-[90]"
                          : "z-10"
                      }`}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 1);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <NotificationBell
                        games={games}
                        compactPanelAnchor="right-center"
                      />
                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 1 && (
                            <motion.span
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 12 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                            >
                              Notifications
                            </motion.span>
                          )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div
                    className={`relative hidden items-center lg:flex ${
                      enableDesktopHoverNav &&
                      hoveredIndex === utilityHoverOffset + 2
                        ? "z-[90]"
                        : "z-10"
                    }`}
                    onMouseEnter={() => {
                      if (enableDesktopHoverNav) {
                        setHoveredIndex(utilityHoverOffset + 2);
                      }
                    }}
                    onMouseLeave={() => {
                      if (enableDesktopHoverNav) {
                        setHoveredIndex(null);
                      }
                    }}
                  >
                    <motion.button
                      data-music-toggle="true"
                      onClick={togglePlayerVisible}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={`hidden h-8 w-8 cursor-pointer select-none items-center justify-center rounded-full border transition-all duration-300 lg:flex ${
                        playerVisible
                          ? "theme-accent-soft-bg shadow-[0_0_18px_rgba(var(--theme-accent-rgb),0.35)]"
                          : "theme-surface theme-hover-surface"
                      }`}
                    >
                      {playerVisible ? (
                        <MdMusicNote className="text-sm" />
                      ) : (
                        <MdMusicOff className="text-sm" />
                      )}
                    </motion.button>
                    <AnimatePresence>
                      {enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 2 && (
                          <motion.span
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 12 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 25,
                            }}
                            className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                          >
                            Music
                          </motion.span>
                        )}
                    </AnimatePresence>
                  </div>

                  {profile ? (
                    <div
                      className={`relative top-0.5 ${
                        enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 3
                          ? "z-[90]"
                          : "z-10"
                      }`}
                      ref={accountMenuRef}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 3);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountOpen((prev) => {
                            const next = !prev;
                            if (next) closePlayer();
                            return next;
                          });
                        }}
                        className="relative h-7 w-7 cursor-pointer sm:h-8 sm:w-8"
                        aria-label="Account menu"
                      >
                        <div
                          className={`
                          absolute inset-0 rounded-full bg-zinc-700
                          theme-surface-alt transition-opacity duration-300
                          ${avatarLoaded ? "opacity-0" : "opacity-100"}
                        `}
                        />
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt="Profile"
                            onLoad={() => setLoadedAvatarSrc(avatarSrc)}
                            className={`
                            h-7 w-7 rounded-full object-cover cursor-pointer
                            theme-avatar-ring border-2 transition-opacity duration-300
                            sm:h-8 sm:w-8
                            ${avatarLoaded ? "opacity-100" : "opacity-0"}
                          `}
                          />
                        ) : (
                          <div
                            className={`
                            h-7 w-7 rounded-full flex items-center justify-center
                            theme-panel theme-text-muted border-2 sm:h-8 sm:w-8
                          `}
                          >
                            <FaUser className="text-xs sm:text-sm" />
                          </div>
                        )}
                      </button>

                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 3 &&
                          !accountOpen && (
                            <motion.span
                              initial={{ opacity: 0, x: accountHoverX }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: accountHoverX }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className={accountHoverSpanClass}
                            >
                              Account
                            </motion.span>
                          )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {accountOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="theme-panel-strong absolute left-full top-1/2 z-50 ml-3 w-52 -translate-y-1/2 overflow-hidden rounded-2xl border p-2 text-sm shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                          >
                            <div className="theme-surface-alt mb-1 rounded-xl border px-3 py-2">
                              <p className="theme-accent-soft-text text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Account
                              </p>
                              <p className="theme-text truncate text-xs font-medium">
                                @{profile.username}
                              </p>
                            </div>

                            <Link
                              href={`/profile/${profile.username}`}
                              onClick={() => setAccountOpen(false)}
                              className="theme-hover-accent theme-text flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
                                <FaUser className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Profile
                              </span>
                            </Link>

                            <Link
                              href="/settings"
                              onClick={() => setAccountOpen(false)}
                              className="theme-hover-accent theme-text mt-0.5 flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
                                <FaCog className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Site Settings
                              </span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                setShowLogoutModal(true);
                              }}
                              className="mt-0.5 flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-red-100 transition-all duration-150 hover:border-red-300/35 hover:bg-red-500/18"
                            >
                              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-300/35 bg-red-500/15 text-red-200">
                                <FaSignOutAlt className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Logout
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : loading ? (
                    <div className="theme-accent-soft-bg h-7 w-7 animate-pulse rounded-full border sm:h-8 sm:w-8" />
                  ) : (
                    <div
                      className="relative flex items-center"
                      ref={accountMenuRef}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 3);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <motion.button
                        type="button"
                        onClick={() =>
                          setAccountOpen((prev) => {
                            const next = !prev;
                            if (next) closePlayer();
                            return next;
                          })
                        }
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className="theme-surface theme-hover-surface flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border font-semibold select-none sm:h-8 sm:w-8"
                      >
                        <FaUser className="text-xs sm:text-sm" />
                      </motion.button>

                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 3 &&
                          !accountOpen && (
                            <motion.span
                              initial={{ opacity: 0, x: accountHoverX }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: accountHoverX }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className={accountHoverSpanClass}
                            >
                              Account
                            </motion.span>
                          )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {accountOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="theme-panel-strong absolute left-full top-1/2 z-50 ml-3 w-44 -translate-y-1/2 overflow-hidden rounded-xl border p-1 text-sm shadow-[0_14px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                open("login");
                              }}
                              className="theme-hover-accent theme-text flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border">
                                <CiLogin className="text-[15px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Log In
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                open("signup");
                              }}
                              className="theme-hover-accent theme-text mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border">
                                <FaUserPlus className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Sign Up
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.nav>
            ) : (
              <motion.nav
                key="top"
                initial={{ opacity: 0, y: -40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.97 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 28,
                }}
                className="theme-nav fixed top-0 left-0 right-0 z-90 hidden items-center justify-between rounded-b-2xl border-b-3 border-x px-3 py-1.5 backdrop-blur-md transition-colors duration-300 sm:flex md:left-4 md:right-4 md:px-4 lg:left-6 lg:right-6 lg:px-6"
              >
                <div className="hidden shrink-0 items-center xl:flex">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <img src="/logo.png" alt="PlayCrew" className="h-8 w-11" />
                    <span className="theme-text text-2xl font-semibold uppercase tracking-wider">
                      Play
                      <span className="theme-accent-text font-black">Crew</span>
                    </span>
                  </Link>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 overflow-visible px-1 sm:justify-center sm:gap-2 md:gap-2.5 lg:gap-4">
                  {navItems.map(
                    ({ href, icon: Icon, label, onClick }, index) => (
                      <motion.div
                        key={label}
                        className={`relative flex items-center ${
                          enableDesktopHoverNav && hoveredIndex === index
                            ? "z-[90]"
                            : "z-10"
                        }`}
                        onMouseEnter={() => {
                          if (enableDesktopHoverNav) setHoveredIndex(index);
                        }}
                        onMouseLeave={() => {
                          if (enableDesktopHoverNav) setHoveredIndex(null);
                        }}
                        animate={{ x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 25,
                        }}
                      >
                        {href ? (
                          <Link
                            href={href}
                            className="theme-hover-surface relative z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition sm:h-10 sm:w-10"
                          >
                            <Icon className="text-base sm:text-lg" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={onClick}
                            className="theme-hover-surface relative z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition sm:h-10 sm:w-10"
                          >
                            <Icon className="text-base sm:text-lg" />
                          </button>
                        )}

                        <AnimatePresence>
                          {enableDesktopHoverNav && hoveredIndex === index && (
                            <motion.span
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 12 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                            >
                              {label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ),
                  )}
                </div>

                <div className="relative ml-1 flex shrink-0 items-center gap-1.5 sm:ml-2 sm:gap-2 lg:ml-4 lg:gap-4">
                  <div className="hidden items-center gap-2 lg:flex">
                    <div
                      className={`relative flex items-center ${
                        enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 1
                          ? "z-[90]"
                          : "z-10"
                      }`}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 1);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <NotificationBell games={games} />
                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 1 && (
                            <motion.span
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 12 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                            >
                              Notifications
                            </motion.span>
                          )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div
                    className={`relative hidden items-center lg:flex ${
                      enableDesktopHoverNav &&
                      hoveredIndex === utilityHoverOffset + 2
                        ? "z-[90]"
                        : "z-10"
                    }`}
                    onMouseEnter={() => {
                      if (enableDesktopHoverNav) {
                        setHoveredIndex(utilityHoverOffset + 2);
                      }
                    }}
                    onMouseLeave={() => {
                      if (enableDesktopHoverNav) {
                        setHoveredIndex(null);
                      }
                    }}
                  >
                    <motion.button
                      data-music-toggle="true"
                      onClick={togglePlayerVisible}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={`hidden h-8 w-8 cursor-pointer select-none items-center justify-center rounded-full border transition-all duration-300 lg:flex ${
                        playerVisible
                          ? "theme-accent-soft-bg shadow-[0_0_18px_rgba(var(--theme-accent-rgb),0.35)]"
                          : "theme-surface theme-hover-surface"
                      }`}
                    >
                      {playerVisible ? (
                        <MdMusicNote className="text-sm" />
                      ) : (
                        <MdMusicOff className="text-sm" />
                      )}
                    </motion.button>
                    <AnimatePresence>
                      {enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 2 && (
                          <motion.span
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 12 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 25,
                            }}
                            className="theme-panel-strong absolute left-full top-1/2 z-[100] ml-2 block -translate-y-1/2 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-lg backdrop-blur-xl pointer-events-none"
                          >
                            Music
                          </motion.span>
                        )}
                    </AnimatePresence>
                  </div>

                  {profile ? (
                    <div
                      className={`relative top-0.5 ${
                        enableDesktopHoverNav &&
                        hoveredIndex === utilityHoverOffset + 3
                          ? "z-[90]"
                          : "z-10"
                      }`}
                      ref={accountMenuRef}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 3);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountOpen((prev) => {
                            const next = !prev;
                            if (next) closePlayer();
                            return next;
                          });
                        }}
                        className="relative h-7 w-7 cursor-pointer sm:h-8 sm:w-8"
                        aria-label="Account menu"
                      >
                        <div
                          className={`
                          absolute inset-0 rounded-full bg-zinc-700
                          theme-surface-alt transition-opacity duration-300
                          ${avatarLoaded ? "opacity-0" : "opacity-100"}
                        `}
                        />
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt="Profile"
                            onLoad={() => setLoadedAvatarSrc(avatarSrc)}
                            className={`
                            h-7 w-7 rounded-full object-cover cursor-pointer
                            theme-avatar-ring border-2 transition-opacity duration-300
                            sm:h-8 sm:w-8
                            ${avatarLoaded ? "opacity-100" : "opacity-0"}
                          `}
                          />
                        ) : (
                          <div
                            className={`
                            h-7 w-7 rounded-full flex items-center justify-center
                            theme-panel theme-text-muted border-2 sm:h-8 sm:w-8
                          `}
                          >
                            <FaUser className="text-xs sm:text-sm" />
                          </div>
                        )}
                      </button>

                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 3 &&
                          !accountOpen && (
                            <motion.span
                              initial={{ opacity: 0, x: accountHoverX }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: accountHoverX }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className={accountHoverSpanClass}
                            >
                              Account
                            </motion.span>
                          )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {accountOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="theme-panel-strong absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border p-2 text-sm shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                          >
                            <div className="theme-surface-alt mb-1 rounded-xl border px-3 py-2">
                              <p className="theme-accent-soft-text text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Account
                              </p>
                              <p className="theme-text truncate text-xs font-medium">
                                @{profile.username}
                              </p>
                            </div>

                            <Link
                              href={`/profile/${profile.username}`}
                              onClick={() => setAccountOpen(false)}
                              className="theme-hover-accent theme-text flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
                                <FaUser className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Profile
                              </span>
                            </Link>

                            <Link
                              href="/settings"
                              onClick={() => setAccountOpen(false)}
                              className="theme-hover-accent theme-text mt-0.5 flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
                                <FaCog className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Site Settings
                              </span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                setShowLogoutModal(true);
                              }}
                              className="mt-0.5 flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-red-100 transition-all duration-150 hover:border-red-300/35 hover:bg-red-500/18"
                            >
                              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-300/35 bg-red-500/15 text-red-200">
                                <FaSignOutAlt className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Logout
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : loading ? (
                    <div className="theme-accent-soft-bg h-7 w-7 animate-pulse rounded-full border sm:h-8 sm:w-8" />
                  ) : (
                    <div
                      className="relative flex items-center"
                      ref={accountMenuRef}
                      onMouseEnter={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(utilityHoverOffset + 3);
                        }
                      }}
                      onMouseLeave={() => {
                        if (enableDesktopHoverNav) {
                          setHoveredIndex(null);
                        }
                      }}
                    >
                      <motion.button
                        type="button"
                        onClick={() =>
                          setAccountOpen((prev) => {
                            const next = !prev;
                            if (next) closePlayer();
                            return next;
                          })
                        }
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className="theme-surface theme-hover-surface flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border font-semibold select-none sm:h-8 sm:w-8"
                      >
                        <FaUser className="text-xs sm:text-sm" />
                      </motion.button>

                      <AnimatePresence>
                        {enableDesktopHoverNav &&
                          hoveredIndex === utilityHoverOffset + 3 &&
                          !accountOpen && (
                            <motion.span
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                              }}
                              className={accountHoverSpanClass}
                            >
                              Account
                            </motion.span>
                          )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {accountOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="theme-panel-strong absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border p-1 text-sm shadow-[0_14px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                open("login");
                              }}
                              className="theme-hover-accent theme-text flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border">
                                <CiLogin className="text-[15px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Log In
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                open("signup");
                              }}
                              className="theme-hover-accent theme-text mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-150"
                            >
                              <span className="theme-accent-soft-bg inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border">
                                <FaUserPlus className="text-[13px]" />
                              </span>
                              <span className="font-semibold tracking-wide">
                                Sign Up
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {mobileMenuOpen && !isDashboard && (
          <>
            <motion.aside
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="theme-panel-strong fixed left-2 right-2 top-14 z-1310 rounded-2xl border p-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)] lg:hidden"
            >
              <div className="space-y-3">
                <div>
                  <p className="theme-text-muted px-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Main
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mobileMainItems.map(
                      ({ href, icon: Icon, label, onClick }) =>
                        href ? (
                          <Link
                            key={`mobile-main-${label}`}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="theme-surface theme-hover-surface theme-text inline-flex h-12 items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition"
                          >
                            <Icon className="text-sm" />
                            {label}
                          </Link>
                        ) : (
                          <button
                            key={`mobile-main-${label}`}
                            type="button"
                            onClick={() => {
                              onClick?.();
                              setMobileMenuOpen(false);
                            }}
                            className="theme-surface theme-hover-surface theme-text inline-flex h-12 items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition"
                          >
                            <Icon className="text-sm" />
                            {label}
                          </button>
                        ),
                    )}
                  </div>
                </div>

                <div>
                  <p className="theme-text-muted px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Explore
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mobileExtraItems.map(
                      ({ href, icon: Icon, label, onClick }) =>
                        href ? (
                          <Link
                            key={`mobile-extra-${label}`}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="theme-surface theme-hover-surface theme-text inline-flex h-12 items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition"
                          >
                            <Icon className="text-sm" />
                            {label}
                          </Link>
                        ) : (
                          <button
                            key={`mobile-extra-${label}`}
                            type="button"
                            onClick={() => {
                              onClick?.();
                              setMobileMenuOpen(false);
                            }}
                            className="theme-surface theme-hover-surface theme-text inline-flex h-12 items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition"
                          >
                            <Icon className="text-sm" />
                            {label}
                          </button>
                        ),
                    )}
                  </div>
                </div>

                <div>
                  {mobileSearchItem && (
                    <button
                      type="button"
                      onClick={() => {
                        mobileSearchItem.onClick?.();
                        setMobileMenuOpen(false);
                      }}
                      className="theme-surface theme-hover-surface theme-text inline-flex h-12 w-full items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition"
                    >
                      {MobileSearchIcon && (
                        <MobileSearchIcon className="text-sm" />
                      )}
                      Search
                    </button>
                  )}
                </div>
              </div>

              <div className="theme-surface mt-3 rounded-lg border p-2.5">
                <NotificationBell games={games} fullWidthTrigger />
              </div>

              <div className="theme-surface mt-3 rounded-xl border p-3">
                <div className="flex items-center gap-4">
                  {currentTrack?.cover ? (
                    <img
                      src={currentTrack.cover}
                      alt={currentTrack.title ?? "Track artwork"}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="theme-surface-alt h-20 w-20 rounded-lg border" />
                  )}

                  <div className="flex-1">
                    <p className="theme-text truncate text-lg font-semibold">
                      {currentTrack?.title ?? "No track loaded"}
                    </p>
                    <p className="theme-text-muted truncate text-sm">
                      {Array.isArray(currentTrack?.artist)
                        ? currentTrack.artist.join(", ")
                        : (currentTrack?.artist ?? "PlayCrew Radio")}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={playPrev}
                        className="theme-surface theme-hover-surface theme-text inline-flex h-12 w-12 items-center justify-center rounded-lg border transition"
                        aria-label="Previous track"
                      >
                        <FaStepBackward size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={togglePlay}
                        className="theme-accent-soft-bg inline-flex h-12 w-12 items-center justify-center rounded-lg border transition hover:bg-cyan-500/25"
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <FaPause size={15} />
                        ) : (
                          <FaPlay size={15} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={playNext}
                        className="theme-surface theme-hover-surface theme-text inline-flex h-12 w-12 items-center justify-center rounded-lg border transition"
                        aria-label="Next track"
                      >
                        <FaStepForward size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (volume > 0.001) {
                            lastVolumeRef.current = volume;
                            setVolume(0);
                            return;
                          }
                          setVolume(
                            Math.max(
                              0.15,
                              Math.min(1, lastVolumeRef.current || 0.5),
                            ),
                          );
                        }}
                        className="theme-surface theme-hover-surface theme-text inline-flex h-12 w-12 items-center justify-center rounded-full border transition"
                        aria-label={volume > 0.001 ? "Mute" : "Unmute"}
                      >
                        {volume > 0.001 ? (
                          <FaVolumeUp size={16} />
                        ) : (
                          <FaVolumeMute size={16} />
                        )}
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="text-sm text-white/70 mb-2 block">
                        Volume
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={typeof volume === "number" ? volume : 0}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full h-2"
                        aria-label="Volume control"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                {profile ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      href={`/profile/${profile.username}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="theme-surface theme-hover-surface theme-text inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
                    >
                      <FaUser size={12} />
                      Profile
                    </Link>

                    <Link
                      href={`/settings`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="theme-surface theme-hover-surface theme-text inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
                    >
                      <FaCog size={12} />
                      Site Settings
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowLogoutModal(true);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-300/35 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    >
                      <FaSignOutAlt size={12} />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        open("login");
                      }}
                      className="theme-surface theme-hover-surface theme-text inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
                    >
                      <CiLogin size={14} />
                      Log In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        open("signup");
                      }}
                      className="theme-accent-soft-bg inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:bg-cyan-500/20"
                    >
                      <FaUserPlus size={12} />
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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

      {/* --- SEARCH MODAL --- */}
      <AnimatePresence>
        {searchModalOpen && (
          <SearchModal
            isOpen={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
