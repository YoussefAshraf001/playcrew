import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "../context/MusicContext";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { HiVolumeUp } from "react-icons/hi";
import { useEffect, useRef, useState } from "react";
import { useUI } from "../context/UIContext";
import { TbArrowsShuffle, TbRepeatOff, TbRepeatOnce } from "react-icons/tb";
import { usePathname } from "next/navigation";

function OverflowMarquee({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(8);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !textRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      const overflow = textWidth > containerWidth + 1;

      setShouldScroll(overflow);
      if (overflow) {
        const gap = 24;
        setDistance(textWidth + gap);
        setDuration(Math.max(8, textWidth / 28));
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    if (textRef.current) observer.observe(textRef.current);

    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  if (!text) return <div className={className} />;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {shouldScroll ? (
        <motion.div
          className="flex w-max items-center gap-6 whitespace-nowrap"
          animate={{ x: [0, -distance] }}
          transition={{
            duration,
            ease: "linear",
            repeat: Infinity,
            repeatDelay: 1,
          }}
        >
          <span ref={textRef} className="shrink-0">
            {text}
          </span>
          <span className="shrink-0" aria-hidden="true">
            {text}
          </span>
        </motion.div>
      ) : (
        <span ref={textRef} className="block truncate">
          {text}
        </span>
      )}
    </div>
  );
}

export default function MusicPlayer() {
  const pathname = usePathname();
  const isDashboard = pathname.includes("/dashboard");
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
    closePlayer,
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

  useEffect(() => {
    if (isDashboard) return;
    if (!shouldShowPlayer) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-music-toggle='true']")) return;
      if (playerRef.current?.contains(target)) return;

      closePlayer();
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isDashboard, shouldShowPlayer, playerRef, closePlayer]);

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
      className={`fixed left-1/2 z-1000 w-[min(95vw,38rem)] -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-linear-to-br from-[#071a2a]/95 via-[#0a1120]/95 to-[#111827]/95 px-3 py-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.62)] backdrop-blur-xl md:left-auto md:right-4 md:w-[580px] md:translate-x-0 lg:right-6 ${
        isDashboard ? "top-6 md:top-6" : "top-18 md:top-16"
      }`}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[170px_1fr_160px] md:grid-cols-[200px_1fr_180px]">
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
                <OverflowMarquee
                  text={currentTrack.title ?? ""}
                  className="text-[13px] font-semibold text-white"
                />
                <OverflowMarquee
                  text={
                    Array.isArray(currentTrack.artist)
                      ? currentTrack.artist.join(", ")
                      : (currentTrack.artist ?? "")
                  }
                  className="text-[11px] text-cyan-100/70"
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

        <div className="mr-10 flex items-center justify-end gap-2 sm:justify-center sm:gap-3">
          <button
            onClick={playPrev}
            className="text-cyan-100/60 transition hover:text-cyan-100"
          >
            <MdSkipPrevious size={19} />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-black transition-all duration-300 hover:scale-105 hover:bg-cyan-300"
          >
            {isPlaying ? <FaPause size={13} /> : <FaPlay size={13} />}
          </button>

          <button
            onClick={playNext}
            className="text-cyan-100/60 transition hover:text-cyan-100"
          >
            <MdSkipNext size={19} />
          </button>
        </div>

        <div className="col-span-2 mt-0.5 flex items-center justify-end gap-1.5 sm:col-span-1 sm:mt-0 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <motion.button
              layout
              whileTap={{ scale: 0.85 }}
              onClick={toggleShuffle}
              className={`flex h-7 w-9 items-center justify-center rounded-lg transition-all duration-300 ${
                isShuffling
                  ? "bg-cyan-400 text-black"
                  : "border border-cyan-200/25 text-cyan-100/70 hover:text-cyan-100"
              }`}
            >
              <TbArrowsShuffle size={16} />
            </motion.button>

            <motion.button
              layout
              whileTap={{ scale: 0.85 }}
              onClick={toggleRepeat}
              className={`flex h-7 w-9 items-center justify-center rounded-lg transition-all duration-300 ${
                isRepeating
                  ? "bg-cyan-400 text-black"
                  : "border border-cyan-200/25 text-cyan-100/70 hover:text-cyan-100"
              }`}
            >
              {isRepeating ? (
                <TbRepeatOnce size={16} />
              ) : (
                <TbRepeatOff size={16} />
              )}
            </motion.button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setVolume(0)}
              className="cursor-pointer text-cyan-100/65 transition hover:text-cyan-100"
              aria-label="Mute volume"
            >
              <HiVolumeUp size={15} />
            </button>
            <div
              ref={volumeRef}
              className="relative mr-1 h-1.5 w-14 cursor-pointer rounded-full bg-cyan-100/20 sm:mr-2 sm:w-20 md:w-24"
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
                className="absolute left-0 top-0 h-1.5 rounded-full bg-cyan-400 transition-none"
                style={{ width: `${volume * 100}%` }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-300 transition-none"
                style={{ left: `calc(${volume * 100}% - 5px)` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-cyan-100/55">
        <span className="w-8 text-right tabular-nums">
          {formatTime(progress)}
        </span>
        <div
          className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-cyan-100/20"
          onClick={(e) => {
            if (isLoadingTrack) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * duration);
          }}
        >
          <div
            className="h-1.5 rounded-full bg-linear-to-r from-cyan-300 to-sky-400 transition-all"
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
