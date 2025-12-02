import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { IoRepeat } from "react-icons/io5";
import { HiVolumeUp } from "react-icons/hi";
import MarqueeText from "./MarqueeText";

export default function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    progress,
    duration,
    seek,
    playerVisible,
    volume,
    setVolume,
    isRepeating,
    toggleRepeat,
    isLoadingTrack,
  } = useMusic();

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ x: 200, opacity: 0 }}
      animate={{
        x: playerVisible ? 0 : 200,
        opacity: playerVisible ? 1 : 0,
        pointerEvents: playerVisible ? "auto" : "none",
      }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="
    fixed top-17 right-[-140px] -translate-x-1/2
    w-[300px] px-4 py-3
    bg-zinc-900/90 backdrop-blur-lg
    rounded-xl border border-zinc-700 shadow-lg
    z-50
  "
    >
      {/* TOP SECTION */}
      <div className="flex flex-col items-center w-full gap-4">
        {/* Song Info (skeleton OR real data) */}
        <AnimatePresence mode="wait">
          {!isLoadingTrack ? (
            <motion.div
              key="trackLoaded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 min-w-0"
            >
              {currentTrack.cover && (
                <img
                  src={currentTrack.cover}
                  className="w-12 h-12 rounded-md object-cover shadow-md"
                />
              )}

              <div className="flex flex-col min-w-0 leading-tight">
                <MarqueeText
                  text={currentTrack.title ?? ""}
                  className="text-sm font-semibold"
                />

                <MarqueeText
                  text={
                    Array.isArray(currentTrack.artist)
                      ? currentTrack.artist.join(", ")
                      : currentTrack.artist ?? ""
                  }
                  className="text-xs text-zinc-400"
                />
              </div>
            </motion.div>
          ) : (
            // SKELETON
            <motion.div
              key="trackSkeleton"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 min-w-0 animate-pulse"
            >
              <div className="w-12 h-12 bg-zinc-700/60 rounded-md" />

              <div className="flex flex-col gap-2">
                <div className="w-32 h-3 bg-zinc-700/60 rounded" />
                <div className="w-24 h-3 bg-zinc-700/50 rounded" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTROLS */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={playPrev}
              className="text-zinc-400 hover:text-white transition"
            >
              <MdSkipPrevious size={22} />
            </button>

            <button
              onClick={togglePlay}
              className="p-2 bg-green-500 hover:bg-green-400 text-black rounded-full transition"
            >
              {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} />}
            </button>

            <button
              onClick={playNext}
              className="text-zinc-400 hover:text-white transition"
            >
              <MdSkipNext size={22} />
            </button>
          </div>

          {/* VOLUME */}
          <div className="flex flex-col items-center gap-3 opacity-90">
            <div className="flex items-center gap-2">
              <HiVolumeUp size={15} className="text-zinc-400" />

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 h-2 rounded-full slider-thumb-sm cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #22c55e ${
                    volume * 100
                  }%, #6b7280 ${volume * 100}%)`,
                }}
              />
            </div>

            <motion.div
              layout
              transition={{
                layout: { duration: 0.55, ease: "easeInOut" },
                scale: { duration: 0.2 },
              }}
              whileTap={{ scale: 0.5 }}
              className={`inline-flex items-center cursor-pointer rounded-xl px-4 transition-colors duration-300 ${
                isRepeating
                  ? "text-white bg-green-400"
                  : "border-2 border-green-400 text-zinc-400 hover:text-white"
              }`}
              onClick={toggleRepeat}
            >
              <IoRepeat size={18} />
              <span className="ml-2">
                {isRepeating ? "Repeating" : "Repeating OFF"}
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        className="
          w-full h-2 mt-3 cursor-pointer
          bg-zinc-700/70 rounded-full relative overflow-hidden
        "
        onClick={(e) => {
          if (isLoadingTrack) return; // disable during skeleton
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seek(pct * duration);
        }}
      >
        <div
          className={`h-2 rounded-full transition-all ${
            isLoadingTrack ? "bg-zinc-600 animate-pulse" : "bg-green-500"
          }`}
          style={{
            width: isLoadingTrack
              ? "30%"
              : duration
              ? `${(progress / duration) * 100}%`
              : "0%",
          }}
        />
      </div>
    </motion.div>
  );
}
