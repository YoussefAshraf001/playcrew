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
} from "react-icons/fa";
import { GiGamepad } from "react-icons/gi";
import { MdExplore, MdMusicNote, MdMusicOff } from "react-icons/md";
import { useState, useMemo, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import { GiTrophiesShelf } from "react-icons/gi";
import SearchModal from "./SearchModal";
import NotificationBell from "./NotificationBell";
import { useGames } from "@/app/context/GameContext";

export default function Navbar() {
  const { profile, user, loading } = useUser();
  const games = useGames();

  const newUserImage = user?.photoURL;
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  const { playerVisible, togglePlayerVisible } = useMusic();

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navItems = [
    { href: "/dashboard", icon: FaHome, label: "Dashboard" },
    { href: "/explore", icon: MdExplore, label: "Explore" },
    { href: "/games", icon: GiGamepad, label: "My Games" },
    { href: "/calendar", icon: FaCalendarAlt, label: "Calendar" },
    { href: "/shelf", icon: GiTrophiesShelf, label: "Shelf" },
    {
      href: null,
      icon: FaSearch,
      label: "Search",
      onClick: () => setSearchModalOpen(true),
    },
  ];

  const handleLogout = async () => {
    if (!user) return;
    await auth.signOut();
    window.location.href = "/login";
  };

  const now = new Date();

  const monthGames = useMemo(() => {
    return games
      .map((g) => {
        const d = g.igdb?.releaseDate;
        if (!d) return null;

        const date =
          d?.toDate?.() ??
          (typeof d === "number" ? new Date(d * 1000) : new Date(d));

        return { ...g, date };
      })
      .filter(
        (g): g is typeof g & { date: Date } =>
          !!g &&
          g.date.getMonth() === now.getMonth() &&
          g.date.getFullYear() === now.getFullYear(),
      );
  }, [games]);

  useEffect(() => {
    setAvatarLoaded(false);
  }, [profile?.avatarBase64]);

  return (
    <>
      <motion.nav
        className="
  fixed top-0 left-6 right-6 z-50
  bg-black/20 backdrop-blur-md
  border-b-3 border-cyan-600
  border-x
  shadow-xl
  px-6 py-1
  flex items-center justify-center lg:justify-between
  text-white
  transition-colors duration-300
  hover:bg-black/80
  rounded-b-2xl
"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* LEFT: Logo */}
        <div className="hidden lg:flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="PlayCrew" className="w-11 h-8" />
            <span className="text-white text-2xl font-semibold uppercase tracking-wider">
              Play<span className="text-cyan-300 font-black">Crew</span>
            </span>
          </Link>
        </div>
        {/* CENTER: Nav links */}
        <div className="flex items-center gap-4">
          {navItems.map(({ href, icon: Icon, label, onClick }, index) => {
            const shiftRight =
              hoveredIndex !== null && index > hoveredIndex ? 100 : 0;

            return (
              <motion.div
                key={label}
                className="relative flex items-center"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                animate={{ x: shiftRight }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              >
                {href ? (
                  <Link
                    href={href}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition relative z-10 cursor-pointer"
                  >
                    <Icon className="text-xl" />
                  </Link>
                ) : (
                  <button
                    onClick={onClick}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition relative z-10 cursor-pointer"
                  >
                    <Icon className="text-xl" />
                  </button>
                )}

                <AnimatePresence>
                  {hoveredIndex === index && (
                    <motion.span
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 12 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 25,
                      }}
                      className="absolute left-full top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-sm px-3 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-50"
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
        <div className="hidden lg:flex items-center gap-4 relative">
          <NotificationBell games={monthGames} />

          <motion.button
            onClick={togglePlayerVisible}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`flex items-center px-3 py-1 rounded-full font-semibold border border-zinc-600 cursor-pointer select-none transition-colors duration-300 ${
              playerVisible
                ? "bg-linear-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,255,255,0.5)]"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {playerVisible ? (
              <MdMusicNote size={20} />
            ) : (
              <MdMusicOff size={20} />
            )}
          </motion.button>

          {profile ? (
            <div
              className="relative cursor-pointer"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <div className="relative w-8 h-8">
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
                  src={profile.avatarBase64 || newUserImage}
                  alt="Profile"
                  onLoad={() => setAvatarLoaded(true)}
                  className={`
      w-8 h-8 rounded-full object-cover cursor-pointer
      border-2 border-zinc-700
      transition-opacity duration-300
      ${avatarLoaded ? "opacity-100" : "opacity-0"}
    `}
                />
              </div>

              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50 flex flex-col"
                  >
                    <Link
                      href={`/profile/${profile.username}`}
                      className="px-4 py-2 hover:bg-zinc-800 transition flex items-center gap-2"
                    >
                      <FaCog /> Settings
                    </Link>
                    <button
                      onClick={() => setShowLogoutModal(true)}
                      className="px-4 py-2 text-left hover:bg-red-600 transition flex items-center gap-2"
                    >
                      <FaSignOutAlt /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : loading ? (
            <div className="w-8 h-8 rounded-full border border-cyan-500 bg-zinc-700 animate-pulse" />
          ) : (
            // --- USER NOT LOGGED IN ---
            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => setAccountOpen(!accountOpen)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold bg-zinc-800 text-zinc-300 border border-zinc-600 hover:bg-zinc-700 cursor-pointer select-none"
              >
                <FaUser size={16} />
              </motion.button>

              {/* DROPDOWN */}
              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-[-24] mt-34 w-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50 text-sm text-center"
                  >
                    <Link href="/login" passHref>
                      <motion.div
                        whileHover={{
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                        }}
                        className="block px-4 py-2 items-center gap-2 cursor-pointer"
                      >
                        Log In
                      </motion.div>
                      {/* Divider */}
                      <hr className="w-full border-zinc-700" />
                    </Link>

                    <Link href="/signup" passHref>
                      <motion.div
                        whileHover={{
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                        }}
                        className="block px-4 py-2 items-center gap-2 cursor-pointer"
                      >
                        Sign Up
                      </motion.div>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.nav>
      {typeof window !== "undefined" &&
        createPortal(
          <ConfirmModal
            open={showLogoutModal}
            title=""
            message="Are you sure you want to log out?"
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

//////////////////////////////////////SIDEBAR//////////////////////////////////////
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
// } from "react-icons/fa";
// import { MdExplore, MdMusicOff } from "react-icons/md";
// import { useState } from "react";
// import ConfirmModal from "./ConfirmModal";
// import { GiTrophiesShelf } from "react-icons/gi";
// import SearchModal from "./SearchModal";

// export default function Navbar() {
//   const { profile, user, loading } = useUser();
//   const { togglePlayerVisible, currentTrack, isPlaying } = useMusic();
//   const showAlbum = currentTrack && isPlaying;

//   const [searchModalOpen, setSearchModalOpen] = useState(false);
//   const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
//   const [accountOpen, setAccountOpen] = useState(false);
//   const [showLogoutModal, setShowLogoutModal] = useState(false);

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

//   return (
//     <>
//       {/* ================= SIDEBAR ================= */}
//       <motion.nav
//         initial={{ x: -40, opacity: 0 }}
//         animate={{ x: 0, opacity: 1 }}
//         transition={{ duration: 0.4, ease: "easeOut" }}
//         className="
//     fixed left-10 top-1/2 -translate-y-1/2 z-50
//     h-[820px] w-16
//     bg-black/30 backdrop-blur-md
//     border border-cyan-600/40
//     shadow-2xl
//     py-4
//     flex flex-col items-center justify-between
//     text-white
//     transition-colors duration-300
//     hover:bg-black/80
//     rounded-[999px]
//   "
//       >
//         {/* ===== TOP ===== */}
//         <Link
//           href="/dashboard"
//           className="w-10 h-10 flex items-center justify-center mb-10"
//         >
//           <img src="/logo.png" alt="PlayCrew" className="w-10 h-8" />
//         </Link>

//         {/* ===== CENTER ===== */}
//         <div className="flex flex-col items-center gap-4 flex-1">
//           {navItems.map(({ href, icon: Icon, label, onClick }, index) => (
//             <div
//               key={label}
//               className="relative w-full flex justify-center"
//               onMouseEnter={() => setHoveredIndex(index)}
//               onMouseLeave={() => setHoveredIndex(null)}
//             >
//               {href ? (
//                 <Link
//                   href={href}
//                   className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
//                 >
//                   <Icon size={20} />
//                 </Link>
//               ) : (
//                 <button
//                   onClick={onClick}
//                   className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition"
//                 >
//                   <Icon size={20} />
//                 </button>
//               )}

//               <AnimatePresence>
//                 {hoveredIndex === index && (
//                   <motion.span
//                     initial={{ opacity: 0, x: -6 }}
//                     animate={{ opacity: 1, x: 10 }}
//                     exit={{ opacity: 0, x: -6 }}
//                     className="absolute left-14 bg-zinc-800 px-3 py-1 rounded text-sm shadow-lg whitespace-nowrap z-50"
//                   >
//                     {label}
//                   </motion.span>
//                 )}
//               </AnimatePresence>
//             </div>
//           ))}
//         </div>

//         {/* ===== BOTTOM ===== */}
//         <div className="flex flex-col items-center gap-4">
//           <button
//             onClick={togglePlayerVisible}
//             className="w-10 h-10 relative rounded-full overflow-hidden flex items-center justify-center transition"
//           >
//             {showAlbum && currentTrack.cover ? (
//               // Vinyl-like spinning album art
//               <div className="w-full h-full rounded-full relative animate-spin-slow">
//                 <img
//                   src={currentTrack.cover}
//                   alt={currentTrack.title}
//                   className="w-full h-full object-cover rounded-full"
//                 />

//                 {/* Center hole */}
//                 <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-black rounded-full -translate-x-1/2 -translate-y-1/2 border border-zinc-700" />
//               </div>
//             ) : (
//               // Default icon if no track is playing
//               <MdMusicOff size={18} className="relative z-10 text-white" />
//             )}
//           </button>

//           {profile ? (
//             <div className="relative">
//               <img
//                 src={profile.avatarBase64 || user?.photoURL || ""}
//                 className="w-9 h-9 rounded-full cursor-pointer border border-zinc-600"
//                 onClick={() => setAccountOpen(!accountOpen)}
//               />

//               <AnimatePresence>
//                 {accountOpen && (
//                   <motion.div
//                     initial={{ opacity: 0, y: 6 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     exit={{ opacity: 0, y: 6 }}
//                     className="absolute left-14 bottom-0 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50"
//                   >
//                     <Link
//                       href={`/profile/${user?.displayName}`}
//                       className="px-4 py-2 flex items-center gap-2 hover:bg-zinc-800"
//                     >
//                       <FaCog /> Settings
//                     </Link>
//                     <button
//                       onClick={() => setShowLogoutModal(true)}
//                       className="px-4 py-2 flex items-center gap-2 w-full text-left text-red-400 hover:bg-red-600 hover:text-white"
//                     >
//                       <FaSignOutAlt /> Logout
//                     </button>
//                   </motion.div>
//                 )}
//               </AnimatePresence>
//             </div>
//           ) : loading ? (
//             <div className="w-9 h-9 rounded-full bg-zinc-700 animate-pulse" />
//           ) : (
//             <Link
//               href="/login"
//               className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
//             >
//               <FaUser size={18} />
//             </Link>
//           )}
//         </div>
//       </motion.nav>

//       {/* ================= LOGOUT CONFIRM ================= */}
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

//       {/* --- SEARCH MODAL --- */}
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
