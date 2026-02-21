import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { HiVolumeUp } from "react-icons/hi";
import { useRef } from "react";
import { useUI } from "../context/UIContext";
import { TbArrowsShuffle, TbRepeatOff, TbRepeatOnce } from "react-icons/tb";

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
    isShuffling,
    toggleShuffle,
    isLoadingTrack,
  } = useMusic();

  const { panelOpen } = useUI();
  const shouldShowPlayer = playerVisible && !panelOpen;
  const formatTime = (t: number) => {
    if (!Number.isFinite(t) || t < 0) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

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
      className="fixed top-[4.5rem] left-1/2 z-50 w-[min(95vw,38rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#121212]/95 px-3 py-2.5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl md:left-auto md:right-4 md:top-16 md:w-[580px] md:translate-x-0 lg:right-6"
    >
      <div className="grid w-full grid-cols-[170px_1fr_160px] items-center gap-2 sm:grid-cols-[190px_1fr_170px] md:grid-cols-[200px_1fr_180px]">
        {/* Song Info (skeleton OR real data) */}
        <AnimatePresence mode="wait">
          {!isLoadingTrack ? (
            <motion.div
              key="trackLoaded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="flex min-w-0 items-center gap-2"
            >
              {currentTrack.cover ? (
                <img
                  src={currentTrack.cover}
                  alt={currentTrack.title ?? "Album cover"}
                  className="h-10 w-10 shrink-0 rounded object-cover shadow-md"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded bg-zinc-700/60" />
              )}

              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {currentTrack.title ?? ""}
                </p>
                <p className="truncate text-[11px] text-zinc-400">
                  {Array.isArray(currentTrack.artist)
                    ? currentTrack.artist.join(", ")
                    : (currentTrack.artist ?? "")}
                </p>
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
              className="flex min-w-0 items-center gap-2 animate-pulse"
            >
              <div className="h-10 w-10 rounded bg-zinc-700/60" />

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="h-3 w-full rounded bg-zinc-700/60" />
                <div className="h-3 w-2/3 rounded bg-zinc-700/50" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={playPrev}
            className="text-zinc-500 transition hover:text-white"
          >
            <MdSkipPrevious size={19} />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1db954] text-black transition-all duration-300 hover:scale-105 hover:bg-[#1ed760]"
          >
            {isPlaying ? <FaPause size={13} /> : <FaPlay size={13} />}
          </button>

          <button
            onClick={playNext}
            className="text-zinc-500 transition hover:text-white"
          >
            <MdSkipNext size={19} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <motion.button
            layout
            whileTap={{ scale: 0.85 }}
            onClick={toggleShuffle}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 ${
              isShuffling
                ? "bg-[#1db954] text-black"
                : "border border-white/15 text-zinc-400 hover:text-white"
            }`}
          >
            <TbArrowsShuffle size={16} />
          </motion.button>

          <motion.button
            layout
            whileTap={{ scale: 0.85 }}
            onClick={toggleRepeat}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 ${
              isRepeating
                ? "bg-[#1db954] text-black"
                : "border border-white/15 text-zinc-400 hover:text-white"
            }`}
          >
            {isRepeating ? <TbRepeatOnce size={18} /> : <TbRepeatOff size={18} />}
          </motion.button>

          <div className="ml-1 flex items-center gap-2">
            <HiVolumeUp size={15} className="text-zinc-500" />
            <div
              ref={volumeRef}
              className="relative h-1.5 w-14 cursor-pointer rounded-full bg-white/15 sm:w-[4rem] md:w-[4.25rem]"
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
              <div
                className="absolute left-0 top-0 h-1.5 rounded-full bg-[#1db954] transition-none"
                style={{ width: `${volume * 100}%` }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#1db954] transition-none"
                style={{ left: `calc(${volume * 100}% - 6px)` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">
        <span className="w-8 text-right tabular-nums">{formatTime(progress)}</span>
        <div
          className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/15"
          onClick={(e) => {
            if (isLoadingTrack) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * duration);
          }}
        >
          <div
            className="h-1.5 rounded-full bg-[#1db954] transition-all"
            style={{
              width: isLoadingTrack
                ? "30%"
                : duration
                  ? `${(progress / duration) * 100}%`
                  : "0%",
            }}
          />
        </div>
        <span className="w-8 tabular-nums">{formatTime(duration)}</span>
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
