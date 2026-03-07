//////////////////////////////////////SIDEBAR v2.0//////////////////////////////////////
// "use client";

// import { auth } from "@/app/lib/firebase";
// import { useUser } from "../context/UserContext";
// import { useMusic } from "../context/MusicContext";
// import Link from "next/link";
// import { AnimatePresence, motion } from "framer-motion";
// import { createPortal } from "react-dom";
// import {
//   FaHome,
//   FaGamepad,
//   FaSignOutAlt,
//   FaCog,
//   FaSearch,
//   FaUser,
//   FaCalendarAlt,
//   FaBars,
// } from "react-icons/fa";
// import { MdExplore, MdMusicOff } from "react-icons/md";
// import { GiTrophiesShelf } from "react-icons/gi";
// import { useState } from "react";

// import ConfirmModal from "./ConfirmModal";
// import SearchModal from "./SearchModal";

// /* ───────────────── Constants ───────────────── */

// const SIDEBAR_CLASSES = `
//   h-[820px] w-16
//   bg-black/30 backdrop-blur-md
//   border border-cyan-600/40
//   shadow-2xl
//   py-4
//   flex flex-col items-center justify-between
//   text-white
//   transition-colors duration-300
//   hover:bg-black/80
//   rounded-[999px]
// `;

// /* ───────────────── Component ───────────────── */

// export default function Navbar() {
//   const { profile, user, loading } = useUser();
//   const { togglePlayerVisible, currentTrack, isPlaying } = useMusic();
//   const showAlbum = currentTrack && isPlaying;

//   const [searchModalOpen, setSearchModalOpen] = useState(false);
//   const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
//   const [accountOpen, setAccountOpen] = useState(false);
//   const [showLogoutModal, setShowLogoutModal] = useState(false);
//   const [mobileOpen, setMobileOpen] = useState(false);

//   const navItems = [
//     { href: "/dashboard", icon: FaHome, label: "Dashboard" },
//     { href: "/explore", icon: MdExplore, label: "Explore" },
//     { href: "/games", icon: FaGamepad, label: "My Games" },
//     { href: "/calendar", icon: FaCalendarAlt, label: "Calendar" },
//     { href: "/shelf", icon: GiTrophiesShelf, label: "Shelf" },
//     {
//       href: null,
//       icon: FaSearch,
//       label: "Search",
//       onClick: () => setSearchModalOpen(true),
//     },
//   ];

//   const handleLogout = async () => {
//     if (!user) return;
//     await auth.signOut();
//     window.location.href = "/login";
//   };

//   /* ───────────────── Sidebar Content (shared) ───────────────── */

//   const SidebarContent = () => (
//     <>
//       {/* TOP */}
//       <Link
//         href="/dashboard"
//         className="w-10 h-10 flex items-center justify-center mb-10"
//       >
//         <img src="/logo.png" alt="PlayCrew" className="w-10 h-8" />
//       </Link>

//       {/* CENTER */}
//       <div className="flex flex-col items-center gap-4 flex-1">
//         {navItems.map(({ href, icon: Icon, label, onClick }, index) => (
//           <div
//             key={label}
//             className="relative w-full flex justify-center"
//             onMouseEnter={() => setHoveredIndex(index)}
//             onMouseLeave={() => setHoveredIndex(null)}
//           >
//             {href ? (
//               <Link
//                 href={href}
//                 className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
//                 onClick={() => setMobileOpen(false)}
//               >
//                 <Icon size={20} />
//               </Link>
//             ) : (
//               <button
//                 onClick={() => {
//                   onClick?.();
//                   setMobileOpen(false);
//                 }}
//                 className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
//               >
//                 <Icon size={20} />
//               </button>
//             )}

//             {/* Tooltip (desktop only) */}
//             <AnimatePresence>
//               {hoveredIndex === index && (
//                 <motion.span
//                   initial={{ opacity: 0, x: -6 }}
//                   animate={{ opacity: 1, x: 10 }}
//                   exit={{ opacity: 0, x: -6 }}
//                   className="hidden lg:block absolute left-14 bg-zinc-800 px-3 py-1 rounded text-sm shadow-lg whitespace-nowrap z-50"
//                 >
//                   {label}
//                 </motion.span>
//               )}
//             </AnimatePresence>
//           </div>
//         ))}
//       </div>

//       {/* BOTTOM */}
//       <div className="flex flex-col items-center gap-4">
//         {/* Music */}
//         <button
//           onClick={togglePlayerVisible}
//           className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
//         >
//           {showAlbum && currentTrack?.cover ? (
//             <div className="w-full h-full rounded-full animate-spin-slow">
//               <img
//                 src={currentTrack.cover}
//                 alt={currentTrack.title}
//                 className="w-full h-full object-cover rounded-full"
//               />
//             </div>
//           ) : (
//             <MdMusicOff size={18} />
//           )}
//         </button>

//         {/* Account */}
//         {profile ? (
//           <div className="relative">
//             <img
//               src={profile.avatarBase64 || user?.photoURL || ""}
//               className="w-9 h-9 rounded-full cursor-pointer border border-zinc-600"
//               onClick={() => setAccountOpen(!accountOpen)}
//             />

//             <AnimatePresence>
//               {accountOpen && (
//                 <motion.div
//                   initial={{ opacity: 0, y: 6 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: 6 }}
//                   className="absolute left-14 bottom-0 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50"
//                 >
//                   <Link
//                     href={`/profile/${user?.displayName}`}
//                     className="px-4 py-2 flex items-center gap-2 hover:bg-zinc-800"
//                   >
//                     <FaCog /> Settings
//                   </Link>
//                   <button
//                     onClick={() => setShowLogoutModal(true)}
//                     className="px-4 py-2 flex items-center gap-2 w-full text-left text-red-400 hover:bg-red-600 hover:text-white"
//                   >
//                     <FaSignOutAlt /> Logout
//                   </button>
//                 </motion.div>
//               )}
//             </AnimatePresence>
//           </div>
//         ) : loading ? (
//           <div className="w-9 h-9 rounded-full bg-zinc-700 animate-pulse" />
//         ) : (
//           <Link
//             href="/login"
//             className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800"
//           >
//             <FaUser size={18} />
//           </Link>
//         )}
//       </div>
//     </>
//   );

//   /* ───────────────── Render ───────────────── */

//   return (
//     <>
//       {/* MOBILE TOGGLE */}
//       <button
//         className="sm:hidden fixed top-4 left-4 z-50 bg-black/50 backdrop-blur-md p-3 rounded-full border border-cyan-600/40"
//         onClick={() => setMobileOpen(true)}
//       >
//         <FaBars />
//       </button>

//       {/* DESKTOP SIDEBAR */}
//       <motion.nav
//         initial={{ x: -40, opacity: 0 }}
//         animate={{ x: 0, opacity: 1 }}
//         transition={{ duration: 0.4 }}
//         className={`hidden sm:flex fixed left-10 top-1/2 -translate-y-1/2 z-40 ${SIDEBAR_CLASSES}`}
//       >
//         <SidebarContent />
//       </motion.nav>

//       {/* MOBILE OVERLAY — SAME SIDEBAR */}
//       <AnimatePresence>
//         {mobileOpen && (
//           <>
//             {/* Blur backdrop */}
//             <motion.div
//               className="fixed inset-0 bg-black/40 backdrop-blur-md z-40"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               onClick={() => setMobileOpen(false)}
//             />

//             {/* Sidebar */}
//             <motion.nav
//               initial={{ x: -120 }}
//               animate={{ x: 0 }}
//               exit={{ x: -120 }}
//               transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
//               className={`fixed left-6 top-1/2 -translate-y-1/2 z-50 ${SIDEBAR_CLASSES}`}
//             >
//               <SidebarContent />
//             </motion.nav>
//           </>
//         )}
//       </AnimatePresence>

//       {/* LOGOUT CONFIRM */}
//       {typeof window !== "undefined" &&
//         createPortal(
//           <ConfirmModal
//             open={showLogoutModal}
//             title=""
//             message="Are you sure you want to log out?"
//             confirmText="Logout"
//             cancelText="Cancel"
//             onCancel={() => setShowLogoutModal(false)}
//             onConfirm={handleLogout}
//           />,
//           document.body,
//         )}

//       {/* SEARCH MODAL */}
//       <AnimatePresence>
//         {searchModalOpen && (
//           <SearchModal
//             isOpen={searchModalOpen}
//             onClose={() => setSearchModalOpen(false)}
//           />
//         )}
//       </AnimatePresence>
//     </>
//   );
// }

//////////////////////////////////////NAVBAR//////////////////////////////////////
"use client";

import { auth } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { useMusic } from "../context/MusicContext";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  FaHome,
  FaSignOutAlt,
  FaCog,
  FaSearch,
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
import { MdExplore, MdMusicNote, MdMusicOff } from "react-icons/md";
import { useState, useEffect, useRef } from "react";
import ConfirmModal from "./ConfirmModal";
import { GiTrophiesShelf } from "react-icons/gi";
import SearchModal from "./SearchModal";
import NotificationBell from "./NotificationBell";
import { useGames } from "@/app/context/GameContext";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModal } from "../context/AuthModalContext";
import { CiLogin } from "react-icons/ci";
import { useUI } from "../context/UIContext";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const isDashboard = pathname.includes("/dashboard");
  const { open } = useAuthModal();
  const { startRouteLoading } = useUI();
  const { profile, user, loading } = useUser();

  const { games } = useGames();

  const newUserImage = user?.photoURL;
  const [avatarLoaded, setAvatarLoaded] = useState(false);

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
    { href: "/games", icon: GiGamepad, label: "My Games" },
    { href: "/calendar", icon: FaCalendarAlt, label: "Calendar" },
    { href: "/shelf", icon: GiTrophiesShelf, label: "Shelf" },
    { href: "/screenshots", icon: FaImages, label: "Screenshots" },
    {
      href: null,
      icon: FaSearch,
      label: "Search",
      onClick: () => setSearchModalOpen(true),
    },
  ];
  const mobileMainLabels = ["Dashboard", "My Games", "Calendar", "Screenshots"];
  const mobileExtraLabels = ["Explore", "Shelf"];
  const mobileMainItems = navItems.filter((item) =>
    mobileMainLabels.includes(item.label),
  );
  const mobileExtraItems = navItems.filter((item) =>
    mobileExtraLabels.includes(item.label),
  );
  const mobileSearchItem = navItems.find((item) => item.label === "Search");

  const handleLogout = async () => {
    if (!user) return;
    await auth.signOut();
    startRouteLoading();
    router.push("/dashboard");
  };

  useEffect(() => {
    setAvatarLoaded(false);
  }, [profile?.avatar?.data]);

  useEffect(() => {
    setHoveredIndex(null);
  }, [pathname]);

  useEffect(() => {
    const update = () => {
      setEnableDesktopHoverNav(window.innerWidth >= 1024);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
    if (searchModalOpen || showLogoutModal) {
      setAccountOpen(false);
    }
  }, [searchModalOpen, showLogoutModal]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    closePlayer();
  }, [mobileMenuOpen, closePlayer]);

  return (
    <>
      {!isDashboard && (
        <motion.nav
          className="
  fixed top-0 left-2 right-2 sm:left-4 sm:right-4 lg:left-6 lg:right-6 z-90
  bg-black/20 backdrop-blur-md
  border-b-3 border-cyan-600
  border-x
  shadow-xl
  px-2 sm:px-3 md:px-4 lg:px-6 py-1.5
  flex items-center justify-between
  text-white
  transition-colors duration-300
  hover:bg-black/80
  rounded-b-xl sm:rounded-b-2xl
"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex w-full items-center justify-between sm:hidden">
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="PlayCrew" className="h-7 w-9" />
              <span className="text-base font-semibold uppercase tracking-[0.08em] text-white">
                Play<span className="text-cyan-300 font-black">Crew</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-900/70 text-zinc-100 transition hover:bg-zinc-800"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
          {/* LEFT: Logo */}
          <div className="hidden xl:flex items-center shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="PlayCrew" className="w-11 h-8" />
              <span className="text-white text-2xl font-semibold uppercase tracking-wider">
                Play<span className="text-cyan-300 font-black">Crew</span>
              </span>
            </Link>
          </div>
          {/* CENTER: Nav links */}
          <div className="hidden min-w-0 flex-1 items-center justify-start gap-1.5 overflow-x-auto px-1 sm:flex sm:justify-center sm:gap-2 md:gap-2.5 lg:gap-4">
            {navItems.map(({ href, icon: Icon, label, onClick }, index) => {
              return (
                <motion.div
                  key={label}
                  className="relative flex items-center"
                  onMouseEnter={() => {
                    if (enableDesktopHoverNav) setHoveredIndex(index);
                  }}
                  onMouseLeave={() => {
                    if (enableDesktopHoverNav) setHoveredIndex(null);
                  }}
                  animate={{ x: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="w-9 h-9 sm:w-10 sm:h-10 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition relative z-10 cursor-pointer shrink-0"
                    >
                      <Icon className="text-base sm:text-lg" />
                    </Link>
                  ) : (
                    <button
                      onClick={onClick}
                      className="w-9 h-9 sm:w-10 sm:h-10 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition relative z-10 cursor-pointer shrink-0"
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
                        className="absolute left-full top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white shadow-lg pointer-events-none lg:block"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
          {/* RIGHT: Player + Account */}
          <div className="relative ml-1 hidden shrink-0 items-center gap-1.5 sm:ml-2 sm:flex sm:gap-2 lg:ml-4 lg:gap-4">
            <div className="hidden md:block">
              <NotificationBell games={games} />
            </div>

            <motion.button
              data-music-toggle="true"
              onClick={togglePlayerVisible}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`hidden h-8 w-10.5 cursor-pointer select-none items-center justify-center rounded-full border transition-all duration-300 md:flex ${
                playerVisible
                  ? "border-cyan-300/60 bg-white/10 text-white shadow-[0_0_18px_rgba(125,211,252,0.35)]"
                  : "border-white/15 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800/85"
              }`}
            >
              {playerVisible ? (
                <MdMusicNote className="text-sm" />
              ) : (
                <MdMusicOff className="text-sm" />
              )}
            </motion.button>

            {profile ? (
              <div className="relative" ref={accountMenuRef}>
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
                  {/* Skeleton */}
                  <div
                    className={`
    absolute inset-0 rounded-full bg-zinc-700
    transition-opacity duration-300
    ${avatarLoaded ? "opacity-0" : "opacity-100"}
  `}
                  />

                  {/* Avatar */}
                  <img
                    src={profile.avatar?.data || newUserImage}
                    alt="Profile"
                    onLoad={() => setAvatarLoaded(true)}
                    className={`
      w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover cursor-pointer
      border-2 border-zinc-700
      transition-opacity duration-300
      ${avatarLoaded ? "opacity-100" : "opacity-0"}
    `}
                  />
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-full mt-2 w-36 sm:w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50 flex flex-col text-sm"
                    >
                      <Link
                        href={`/profile/${profile.username}`}
                        onClick={() => setAccountOpen(false)}
                        className="px-4 py-2 hover:bg-zinc-800 transition flex items-center gap-2"
                      >
                        <FaCog /> Settings
                      </Link>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          setShowLogoutModal(true);
                        }}
                        className="px-4 py-2 text-left hover:bg-red-600 transition flex items-center gap-2"
                      >
                        <FaSignOutAlt /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : loading ? (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-cyan-500 bg-zinc-700 animate-pulse" />
            ) : (
              // --- USER NOT LOGGED IN ---
              <div className="flex items-center" ref={accountMenuRef}>
                <motion.button
                  onClick={() =>
                    setAccountOpen((prev) => {
                      const next = !prev;
                      if (next) closePlayer();
                      return next;
                    })
                  }
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full font-semibold bg-zinc-800 text-zinc-300 border border-zinc-600 hover:bg-zinc-700 cursor-pointer select-none"
                >
                  <FaUser className="text-xs sm:text-sm" />
                </motion.button>

                {/* DROPDOWN */}
                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-white/12 bg-[#0a0d12]/96 p-1 text-sm shadow-[0_14px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                    >
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          open("login");
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-zinc-100 transition-all duration-150 hover:border-cyan-400/25 hover:bg-cyan-500/8"
                      >
                        <span className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/15 text-cyan-200">
                          <CiLogin className="text-[15px]" />
                        </span>
                        <span className="font-semibold tracking-wide">Log In</span>
                      </button>

                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          open("signup");
                        }}
                        className="mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-zinc-100 transition-all duration-150 hover:border-cyan-400/25 hover:bg-cyan-500/8"
                      >
                        <span className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/15 text-cyan-200">
                          <FaUserPlus className="text-[13px]" />
                        </span>
                        <span className="font-semibold tracking-wide">Sign Up</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.nav>
      )}
      <AnimatePresence>
        {mobileMenuOpen && !isDashboard && (
          <>
            <motion.button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-1300 bg-black/55 sm:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Close mobile menu"
            />
            <motion.aside
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed left-2 right-2 top-14 z-1310 rounded-2xl border border-cyan-500/25 bg-[#09090b]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:hidden"
            >
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Main
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {mobileMainItems.map(
                    ({ href, icon: Icon, label, onClick }) =>
                      href ? (
                        <Link
                          key={`mobile-main-${label}`}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
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
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                        >
                          <Icon className="text-sm" />
                          {label}
                        </button>
                      ),
                  )}
                </div>
                <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Explore
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {mobileExtraItems.map(
                    ({ href, icon: Icon, label, onClick }) =>
                      href ? (
                        <Link
                          key={`mobile-extra-${label}`}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
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
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                        >
                          <Icon className="text-sm" />
                          {label}
                        </button>
                      ),
                  )}
                </div>
                {mobileSearchItem && (
                  <button
                    type="button"
                    onClick={() => {
                      mobileSearchItem.onClick?.();
                      setMobileMenuOpen(false);
                    }}
                    className="inline-flex h-10 w-full items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                  >
                    <mobileSearchItem.icon className="text-sm" />
                    Search
                  </button>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-zinc-900/50 p-2.5">
                <NotificationBell games={games} fullWidthTrigger />
              </div>
              <div className="mt-3 rounded-xl border border-white/12 bg-zinc-900/65 p-2.5">
                <div className="mb-2 flex items-center gap-2.5">
                  {currentTrack?.cover ? (
                    <img
                      src={currentTrack.cover}
                      alt={currentTrack.title ?? "Track artwork"}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-white">
                      {currentTrack?.title ?? "No track loaded"}
                    </p>
                    <p className="truncate text-[10px] text-zinc-300">
                      {Array.isArray(currentTrack?.artist)
                        ? currentTrack.artist.join(", ")
                        : (currentTrack?.artist ?? "PlayCrew Radio")}
                    </p>
                  </div>
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:bg-black/55"
                    aria-label={volume > 0.001 ? "Mute" : "Unmute"}
                  >
                    {volume > 0.001 ? (
                      <FaVolumeUp size={12} />
                    ) : (
                      <FaVolumeMute size={12} />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={playPrev}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-white/20 bg-black/35 text-white transition hover:bg-black/55"
                    aria-label="Previous track"
                  >
                    <FaStepBackward size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-500/15 text-cyan-100 transition hover:bg-cyan-500/25"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <FaPause size={11} /> : <FaPlay size={11} />}
                  </button>
                  <button
                    type="button"
                    onClick={playNext}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-white/20 bg-black/35 text-white transition hover:bg-black/55"
                    aria-label="Next track"
                  >
                    <FaStepForward size={11} />
                  </button>
                </div>
              </div>
              {profile ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={`/profile/${profile.username}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                  >
                    <FaCog size={12} />
                    Settings
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      open("login");
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900/75 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
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
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                  >
                    <FaUserPlus size={12} />
                    Sign Up
                  </button>
                </div>
              )}
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
