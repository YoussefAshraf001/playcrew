"use client";

import { auth } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaHome,
  FaGamepad,
  FaSignOutAlt,
  FaRegImages,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { MdExplore, MdMusicNote, MdMusicOff } from "react-icons/md";
import Image from "next/image";
import { useMusic } from "../context/MusicContext";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const { profile, loading, user } = useUser();
  // const [collapsed, setCollapsed] = useState(true);

  const { playerVisible, togglePlayerVisible } = useMusic();

  const navItems = [
    { href: "/dashboard", icon: FaHome, label: "Dashboard" },
    { href: "/explore", icon: MdExplore, label: "Explore" },
    { href: "/games", icon: FaGamepad, label: "Games" },
    { href: "#screenshots", icon: FaRegImages, label: "Screenshots" },
  ];

  const handleLogout = async () => {
    if (!user) return;
    await auth.signOut();
    window.location.href = "/login";
  };

  return (
    <motion.aside
      className={`fixed bg-[#0f0f11] text-white border border-zinc-800 shadow-lg origin-top z-50 overflow-hidden transition-all duration-500 ${
        collapsed ? "w-20" : "w-64"
      }`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "calc(100vh)", opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.42, 0, 0.58, 1] }}
    >
      <div className="flex flex-col justify-between h-full pt-8">
        {/* Top Section */}
        <div>
          <div className="flex flex-col px-4">
            <div className="relative mb-8 h-16 flex items-center">
              <motion.img
                src="/logo.png"
                alt="PlayCrew Logo"
                width={60}
                height={60}
                className="absolute"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    key="logo-text"
                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="ml-20 text-3xl font-bold text-cyan-500"
                  >
                    PlayCrew
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}

          <nav className="flex flex-col gap-2 px-2">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`relative group ${
                  collapsed && "justify-center"
                } p-3 rounded-xl flex items-center gap-4 hover:bg-zinc-800 transition-all duration-300`}
              >
                <Icon className="text-2xl" />

                {collapsed ? (
                  <AnimatePresence>
                    <motion.span
                      key={label}
                      initial={{ opacity: 0, x: -10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -10, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="absolute left-full top-1/2 -translate-y-1/2 bg-black text-white px-2 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none text-sm font-medium"
                    >
                      {label}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="text-sm font-medium"
                  >
                    {label}
                  </motion.span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Section */}
        {profile ? (
          <div className="flex flex-col items-center gap-3 text-center pb-4">
            <div className="flex flex-col gap-2 w-full px-3">
              {/* Mute / Unmute Button */}
              <div
                className={`${
                  collapsed ? "flex flex-col" : "flex"
                } w-full justify-center gap-2`}
              >
                {/* Toggle Player Visibility */}
                <button
                  onClick={togglePlayerVisible}
                  className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    playerVisible
                      ? "border-2 border-cyan-600 hover:bg-cyan-600"
                      : "border-2 border-zinc-500 hover:bg-zinc-600"
                  } ${collapsed ? "hover:scale-110" : "hover:scale-125"}`}
                >
                  {playerVisible ? (
                    <MdMusicNote className="text-xl" />
                  ) : (
                    <MdMusicOff className="text-xl" />
                  )}
                </button>

                {/* Collapse Button */}
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 border-2 border-cyan-600 hover:bg-cyan-600 ${
                    collapsed ? "hover:scale-110" : "hover:scale-125"
                  }`}
                >
                  {collapsed ? (
                    <FaChevronRight className="text-xl" />
                  ) : (
                    <FaChevronLeft className="text-xl" />
                  )}
                </button>
              </div>

              <Link
                href={`/profile/${profile.username}`}
                className="flex items-center gap-3 my-1 p-2"
              >
                {profile.avatarBase64 ? (
                  <Image
                    src={profile.avatarBase64}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full cursor-pointer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-cyan-500 bg-cyan-600 flex items-center justify-center text-white font-semibold cursor-pointer">
                    {profile.username}
                  </div>
                )}
                {!collapsed && (
                  <span className="text-sm font-medium">
                    {profile.username}
                  </span>
                )}
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="group p-3 rounded-xl bg-zinc-800 hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-3 w-full"
              >
                <FaSignOutAlt className="text-xl" />
                {!collapsed && <span className="text-sm">Logout</span>}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 mt-4 text-center">
            <div className="w-8 h-8 rounded-full border border-cyan-500 bg-zinc-700 animate-pulse" />
          </div>
        ) : null}
      </div>
    </motion.aside>
  );
}

// "use client";

// import { auth } from "@/app/lib/firebase";
// import { useUser } from "../context/UserContext";

// import Link from "next/link";
// import { AnimatePresence, motion } from "framer-motion";
// import {
//   FaHome,
//   FaGamepad,
//   FaSignOutAlt,
//   FaRegImages,
//   FaChevronLeft,
//   FaChevronRight,
// } from "react-icons/fa";
// import { MdExplore, MdMusicNote, MdMusicOff } from "react-icons/md";
// import Image from "next/image";
// import { useState } from "react";
// import { useMusic } from "../context/MusicContext";

// export default function Sidebar() {
//   const { profile, loading, user } = useUser();
//   const [collapsed, setCollapsed] = useState(true);

//   const { playerVisible, togglePlayerVisible } = useMusic();

//   const navItems = [
//     { href: "/dashboard", icon: FaHome, label: "Dashboard" },
//     { href: "/explore", icon: MdExplore, label: "Explore" },
//     { href: "/games", icon: FaGamepad, label: "Games" },
//     { href: "#screenshots", icon: FaRegImages, label: "Screenshots" },
//   ];

//   const handleLogout = async () => {
//     if (!user) return;
//     await auth.signOut();
//     window.location.href = "/login";
//   };

//   return (
//     <motion.aside
//       className={`fixed bg-[#0f0f11] text-white border border-zinc-800 shadow-lg origin-top z-50 overflow-hidden transition-all duration-500 ${
//         collapsed ? "w-20" : "w-64"
//       }`}
//       initial={{ height: 0, opacity: 0 }}
//       animate={{ height: "calc(100vh)", opacity: 1 }}
//       transition={{ duration: 0.8, ease: [0.42, 0, 0.58, 1] }}
//     >
//       <div className="flex flex-col justify-between h-full pt-8">
//         {/* Top Section */}
//         <div>
//           <div className="flex flex-col px-4">
//             <div className="relative mb-8 h-16 flex items-center">
//               <motion.img
//                 src="/logo.png"
//                 alt="PlayCrew Logo"
//                 width={60}
//                 height={60}
//                 className="absolute"
//                 initial={{ scale: 0.95, opacity: 0 }}
//                 animate={{ scale: 1, opacity: 1 }}
//                 transition={{ type: "spring", stiffness: 300, damping: 20 }}
//               />

//               <AnimatePresence>
//                 {!collapsed && (
//                   <motion.span
//                     key="logo-text"
//                     initial={{ opacity: 0, x: -10, scale: 0.95 }}
//                     animate={{ opacity: 1, x: 0, scale: 1 }}
//                     exit={{ opacity: 0, x: -10, scale: 0.95 }}
//                     transition={{ type: "spring", stiffness: 300, damping: 20 }}
//                     className="ml-20 text-3xl font-bold text-cyan-500"
//                   >
//                     PlayCrew
//                   </motion.span>
//                 )}
//               </AnimatePresence>
//             </div>
//           </div>

//           {/* Navigation */}

//           <nav className="flex flex-col gap-2 px-2">
//             {navItems.map(({ href, icon: Icon, label }) => (
//               <Link
//                 key={href}
//                 href={href}
//                 className={`relative group ${
//                   collapsed && "justify-center"
//                 } p-3 rounded-xl flex items-center gap-4 hover:bg-zinc-800 transition-all duration-300`}
//               >
//                 <Icon className="text-2xl" />

//                 {collapsed ? (
//                   <AnimatePresence>
//                     <motion.span
//                       key={label}
//                       initial={{ opacity: 0, x: -10, scale: 0.95 }}
//                       animate={{ opacity: 1, x: 0, scale: 1 }}
//                       exit={{ opacity: 0, x: -10, scale: 0.95 }}
//                       transition={{
//                         type: "spring",
//                         stiffness: 300,
//                         damping: 20,
//                       }}
//                       className="absolute left-full top-1/2 -translate-y-1/2 bg-black text-white px-2 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none text-sm font-medium"
//                     >
//                       {label}
//                     </motion.span>
//                   </AnimatePresence>
//                 ) : (
//                   <motion.span
//                     whileHover={{ scale: 1.05 }}
//                     transition={{ type: "spring", stiffness: 300, damping: 20 }}
//                     className="text-sm font-medium"
//                   >
//                     {label}
//                   </motion.span>
//                 )}
//               </Link>
//             ))}
//           </nav>
//         </div>

//         {/* Bottom Section */}
//         {profile ? (
//           <div className="flex flex-col items-center gap-3 text-center pb-4">
//             <div className="flex flex-col gap-2 w-full px-3">
//               {/* Mute / Unmute Button */}
//               <div
//                 className={`${
//                   collapsed ? "flex flex-col" : "flex"
//                 } w-full justify-center gap-2`}
//               >
//                 {/* Toggle Player Visibility */}
//                 <button
//                   onClick={togglePlayerVisible}
//                   className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 ${
//                     playerVisible
//                       ? "border-2 border-cyan-600 hover:bg-cyan-600"
//                       : "border-2 border-zinc-500 hover:bg-zinc-600"
//                   } ${collapsed ? "hover:scale-110" : "hover:scale-125"}`}
//                 >
//                   {playerVisible ? (
//                     <MdMusicNote className="text-xl" />
//                   ) : (
//                     <MdMusicOff className="text-xl" />
//                   )}
//                 </button>

//                 {/* Collapse Button */}
//                 <button
//                   onClick={() => setCollapsed(!collapsed)}
//                   className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 border-2 border-cyan-600 hover:bg-cyan-600 ${
//                     collapsed ? "hover:scale-110" : "hover:scale-125"
//                   }`}
//                 >
//                   {collapsed ? (
//                     <FaChevronRight className="text-xl" />
//                   ) : (
//                     <FaChevronLeft className="text-xl" />
//                   )}
//                 </button>
//               </div>

//               <Link
//                 href={`/profile/${profile.username}`}
//                 className="flex items-center gap-3 my-1 p-2"
//               >
//                 {profile.avatarBase64 ? (
//                   <Image
//                     src={profile.avatarBase64}
//                     alt="Profile"
//                     width={32}
//                     height={32}
//                     className="rounded-full cursor-pointer"
//                   />
//                 ) : (
//                   <div className="w-8 h-8 rounded-full border border-cyan-500 bg-cyan-600 flex items-center justify-center text-white font-semibold cursor-pointer">
//                     {profile.username}
//                   </div>
//                 )}
//                 {!collapsed && (
//                   <span className="text-sm font-medium">
//                     {profile.username}
//                   </span>
//                 )}
//               </Link>

//               {/* Logout */}
//               <button
//                 onClick={handleLogout}
//                 className="group p-3 rounded-xl bg-zinc-800 hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-3 w-full"
//               >
//                 <FaSignOutAlt className="text-xl" />
//                 {!collapsed && <span className="text-sm">Logout</span>}
//               </button>
//             </div>
//           </div>
//         ) : loading ? (
//           <div className="flex flex-col items-center gap-3 mt-4 text-center">
//             <div className="w-8 h-8 rounded-full border border-cyan-500 bg-zinc-700 animate-pulse" />
//           </div>
//         ) : null}
//       </div>
//     </motion.aside>
//   );
// }
