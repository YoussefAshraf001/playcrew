"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import toast from "react-hot-toast";
import { parseBlob } from "music-metadata-browser";

export interface Track {
  src: string;
  title: string;
  artist?: string;
  cover?: string;
}

interface MusicContextType {
  isMuted: boolean;
  toggleMute: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  currentTrack: Track | null;
  progress: number;
  duration: number;
  playNext: () => void;
  playPrev: () => void;
  seek: (time: number) => void;
  playerVisible: boolean;
  togglePlayerVisible: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVisible, setPlayerVisible] = useState(true);

  const currentTrack = tracks[trackIndex] || null;
  const togglePlayerVisible = () => setPlayerVisible((v) => !v);

  // --- Load tracks ---
  useEffect(() => {
    fetch("/api/music")
      .then((res) => res.json())
      .then((data: Track[]) => {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setTracks(shuffled);
        setTrackIndex(0);
      })
      .catch(() => toast("Failed to load tracks", { duration: 3000 }));
  }, []);

  // --- Setup audio & read metadata ---
  useEffect(() => {
    if (!currentTrack) return;

    // Only fetch metadata if artist is missing
    const fetchMetadata = async () => {
      if (!currentTrack.artist) {
        try {
          const res = await fetch(currentTrack.src);
          const blob = await res.blob();
          const metadata = await parseBlob(blob);

          const artist = metadata.common.artist || "Unknown Artist";

          setTracks((prevTracks) =>
            prevTracks.map((t, i) => (i === trackIndex ? { ...t, artist } : t))
          );
        } catch (err) {
          console.error("Error reading metadata:", err);
        }
      }
    };

    fetchMetadata();

    // --- Setup audio ---
    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(currentTrack.src);
    audio.preload = "metadata";
    audio.volume = 0.5;
    audio.muted = isMuted;
    audioRef.current = audio;

    const updateProgress = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => playNext();

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => toast("Enjoy your vibes", { duration: 2000 }));

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentTrack?.src]); // only depend on src to avoid infinite loops

  // --- Controls ---
  const toggleMute = () => {
    setIsMuted((prev) => {
      if (audioRef.current) audioRef.current.muted = !prev;
      return !prev;
    });
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true));
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const playNext = () => {
    setTrackIndex((prev) => (tracks.length ? (prev + 1) % tracks.length : 0));
  };

  const playPrev = () => {
    setTrackIndex((prev) =>
      tracks.length ? (prev - 1 + tracks.length) % tracks.length : 0
    );
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        isMuted,
        toggleMute,
        isPlaying,
        togglePlay,
        currentTrack,
        progress,
        duration,
        playNext,
        playPrev,
        seek,
        playerVisible,
        togglePlayerVisible,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
