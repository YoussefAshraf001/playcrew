import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { HiVolumeUp } from "react-icons/hi";
import MarqueeText from "./MarqueeText";
import { useRef } from "react";
import { useUI } from "../context/UIContext";
import { TbRepeatOff, TbRepeatOnce } from "react-icons/tb";

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
    playerRef,
    volume,
    setVolume,
    isRepeating,
    toggleRepeat,
    isLoadingTrack,
  } = useMusic();

  const { panelOpen } = useUI();
  const shouldShowPlayer = playerVisible && !panelOpen;

  const volumeRef = useRef<HTMLDivElement | null>(null);

  const handleVolumeChange = (clientX: number) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, pct));
    setVolume(clamped);
  };

  if (!currentTrack) return null;

  return (
    <motion.div
      ref={playerRef}
      initial={{ y: -200, opacity: 0 }}
      animate={{
        y: shouldShowPlayer ? 0 : -200,
        opacity: shouldShowPlayer ? 1 : 0,
        pointerEvents: shouldShowPlayer ? "auto" : "none",
      }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="
    fixed top-[4.5rem] left-1/2 -translate-x-1/2
    md:top-16 md:left-auto md:right-4 md:translate-x-0
    lg:right-6
    w-[min(95vw,34rem)] md:w-[520px]
    px-3 sm:px-4 md:px-6 py-3 md:py-4
    rounded-2xl
    bg-linear-to-br from-[#0b1a24]/95 to-[#071118]/95
    backdrop-blur-xl
    border border-cyan-400/20
    shadow-[0_15px_60px_rgba(0,0,0,0.6)]
    z-50
  "
    >
      {/* TOP SECTION */}
      <div className="flex items-center justify-between w-full gap-3 sm:gap-4 md:gap-6">
        {/* Song Info (skeleton OR real data) */}
        <AnimatePresence mode="wait">
          {!isLoadingTrack ? (
            <motion.div
              key="trackLoaded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 sm:gap-3 min-w-0"
            >
              {currentTrack.cover && (
                <img
                  src={currentTrack.cover}
                  alt={currentTrack.title ?? "Album cover"}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover shadow-md"
                />
              )}

              <div className="flex flex-col min-w-0 max-w-[100px] sm:max-w-[130px] md:max-w-[150px] leading-tight gap-1 sm:gap-1.5">
                <MarqueeText
                  text={currentTrack.title ?? ""}
                  className="text-xs font-semibold"
                />

                <MarqueeText
                  text={
                    Array.isArray(currentTrack.artist)
                      ? currentTrack.artist.join(", ")
                      : (currentTrack.artist ?? "")
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
              className="flex items-center gap-2 sm:gap-3 min-w-0 animate-pulse"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-700/60 rounded-md" />

              <div className="flex flex-col gap-2">
                <div className="w-32 h-3 bg-zinc-700/60 rounded" />
                <div className="w-24 h-3 bg-zinc-700/50 rounded" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTROLS */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
          <button
            onClick={playPrev}
            className="text-zinc-500 hover:text-cyan-400 transition"
          >
              <MdSkipPrevious size={20} />
          </button>

          <button
            onClick={togglePlay}
            className="
              p-2.5 sm:p-3 rounded-full
              bg-cyan-400 text-black
              hover:bg-cyan-300
              transition-all duration-300
              shadow-[0_0_20px_rgba(34,211,238,0.35)]
            "
          >
            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
          </button>

          <button
            onClick={playNext}
            className="text-zinc-500 hover:text-cyan-400 transition"
          >
              <MdSkipNext size={20} />
          </button>
        </div>

        {/* VOLUME + REPEAT */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <HiVolumeUp size={16} className="text-zinc-500" />

            <div
              ref={volumeRef}
              className="relative w-14 sm:w-[4.5rem] md:w-20 h-1.5 bg-[#0f2532] rounded-full cursor-pointer"
              onMouseDown={(e) => {
                handleVolumeChange(e.clientX);

                const move = (ev: MouseEvent) => handleVolumeChange(ev.clientX);
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };

                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              {/* Fill */}
              <div
                className="absolute top-0 left-0 h-1.5 bg-cyan-400 rounded-full transition-none"
                style={{ width: `${volume * 100}%` }}
              />

              {/* Knob */}
              <div
                className="
      absolute top-1/2 -translate-y-1/2
      w-3 h-3 rounded-full
      bg-cyan-400
      shadow-[0_0_12px_rgba(34,211,238,0.7)]
      transition-none
    "
                style={{ left: `calc(${volume * 100}% - 6px)` }}
              />
            </div>
          </div>

          <motion.div
            layout
            whileTap={{ scale: 0.8 }}
            onClick={toggleRepeat}
              className={`
              flex items-center justify-center
              w-8 h-8 sm:w-9 sm:h-9 rounded-xl
              transition-all duration-300 cursor-pointer
              ${
                isRepeating
                  ? "bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  : "border border-cyan-400/30 text-zinc-400 hover:text-cyan-400"
              }
            `}
          >
            {isRepeating ? (
              <TbRepeatOnce size={18} />
            ) : (
              <TbRepeatOff size={18} />
            )}
          </motion.div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        className="
          w-full h-2 mt-4
          bg-[#0f2532]
          rounded-full relative overflow-hidden cursor-pointer
        "
        onClick={(e) => {
          if (isLoadingTrack) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seek(pct * duration);
        }}
      >
        <div
          className="h-2 rounded-full transition-all bg-cyan-400"
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

// import { motion, AnimatePresence } from "framer-motion";
// import { useMusic } from "../context/MusicContext";
// import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
// import { FaPause, FaPlay } from "react-icons/fa";
// import { IoRepeat } from "react-icons/io5";
// import { HiVolumeUp } from "react-icons/hi";
// import MarqueeText from "./MarqueeText";

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
//     playerRef,
//     volume,
//     setVolume,
//     isRepeating,
//     toggleRepeat,
//     isLoadingTrack,
//   } = useMusic();

//   if (!currentTrack) return null;

//   return (
//     <motion.div
//       ref={playerRef}
//       initial={{ y: -200, opacity: 0 }}
//       animate={{
//         y: playerVisible ? 0 : -200,
//         opacity: playerVisible ? 1 : 0,
//         pointerEvents: playerVisible ? "auto" : "none",
//       }}
//       transition={{ duration: 0.35, ease: "easeInOut" }}
//       className="
//           fixed top-6 -right-50 -translate-x-1/2
//           w-[500px] h-[100px] px-4 py-3
//           bg-zinc-900/90 backdrop-blur-lg
//           rounded-xl border border-zinc-700 shadow-lg
//           z-50
//         "
//     >
//       {/* TOP SECTION */}
//       <div className="flex items-center w-full gap-4">
//         {/* Song Info (skeleton OR real data) */}
//         <AnimatePresence mode="wait">
//           {!isLoadingTrack ? (
//             <motion.div
//               key="trackLoaded"
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -10 }}
//               transition={{ duration: 0.4 }}
//               className="flex items-center gap-3 min-w-0"
//             >
//               {currentTrack.cover && (
//                 <img
//                   src={currentTrack.cover}
//                   className="w-12 h-12 rounded-md object-cover shadow-md"
//                 />
//               )}

//               <div className="flex flex-col min-w-0 max-w-[150px] leading-tight">
//                 <MarqueeText
//                   text={currentTrack.title ?? ""}
//                   className="text-sm font-semibold"
//                 />

//                 <MarqueeText
//                   text={
//                     Array.isArray(currentTrack.artist)
//                       ? currentTrack.artist.join(", ")
//                       : (currentTrack.artist ?? "")
//                   }
//                   className="text-xs text-zinc-400"
//                 />
//               </div>
//             </motion.div>
//           ) : (
//             // SKELETON
//             <motion.div
//               key="trackSkeleton"
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -10 }}
//               transition={{ duration: 0.3 }}
//               className="flex items-center gap-3 min-w-0 animate-pulse"
//             >
//               <div className="w-12 h-12 bg-zinc-700/60 rounded-md" />

//               <div className="flex flex-col gap-2">
//                 <div className="w-32 h-3 bg-zinc-700/60 rounded" />
//                 <div className="w-24 h-3 bg-zinc-700/50 rounded" />
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* CONTROLS */}
//         <div className="flex items-center gap-3">
//           <div className="flex items-center justify-center gap-2">
//             <button
//               onClick={playPrev}
//               className="text-zinc-400 hover:text-white transition"
//             >
//               <MdSkipPrevious size={22} />
//             </button>

//             <button
//               onClick={togglePlay}
//               className="p-2 bg-green-500 hover:bg-green-400 text-black rounded-full transition"
//             >
//               {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} />}
//             </button>

//             <button
//               onClick={playNext}
//               className="text-zinc-400 hover:text-white transition"
//             >
//               <MdSkipNext size={22} />
//             </button>
//           </div>

//           {/* VOLUME */}
//           <div className="flex items-center gap-3 opacity-90">
//             <div className="flex items-center gap-2">
//               <HiVolumeUp size={15} className="text-zinc-400" />

//               <input
//                 type="range"
//                 min={0}
//                 max={1}
//                 step={0.01}
//                 value={volume}
//                 onChange={(e) => setVolume(Number(e.target.value))}
//                 className="w-20 h-2 rounded-full slider-thumb-sm cursor-pointer"
//                 style={{
//                   background: `linear-gradient(to right, #22c55e ${
//                     volume * 100
//                   }%, #6b7280 ${volume * 100}%)`,
//                 }}
//               />
//             </div>

//             <motion.div
//               layout
//               transition={{
//                 layout: { duration: 0.55, ease: "easeInOut" },
//                 scale: { duration: 0.2 },
//               }}
//               whileTap={{ scale: 0.5 }}
//               className={`inline-flex items-center cursor-pointer rounded-xl p-1 transition-colors duration-300 ${
//                 isRepeating
//                   ? "text-white bg-green-400"
//                   : "border-2 border-green-400 text-zinc-400 hover:text-white"
//               }`}
//               onClick={toggleRepeat}
//             >
//               <IoRepeat size={18} />
//             </motion.div>
//           </div>
//         </div>
//       </div>

//       {/* PROGRESS BAR */}
//       <div
//         className="
//           w-full h-2 mt-3 cursor-pointer
//           bg-zinc-700/70 rounded-full relative overflow-hidden
//         "
//         onClick={(e) => {
//           if (isLoadingTrack) return; // disable during skeleton
//           const rect = e.currentTarget.getBoundingClientRect();
//           const pct = (e.clientX - rect.left) / rect.width;
//           seek(pct * duration);
//         }}
//       >
//         <div
//           className={`h-2 rounded-full transition-all ${
//             isLoadingTrack ? "bg-zinc-600 animate-pulse" : "bg-green-500"
//           }`}
//           style={{
//             width: isLoadingTrack
//               ? "30%"
//               : duration
//                 ? `${(progress / duration) * 100}%`
//                 : "0%",
//           }}
//         />
//       </div>
//     </motion.div>
//   );
// }
