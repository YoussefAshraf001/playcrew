"use client";

import { auth } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { useMusic } from "../context/MusicContext";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  FaHome,
  FaGamepad,
  FaSignOutAlt,
  FaCog,
  FaSearch,
  FaUser,
} from "react-icons/fa";
import { MdExplore, MdMusicNote, MdMusicOff } from "react-icons/md";
import { useState, useEffect, useRef } from "react";
import ConfirmModal from "./ConfirmModal";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

export default function Navbar() {
  const { profile, user, loading } = useUser();

  const newUserImage = user?.photoURL;

  const { playerVisible, togglePlayerVisible } = useMusic();

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navItems = [
    { href: "/dashboard", icon: FaHome, label: "Dashboard" },
    { href: "/explore", icon: MdExplore, label: "Explore" },
    { href: "/games", icon: FaGamepad, label: "My Games" },
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

  // --- Search fetch ---
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoadingSearch(true);

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(
          `https://api.rawg.io/api/games?key=${API_KEY}&search=${query}&page_size=20`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setResults(data.results || []);
        console.log(data);
      } catch (err) {
        if ((err as any).name === "AbortError") return;
        console.error(err);
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [query]);

  const isExpanded = query.trim().length > 0;

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
            <span className=" text-white text-2xl">
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
          <motion.button
            onClick={togglePlayerVisible}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`flex items-center gap-2 px-3 py-1 rounded-full font-semibold border border-zinc-600 cursor-pointer select-none transition-colors duration-300 ${
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
            <span>Music</span>
          </motion.button>

          {profile ? (
            <div
              className="relative"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <img
                src={profile.avatarBase64! || (user && newUserImage)}
                alt="Profile"
                width={32}
                height={32}
                className="rounded-full cursor-pointer border-3 border-zinc-700"
              />

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
                      href={`/profile/${user.displayName}`}
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
        {/* --- SEARCH MODAL --- */}
        {typeof window !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {searchModalOpen && (
                <motion.div
                  key="overlay"
                  className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-md flex items-center justify-center px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    key="modal"
                    className="bg-[#1e1e1e] rounded-lg overflow-hidden p-4 w-full max-w-lg flex flex-col"
                    initial={false}
                    animate={{
                      height: isExpanded ? 600 : 120,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 28,
                    }}
                  >
                    <button
                      className="self-end text-white text-2xl font-bold mb-2"
                      onClick={() => {
                        setSearchModalOpen(false);
                        setQuery("");
                      }}
                    >
                      &times;
                    </button>

                    <input
                      type="text"
                      value={query}
                      placeholder="Search a game..."
                      onChange={(e) => setQuery(e.target.value)}
                      className="bg-[#2a2a2a] text-center text-white rounded-full px-4 py-2 w-full outline-none mb-2"
                    />

                    <div
                      className={`flex flex-col gap-2  ${
                        isExpanded
                          ? "overflow-y-auto custom-scrollbar"
                          : "overflow-hidden"
                      } p-2`}
                    >
                      {loadingSearch
                        ? Array.from({ length: 9 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-12 w-full bg-zinc-700 animate-pulse rounded"
                            />
                          ))
                        : results.map((game) => (
                            <motion.div
                              key={game.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                            >
                              <Link
                                href={`/game/${game.id}`}
                                onClick={() => setSearchModalOpen(false)}
                                className="group relative block h-20 rounded-lg overflow-hidden transition"
                              >
                                {/* Background image */}
                                <img
                                  src={game.background_image}
                                  alt={game.name}
                                  className="absolute inset-0 w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-300"
                                />

                                {/* Dark gradient overlay */}
                                <div className="absolute inset-0 bg-linear-to-r from-black via-black/50 to-black/10" />

                                {/* Content */}
                                <div className="relative z-10 flex flex-col justify-center h-full px-3">
                                  <span className="text-white text-md font-semibold leading-tight line-clamp-1">
                                    {game.name}
                                  </span>

                                  {game.released && (
                                    <span className="text-white/60 text-sm tracking-wide">
                                      {new Date(game.released).getFullYear()}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </motion.div>
                          ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
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
          document.body
        )}
    </>
  );
}
