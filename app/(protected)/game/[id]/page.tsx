"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  FaHeart,
  FaPlaystation,
  FaXbox,
  FaApple,
  FaSteam,
  FaPause,
  FaPlay,
  FaCrown,
  FaLinux,
  FaGoogle,
  FaLock,
  FaStar,
  FaWindows,
} from "react-icons/fa";
import { BsNintendoSwitch } from "react-icons/bs";
import { IoLogoGameControllerA } from "react-icons/io";
import { GiMouthWatering } from "react-icons/gi";
import {
  MdOutlineOnlinePrediction,
  MdRemoveCircleOutline,
} from "react-icons/md";
import { DiAndroid } from "react-icons/di";
import { SiEpicgames, SiStadia, SiWii } from "react-icons/si";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Helmet } from "react-helmet-async";

import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import ScreenshotsCarousel from "@/app/components/ScreenshotsCarousel";
import VideoCarousel from "@/app/components/VideoCarousel";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import SimilarGamesGrid from "@/app/components/SimilarGamesGrid";
import Link from "next/link";

const statuses = [
  { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" }, // Active / ongoing → blue = focus
  { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" }, // Paused / waiting → yellow = caution
  {
    label: "Dropped",
    icon: <MdRemoveCircleOutline size={16} />,
    color: "bg-red-500",
  }, // Stop / negative → red
  { label: "Completed", icon: <FaCrown size={20} />, color: "bg-green-500" }, // Success → green
  {
    label: "Online",
    icon: <MdOutlineOnlinePrediction size={23} />,
    color: "bg-purple-500",
  }, // Neutral / discovery → purple
  {
    label: "Want To Play",
    icon: <GiMouthWatering size={20} />,
    color: "bg-teal-500",
  }, // Excited / wishlist → teal
];

type StatusType = string | null;
type PCGWRow = Record<string, string | null>;
type StoredRating = number | "excluded";

interface CategoryRatings {
  graphics: StoredRating;
  gameplay: StoredRating;
  story: StoredRating;
  ost: StoredRating;
  cinematics: StoredRating;
  voiceActing: StoredRating;
}

interface TrackedGameModalData {
  _docId: string;
  name: string;
  playtime?: number;
  my_rating?: number;
  status?: string;
  progress?: number;
  notes?: string;
  categoryRatings?: CategoryRatings;
  favorite?: boolean;
  notInterested?: boolean;
  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    total_rating?: number;
    genres?: string[];
    releaseDate?: Date;
  };
}

interface SimilarGame {
  id: number;
  name: string;
  cover?: string;
  rating?: number;
  released?: number | null;
}

interface CastVoiceEntry {
  id: number;
  character: string;
  characterSlug?: string | null;
  actor: string;
  actorSlug?: string | null;
  actorImage?: string | null;
}

type PCGamingWikiApiResponse = {
  data?: {
    cargoquery?: Array<{ title?: PCGWRow }>;
  };
};

export default function GamePage() {
  const { id } = useParams();
  const { user } = useUser();

  const [game, setGame] = useState<any>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusType>(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [loadingGame, setLoadingGame] = useState(false);
  const [drmRows, setDrmRows] = useState<PCGWRow[]>([]);
  const [loadingDrm, setLoadingDrm] = useState(false);
  const [drmError, setDrmError] = useState<string | null>(null);
  const [trackedGameData, setTrackedGameData] = useState<any>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);

  const [aboutOpen, setAboutOpen] = useState(false);

  const [tab, setTab] = useState<"screenshots" | "trailers" | "similar">(
    "screenshots",
  );
  const genreContainerRef = useRef<HTMLDivElement>(null);
  const genreTrackRef = useRef<HTMLDivElement>(null);
  const [genreShouldScroll, setGenreShouldScroll] = useState(false);
  const [genreScrollDistance, setGenreScrollDistance] = useState(0);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [screenshotsReady, setScreenshotsReady] = useState(false);

  const requireLogin = () => {
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    return true;
  };

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      setLoadingGame(true);
      try {
        const res = await fetch(`/api/igdb/game`, {
          method: "POST",
          body: JSON.stringify({ id }),
          cache: "force-cache",
        });
        const data = await res.json();
        console.log("[GamePage] /api/igdb/game response", {
          id,
          game: data?.name,
          castVoiceCount: Array.isArray(data?.cast_voice)
            ? data.cast_voice.length
            : 0,
          castVoiceSample: Array.isArray(data?.cast_voice)
            ? data.cast_voice.slice(0, 3)
            : [],
        });
        setGame(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingGame(false);
      }
    };
    fetchGame();
  }, [id]);

  useEffect(() => {
    if (!game?.name) return;

    let cancelled = false;

    const fetchDrm = async () => {
      setLoadingDrm(true);
      setDrmError(null);

      try {
        const res = await fetch(
          `/api/pcgamingwiki?title=${encodeURIComponent(game.name)}`,
          {
            cache: "no-store",
          },
        );

        const payload: PCGamingWikiApiResponse = await res.json();
        console.log("[PCGamingWiki] payload", {
          game: game.name,
          status: res.status,
          payload,
        });
        const rows =
          payload?.data?.cargoquery
            ?.map((entry) => entry?.title)
            .filter(Boolean) ?? [];
        console.log("[PCGamingWiki] parsed rows", {
          game: game.name,
          rows,
        });

        if (!cancelled) {
          setDrmRows(rows as PCGWRow[]);
        }
      } catch {
        if (!cancelled) {
          setDrmRows([]);
          setDrmError("Failed to load DRM data.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDrm(false);
        }
      }
    };

    fetchDrm();

    return () => {
      cancelled = true;
    };
  }, [game?.name]);

  // Screenshots (if IGDB returns an array of objects with .url)
  const screenshots = useMemo(() => {
    if (!game) return [];

    return (
      game.short_screenshots?.map((s: any, i: number) => ({
        id: i,
        image: s.replace(/t_[^/]+/, "t_1080p"), // full quality
        bg: s.replace(/t_[^/]+/, "t_screenshot_big"), // background
      })) ?? []
    );
  }, [game]);

  const description =
    game?.description_raw &&
    game.description_raw.toLowerCase() !== "no description available"
      ? game.description_raw
      : game?.summary;

  const videoThumbnails = game?.videos?.map((v: any, idx: any) => ({
    id: v.id,
    thumbnail: `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`,
    videoId: v.video_id,
  }));

  const similarGames = useMemo<SimilarGame[]>(
    () =>
      Array.isArray(game?.similar_games)
        ? (game.similar_games as SimilarGame[])
        : [],
    [game?.similar_games],
  );

  const dlcCount = useMemo(() => {
    if (!game) return 0;
    const dlcs = Array.isArray(game.dlcs) ? game.dlcs.length : 0;
    const expansions = Array.isArray(game.expansions)
      ? game.expansions.length
      : 0;
    const standalone = Array.isArray(game.standalone_expansions)
      ? game.standalone_expansions.length
      : 0;
    return dlcs + expansions + standalone;
  }, [game]);

  const posterImage = useMemo(() => {
    if (!game) return "/placeholder-game.jpg";

    if (game.cover) {
      if (typeof game.cover === "string") {
        const rawCover = game.cover.startsWith("//")
          ? `https:${game.cover}`
          : game.cover;
        return rawCover.replace(/t_[^/]+/, "t_1080p");
      }

      if (game.cover.url) {
        const rawCover = game.cover.url.startsWith("//")
          ? `https:${game.cover.url}`
          : game.cover.url;
        return rawCover.replace(/t_[^/]+/, "t_1080p");
      }
    }

    if (game.background_image) {
      const rawBg = game.background_image.startsWith("//")
        ? `https:${game.background_image}`
        : game.background_image;
      return rawBg.replace(/t_[^/]+/, "t_1080p");
    }
    return "/placeholder-game.jpg";
  }, [game]);

  useEffect(() => {
    if (!screenshots?.length) return;
    setBgImage(screenshots[0].bg);
  }, [screenshots]);

  useEffect(() => {
    setPosterLoaded(false);
  }, [posterImage]);

  useEffect(() => {
    if (!screenshots?.length) {
      setScreenshotsReady(true);
      return;
    }

    let cancelled = false;
    setScreenshotsReady(false);

    const previewImage = new Image();
    previewImage.src = screenshots[0].image;
    previewImage.onload = () => {
      if (!cancelled) setScreenshotsReady(true);
    };
    previewImage.onerror = () => {
      if (!cancelled) setScreenshotsReady(true);
    };

    return () => {
      cancelled = true;
    };
  }, [screenshots]);

  useEffect(() => {
    if (!screenshots || screenshots.length === 0) return;

    // Pick initial image
    setBgImage(screenshots[Math.floor(Math.random() * screenshots.length)].bg);

    const interval = setInterval(() => {
      const random =
        screenshots[Math.floor(Math.random() * screenshots.length)];
      setBgImage(random.bg);
    }, 10000);

    return () => clearInterval(interval);
  }, [screenshots]);

  // useEffect(() => {
  //   setLoadingDlcs(true);
  //   if (!game) return;

  //   const ids = [
  //     ...(game.dlcs ?? []),
  //     ...(game.expansions ?? []),
  //     ...(game.standalone_expansions ?? []),
  //   ];

  //   if (!ids.length) return;

  //   const fetchDlcs = async () => {
  //     const res = await fetch("/api/igdb/dlcs", {
  //       method: "POST",
  //       body: JSON.stringify({ ids }),
  //     });

  //     const data = await res.json();
  //     setDlcs(data);
  //     setLoadingDlcs(false);
  //   };
  //   fetchDlcs();
  // }, [game]);

  const fetchUserTrackedGame = async () => {
    try {
      const ref = doc(db, "users", user.uid, "games_igdb", game.id.toString());
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const tracked = snap.data();
        setIsFavorited(Boolean(tracked.favorite));
        setCurrentStatus(tracked.status || null);
        setTrackedGameData(tracked);
      } else {
        setTrackedGameData(null);
      }
    } catch (err) {
      console.error("Failed to fetch tracked game:", err);
    }
  };

  useEffect(() => {
    if (!user || !game) return;
    requestIdleCallback(() => fetchUserTrackedGame());
  }, [user, game]);

  useEffect(() => {
    if (!Array.isArray(game?.genres) || game.genres.length === 0) {
      setGenreShouldScroll(false);
      setGenreScrollDistance(0);
      return;
    }

    const measure = () => {
      const containerWidth = genreContainerRef.current?.clientWidth ?? 0;
      const singleTrackWidth = genreTrackRef.current?.scrollWidth ?? 0;

      setGenreShouldScroll(singleTrackWidth > containerWidth);
      setGenreScrollDistance(singleTrackWidth);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [game?.genres]);

  const normalizeGenres = (genres: any[] = []) =>
    genres.map((g) => (typeof g === "object" ? g.name : g)).filter(Boolean);

  const normalizePlatforms = (platforms: any[] = []) => {
    const seen = new Set<string>();

    return platforms
      .map((p) => p?.platform?.name || p?.name)
      .filter(Boolean)
      .map((name) => name.toLowerCase())
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  };

  const updateTrackedGame = async (data: any) => {
    if (!user || !game) return;

    const genres = normalizeGenres(game.genres);
    const platforms = normalizePlatforms(game.platforms);

    const releaseDate =
      typeof game.released === "number" ? new Date(game.released * 1000) : null;

    let coverUrl = "/placeholder-game.jpg";

    if (game.cover) {
      if (typeof game.cover === "string") {
        // If cover is already a string URL
        coverUrl = game.cover.includes("https:")
          ? game.cover
          : `https:${game.cover}`;
      } else if (game.cover.url) {
        // If cover is an object with url property
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_1080p")}`;
      }
    } else if (game.background_image) {
      // Fallback to background image
      coverUrl = game.background_image;
    }

    await setDoc(
      doc(db, "users", user.uid, "games_igdb", game.id.toString()),
      {
        name: game.name,

        igdb: {
          id: game.id,
          name: game.name,
          cover: coverUrl,
          rating: game.rating || 0,
          genres,
          platforms,
          releaseDate,
        },

        my_rating: data.my_rating ?? null,
        playtime: data.playtime ?? 0,
        progress: data.progress ?? 0,
        notes: data.notes ?? "",
        status: data.status,
        favorite: data.favorite ?? false,

        categoryRatings: data.categoryRatings ?? null,

        lastUpdated: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const handleFavoriteToggle = async () => {
    if (!game) return;
    if (!user) {
      toast.error(<>You must be logged to use this feature.</>);
      return;
    }
    try {
      setLoadingFavorite(true);
      const newFav = !isFavorited;
      await updateTrackedGame({
        favorite: newFav,
        status: currentStatus,
      });
      setIsFavorited(newFav);
      toast.success(
        `${game.name} ${
          newFav ? "added to favorites" : "removed from favorites"
        }`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update favorite.");
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handleChangeStatus = async (status: string) => {
    if (!game) return;
    if (!user) {
      toast.error("You must be logged in to use this feature.");
      return;
    }

    if (currentStatus?.trim().toLowerCase() === status.toLowerCase()) {
      toast.error(
        <>
          Game is already set as{" "}
          <span className="text-red-600 pl-1">{currentStatus}</span>
        </>,
      );
      return;
    }

    try {
      setLoadingStatus(status);

      // Update Firestore
      if (status === "Completed") {
        await updateTrackedGame({
          status,
          favorite: isFavorited,
          progress: 100,
        });
      } else {
        await updateTrackedGame({
          status,
          favorite: isFavorited,
        });
      }

      // Update local state AFTER Firestore write succeeds
      setCurrentStatus(status);
      toast.success(`${game.name} marked as ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    } finally {
      setLoadingStatus(null);
    }
  };

  // Normalize parent platforms
  const normalizeParentPlatforms = (
    platforms: { platform: { name: string } }[],
  ) => {
    const result = new Set<string>();

    platforms.forEach(({ platform }) => {
      const name = platform.name.toLowerCase();

      if (name.includes("pc")) {
        result.add("steam");
        result.add("epic");
        return;
      }

      if (name.includes("playstation")) result.add("playstation");
      else if (name.includes("xbox")) result.add("xbox");
      else if (name.includes("nintendo")) result.add("nintendo");
      else if (name.includes("mac")) result.add("mac");
      else if (name.includes("ios")) result.add("ios");
      else if (name.includes("android")) result.add("android");
      else if (name.includes("linux")) result.add("linux");
      else if (name.includes("web")) result.add("google");
      else if (name.includes("stadia")) result.add("stadia");
      else if (name.includes("wii")) result.add("wii");
      else if (name.includes("windows")) result.add("windows");
    });

    return Array.from(result);
  };

  // Icon mapping
  const getPlatformIcon = (name?: string) => {
    if (!name) return <IoLogoGameControllerA />;

    switch (name.toLowerCase()) {
      case "steam":
        return <FaSteam />;
      case "epic":
        return <SiEpicgames />;
      case "playstation":
        return <FaPlaystation />;
      case "xbox":
        return <FaXbox />;
      case "nintendo":
        return <BsNintendoSwitch />;
      case "mac":
        return <FaApple />;
      case "ios":
        return <FaApple />;
      case "android":
        return <DiAndroid />;
      case "linux":
        return <FaLinux />;
      case "google":
        return <FaGoogle />;
      case "stadia":
        return <SiStadia />;
      case "wii":
        return <SiWii />;
      case "windows":
        return <FaWindows />;
      default:
        return <IoLogoGameControllerA />;
    }
  };

  // Platform link
  const getPlatformLink = (platform?: string, gameName?: string) => {
    if (!platform || !gameName) return "#";

    switch (platform.toLowerCase()) {
      case "steam":
        return `https://store.steampowered.com/search/?term=${encodeURIComponent(
          gameName,
        )}`;
      case "epic":
        return `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(
          gameName,
        )}`;
      case "playstation":
        return `https://store.playstation.com/en-us/search/${encodeURIComponent(
          gameName,
        )}`;
      case "xbox":
        return `https://www.xbox.com/en-us/Search/Results?q=${encodeURIComponent(
          gameName,
        )}`;
      case "nintendo":
        return `https://www.nintendo.com/search/?q=${encodeURIComponent(
          gameName,
        )}`;
      case "mac":
        return `https://apps.apple.com/us/mac/search?term=${encodeURIComponent(
          gameName,
        )}`;
      case "ios":
        return `https://apps.apple.com/us/iphone/search?term=${encodeURIComponent(
          gameName,
        )}`;
      case "android":
        return `https://play.google.com/store/search?q=${encodeURIComponent(
          gameName,
        )}`;
      case "windows":
        return `https://play.google.com/store/search?q=${encodeURIComponent(
          gameName,
        )}`;
      case "wii":
        return `https://www.google.com/search?q=${encodeURIComponent(
          gameName,
        )} ${encodeURIComponent(platform) + " u"}`;
      case "stadia":
        return `https://stadia.google.com/gg/`;
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(
          gameName,
        )}`;
    }
  };

  const truncate = (text: string, length = 300) => {
    if (!text) return "";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  const getReleaseLabel = (unixSeconds: number) => {
    const now = new Date();
    const releaseDate = new Date(unixSeconds * 1000);

    const diffMs = releaseDate.getTime() - now.getTime();
    const isFuture = diffMs > 0;

    const abs = Math.abs(diffMs);
    const days = Math.floor(abs / (1000 * 60 * 60 * 24));
    const years = Math.floor(abs / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor(
      (abs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30),
    );

    if (years === 0 && months === 0 && days > 0) {
      return isFuture
        ? `Releases in ${days} day${days > 1 ? "s" : ""}`
        : `${days} day${days > 1 ? "s" : ""} ago`;
    }

    if (years === 0 && months === 0 && days === 0) {
      return isFuture ? "Coming today" : "Just released";
    }

    const parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);

    return isFuture
      ? `Releases in ${parts.join(", ")}`
      : `${parts.join(", ")} ago`;
  };

  const isReleased = game?.released
    ? game.released * 1000 <= Date.now()
    : false;

  // Official only makes sense if released
  const hasReleaseDate = Boolean(game?.released);
  const hasOfficialStores = Boolean(game?.platforms?.length);

  // Overlay only if NO stores or NO release date
  const showStoreOverlay = !hasOfficialStores || !hasReleaseDate;

  const drmLabels = useMemo(() => {
    if (!drmRows.length) return [];

    const values = new Set<string>();
    const keys = [
      "Uses DRM",
      "Retail DRM",
      "Steam DRM",
      "GOGcom DRM",
      "Epic Games Store DRM",
      "EA app DRM",
      "Ubisoft Store DRM",
      "Microsoft Store DRM",
      "Developer website DRM",
      "Publisher website DRM",
      "Official website DRM",
    ];

    const pushValues = (raw: string | null | undefined) => {
      if (!raw) return;
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => values.add(part));
    };

    drmRows.forEach((row) => {
      keys.forEach((key) => pushValues(row[key]));
    });

    return Array.from(values);
  }, [drmRows]);

  const hasDenuvo = useMemo(
    () =>
      drmLabels.some((label) => {
        const normalized = label.toLowerCase();
        return (
          normalized.includes("denuvo") ||
          normalized.includes("denovu") ||
          normalized.includes("denuvo anti-tamper") ||
          normalized.includes("denovu anti-tamper")
        );
      }),
    [drmLabels],
  );

  const isOnlineOnly = useMemo(() => {
    const hasAlwaysOnline = drmLabels.some((label) =>
      label.toLowerCase().includes("always online"),
    );
    const hasSingleplayerMode = drmRows.some((row) => {
      const modes = (row["Modes"] ?? "").toLowerCase();
      return modes
        .split(",")
        .map((part) => part.trim())
        .includes("singleplayer");
    });

    const parseTriState = (
      value: string | null | undefined,
    ): boolean | null => {
      if (!value) return null;
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "1")
        return true;
      if (normalized === "false" || normalized === "no" || normalized === "0")
        return false;
      return null;
    };

    const rowIndicatesOnlineOnly = drmRows.some((row) => {
      const online = parseTriState(row["Online"]);
      const local = parseTriState(row["Local"]);
      return online === true && local === false;
    });

    if (hasAlwaysOnline) return true;
    if (hasSingleplayerMode) return false;
    return rowIndicatesOnlineOnly;
  }, [drmLabels, drmRows]);

  useEffect(() => {
    console.log("[PCGamingWiki] DRM evaluation", {
      game: game?.name,
      drmLabels,
      hasDenuvo,
      isOnlineOnly,
    });
  }, [game?.name, drmLabels, hasDenuvo, isOnlineOnly]);

  const slugFromName = game?.name
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const trackingModalGame = useMemo<TrackedGameModalData | null>(() => {
    if (!game?.id) return null;

    let coverUrl = "/placeholder-game.jpg";
    if (game.cover) {
      if (typeof game.cover === "string") {
        coverUrl = game.cover.includes("https:")
          ? game.cover
          : `https:${game.cover}`;
      } else if (game.cover.url) {
        coverUrl = `https:${game.cover.url.replace("t_thumb", "t_1080p")}`;
      }
    } else if (game.background_image) {
      coverUrl = game.background_image;
    }

    const releaseDate =
      typeof game.released === "number"
        ? new Date(game.released * 1000)
        : undefined;

    return {
      _docId: String(game.id),
      name: game.name,
      playtime: trackedGameData?.playtime ?? 0,
      my_rating: trackedGameData?.my_rating ?? 0,
      status: trackedGameData?.status ?? currentStatus ?? "Playing",
      progress: trackedGameData?.progress ?? 0,
      notes: trackedGameData?.notes ?? "",
      categoryRatings: trackedGameData?.categoryRatings,
      favorite: trackedGameData?.favorite ?? isFavorited ?? false,
      notInterested: trackedGameData?.notInterested ?? false,
      igdb: {
        id: game.id,
        name: game.name,
        cover: coverUrl,
        rating: game.rating || 0,
        genres: normalizeGenres(game.genres),
        releaseDate,
      },
    };
  }, [game, trackedGameData, currentStatus, isFavorited]);
  const hasTrackedEntry = Boolean(trackedGameData);

  const handleSaveTrackingModal = async (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
  ) => {
    if (!user || !game || trackingSaving) return;

    try {
      setTrackingSaving(true);
      await updateTrackedGame({
        notes,
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
        categoryRatings,
        notInterested,
        lastUpdated: serverTimestamp(),
      });

      setCurrentStatus(status);
      setIsFavorited(favorite);
      setTrackedGameData((prev: any) => ({
        ...(prev ?? {}),
        notes,
        my_rating: rating,
        progress,
        playtime,
        status,
        favorite,
        categoryRatings,
        notInterested,
      }));
      setTrackingModalOpen(false);
      toast.success("Game saved!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save game.");
    } finally {
      setTrackingSaving(false);
    }
  };

  ///////////////////////////////////////// UI /////////////////////////////////////////////

  if (!game || loadingGame) return <LoadingSpinner />;

  if (loadingGame) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen bg-black text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </motion.div>
    );
  }

  return (
    <>
      <Helmet>
        <title>PlayCrew - {game.name}</title>
      </Helmet>

      <div className="relative min-h-screen text-white bg-transparent pt-12 sm:pt-14 lg:pt-12">
        {/* HERO BACKGROUND */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 z-0"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={bgImage}
              src={bgImage!}
              className="w-full h-full object-cover absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </AnimatePresence>

          <div className="absolute inset-0 bg-linear-to-b from-black/10 to-black backdrop-blur-sm" />
        </motion.div>

        {/* MAIN CONTENT */}

        <motion.main
          className="relative z-10 mx-auto flex max-w-[1700px] flex-col gap-4 px-3 py-4 sm:px-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {/* Center content */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">
            {/* Poster + Header */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-5 items-center md:items-start">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative h-56 w-40 sm:h-64 sm:w-44 md:h-80 md:w-56">
                  {!posterLoaded && (
                    <div className="absolute inset-0 rounded-2xl bg-zinc-800/80 animate-pulse shadow-xl" />
                  )}
                  <motion.img
                    src={posterImage}
                    onLoad={() => setPosterLoaded(true)}
                    onError={() => setPosterLoaded(true)}
                    className={`w-full h-full object-cover rounded-2xl shadow-xl transition-opacity duration-500 ${
                      posterLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  />
                </div>

                {/* Small game name under poster */}
                <div className="flex justify-center">
                  <a
                    href={`https://www.igdb.com/games/${slugFromName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      group inline-flex items-center gap-2
                      px-3 py-1
                      text-[14px] font-medium tracking-wide
                      text-white/60
                      bg-white/5
                      border border-white/15
                      rounded-full
                      backdrop-blur-md
                      transition-all duration-300
                      hover:text-cyan-300
                      hover:border-cyan-400/40
                      hover:bg-cyan-500/10
                      hover:-translate-y-0.5
                    "
                  >
                    <span className="uppercase tracking-[0.15em] text-[10px]">
                      IGDB
                    </span>
                    <span className="font-mono text-[10px] text-white/70">
                      #{game.id}
                    </span>
                  </a>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <h1 className="wrap-break-words text-3xl font-extrabold drop-shadow-xl sm:text-4xl md:text-5xl lg:text-[3rem]">
                    {game.name}
                  </h1>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={handleFavoriteToggle}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-[13px] border border-white/10 hover:bg-red-500 hover:scale-105 transition cursor-pointer ${
                      isFavorited ? "bg-red-600" : "bg-white/10"
                    }`}
                    disabled={loadingFavorite}
                  >
                    {loadingFavorite ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <>
                        <FaHeart /> {isFavorited ? "Favorited" : "Favorite"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!requireLogin()) return;
                      setTrackingModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg text-[13px] border border-white/10 bg-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/40 transition cursor-pointer hover:scale-105"
                  >
                    {hasTrackedEntry ? "Edit Tracking" : "Add Tracking"}
                  </button>
                </div>

                {/* Status Buttons */}
                <div className="flex flex-wrap gap-3">
                  {statuses.map((s) => {
                    const isSelected =
                      currentStatus?.trim().toLowerCase() ===
                      s.label.toLowerCase();
                    return (
                      <button
                        key={s.label}
                        onClick={() => {
                          if (!requireLogin()) return;
                          handleChangeStatus(s.label);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] border border-white/10 transition cursor-pointer hover:scale-105 ${
                          isSelected ? s.color : "bg-white/10 hover:bg-white/20"
                        }`}
                      >
                        {loadingStatus === s.label ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          <>
                            {s.icon && s.icon}
                            <span>{s.label}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* About */}
                <div className="bg-white/5 border border-white/10 p-2 rounded-2xl">
                  {Array.isArray(game.genres) && game.genres.length > 0 ? (
                    <div
                      ref={genreContainerRef}
                      className="relative w-full max-w-full overflow-hidden"
                    >
                      <motion.div
                        className="flex w-max items-center gap-2 whitespace-nowrap"
                        animate={
                          genreShouldScroll && genreScrollDistance > 0
                            ? { x: [0, -genreScrollDistance] }
                            : { x: 0 }
                        }
                        transition={
                          genreShouldScroll && genreScrollDistance > 0
                            ? {
                                duration: Math.max(
                                  12,
                                  genreScrollDistance / 35,
                                ),
                                repeat: Infinity,
                                ease: "linear",
                              }
                            : { duration: 0 }
                        }
                      >
                        <div
                          ref={genreTrackRef}
                          className="flex items-center gap-2 whitespace-nowrap shrink-0"
                        >
                          {game.genres.map((genre: string, index: number) => (
                            <span
                              key={`${genre}-base-${index}`}
                              className="px-3 py-1 rounded-full text-[11px] uppercase tracking-wide bg-white/10 border border-white/15 text-white/80"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                        {genreShouldScroll && (
                          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                            {game.genres.map((genre: string, index: number) => (
                              <span
                                key={`${genre}-loop-${index}`}
                                className="px-3 py-1 rounded-full text-[11px] uppercase tracking-wide bg-white/10 border border-white/15 text-white/80"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">
                      No genres available.
                    </p>
                  )}
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-white/80 hover:text-white">
                  <h2 className="text-2xl font-bold mb-3">Story</h2>

                  <p className="text-[13px] leading-relaxed transition">
                    {description ? (
                      truncate(description, 330)
                    ) : (
                      <span>No Description found</span>
                    )}
                  </p>

                  {description?.length > 330 && (
                    <p
                      className="text-cyan-300 mt-2 text-sm cursor-pointer hover:underline w-[70px]"
                      onClick={() => setAboutOpen(true)}
                    >
                      Read more
                    </p>
                  )}
                </div>

                <AnimatePresence>
                  {aboutOpen && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        key="backdrop"
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-999"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={() => setAboutOpen(false)} // click outside to close
                      />

                      {/* Modal Content */}
                      <motion.div
                        key="modal"
                        className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[94vw] sm:w-[90vw] bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-5 max-w-2xl z-1000 shadow-2xl"
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 120,
                          damping: 16,
                        }}
                      >
                        <p className="text-white/80 text-[1.08rem] leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                          {description}
                        </p>

                        <button
                          onClick={() => setAboutOpen(false)}
                          className="absolute top-3 right-3 text-white/70 hover:text-white text-2xl"
                        >
                          ✕
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Stats */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                  {/* Rating */}
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center h-full flex flex-col justify-center">
                    <h3 className="text-[13px] opacity-70 mb-1">
                      IGDB Rating Score
                    </h3>

                    <div className="flex justify-center items-center gap-1 text-ld font-semibold">
                      <FaStar
                        size={22}
                        className={`drop-shadow-sm pr-1 ${
                          game.rating ? "text-amber-300" : "text-white/40"
                        }`}
                      />

                      <span
                        className={
                          game.rating ? "text-white" : "text-white/50 italic"
                        }
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            game.rating ? "text-white" : "text-white/50 italic"
                          }`}
                        >
                          <span>
                            {game.rating
                              ? `${Math.round(game.rating)}`
                              : isReleased
                                ? "Not rated"
                                : "Not released yet"}
                          </span>
                          {game.rating && <span>%</span>}
                        </div>
                      </span>
                    </div>

                    <div className="text-[10px] pt-2 text-zinc-400">
                      {game.rating && game.total_rating_count
                        ? `Based on ${game.total_rating_count} reviews`
                        : "No ratings available"}
                    </div>
                  </div>

                  {/* Release */}
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center h-full flex flex-col justify-center">
                    <h3 className="text-[13px] opacity-70 mb-1">Release</h3>

                    <div className="text-[14px] font-semibold">
                      {game.released
                        ? new Date(game.released * 1000).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )
                        : "TBA"}

                      {game.released && (
                        <div className="text-[11px] text-white/60 mt-1">
                          ({getReleaseLabel(game.released)})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center h-full flex flex-col justify-center">
                    <h3 className="text-[11px] opacity-70 mb-1">DLC Content</h3>
                    <div className="text-[14px] font-semibold">
                      {dlcCount > 0 ? `${dlcCount} Available` : "No DLCs"}
                    </div>
                    <div className="text-[11px] text-white/60 mt-1">
                      {Array.isArray(game?.expansions) &&
                      game.expansions.length > 0
                        ? `${game.expansions.length} expansion${game.expansions.length > 1 ? "s" : ""}`
                        : "Base game only"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs: Screenshots / Trailers / Similar */}
            <div>
              <div className="flex gap-2 justify-center mb-4 text-[12px]">
                <button
                  onClick={() => setTab("screenshots")}
                  className={`px-4 py-2 cursor-pointer hover:scale-105 hover:opacity-100 ease-in-out transition-all duration-300 rounded-full border 
                    ${tab === "screenshots" ? "bg-cyan-500 text-black" : "bg-white/10"}`}
                >
                  Screenshots
                </button>
                <button
                  onClick={() => setTab("trailers")}
                  className={`px-4 py-2 cursor-pointer hover:scale-105 hover:opacity-100 ease-in-out transition-all duration-300 rounded-full border 
                    ${tab === "trailers" ? "bg-cyan-500 text-black" : "bg-white/10"}`}
                >
                  Trailers
                </button>
                <button
                  onClick={() => setTab("similar")}
                  className={`px-4 py-2 cursor-pointer hover:scale-105 hover:opacity-100 ease-in-out transition-all duration-300 rounded-full border 
                    ${tab === "similar" ? "bg-cyan-500 text-black" : "bg-white/10"}`}
                >
                  Similar Games
                </button>
              </div>
              <AnimatePresence mode="wait">
                {tab === "screenshots" && (
                  <motion.div
                    key="screenshots"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <div className="relative">
                      {!screenshotsReady && (
                        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={`skeleton-shot-${idx}`}
                              className="h-48 rounded-lg bg-zinc-800/80 animate-pulse"
                            />
                          ))}
                        </div>
                      )}
                      <div
                        className={`transition-opacity duration-500 ${
                          screenshotsReady ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <ScreenshotsCarousel screenshots={screenshots} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {tab === "trailers" && (
                  <motion.div
                    key="trailers"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <VideoCarousel videos={videoThumbnails} />
                  </motion.div>
                )}
                {tab === "similar" && (
                  <motion.div
                    key="similar"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    <SimilarGamesGrid games={similarGames} maxItems={20} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right column: Stores & repacks */}
          <div className="w-full shrink-0 space-y-4 lg:w-[270px] xl:w-[300px] xl:sticky xl:top-24">
            <div className="relative bg-white/5 border border-white/10 p-4 rounded-2xl">
              <h2 className="text-center text-lg font-bold mb-2">Download</h2>
              <hr className="w-full border-zinc-700 mb-4" />

              <div
                className={`relative mt-5 ${game.platforms.length > 10 && "pr-4"}  p-2`}
              >
                <h2 className="text-lg font-bold mb-2">Official</h2>

                <div className="relative mt-3">
                  <div
                    className={`space-y-3 transition ${
                      showStoreOverlay
                        ? "blur-sm pointer-events-none select-none"
                        : ""
                    }`}
                  >
                    {hasOfficialStores ? (
                      <>
                        {game.platforms
                          .flatMap((p: any) => {
                            if (!p?.platform?.name) return [];

                            const name = p.platform.name;

                            if (name.toLowerCase().includes("pc")) {
                              return [
                                {
                                  key: "steam",
                                  platform: "steam",
                                  label: name,
                                },
                                { key: "epic", platform: "epic", label: name },
                              ];
                            }

                            return [
                              {
                                key: name,
                                platform: normalizeParentPlatforms([p])[0],
                                label: name,
                              },
                            ];
                          })
                          .map((item: any) => (
                            <a
                              key={item.key}
                              href={getPlatformLink(item.platform, game.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg bg-white/10 transition-transform duration-300 ease-in-out hover:bg-white/20 hover:scale-105 will-change-transform"
                            >
                              {getPlatformIcon(item.platform)}
                              <span>
                                {item.label.toLowerCase().includes("pc")
                                  ? item.platform === "steam"
                                    ? "Steam"
                                    : "Epic Games"
                                  : item.label}
                              </span>
                            </a>
                          ))}
                      </>
                    ) : (
                      <p className="text-sm text-white/50 text-center">
                        No official stores available.
                      </p>
                    )}
                  </div>
                </div>

                {showStoreOverlay && (
                  <div
                    className="mt-10 
                        absolute inset-0
                        flex items-center justify-center
                        rounded-xl
                        bg-black/55
                        backdrop-blur-sm
                        z-10
                      "
                  >
                    <div className="flex flex-col items-center gap-3 px-6 text-center">
                      <div
                        className="
                          w-12 h-12
                          flex items-center justify-center
                          rounded-full
                          bg-white/5
                          border border-white/10
                        "
                      >
                        <FaLock size={18} className="text-white/70" />
                      </div>
                      <p className="text-xs uppercase tracking-wide text-white/60 leading-relaxed">
                        Locked until preorder
                        <br />
                        or release day
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* =========================CRACKED========================== */}
              <div
                className={`relative mt-5 ${game.platforms.length > 10 && "pr-4"}  p-2`}
              >
                <h2 className="text-lg font-bold mb-2">Cracked</h2>

                <div className="relative mt-3">
                  <div className="space-y-3 transition">
                    <a
                      href={`https://fitgirl-repacks.site/${encodeURIComponent(
                        game.name
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, ""),
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 transition-transform duration-300 ease-in-out hover:bg-white/20 hover:scale-105 will-change-transform"
                    >
                      <img
                        src="https://www.google.com/s2/favicons?domain=fitgirl-repacks.site&sz=64"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>FitGirl Repacks</span>
                    </a>

                    <a
                      href={`https://dodi-repacks.site/${encodeURIComponent(
                        game.name
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, ""),
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 transition-transform duration-300 ease-in-out hover:bg-white/20 hover:scale-105 will-change-transform"
                    >
                      <img
                        src="https://www.google.com/s2/favicons?domain=dodi-repacks.site&sz=64"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>Dodi Repacks</span>
                    </a>

                    <a
                      href={`https://www.skidrowreloaded.com/?s=${encodeURIComponent(
                        game.name,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 transition-transform duration-300 ease-in-out hover:bg-white/20 hover:scale-105 will-change-transform"
                    >
                      <img
                        src="https://www.google.com/s2/favicons?domain=skidrowreloaded.com&sz=64"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>Skidrow Reloaded</span>
                    </a>
                    <a
                      href={`https://gamedrive.org/?s=${encodeURIComponent(
                        game.name,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 transition-transform duration-300 ease-in-out hover:bg-white/20 hover:scale-105 will-change-transform"
                    >
                      <img
                        src="https://www.google.com/s2/favicons?domain=gamedrive.org&sz=64"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>GameDrive</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* =========================MODS========================== */}
              <div
                className={`relative mt-6 ${game.platforms.length > 10 && "pr-4"} p-2`}
              >
                {/* TITLE (never covered) */}
                <h2 className="text-center text-lg font-bold mb-2">Mods</h2>
                <hr className="w-full border-zinc-700 mb-4" />

                {/* CONTENT WRAPPER (overlay lives here) */}
                <div className="relative rounded-xl overflow-hidden">
                  {/* ACTUAL CONTENT */}
                  <div className="transition">
                    <a
                      href={`https://www.nexusmods.com/games?keyword=${encodeURIComponent(
                        game.name,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        flex items-center gap-2
                        text-[11px] px-3 py-1.5
                        rounded-lg bg-white/10
                        transition-transform duration-300
                        hover:bg-white/20 hover:scale-105
                      "
                    >
                      <img
                        src="https://www.google.com/s2/favicons?domain=nexusmods.com&sz=64"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>Nexus Mods</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.main>

        {trackingModalGame && (
          <GameTrackingModal
            open={trackingModalOpen}
            onClose={() => setTrackingModalOpen(false)}
            onSave={handleSaveTrackingModal}
            saving={trackingSaving}
            game={trackingModalGame}
            initialNotes={trackingModalGame.notes ?? ""}
            initialRating={trackingModalGame.my_rating ?? 0}
            initialCategoryRatings={trackingModalGame.categoryRatings}
            initialProgress={trackingModalGame.progress ?? 0}
            initialPlaytime={trackingModalGame.playtime ?? 0}
            initialStatus={trackingModalGame.status ?? "Playing"}
            initialFavorite={trackingModalGame.favorite ?? false}
            showStatus={true}
            showFavorite={true}
          />
        )}
      </div>
    </>
  );
}
