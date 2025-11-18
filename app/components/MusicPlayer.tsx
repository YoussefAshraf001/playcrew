import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { IoRepeat } from "react-icons/io5";
import { HiVolumeUp } from "react-icons/hi";

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
  } = useMusic();

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ y: 200, opacity: 0 }}
      animate={{
        y: playerVisible ? 0 : 200,
        opacity: playerVisible ? 1 : 0,
      }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="
        fixed bottom-4 left-1/2 -translate-x-1/2
        w-[520px] px-4 py-3
        bg-zinc-900/90 backdrop-blur-lg
        rounded-xl border border-zinc-700 shadow-lg
        z-50
      "
    >
      {/* TOP SECTION */}
      <div className="flex items-center justify-between w-full">
        {/* Song Info with fade animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentTrack.title}-${currentTrack.artist}`}
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
              // Vinyl Look
              // <div className="relative w-12 h-12">
              //   <img
              //     src={currentTrack.cover}
              //     className={`w-full h-full rounded-full object-cover shadow-md animate-[spin_10s_linear_infinite]`}
              //   />
              //   <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              // </div>
            )}
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-sm font-semibold truncate max-w-[200px]">
                {currentTrack.title}
              </span>
              <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                {currentTrack.artist || "Unknown Artist"}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Controls (constant) */}
        <div className="flex items-center gap-3">
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

          <button
            onClick={toggleRepeat}
            className={`transition ${
              isRepeating ? "text-green-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            <IoRepeat size={18} />
          </button>

          {/* Small inline volume */}
          <div className="flex items-center gap-2 ml-2 opacity-90">
            <HiVolumeUp size={14} className="text-zinc-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 h-1 rounded-full slider-thumb-sm cursor-pointer"
              style={{
                background: `linear-gradient(to right, #22c55e ${
                  volume * 100
                }%, #6b7280 ${volume * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        className="
          w-full h-2 mt-3 cursor-pointer
          bg-zinc-700/70 rounded-full relative
        "
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seek(pct * duration);
        }}
      >
        <div
          className="h-2 bg-green-500 rounded-full transition-all"
          style={{
            width: duration ? `${(progress / duration) * 100}%` : "0%",
          }}
        />
      </div>
    </motion.div>
  );
}

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { motion } from "framer-motion";
// import { useMusic } from "../context/MusicContext";
// import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
// import { FaPauseCircle } from "react-icons/fa";
// import { FaCirclePlay } from "react-icons/fa6";

// export default function MusicPlayer() {
//   const {
//     currentTrack,
//     isPlaying,
//     togglePlay,
//     playNext,
//     playPrev,
//     progress,
//     duration,
//     seek,
//     playerVisible,
//   } = useMusic();

//   const titleRef = useRef<HTMLDivElement>(null);
//   const artistRef = useRef<HTMLDivElement>(null);

//   if (!currentTrack) return null;

//   return (
//     <motion.div
//       initial={{ y: 200, opacity: 0 }}
//       animate={{
//         y: playerVisible ? 0 : 200,
//         opacity: playerVisible ? 1 : 0,
//       }}
//       transition={{ duration: 0.4, ease: "easeInOut" }}
//       className={`fixed w-83 py-2 px-4 bottom-3 right-[42.2%] z-50 bg-zinc-900 rounded-xl shadow-xl border border-zinc-700 ${
//         !playerVisible ? "pointer-events-none" : ""
//       }`}
//     >
//       <div className="flex items-center gap-3">
//         {currentTrack.cover && (
//           <img
//             src={currentTrack.cover}
//             alt={currentTrack.title}
//             className="w-12 h-12 rounded-md object-cover shadow-md"
//           />
//         )}
//         <div className="flex flex-col overflow-hidden">
//           <div ref={titleRef} className="font-semibold whitespace-nowrap">
//             {currentTrack.title}
//           </div>
//           <div
//             ref={artistRef}
//             className="text-sm text-zinc-400 whitespace-nowrap"
//           >
//             {currentTrack.artist || "Unknown Artist"}
//           </div>
//         </div>
//       </div>

//       {/* Progress Bar */}
//       <div
//         className="w-full h-2 bg-zinc-700 rounded-full cursor-pointer mt-3 relative"
//         onClick={(e) => {
//           const rect = e.currentTarget.getBoundingClientRect();
//           const clickX = e.clientX - rect.left;
//           const clampedX = Math.max(0, Math.min(clickX, rect.width));
//           const seekTime = (clampedX / rect.width) * duration;
//           seek(seekTime);
//         }}
//       >
//         <div
//           className="h-2 bg-cyan-500 rounded-full"
//           style={{
//             width: duration ? `${(progress / duration) * 100}%` : "0%",
//           }}
//         />
//       </div>

//       {/* Controls */}
//       <div className="flex items-center justify-between mt-3">
//         <button
//           onClick={playPrev}
//           className="text-zinc-400 hover:text-white transition"
//         >
//           <MdSkipPrevious size={28} />
//         </button>
//         <button
//           onClick={togglePlay}
//           className="text-cyan-500 hover:scale-110 transition-transform"
//         >
//           {isPlaying ? <FaPauseCircle size={28} /> : <FaCirclePlay size={28} />}
//         </button>
//         <button
//           onClick={playNext}
//           className="text-zinc-400 hover:text-white transition"
//         >
//           <MdSkipNext size={28} />
//         </button>
//       </div>
//     </motion.div>
//   );
// }
