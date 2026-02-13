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
  playerRef: React.RefObject<HTMLDivElement | null>;

  isRepeating: boolean;
  toggleRepeat: () => void;

  isLoadingTrack: boolean;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

/* ───────────────── STORAGE KEYS ───────────────── */

const STATE_KEY = "music-state";
const WAS_LISTENING_KEY = "music-was-listening";

/* ───────────────── PROVIDER ───────────────── */

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const hydratedRef = useRef(false);
  const repeatRef = useRef(false);
  const askedRef = useRef(false);
  const wasListeningRef = useRef(false);

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
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  /* ───────────────── SESSION RESTORE ───────────────── */

  useEffect(() => {
    wasListeningRef.current =
      localStorage.getItem(WAS_LISTENING_KEY) === "true";

    const p = localStorage.getItem("music-isPlaying");
    const v = localStorage.getItem("music-volume");
    const vis = localStorage.getItem("music-visible");
    const r = localStorage.getItem("music-repeat");

    if (p !== null) setIsPlaying(p === "true");
    if (v) setVolume(Number(v));
    if (vis) setPlayerVisible(vis === "true");

    if (r) {
      const rr = r === "true";
      setIsRepeating(rr);
      repeatRef.current = rr;
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
          setTrackIndex((i) => (i + 1) % tracks.length);
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

    askedRef.current = true;

    toast.custom(
      (t) => (
        <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl border border-cyan-400/30 shadow-lg">
          <p className="text-sm mb-3">
            Continue playing <strong>{currentTrack.title}</strong>?
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                resumeFromGesture();
                toast.dismiss(t.id);
              }}
              className="px-3 py-1.5 rounded-md bg-cyan-500 text-black font-semibold"
            >
              Yes
            </button>

            <button
              onClick={() => {
                localStorage.setItem(WAS_LISTENING_KEY, "false");
                toast.dismiss(t.id);
              }}
              className="px-3 py-1.5 rounded-md bg-zinc-700"
            >
              No
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-zinc-700 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-400 animate-toast-progress"
              style={{ animationDuration: "4000ms" }}
            />
          </div>
        </div>
      ),
      { duration: Infinity },
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
    setTrackIndex((i) => (i + 1) % tracks.length);
  };

  const playPrev = () => {
    shouldRestoreTimeRef.current = false;
    shouldAutoplayNextRef.current = true;
    setTrackIndex((i) => (i - 1 + tracks.length) % tracks.length);
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

  const togglePlayerVisible = () => setPlayerVisible((v) => !v);

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
        playerRef,
        isRepeating,
        toggleRepeat,
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
