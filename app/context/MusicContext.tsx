"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
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

  isLoadingTrack: boolean;

  isRepeating: boolean;
  toggleRepeat: () => void;

  volume: number;
  setVolume: (v: number) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVisible, setPlayerVisible] = useState(true);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [volume, setVolume] = useState(0.5);

  // -------------------
  // Persisted settings
  // -------------------
  useEffect(() => {
    const storedVolume = localStorage.getItem("music-volume");
    if (storedVolume) setVolume(Number(storedVolume));

    const storedRepeat = localStorage.getItem("music-repeat");
    if (storedRepeat) {
      const repeatState = storedRepeat === "true";
      setIsRepeating(repeatState);
      repeatRef.current = repeatState;
    }

    const storedvisability = localStorage.getItem("music-visability");
    if (storedvisability) {
      const visabilityState = storedvisability === "true";
      setPlayerVisible(visabilityState);
    }

    const storedIsPlaying = localStorage.getItem("music-isPlaying");
    if (storedIsPlaying) {
      const musicIsPlaying = storedIsPlaying === "true";
      setIsPlaying(musicIsPlaying);
      if (audioRef.current) {
        if (musicIsPlaying) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("music-volume", volume.toString());
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("music-repeat", isRepeating.toString());
  }, [isRepeating]);

  useEffect(() => {
    localStorage.setItem("music-isPlaying", isPlaying.toString());
  }, [isPlaying]);

  useEffect(() => {
    localStorage.setItem("music-visability", playerVisible.toString());
  }, [playerVisible]);

  // Current track
  const currentTrack = useMemo(
    () => tracks[trackIndex] || null,
    [tracks, trackIndex]
  );

  // Load tracks
  useEffect(() => {
    fetch("/api/music")
      .then((res) => res.json())
      .then((data: Track[]) => {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setTracks(shuffled);
      })
      .catch(() => toast("Failed to load tracks"));
  }, []);

  // Audio setup
  useEffect(() => {
    if (!currentTrack) return;

    setIsLoadingTrack(true);

    // Pause old audio if exists
    audioRef.current?.pause();

    // Create new audio
    const audio = new Audio(currentTrack.src);
    audioRef.current = audio;
    audio.volume = volume;
    audio.preload = "metadata";

    // Play immediately if already playing
    if (isPlaying) audio.play().catch(() => {});

    // Update progress and duration
    const updateProgress = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);

    const onEnded = () => {
      if (repeatRef.current) {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    // Fetch metadata asynchronously
    (async () => {
      try {
        const res = await fetch(currentTrack.src);
        const blob = await res.blob();
        const metadata = await parseBlob(blob);

        const artist = metadata.common.artist;
        let cover: string | undefined;

        if (metadata.common.picture?.length) {
          const picture = metadata.common.picture[0];
          const bytes = picture.data;
          let binary = "";
          const chunkSize = 0x8000;

          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }

          cover = `data:${picture.format};base64,${window.btoa(binary)}`;
        }

        // Update track info **without blocking playback**
        setTracks((prev) =>
          prev.map((t, i) => (i === trackIndex ? { ...t, artist, cover } : t))
        );
      } catch (err) {
        console.error("Failed to read metadata", err);
      } finally {
        setIsLoadingTrack(false);
      }
    })();

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack?.src]);

  // Controls
  const toggleRepeat = () => {
    setIsRepeating((r) => {
      const newVal = !r;
      repeatRef.current = newVal;
      return newVal;
    });
  };

  const togglePlayerVisible = () => setPlayerVisible((v) => !v);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const playNext = () =>
    setTrackIndex((i) => (tracks.length ? (i + 1) % tracks.length : 0));

  const playPrev = () =>
    setTrackIndex((i) =>
      tracks.length ? (i - 1 + tracks.length) % tracks.length : 0
    );

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        isPlaying,
        togglePlay,
        currentTrack,
        isLoadingTrack,
        progress,
        duration,
        playNext,
        playPrev,
        seek,
        playerVisible,
        togglePlayerVisible,

        isRepeating,
        toggleRepeat,

        volume,
        setVolume,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
};
