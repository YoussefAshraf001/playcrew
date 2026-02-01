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

export interface Track {
  id: number;
  src: string;
  title: string;
  artist?: string | string[];
  cover?: string;
}

interface MusicContextType {
  isPlaying: boolean; // user intent (persisted)
  isActuallyPlaying: boolean; // real audio state (ui only)

  togglePlay: () => void;
  pause: () => void;

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

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const lockRef = useRef(false); // 🔒 HARD LOCK (hero owns this)

  const [isPlaying, setIsPlaying] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const [isRepeating, setIsRepeating] = useState(false);
  const repeatRef = useRef(false);

  const [playerVisible, setPlayerVisible] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  const hasHydratedRef = useRef(false);

  // ─────────────────────────────
  // RESTORE PERSISTED STATE
  // ─────────────────────────────
  useEffect(() => {
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

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
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

  // ─────────────────────────────
  // LOAD TRACK LIST
  // ─────────────────────────────
  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then((data: Track[]) => setTracks(data))
      .catch(() => toast.error("Failed to load music"));
  }, []);

  const currentTrack = useMemo(
    () => tracks[trackIndex] ?? null,
    [tracks, trackIndex],
  );

  // ─────────────────────────────
  // AUDIO LIFECYCLE (STABLE ELEMENT)
  // ─────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;

    setIsLoadingTrack(true);

    let audio = audioRef.current;

    // ─────────────────────────────
    // 1️⃣ CREATE AUDIO ONCE
    // ─────────────────────────────
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
      audio.volume = volume;

      audio.addEventListener("play", () => setIsActuallyPlaying(true));
      audio.addEventListener("pause", () => setIsActuallyPlaying(false));
      audio.addEventListener("timeupdate", () =>
        setProgress(audio!.currentTime),
      );
      audio.addEventListener("loadedmetadata", () =>
        setDuration(audio!.duration || 0),
      );
      audio.addEventListener("ended", () => {
        if (repeatRef.current) {
          audio!.currentTime = 0;
          if (!lockRef.current) audio!.play().catch(() => {});
        } else {
          setTrackIndex((i) => (i + 1) % tracks.length);
        }
      });
    }

    // ─────────────────────────────
    // 2️⃣ LOAD METADATA (ASYNC, SAFE)
    // ─────────────────────────────
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
      } catch {
        // metadata is optional
      } finally {
        setIsLoadingTrack(false);
      }
    })();

    // ─────────────────────────────
    // 3️⃣ CHANGE AUDIO SOURCE (ONCE PER TRACK)
    // ─────────────────────────────
    if (audio.src !== currentTrack.src) {
      audio.src = currentTrack.src;
      audio.load();
    }

    // ─────────────────────────────
    // 4️⃣ RESPECT USER INTENT
    // ─────────────────────────────
    if (isPlaying && !lockRef.current) {
      audio.play().catch(() => {});
    }
  }, [currentTrack?.src]);

  // ─────────────────────────────
  // CONTROLS
  // ─────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      lockRef.current = false;
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const pause = useCallback(() => {
    lockRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const playNext = () => setTrackIndex((i) => (i + 1) % tracks.length);

  const playPrev = () =>
    setTrackIndex((i) => (i - 1 + tracks.length) % tracks.length);

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

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
}

// "use client";

// import React, {
//   createContext,
//   useContext,
//   useState,
//   useEffect,
//   useRef,
//   useMemo,
//   useCallback,
// } from "react";
// import toast from "react-hot-toast";
// import { parseBlob } from "music-metadata-browser";

// export interface Track {
//   id: number;
//   src: string;
//   title: string;
//   artist?: string | string[];
//   cover?: string;
// }

// interface MusicContextType {
//   isPlaying: boolean;
//   togglePlay: () => void;
//   currentTrack: Track | null;
//   progress: number;
//   duration: number;
//   playNext: () => void;
//   playPrev: () => void;
//   seek: (time: number) => void;
//   playerVisible: boolean;
//   playerRef: React.RefObject<HTMLDivElement | null>;

//   togglePlayerVisible: () => void;

//   isLoadingTrack: boolean;

//   isRepeating: boolean;
//   toggleRepeat: () => void;

//   volume: number;
//   setVolume: (v: number) => void;
// }

// const MusicContext = createContext<MusicContextType | undefined>(undefined);

// export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
//   const audioRef = useRef<HTMLAudioElement | null>(null);
//   const repeatRef = useRef(false);
//   const playerRef = useRef<HTMLDivElement | null>(null);

//   const [tracks, setTracks] = useState<Track[]>([]);
//   const [trackIndex, setTrackIndex] = useState(0);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [playerVisible, setPlayerVisible] = useState(false);
//   const [isRepeating, setIsRepeating] = useState(false);
//   const [isLoadingTrack, setIsLoadingTrack] = useState(false);
//   const [volume, setVolume] = useState(0.5);

//   // -------------------
//   // Persisted settings
//   // -------------------
//   useEffect(() => {
//     const storedVolume = localStorage.getItem("music-volume");
//     if (storedVolume) setVolume(Number(storedVolume));

//     const storedRepeat = localStorage.getItem("music-repeat");
//     if (storedRepeat) {
//       const repeatState = storedRepeat === "true";
//       setIsRepeating(repeatState);
//       repeatRef.current = repeatState;
//     }

//     const storedvisability = localStorage.getItem("music-visability");
//     if (storedvisability) {
//       const visabilityState = storedvisability === "true";
//       setPlayerVisible(visabilityState);
//     }

//     const storedIsPlaying = localStorage.getItem("music-isPlaying");
//     if (storedIsPlaying) {
//       const musicIsPlaying = storedIsPlaying === "true";
//       setIsPlaying(musicIsPlaying);
//       if (audioRef.current) {
//         if (musicIsPlaying) {
//           audioRef.current.play().catch(() => {});
//         } else {
//           audioRef.current.pause();
//         }
//       }
//     }
//   }, []);

//   useEffect(() => {
//     localStorage.setItem("music-volume", volume.toString());
//     if (audioRef.current) audioRef.current.volume = volume;
//   }, [volume]);

//   useEffect(() => {
//     localStorage.setItem("music-repeat", isRepeating.toString());
//   }, [isRepeating]);

//   useEffect(() => {
//     localStorage.setItem("music-isPlaying", isPlaying.toString());
//   }, [isPlaying]);

//   useEffect(() => {
//     localStorage.setItem("music-visability", playerVisible.toString());
//   }, [playerVisible]);

//   // Current track
//   const currentTrack = useMemo(
//     () => tracks[trackIndex] || null,
//     [tracks, trackIndex],
//   );

//   // Load tracks
//   useEffect(() => {
//     fetch("/api/music")
//       .then((res) => res.json())
//       .then((data: Track[]) => {
//         const shuffled = [...data].sort(() => Math.random() - 0.5);
//         setTracks(shuffled);
//       })
//       .catch(() => toast("Failed to load tracks"));
//   }, []);

//   // Audio setup
//   useEffect(() => {
//     if (!currentTrack) return;

//     setIsLoadingTrack(true);

//     let audio: HTMLAudioElement | null = null;

//     const loadTrack = async () => {
//       let artist: string | string[] | undefined;
//       let cover: string | undefined;

//       try {
//         // Fetch audio file as blob to parse metadata
//         const res = await fetch(currentTrack.src);
//         const blob = await res.blob();
//         const metadata = await parseBlob(blob);

//         artist = metadata.common.artist;

//         if (metadata.common.picture?.length) {
//           const picture = metadata.common.picture[0];
//           const bytes = picture.data;
//           let binary = "";
//           const chunkSize = 0x8000;
//           for (let i = 0; i < bytes.length; i += chunkSize) {
//             const chunk = bytes.subarray(i, i + chunkSize);
//             binary += String.fromCharCode(...chunk);
//           }
//           cover = `data:${picture.format};base64,${window.btoa(binary)}`;
//         }

//         // Update track info with metadata
//         setTracks((prev) =>
//           prev.map((t, i) => (i === trackIndex ? { ...t, artist, cover } : t)),
//         );
//       } catch (err) {
//         console.error("Failed to parse metadata", err);
//       }

//       // After metadata is ready, create audio
//       audio = new Audio(currentTrack.src);
//       audioRef.current = audio;
//       audio.volume = volume;
//       audio.preload = "metadata";

//       // Play if needed
//       if (isPlaying) audio.play().catch(() => {});

//       // Set up audio events
//       const updateProgress = () => setProgress(audio!.currentTime);
//       const updateDuration = () => setDuration(audio!.duration || 0);
//       const onEnded = () => {
//         if (repeatRef.current) {
//           audio!.currentTime = 0;
//           audio!.play();
//         } else {
//           playNext();
//         }
//       };

//       audio.addEventListener("timeupdate", updateProgress);
//       audio.addEventListener("loadedmetadata", updateDuration);
//       audio.addEventListener("ended", onEnded);

//       setIsLoadingTrack(false);

//       return () => {
//         audio!.pause();
//         audio!.removeEventListener("timeupdate", updateProgress);
//         audio!.removeEventListener("loadedmetadata", updateDuration);
//         audio!.removeEventListener("ended", onEnded);
//       };
//     };

//     loadTrack();

//     return () => {
//       audio?.pause();
//     };
//   }, [currentTrack?.src]);

//   // Controls
//   const toggleRepeat = () => {
//     setIsRepeating((r) => {
//       const newVal = !r;
//       repeatRef.current = newVal;
//       return newVal;
//     });
//   };

//   // const togglePlayerVisible = () => setPlayerVisible((v) => !v);
//   const togglePlayerVisible = useCallback(() => {
//     setPlayerVisible((v) => !v);
//   }, []);

//   const togglePlay = () => {
//     if (!audioRef.current) return;
//     if (audioRef.current.paused) {
//       audioRef.current.play();
//       setIsPlaying(true);
//     } else {
//       audioRef.current.pause();
//       setIsPlaying(false);
//     }
//   };

//   const playNext = () =>
//     setTrackIndex((i) => (tracks.length ? (i + 1) % tracks.length : 0));

//   const playPrev = () =>
//     setTrackIndex((i) =>
//       tracks.length ? (i - 1 + tracks.length) % tracks.length : 0,
//     );

//   const seek = (time: number) => {
//     if (audioRef.current) {
//       audioRef.current.currentTime = time;
//       setProgress(time);
//     }
//   };

//   return (
//     <MusicContext.Provider
//       value={{
//         isPlaying,
//         togglePlay,
//         currentTrack,
//         isLoadingTrack,
//         progress,
//         duration,
//         playNext,
//         playPrev,
//         seek,
//         playerVisible,
//         playerRef,
//         togglePlayerVisible,

//         isRepeating,
//         toggleRepeat,

//         volume,
//         setVolume,
//       }}
//     >
//       {children}
//     </MusicContext.Provider>
//   );
// };

// export const useMusic = () => {
//   const ctx = useContext(MusicContext);
//   if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
//   return ctx;
// };
