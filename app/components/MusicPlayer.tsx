"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPauseCircle } from "react-icons/fa";
import { FaCirclePlay } from "react-icons/fa6";

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
  } = useMusic();

  const titleRef = useRef<HTMLDivElement>(null);
  const artistRef = useRef<HTMLDivElement>(null);

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ x: 200, opacity: 0 }}
      animate={{
        x: playerVisible ? 0 : 200,
        opacity: playerVisible ? 1 : 0,
      }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className={`fixed top-5 right-6 z-50 bg-zinc-900 p-4 rounded-xl shadow-xl border border-zinc-700 w-80 ${
        !playerVisible ? "pointer-events-none" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {currentTrack.cover && (
          <img
            src={currentTrack.cover}
            alt={currentTrack.title}
            className="w-12 h-12 rounded-md object-cover shadow-md"
          />
        )}
        <div className="flex flex-col overflow-hidden">
          <div ref={titleRef} className="font-semibold whitespace-nowrap">
            {currentTrack.title}
          </div>
          <div
            ref={artistRef}
            className="text-sm text-zinc-400 whitespace-nowrap"
          >
            {currentTrack.artist || "Unknown Artist"}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="w-full h-2 bg-zinc-700 rounded-full cursor-pointer mt-3 relative"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clampedX = Math.max(0, Math.min(clickX, rect.width));
          const seekTime = (clampedX / rect.width) * duration;
          seek(seekTime);
        }}
      >
        <div
          className="h-2 bg-cyan-500 rounded-full"
          style={{
            width: duration ? `${(progress / duration) * 100}%` : "0%",
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={playPrev}
          className="text-zinc-400 hover:text-white transition"
        >
          <MdSkipPrevious size={28} />
        </button>
        <button
          onClick={togglePlay}
          className="text-cyan-500 hover:scale-110 transition-transform"
        >
          {isPlaying ? <FaPauseCircle size={28} /> : <FaCirclePlay size={28} />}
        </button>
        <button
          onClick={playNext}
          className="text-zinc-400 hover:text-white transition"
        >
          <MdSkipNext size={28} />
        </button>
      </div>
    </motion.div>
  );
}

// "use client";

// import { FaPauseCircle } from "react-icons/fa";
// import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
// import { FaCirclePlay } from "react-icons/fa6";
// import { motion } from "framer-motion";
// import { useRef, useEffect, useState } from "react";

// import { useMusic } from "../context/MusicContext";

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
//   const [titleOverflow, setTitleOverflow] = useState(false);

//   const artistRef = useRef<HTMLDivElement>(null);
//   const [artistOverflow, setArtistOverflow] = useState(false);

//   useEffect(() => {
//     if (titleRef.current) {
//       setTitleOverflow((titleRef.current.scrollWidth ?? 0) > 130);
//     }
//     if (artistRef.current) {
//       setArtistOverflow((artistRef.current.scrollWidth ?? 0) > 130);
//     }
//   }, [currentTrack?.title, currentTrack?.artist]);

//   return (
//     <motion.div
//       initial={{ x: 200, opacity: 0 }}
//       animate={{
//         x: playerVisible ? 0 : 200,
//         opacity: playerVisible ? 1 : 0,
//       }}
//       transition={{ duration: 0.4, ease: "easeInOut" }}
//       className="fixed top-5 right-6 z-50 bg-zinc-900 p-4 rounded-xl shadow-xl border border-zinc-700 w-80"
//     >
//       {currentTrack ? (
//         <>
//           {/* Track Info */}
//           <div className="flex items-center gap-3">
//             {currentTrack.cover && (
//               <img
//                 src={currentTrack.cover}
//                 alt={currentTrack.title}
//                 className="w-12 h-12 rounded-md object-cover shadow-md"
//               />
//             )}
//             <div className="flex flex-col overflow-hidden">
//               <div className="font-semibold whitespace-nowrap" ref={titleRef}>
//                 {titleOverflow ? (
//                   <motion.div
//                     animate={{
//                       x: [
//                         "0%",
//                         `-${Math.max(
//                           (titleRef.current?.scrollWidth ?? 0) - 130,
//                           0
//                         )}px`,
//                       ],
//                     }}
//                     transition={{
//                       repeat: Infinity,
//                       repeatType: "reverse",
//                       duration: 5,
//                       ease: "linear",
//                     }}
//                   >
//                     {currentTrack.title}
//                   </motion.div>
//                 ) : (
//                   <span className="truncate max-w-[130px]">
//                     {currentTrack.title}
//                   </span>
//                 )}
//               </div>
//               <div
//                 className="text-sm text-zinc-400 whitespace-nowrap"
//                 ref={artistRef}
//               >
//                 {artistOverflow ? (
//                   <motion.div
//                     animate={{
//                       x: [
//                         "0%",
//                         `-${Math.max(
//                           (artistRef.current?.scrollWidth ?? 0) - 130,
//                           0
//                         )}px`,
//                       ],
//                     }}
//                     transition={{
//                       repeat: Infinity,
//                       repeatType: "reverse",
//                       duration: 5,
//                       ease: "linear",
//                     }}
//                   >
//                     {currentTrack.artist || "Unknown Artist"}
//                   </motion.div>
//                 ) : (
//                   <span className="truncate max-w-[130px]">
//                     {currentTrack.artist || "Unknown Artist"}
//                   </span>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Progress Bar */}
//           <div
//             className="w-full h-2 bg-zinc-700 rounded-full cursor-pointer mt-3 relative"
//             onClick={(e) => {
//               const rect = e.currentTarget.getBoundingClientRect();
//               const clickX = e.clientX - rect.left;
//               const clampedX = Math.max(0, Math.min(clickX, rect.width));
//               const seekTime = (clampedX / rect.width) * duration;
//               seek(seekTime);
//             }}
//           >
//             <div
//               className="h-2 bg-cyan-500 rounded-full"
//               style={{
//                 width: duration ? `${(progress / duration) * 100}%` : "0%",
//               }}
//             />
//           </div>

//           {/* Controls */}
//           <div className="flex items-center justify-between mt-3">
//             <button
//               onClick={playPrev}
//               className="text-zinc-400 hover:text-white transition"
//             >
//               <MdSkipPrevious size={28} />
//             </button>

//             <button
//               onClick={togglePlay}
//               className="text-cyan-500 hover:scale-110 transition-transform"
//             >
//               {isPlaying ? (
//                 <FaPauseCircle size={28} />
//               ) : (
//                 <FaCirclePlay size={28} />
//               )}
//             </button>

//             <button
//               onClick={playNext}
//               className="text-zinc-400 hover:text-white transition"
//             >
//               <MdSkipNext size={28} />
//             </button>
//           </div>
//         </>
//       ) : (
//         <div className="text-center text-zinc-400 text-sm">
//           No track selected
//         </div>
//       )}
//     </motion.div>
//   );
// }
