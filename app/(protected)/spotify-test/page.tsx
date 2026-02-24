"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MdSkipNext, MdSkipPrevious } from "react-icons/md";
import { FaPause, FaPlay } from "react-icons/fa";
import { HiVolumeUp } from "react-icons/hi";
import { TbArrowsShuffle, TbRepeatOff, TbRepeatOnce } from "react-icons/tb";

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

export default function SpotifyTestPage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [volume, setVolume] = useState(0.42);
  const [progress, setProgress] = useState(190);
  const duration = 219;
  const volumeRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (t: number) => {
    if (!Number.isFinite(t) || t < 0) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const handleVolumeChange = (clientX: number) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    setVolume(Math.max(0, Math.min(1, pct)));
  };

  return (
    <main className="min-h-screen bg-black text-white px-4 py-28 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-200/75">
          Spotify Player Test
        </p>

        <div className="rounded-2xl border border-cyan-300/25 bg-linear-to-br from-[#071a2a]/95 via-[#0a1120]/95 to-[#111827]/95 px-3 py-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.62)] backdrop-blur-xl">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[170px_1fr_160px] md:grid-cols-[200px_1fr_180px]">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82ae553c8228"
                alt="Album cover"
                className="h-10 w-10 shrink-0 rounded object-cover shadow-md"
              />

              <div className="min-w-0">
                <OverflowMarquee
                  text="Follow You Into The Dark Where Neon Dreams Fade Slowly"
                  className="text-[13px] font-semibold text-white"
                />
                <OverflowMarquee
                  text="Alan Wake, RAKEL, Long Artist Name For Overflow Testing"
                  className="text-[11px] text-cyan-100/70"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:justify-center sm:gap-3">
              <button className="text-cyan-100/60 transition hover:text-cyan-100">
                <MdSkipPrevious size={19} />
              </button>
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-black transition-all duration-300 hover:scale-105 hover:bg-cyan-300"
              >
                {isPlaying ? <FaPause size={13} /> : <FaPlay size={13} />}
              </button>
              <button className="text-cyan-100/60 transition hover:text-cyan-100">
                <MdSkipNext size={19} />
              </button>
            </div>

            <div className="col-span-2 mt-0.5 flex items-center justify-end gap-1.5 sm:col-span-1 sm:mt-0 sm:gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <button
                  onClick={() => setIsShuffling((s) => !s)}
                  className={`flex h-8 w-10 sm:w-12 items-center justify-center rounded-lg transition-all duration-300 ${
                    isShuffling
                      ? "bg-cyan-400 text-black"
                      : "border border-cyan-200/25 text-cyan-100/70 hover:text-cyan-100"
                  }`}
                >
                  <TbArrowsShuffle size={16} />
                </button>

                <button
                  onClick={() => setIsRepeating((r) => !r)}
                  className={`flex h-8 w-10 sm:w-12 items-center justify-center rounded-lg transition-all duration-300 ${
                    isRepeating
                      ? "bg-cyan-400 text-black"
                      : "border border-cyan-200/25 text-cyan-100/70 hover:text-cyan-100"
                  }`}
                >
                  {isRepeating ? (
                    <TbRepeatOnce size={18} />
                  ) : (
                    <TbRepeatOff size={18} />
                  )}
                </button>
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
            <span className="w-8 text-right tabular-nums">{formatTime(progress)}</span>
            <div
              className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-cyan-100/20"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setProgress(Math.max(0, Math.min(duration, pct * duration)));
              }}
            >
              <div
                className="h-1.5 rounded-full bg-linear-to-r from-cyan-300 to-sky-400 transition-all"
                style={{ width: `${(progress / duration) * 100}%` }}
              />
            </div>
            <span className="w-8 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

