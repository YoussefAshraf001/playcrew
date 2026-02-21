"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import toast from "react-hot-toast";
import { parseBlob } from "music-metadata-browser";
import { usePathname } from "next/navigation";

/* ───────────────── TYPES ───────────────── */

export interface Track {
  id: number;
  src: string;
  title: string;
  artist?: string | string[];
  cover?: string;
}

interface MusicContextType {
  isPlaying: boolean;
  isActuallyPlaying: boolean;

  togglePlay: () => void;
  pause: () => void;
  resumeFromGesture: () => void;

  currentTrack: Track | null;
  progress: number;
  duration: number;

  playNext: () => void;
  playPrev: () => void;
  seek: (t: number) => void;

  volume: number;
  setVolume: (v: number) => void;

  playerVisible: boolean;
  togglePlayerVisible: () => void;
  closePlayer: () => void;
  playerRef: React.RefObject<HTMLDivElement | null>;

  isRepeating: boolean;
  toggleRepeat: () => void;
  isShuffling: boolean;
  toggleShuffle: () => void;

  isLoadingTrack: boolean;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

/* ───────────────── STORAGE KEYS ───────────────── */

const STATE_KEY = "music-state";
const WAS_LISTENING_KEY = "music-was-listening";
const AUTO_RESUME_SILENT_KEY = "music-auto-resume-silent";
const SHUFFLE_KEY = "music-shuffle";

/* ───────────────── PROVIDER ───────────────── */

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const hydratedRef = useRef(false);
  const repeatRef = useRef(false);
  const shuffleRef = useRef(false);
  const shuffleHistoryRef = useRef<number[]>([]);
  const askedRef = useRef(false);
  const wasListeningRef = useRef(false);
  const tracksLengthRef = useRef(0);

  /** These two refs are the heart of the fix */
  const shouldRestoreTimeRef = useRef(true);
  const shouldAutoplayNextRef = useRef(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const [playerVisible, setPlayerVisible] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  /* ───────────────── SESSION RESTORE ───────────────── */

  useEffect(() => {
    wasListeningRef.current =
      localStorage.getItem(WAS_LISTENING_KEY) === "true";

    const p = localStorage.getItem("music-isPlaying");
    const v = localStorage.getItem("music-volume");
    const vis = localStorage.getItem("music-visible");
    const r = localStorage.getItem("music-repeat");
    const s = localStorage.getItem(SHUFFLE_KEY);

    if (p !== null) setIsPlaying(p === "true");
    if (v) setVolume(Number(v));
    if (vis) setPlayerVisible(vis === "true");

    if (r) {
      const rr = r === "true";
      setIsRepeating(rr);
      repeatRef.current = rr;
    }

    if (s) {
      const ss = s === "true";
      setIsShuffling(ss);
      shuffleRef.current = ss;
    }

    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem("music-isPlaying", String(isPlaying));
  }, [isPlaying]);

  useEffect(() => {
    localStorage.setItem("music-volume", String(volume));
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("music-visible", String(playerVisible));
  }, [playerVisible]);

  useEffect(() => {
    localStorage.setItem("music-repeat", String(isRepeating));
  }, [isRepeating]);

  useEffect(() => {
    localStorage.setItem(SHUFFLE_KEY, String(isShuffling));
    shuffleRef.current = isShuffling;
    if (!isShuffling) shuffleHistoryRef.current = [];
  }, [isShuffling]);

  /* ───────────────── LOAD TRACK LIST ───────────────── */

  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then((data: Track[]) => {
        setTracks(data);

        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          try {
            const { trackIndex } = JSON.parse(raw);
            if (typeof trackIndex === "number") {
              setTrackIndex(trackIndex);
            }
          } catch {}
        }
      })
      .catch(() => toast.error("Failed to load music"));
  }, []);

  const currentTrack = useMemo(
    () => tracks[trackIndex] ?? null,
    [tracks, trackIndex],
  );

  useEffect(() => {
    tracksLengthRef.current = tracks.length;
  }, [tracks.length]);

  /* ───────────────── AUDIO SETUP ───────────────── */

  useEffect(() => {
    if (!currentTrack) return;

    setIsLoadingTrack(true);

    let audio = audioRef.current;

    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
      audio.volume = volume;

      audio.addEventListener("play", () => {
        setIsActuallyPlaying(true);
        localStorage.setItem(WAS_LISTENING_KEY, "true");
      });

      audio.addEventListener("pause", () => {
        setIsActuallyPlaying(false);
      });

      audio.addEventListener("timeupdate", () => {
        setProgress(audio!.currentTime);
      });

      audio.addEventListener("ended", () => {
        audio!.currentTime = 0;
        setProgress(0);

        shouldRestoreTimeRef.current = false;
        shouldAutoplayNextRef.current = true;

        if (repeatRef.current) {
          audio!.play().catch(() => {});
        } else {
          setTrackIndex((i) => {
            const total = tracksLengthRef.current;
            if (total === 0) return i;

            if (shuffleRef.current) {
              shuffleHistoryRef.current.push(i);
              if (total === 1) return i;
              let next = i;
              while (next === i) next = Math.floor(Math.random() * total);
              return next;
            }

            return (i + 1) % total;
          });
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio!.duration || 0);

        const raw = localStorage.getItem(STATE_KEY);

        if (shouldRestoreTimeRef.current && raw) {
          try {
            const { time, trackId } = JSON.parse(raw);
            if (trackId === currentTrack.id && typeof time === "number") {
              audio!.currentTime = Math.min(time, audio!.duration || time);
              setProgress(audio!.currentTime);
            }
          } catch {}
        } else {
          audio!.currentTime = 0;
          setProgress(0);
        }

        shouldRestoreTimeRef.current = false;
        setIsLoadingTrack(false);

        if (shouldAutoplayNextRef.current) {
          shouldAutoplayNextRef.current = false;
          audio!.play().catch(() => {});
          setIsPlaying(true);
        }
      });
    }

    // Optional metadata
    (async () => {
      try {
        const res = await fetch(currentTrack.src);
        const blob = await res.blob();
        const metadata = await parseBlob(blob);

        let cover: string | undefined;
        if (metadata.common.picture?.length) {
          const pic = metadata.common.picture[0];
          const binary = String.fromCharCode(...pic.data);
          cover = `data:${pic.format};base64,${btoa(binary)}`;
        }

        setTracks((prev) =>
          prev.map((t, i) =>
            i === trackIndex
              ? { ...t, artist: metadata.common.artist, cover }
              : t,
          ),
        );
      } catch {}
    })();

    if (audio.src !== currentTrack.src) {
      audio.src = currentTrack.src;
      audio.load();
    }
  }, [currentTrack?.src]);

  /* ───────────────── SAVE POSITION ───────────────── */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const save = () => {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          trackIndex,
          trackId: currentTrack.id,
          time: audio.currentTime,
        }),
      );
    };

    const id = setInterval(save, 1000);
    window.addEventListener("beforeunload", save);

    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
    };
  }, [trackIndex, currentTrack]);

  /* ───────────────── USER GESTURE RESUME ───────────────── */

  const resumeFromGesture = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  /* ───────────────── CONTINUE TOAST ───────────────── */

  useEffect(() => {
    if (!wasListeningRef.current) return;
    if (!currentTrack) return;
    if (isActuallyPlaying) return;
    if (askedRef.current) return;

    const shouldAutoResumeSilently =
      localStorage.getItem(AUTO_RESUME_SILENT_KEY) === "true";

    if (shouldAutoResumeSilently) {
      askedRef.current = true;
      setTimeout(() => {
        resumeFromGesture();
      }, 0);
      return;
    }

    const TOAST_DURATION_MS = 5000;
    askedRef.current = true;
    let dontShowAgain = false;

    const handleResume = (toastId: string) => {
      if (dontShowAgain) {
        localStorage.setItem(AUTO_RESUME_SILENT_KEY, "true");
      }
      toast.remove(toastId);
      resumeFromGesture();
    };

    const handleDismiss = (toastId: string) => {
      localStorage.setItem(WAS_LISTENING_KEY, "false");
      toast.remove(toastId);
    };

    toast.custom(
      (t) => (
        <div className="w-[min(95vw,28rem)] overflow-hidden rounded-2xl border border-cyan-300/25 bg-linear-to-br from-[#07101a]/95 via-[#0a1420]/95 to-[#081927]/95 text-white shadow-[0_22px_65px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="px-5 pt-4 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">
              Resume Playback
            </p>
            <p className="mt-1.5 text-sm leading-snug text-zinc-100">
              Continue listening to{" "}
              <strong className="text-cyan-200">{currentTrack.title}</strong>?
            </p>
          </div>

          <div className="px-5 pb-4">
            <label className="mb-3 flex items-center gap-2 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                onChange={(e) => {
                  dontShowAgain = e.target.checked;
                }}
                className="h-3.5 w-3.5 rounded border-cyan-300/60 accent-cyan-400"
              />
              Don&apos;t show again
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleDismiss(t.id);
                }}
                className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
              >
                Not now
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleResume(t.id);
                }}
                className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-cyan-300"
              >
                Resume
              </button>
            </div>
          </div>

          <div className="h-1.5 w-full bg-zinc-800/90">
            <div
              className="h-full bg-linear-to-r from-cyan-300 via-cyan-400 to-sky-300 animate-toast-progress"
              style={{ animationDuration: `${TOAST_DURATION_MS}ms` }}
            />
          </div>
        </div>
      ),
      {
        duration: TOAST_DURATION_MS,
        removeDelay: 0,
        position: "top-center",
      },
    );
  }, [currentTrack, isActuallyPlaying, resumeFromGesture]);

  /* ───────────────── CONTROLS ───────────────── */

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const playNext = () => {
    shouldRestoreTimeRef.current = false;
    shouldAutoplayNextRef.current = true;
    setTrackIndex((i) => {
      const total = tracks.length;
      if (total === 0) return i;

      if (shuffleRef.current) {
        shuffleHistoryRef.current.push(i);
        if (total === 1) return i;
        let next = i;
        while (next === i) next = Math.floor(Math.random() * total);
        return next;
      }

      return (i + 1) % total;
    });
  };

  const playPrev = () => {
    shouldRestoreTimeRef.current = false;
    shouldAutoplayNextRef.current = true;
    setTrackIndex((i) => {
      const total = tracks.length;
      if (total === 0) return i;

      if (shuffleRef.current) {
        const prev = shuffleHistoryRef.current.pop();
        return typeof prev === "number" ? prev : i;
      }

      return (i - 1 + total) % total;
    });
  };

  const seek = (t: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
    setProgress(t);
  };

  const toggleRepeat = () => {
    setIsRepeating((r) => {
      repeatRef.current = !r;
      return !r;
    });
  };
  const toggleShuffle = () => setIsShuffling((s) => !s);

  const togglePlayerVisible = () => setPlayerVisible((v) => !v);
  const closePlayer = () => setPlayerVisible(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPlayerVisible(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <MusicContext.Provider
      value={{
        isPlaying,
        isActuallyPlaying,
        togglePlay,
        pause,
        resumeFromGesture,
        currentTrack,
        progress,
        duration,
        playNext,
        playPrev,
        seek,
        volume,
        setVolume,
        playerVisible,
        togglePlayerVisible,
        closePlayer,
        playerRef,
        isRepeating,
        toggleRepeat,
        isShuffling,
        toggleShuffle,
        isLoadingTrack,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

/* ───────────────── HOOK ───────────────── */

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
}
