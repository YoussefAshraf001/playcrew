"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMusic } from "@/app/context/MusicContext";
import AboutPanel from "@/app/components/mainMenu/AboutPanel";
import { FaGamepad, FaLaptopCode, FaPalette } from "react-icons/fa";
import { HiLightningBolt } from "react-icons/hi";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 15,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function AboutPage() {
  const [expanded, setExpanded] = useState(false);

  const { currentTrack, isPlaying } = useMusic();
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then(setTracks);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--theme-bg)] text-white">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.15),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.85))]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-10">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-4xl border border-white/10 bg-white/[0.03]"
        >
          <div className="p-12 md:p-16">
            <p className="uppercase tracking-[0.45em] text-cyan-300 text-xs">
              PlayCrew Archive
            </p>

            <h1 className="mt-4 text-5xl md:text-7xl font-black leading-none">
              Every Game
              <br />
              Leaves A Mark
            </h1>

            <p className="mt-6 max-w-2xl text-zinc-400 text-lg">
              Track your gaming journey, preserve your memories, discover
              upcoming releases, and build a collection that grows with you.
            </p>
          </div>
        </motion.section>

        {/* ABOUT */}
        <AboutPanel
          containerVariants={containerVariants}
          itemVariants={itemVariants}
          onClose={() => {}}
        />

        {/* SOUNDTRACK */}
        <motion.section
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-white/10 bg-white/[0.03] overflow-hidden"
        >
          <div className="border-b border-white/10 p-8">
            <p className="uppercase tracking-[0.3em] text-cyan-300 text-xs">
              Soundtrack
            </p>

            <h2 className="mt-3 text-4xl font-black">The Music Of PlayCrew</h2>

            <p className="mt-3 text-zinc-400 max-w-2xl">
              Music featured throughout PlayCrew. Metadata is pulled directly
              from the audio files.
            </p>
          </div>

          <div className="p-6">
            <div className="rounded-3xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_160px_100px] px-6 py-4 text-xs uppercase tracking-widest text-zinc-500 border-b border-white/10">
                <span>#</span>
                <span>Track</span>
                <span>Collection</span>
                <span>Length</span>
              </div>

              {tracks.length > 0 ? (
                tracks.map((track: any, index: number) => (
                  <motion.div
                    key={track.id}
                    whileHover={{ x: 4 }}
                    className={`grid grid-cols-[50px_1fr] items-center gap-4 px-6 py-3 border-b border-white/5 transition-all duration-200 ${
                      currentTrack?.src === track.src
                        ? "bg-cyan-500/10"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Number / Playing */}
                    <div className="flex justify-center">
                      {currentTrack?.src === track.src && isPlaying ? (
                        <div className="flex gap-[2px] items-end h-4">
                          <span className="music-bar" />
                          <span className="music-bar" />
                          <span className="music-bar" />
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-sm">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    {/* Song */}
                    <div className="flex items-center gap-3 min-w-0">
                      {track.cover ? (
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          🎵
                        </div>
                      )}

                      <div className="min-w-0">
                        <p
                          className={`truncate font-medium ${
                            currentTrack?.src === track.src
                              ? "text-cyan-300"
                              : "text-white"
                          }`}
                        >
                          {track.title}
                        </p>

                        <p className="text-sm text-zinc-500 truncate">
                          {Array.isArray(track.artist)
                            ? track.artist.join(", ")
                            : track.artist || "Unknown Artist"}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-12 text-center text-zinc-500">
                  No soundtrack data available.
                </div>
              )}
            </div>

            <p className="mt-5 text-xs text-zinc-500">
              All music belongs to its respective copyright owners. PlayCrew
              does not claim ownership of any audio assets.
            </p>
          </div>
        </motion.section>

        {/* DEVELOPER */}
        <motion.section
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-white/10 bg-white/[0.03] overflow-hidden"
        >
          <div className="p-8 border-b border-white/10">
            <p className="uppercase tracking-[0.3em] text-cyan-300 text-xs">
              Developer
            </p>

            <h2 className="mt-3 text-4xl font-black">Meet The Creator</h2>
          </div>

          <motion.div
            layout
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer"
          >
            <div className="relative group overflow-hidden">
              <img
                src="/dev.jpg"
                alt="Developer"
                className="h-[500px] w-full object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute inset-0 flex items-end p-10">
                <div>
                  <h3 className="text-5xl font-black">Youssef Ashraf</h3>

                  <p className="text-cyan-300 mt-2">
                    Founder, Designer & Developer
                  </p>
                </div>
              </div>

              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-black/60 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="space-y-2 text-zinc-300">
                    <p className="flex items-center gap-2">
                      <FaLaptopCode className="text-blue-400" />
                      Software Engineer
                    </p>

                    <p className="flex items-center gap-2">
                      <FaGamepad className="text-green-400" />
                      Game Collector
                    </p>

                    <p className="flex items-center gap-2">
                      <FaPalette className="text-pink-400" />
                      UI Enjoyer
                    </p>

                    <p className="flex items-center gap-2">
                      <HiLightningBolt className="text-yellow-400" />
                      Click To Learn More
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{
                    height: 0,
                    opacity: 0,
                  }}
                  animate={{
                    height: "auto",
                    opacity: 1,
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="p-10">
                    <p className="text-lg leading-relaxed text-zinc-300 max-w-4xl">
                      PlayCrew started as a personal project built around one
                      idea: game tracking should feel as enjoyable as gaming
                      itself.
                      <br />
                      <br />
                      What began as a simple collection manager evolved into a
                      platform focused on preserving memories, screenshots,
                      reviews, progression, statistics, release tracking,
                      profiles, music and everything that makes gaming personal.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4 mt-10">
                      <div className="rounded-2xl border border-white/10 p-6">
                        <div className="text-3xl mb-2">🎮</div>
                        <p className="font-semibold">RPG Enjoyer</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 p-6">
                        <div className="text-3xl mb-2">💻</div>
                        <p className="font-semibold">Front-end Developer</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 p-6">
                        <div className="text-3xl mb-2">🎨</div>
                        <p className="font-semibold">UI Perfectionist</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* FOOTER */}
        <div className="text-center py-8 text-zinc-500">
          <p>
            Built with Next.js, Firebase, Tauri and questionable sleep
            schedules.
          </p>
          <p className="mt-2 text-sm">© 2026 PlayCrew</p>
        </div>
      </div>
    </main>
  );
}
