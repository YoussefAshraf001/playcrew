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
  FaInfoCircle,
  FaLinux,
  FaGoogle,
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
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Helmet } from "react-helmet-async";

import { getAwardCategoryFromDocId, getAwardYears } from "@/app/lib/awards";
import { db } from "@/app/lib/firebase";
import { getRecentGameActionSummary } from "@/app/lib/recentGameActions";
import { useUser } from "@/app/context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import ScreenshotsCarousel from "@/app/components/ScreenshotsCarousel";
import VideoCarousel from "@/app/components/VideoCarousel";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import SimilarGamesGrid from "@/app/components/SimilarGamesGrid";
import { IoCloseCircle } from "react-icons/io5";
import { CategoryRatings, TrackedGame } from "@/app/types/trackedGame";

const statuses = [
  { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" }, // Active / ongoing â†’ blue = focus
  { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" }, // Paused / waiting â†’ yellow = caution
  {
    label: "Dropped",
    icon: <MdRemoveCircleOutline size={16} />,
    color: "bg-red-500",
  }, // Stop / negative â†’ red
  { label: "Completed", icon: <FaCrown size={20} />, color: "bg-green-500" }, // Success â†’ green
  {
    label: "Online",
    icon: <MdOutlineOnlinePrediction size={23} />,
    color: "bg-purple-500",
  }, // Neutral / discovery â†’ purple
  {
    label: "Want To Play",
    icon: <GiMouthWatering size={20} />,
    color: "bg-teal-500",
  }, // Excited / wishlist â†’ teal
];

type StatusType = string | null;
type StoredRating = number | "excluded" | null;
type WinnerAward = {
  year: number;
  category: string;
};

interface SimilarGame {
  id: number;
  name: string;
  cover?: string;
  rating?: number;
  released?: number | null;
}

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
  const [trackedGameData, setTrackedGameData] = useState<any>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingRemoving, setTrackingRemoving] = useState(false);
  const [winnerAwards, setWinnerAwards] = useState<WinnerAward[]>([]);
  const [loadingWinnerAwards, setLoadingWinnerAwards] = useState(true);

  const gotyAwards = useMemo(
    () => winnerAwards.filter((award) => award.category === "Game of the Year"),
    [winnerAwards],
  );
  const otherWinnerAwards = useMemo(
    () => winnerAwards.filter((award) => award.category !== "Game of the Year"),
    [winnerAwards],
  );

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

  useEffect(() => {
    if (!aboutOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [aboutOpen]);

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
        setGame(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingGame(false);
      }
    };
    fetchGame();
  }, [id]);

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

  useEffect(() => {
    if (!user || !game) return;

    const ref = doc(db, "users", user.uid, "games_igdb", game.id.toString());

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const tracked = snap.data();

        setTrackedGameData(tracked);
        setIsFavorited(Boolean(tracked.favorite));
        setCurrentStatus(tracked.status || null);
      } else {
        setTrackedGameData(null);
        setCurrentStatus(null);
        setIsFavorited(false);
      }
    });

    return () => unsubscribe();
  }, [user, game]);

  useEffect(() => {
    if (!user || !game?.id) {
      setWinnerAwards([]);
      setLoadingWinnerAwards(false);
      return;
    }

    setLoadingWinnerAwards(true);

    let cancelled = false;

    const loadWinnerCategories = async () => {
      try {
        const yearSnapshots = await Promise.all(
          getAwardYears().map(async (year) => ({
            year,
            snap: await getDocs(
              collection(
                db,
                "users",
                user.uid,
                "awards",
                String(year),
                "categories",
              ),
            ),
          })),
        );

        const gotyFound = yearSnapshots.some(({ snap }) =>
          snap.docs.some(
            (entry) =>
              getAwardCategoryFromDocId(entry.id) === "Game of the Year",
          ),
        );

        const winners: WinnerAward[] = yearSnapshots
          .flatMap(({ year, snap }) =>
            snap.docs.flatMap((entry) => {
              const data = entry.data();
              const winnerIgdbId = Number(data?.winner?.igdbId ?? data?.igdbId);
              if (winnerIgdbId !== Number(game.id)) return [];

              const category = getAwardCategoryFromDocId(entry.id);
              if (!category) return [];

              return [
                {
                  year,
                  category,
                },
              ];
            }),
          )
          .sort((a, b) => b.year - a.year);
        if (!cancelled) {
          setWinnerAwards(winners);
          setLoadingWinnerAwards(false);
        }
      } catch (err) {
        console.error("Failed to load winner categories:", err);
        if (!cancelled) {
          setWinnerAwards([]);
          setLoadingWinnerAwards(false);
        }
      }
    };

    void loadWinnerCategories();

    return () => {
      cancelled = true;
    };
  }, [user, game?.id]);

  useEffect(() => {
    if (otherWinnerAwards.length === 0) {
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
  }, [otherWinnerAwards]);

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

    const previousTrackedGame = trackedGameData ?? {
      favorite: isFavorited,
      status: currentStatus,
      progress: trackedGameData?.progress ?? 0,
      my_rating: trackedGameData?.my_rating ?? null,
      notes: trackedGameData?.notes ?? "",
      playtime: trackedGameData?.playtime ?? 0,
    };

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
        playedSessions: data.playedSessions ?? [],
        save: data.save ?? null,

        recentActionSummary:
          data.recentActionSummary ??
          getRecentGameActionSummary(previousTrackedGame, {
            favorite: data.favorite ?? false,
            status: data.status,
            progress: data.progress ?? 0,
            my_rating: data.my_rating ?? null,
            notes: data.notes ?? "",
            playtime: data.playtime ?? 0,
          }),

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
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">
            {newFav ? "was added to favorites" : "was removed from favorites"}
          </span>
        </span>,
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
      setTrackedGameData((prev: any) => ({
        ...(prev ?? {}),
        status,
        favorite: prev?.favorite ?? isFavorited,
        progress: status === "Completed" ? 100 : (prev?.progress ?? 0),
      }));
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">is now added and marked as</span>
          <span className="font-bold pr-1">{status}</span>
        </span>,
      );
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

  // const getReleaseLabel = (unixSeconds: number) => {
  //   const now = new Date();
  //   const releaseDate = new Date(unixSeconds * 1000);

  //   const diffMs = releaseDate.getTime() - now.getTime();
  //   const isFuture = diffMs > 0;

  //   const abs = Math.abs(diffMs);
  //   const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  //   const years = Math.floor(abs / (1000 * 60 * 60 * 24 * 365));
  //   const months = Math.floor(
  //     (abs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30),
  //   );

  //   if (years === 0 && months === 0 && days > 0) {
  //     return isFuture
  //       ? `Releases in ${days} day${days > 1 ? "s" : ""}`
  //       : `${days} day${days > 1 ? "s" : ""} ago`;
  //   }

  //   if (years === 0 && months === 0 && days === 0) {
  //     return isFuture ? "Coming today" : "Just released";
  //   }

  //   const parts = [];
  //   if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  //   if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);

  //   return isFuture
  //     ? `Releases in ${parts.join(", ")}`
  //     : `${parts.join(", ")} ago`;
  // };

  const getReleaseLabel = (unixSeconds: number) => {
    const today = new Date();
    const release = new Date(unixSeconds * 1000);

    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);

    const diffMs = release.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const absDays = Math.abs(diffDays);
    const years = Math.floor(absDays / 365);
    const days = absDays % 365;

    if (diffDays === 0) return "Released today";
    if (diffDays === -1) return "Released yesterday";
    if (diffDays === 1) return "Releases tomorrow";

    if (years > 0) {
      const yearText = `${years} year${years > 1 ? "s" : ""}`;
      const dayText = days > 0 ? `, ${days} day${days > 1 ? "s" : ""}` : "";

      return diffDays > 0
        ? `Releases in ${yearText}${dayText}`
        : `${yearText}${dayText} ago`;
    }

    return diffDays > 0
      ? `Releases in ${absDays} day${absDays > 1 ? "s" : ""}`
      : `${absDays} day${absDays > 1 ? "s" : ""} ago`;
  };

  const isReleased = game?.released
    ? game.released * 1000 <= Date.now()
    : false;

  // Official only makes sense if released
  const hasReleaseDate = Boolean(game?.released);
  const platformCount = Array.isArray(game?.platforms)
    ? game.platforms.length
    : 0;
  const showUnreleasedOverlay = !hasReleaseDate || !isReleased;

  const slugFromName = game?.name
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const trackingModalGame = useMemo<TrackedGame | null>(() => {
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
      my_rating: trackedGameData?.my_rating ?? null,
      status: trackedGameData?.status ?? currentStatus ?? "Playing",
      progress: trackedGameData?.progress ?? 0,
      notes: trackedGameData?.notes ?? "",
      categoryRatings: trackedGameData?.categoryRatings,
      favorite: trackedGameData?.favorite ?? isFavorited ?? false,
      playedSessions: trackedGameData?.playedSessions ?? [],
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
    rating: number | null,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean,
    categoryRatings: CategoryRatings,
    notInterested: boolean,
    playedSessions: NonNullable<TrackedGame["playedSessions"]>,
    save?: TrackedGame["save"],
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
        playedSessions,
        save,
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
        playedSessions,
      }));
      setTrackingModalOpen(false);
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">updated Successfully.</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save game.");
    } finally {
      setTrackingSaving(false);
    }
  };

  const handleRemoveTrackingEntry = async () => {
    if (!user || !game || trackingRemoving) return;

    try {
      setTrackingRemoving(true);
      await deleteDoc(
        doc(db, "users", user.uid, "games_igdb", game.id.toString()),
      );
      setTrackedGameData(null);
      setCurrentStatus(null);
      setIsFavorited(false);
      setTrackingModalOpen(false);
      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name ?? "Game"}</span>
          <span className="text-black">is now removed from your library.</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove game from library.");
    } finally {
      setTrackingRemoving(false);
    }
  };

  const hasAwards = !loadingWinnerAwards && gotyAwards.length > 0;
  const storyLimit = hasAwards ? 580 : 680;

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
        <meta
          name="description"
          content={`View ${game.name} details, ratings, and tracking progress on PlayCrew.`}
        />
      </Helmet>

      <div className="relative min-h-screen text-white bg-transparent pt-12 sm:pt-14 lg:pt-12">
        {/* HERO BACKGROUND */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={bgImage}
              src={bgImage!}
              className="absolute inset-0 w-full h-full object-cover blur-xl brightness-75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </AnimatePresence>
        </motion.div>

        {/* MAIN CONTENT */}

        <motion.main
          className="relative z-10 mx-auto grid max-w-[1780px] gap-5 px-3 py-4 sm:px-4 lg:px-6 lg:py-6 2xl:grid-cols-[minmax(0,1fr)_300px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="flex min-w-0 flex-col gap-5">
            <section className="overflow-hidden rounded-4xl border border-white/12 bg-black/12 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-5 xl:p-6">
              <div className="grid gap-5 xl:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[272px_minmax(0,1fr)]">
                <aside className="flex flex-col items-center gap-4 xl:sticky xl:top-24 xl:self-start">
                  {/* Poster */}
                  <div className="relative h-60 w-44 sm:h-72 sm:w-48 lg:h-104 lg:w-70">
                    {!posterLoaded && (
                      <div className="absolute inset-0 rounded-[26px] bg-zinc-800/80 shadow-xl animate-pulse" />
                    )}

                    <motion.img
                      src={posterImage}
                      onLoad={() => setPosterLoaded(true)}
                      onError={() => setPosterLoaded(true)}
                      className={`h-full w-full rounded-[26px] object-cover shadow-[0_18px_60px_rgba(0,0,0,0.48)] transition-opacity duration-500 ${
                        posterLoaded ? "opacity-100" : "opacity-0"
                      }`}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                    />
                  </div>

                  {/* IGDB link */}
                  <div>
                    <a
                      href={`https://www.igdb.com/games/${slugFromName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-white/65 transition-all duration-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                    >
                      <span>IGDB</span>
                      <span className="font-mono text-white/75">
                        #{game.id}
                      </span>
                    </a>
                  </div>

                  {/* Compact stat grid */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-[260px]">
                    {/* Rating */}
                    <div className="flex flex-col justify-evenly rounded-2xl border border-white/12 bg-white/2 p-3 text-center">
                      <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                        Rating
                      </h3>

                      <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-white">
                        <FaStar
                          size={12}
                          className={
                            game.total_rating
                              ? "text-amber-300"
                              : "text-white/35"
                          }
                        />
                        <span>
                          {game.total_rating
                            ? `${Math.round(game.total_rating)} / 100`
                            : isReleased
                              ? "Not rated"
                              : "TBA"}
                        </span>
                      </div>

                      <p className="text-[10px] text-white/55">
                        {game.total_rating_count
                          ? `${game.total_rating_count} reviews`
                          : "No reviews"}
                      </p>
                    </div>

                    {/* Release */}
                    <div className="flex flex-col justify-evenly rounded-2xl border border-white/12 bg-white/2 p-3 text-center">
                      <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                        Release Date
                      </h3>

                      <div className="text-[12px] font-semibold text-white">
                        {game.released
                          ? new Date(game.released * 1000).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "TBA"}
                      </div>

                      {/* <p className="mt-1 text-[10px] text-white/55">
                        (
                        {game.released
                          ? getReleaseLabel(game.released)
                          : "Pending"}
                        )
                      </p> */}
                    </div>
                  </div>
                </aside>

                <div className="min-w-0 space-y-4 sm:space-y-5">
                  <div className="overflow-hidden rounded-[28px] border border-white/12 bg-black/12 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.24)] sm:p-5 xl:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-3">
                          <h1 className="wrap-break-words text-3xl font-extrabold leading-none drop-shadow-xl sm:text-4xl lg:text-5xl xl:text-[3.4rem]">
                            {game.name}
                          </h1>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                            {normalizeGenres(game.genres)
                              .slice(0, 4)
                              .map((genre) => (
                                <span
                                  key={genre}
                                  className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/74"
                                >
                                  {genre}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 xl:ml-auto xl:max-w-[320px] xl:justify-end">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <AnimatePresence initial={false}>
                              {hasTrackedEntry && (
                                <>
                                  <motion.button
                                    key="favorite"
                                    onClick={handleFavoriteToggle}
                                    className={`relative flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:scale-105 ${
                                      isFavorited
                                        ? "border-red-400/45 bg-red-600 text-white"
                                        : "border-white/12 bg-transparent text-white/90 hover:bg-red-500 hover:text-white"
                                    }`}
                                    disabled={loadingFavorite}
                                    initial={{
                                      opacity: 0,
                                      x: 18,
                                      width: 0,
                                      paddingLeft: 0,
                                      paddingRight: 0,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      x: 0,
                                      width: "auto",
                                      paddingLeft: 16,
                                      paddingRight: 16,
                                    }}
                                    exit={{
                                      opacity: 0,
                                      x: 18,
                                      width: 0,
                                      paddingLeft: 0,
                                      paddingRight: 0,
                                    }}
                                    transition={{
                                      duration: 0.26,
                                      ease: "easeOut",
                                    }}
                                  >
                                    {/* Main content (keeps width) */}
                                    <span
                                      className={`flex items-center gap-2 ${
                                        loadingFavorite
                                          ? "opacity-0"
                                          : "opacity-100"
                                      }`}
                                    >
                                      <FaHeart />
                                      {isFavorited ? "Favorited" : "Favorite"}
                                    </span>

                                    {/* Loader overlay */}
                                    {loadingFavorite && (
                                      <span className="absolute inset-0 flex items-center justify-center">
                                        <span className="loading loading-dots loading-sm" />
                                      </span>
                                    )}
                                  </motion.button>

                                  <motion.button
                                    key="edit-tracking"
                                    onClick={() => {
                                      if (!requireLogin()) return;
                                      setTrackingModalOpen(true);
                                    }}
                                    className="rounded-xl border border-white/12 bg-transparent px-4 py-2 text-[13px] text-white/90 transition hover:scale-105 hover:border-cyan-400/35 hover:bg-cyan-500/12"
                                    initial={{
                                      opacity: 0,
                                      x: 18,
                                      width: 0,
                                      paddingLeft: 0,
                                      paddingRight: 0,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      x: 0,
                                      width: "auto",
                                      paddingLeft: 16,
                                      paddingRight: 16,
                                    }}
                                    exit={{
                                      opacity: 0,
                                      x: 18,
                                      width: 0,
                                      paddingLeft: 0,
                                      paddingRight: 0,
                                    }}
                                    transition={{
                                      duration: 0.26,
                                      ease: "easeOut",
                                      delay: 0.04,
                                    }}
                                  >
                                    Edit Tracking
                                  </motion.button>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

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
                              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] transition hover:scale-105 ${
                                isSelected
                                  ? `${s.color} border-transparent text-white`
                                  : "border-white/10 bg-transparent text-white/88 hover:bg-white/14"
                              }`}
                            >
                              <span className="relative inline-grid place-items-center">
                                <span
                                  className={`flex items-center gap-2 ${
                                    loadingStatus === s.label
                                      ? "opacity-0"
                                      : "opacity-100"
                                  }`}
                                >
                                  {s.icon && s.icon}
                                  <span>{s.label}</span>
                                </span>
                                {loadingStatus === s.label && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="loading loading-dots loading-sm" />
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.35 }}
                        className="rounded-[22px] bg-[linear-gradient(180deg,rgba(251,191,36,0.21),rgba(0,0,0,0.20))] p-3"
                      >
                        {/* HEADER */}
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/78">
                          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
                          The PlayCrew Awards
                          <div className="flex items-center text-[10px] font-semibold tracking-[0.24em] text-amber-100/78">
                            {isReleased && (
                              <span className="ml-1 gap-1 inline-flex items-center justify-center rounded-full bg-amber-300/20 px-3 py-[0.5px] text-[10px] font-bold text-amber-100">
                                {winnerAwards.length}
                                <span>Won</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* LOADING */}
                        {loadingWinnerAwards && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-center gap-2"
                          >
                            <span className="loading loading-infinity loading-sm" />
                          </motion.div>
                        )}

                        {/* NOT RELEASED YET */}
                        {!loadingWinnerAwards && !isReleased && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[12px] text-white/70 text-center"
                          >
                            2026 PlayCrew Game Awards will be announced on{" "}
                            <span className="font-semibold text-amber-200">
                              December 10th
                            </span>
                            .
                          </motion.div>
                        )}

                        {/* RELEASED BUT NO AWARDS */}
                        {!loadingWinnerAwards &&
                          isReleased &&
                          winnerAwards.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[12px] text-white/60 text-center"
                            >
                              No PlayCrew awards won
                            </motion.div>
                          )}

                        {/* AWARDS */}
                        {!loadingWinnerAwards && winnerAwards.length > 0 && (
                          <>
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
                                          14,
                                          genreScrollDistance / 34,
                                        ),
                                        repeat: Infinity,
                                        ease: "linear",
                                      }
                                    : { duration: 0 }
                                }
                              >
                                {/* ORIGINAL */}
                                <div
                                  ref={genreTrackRef}
                                  className="flex shrink-0 items-center gap-2 whitespace-nowrap"
                                >
                                  {winnerAwards.map((award) => (
                                    <span
                                      key={`${award.year}-${award.category}`}
                                      className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/84"
                                    >
                                      {award.year} {award.category}
                                    </span>
                                  ))}
                                </div>

                                {/* DUPLICATE FOR LOOP */}
                                {genreShouldScroll && (
                                  <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                                    {otherWinnerAwards.map((award) => (
                                      <span
                                        key={`${award.year}-${award.category}-loop`}
                                        className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/84"
                                      >
                                        {award.year} {award.category}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      layout
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`grid gap-4 ${
                        hasAwards
                          ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]"
                          : "grid-cols-1 lg:h-60"
                      }`}
                    >
                      {/* STORY */}
                      <motion.div
                        layout
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="rounded-[28px] border border-white/12 bg-black/12 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h2 className="text-2xl font-bold text-white">
                            Story
                          </h2>

                          {description?.length > storyLimit && (
                            <button
                              className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline"
                              onClick={() => setAboutOpen(true)}
                            >
                              Read more
                            </button>
                          )}
                        </div>

                        <p className="text-[13px] leading-7 text-white/78">
                          {description
                            ? truncate(description, storyLimit)
                            : "No description found."}
                        </p>
                      </motion.div>

                      {/* AWARDS */}
                      <AnimatePresence>
                        {hasAwards && (
                          <motion.div
                            key="awards"
                            initial={{ opacity: 0, x: 70 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 70 }}
                            transition={{
                              duration: 0.4,
                              ease: "easeOut",
                              delay: 0.08,
                            }}
                            className="relative z-0 w-full overflow-hidden rounded-[28px] border border-amber-200/35 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.42),rgba(245,158,11,0.14)_38%,rgba(0,0,0,0.62)_82%)] px-4 pb-5 pt-4 text-center shadow-[0_24px_48px_rgba(0,0,0,0.34),0_0_0_1px_rgba(251,191,36,0.08)]"
                          >
                            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-amber-100/80 to-transparent" />

                            {/* Trophy */}
                            <div className="mx-auto mt-2 flex h-35 w-35 items-center justify-center">
                              <img
                                src="/GOTY-New.png"
                                alt=""
                                className="h-45 w-45 object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.42)]"
                              />
                            </div>

                            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-100/78">
                              PlayCrew Awards
                            </p>

                            <h3 className="mt-2 text-[16px] font-black uppercase tracking-[0.18em] text-amber-50">
                              Game of the Year
                            </h3>

                            <motion.div
                              className="mt-3 flex flex-wrap items-center justify-center gap-1.5"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.18 }}
                            >
                              {gotyAwards.map((award) => (
                                <span
                                  key={`${award.year}-${award.category}`}
                                  className="rounded-xl border border-amber-100/30 bg-amber-300/14 px-2.5 py-1 text-[12px] uppercase tracking-[0.08em] text-amber-50"
                                >
                                  {award.year} Winner
                                </span>
                              ))}
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </section>

            <section className="rounded-4xl border border-white/12 bg-black/12 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:p-5 xl:p-6">
              <div className="mb-5 flex flex-wrap justify-center gap-2 text-[12px]">
                <button
                  onClick={() => setTab("screenshots")}
                  className={`rounded-full border px-4 py-2 transition-all duration-300 hover:scale-105 ${
                    tab === "screenshots"
                      ? "border-cyan-300/50 bg-cyan-400 text-black"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
                >
                  Screenshots
                </button>
                <button
                  onClick={() => setTab("trailers")}
                  className={`rounded-full border px-4 py-2 transition-all duration-300 hover:scale-105 ${
                    tab === "trailers"
                      ? "border-cyan-300/50 bg-cyan-400 text-black"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
                >
                  Trailers
                </button>
                <button
                  onClick={() => setTab("similar")}
                  className={`rounded-full border px-4 py-2 transition-all duration-300 hover:scale-105 ${
                    tab === "similar"
                      ? "border-cyan-300/50 bg-cyan-400 text-black"
                      : "border-white/12 bg-transparent text-white/85 hover:bg-white/14"
                  }`}
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
            </section>
          </div>

          <aside className="w-full">
            {/* <div className="relative h-full overflow-hidden rounded-[30px] border border-white/12 bg-black/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5"> */}
            <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-black/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div>
                  <p className="text-[14px] font-bold uppercase tracking-[0.42em] text-white/55">
                    Platforms Hub
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4`}
                >
                  <h2 className="mb-3 text-lg font-bold">Official</h2>
                  <div className="relative mt-3">
                    <div
                      className={`space-y-3 transition ${platformCount > 6 ? "2xl:max-h-43 2xl:overflow-y-auto 2xl:pr-3 2xl:overscroll-contain" : ""}`}
                    >
                      {platformCount > 0 ? (
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
                                  {
                                    key: "epic",
                                    platform: "epic",
                                    label: name,
                                  },
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
                                className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[12px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
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
                        <p className="text-center text-sm text-white/50">
                          No official stores available.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4 ${platformCount > 6 ? "pr-7" : ""}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-lg font-bold">Cracked</h2>
                    <div className="group relative inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Cracked availability note"
                        className="inline-flex h-4 w-4 items-center justify-center text-white/55 transition hover:text-white/80 focus:outline-none"
                      >
                        <FaInfoCircle size={12} />
                      </button>
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[13px] font-medium leading-relaxed tracking-wide text-zinc-200 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        If the game has
                        <span className="text-red-500 pl-1">Denuvo</span>, it
                        most likely will not be cracked soon.
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <div
                      className={`space-y-3 transition ${
                        showUnreleasedOverlay
                          ? "pointer-events-none select-none blur-sm"
                          : ""
                      }`}
                    >
                      <a
                        href={`https://fitgirl-repacks.site/${encodeURIComponent(
                          game.name
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, ""),
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=fitgirl-repacks.site&sz=64"
                          className="h-5 w-5 rounded-full"
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
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=dodi-repacks.site&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Dodi Repacks</span>
                      </a>
                      <a
                        href={`https://gamedrive.org/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=gamedrive.org&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>GameDrive</span>
                      </a>
                      <a
                        href={`https://www.skidrowreloaded.com/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=skidrowreloaded.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Skidrow Reloaded</span>
                      </a>
                      <a
                        href={`https://www.aimhaven.com/?s=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=aimhaven.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>AimHaven</span>
                      </a>
                    </div>

                    {showUnreleasedOverlay && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 px-6 text-center">
                          <p className="text-xs uppercase tracking-wide leading-relaxed text-white/60">
                            Locked until
                            <br />
                            release day
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`relative rounded-3xl border border-white/10 bg-transparent p-4 ${platformCount > 6 ? "pr-7" : ""}`}
                >
                  <h2 className="mb-3 text-lg font-bold">Mods</h2>
                  <div className="relative overflow-hidden rounded-xl">
                    <div
                      className={`transition ${
                        showUnreleasedOverlay
                          ? "pointer-events-none select-none blur-sm"
                          : ""
                      }`}
                    >
                      <a
                        href={`https://www.nexusmods.com/games?keyword=${encodeURIComponent(game.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[11px] transition-transform duration-300 hover:scale-[1.02] hover:bg-white/16"
                      >
                        <img
                          src="https://www.google.com/s2/favicons?domain=nexusmods.com&sz=64"
                          className="h-5 w-5 rounded-full"
                        />
                        <span>Nexus Mods</span>
                      </a>
                    </div>

                    {showUnreleasedOverlay && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-sm">
                        <div className="flex w-full flex-col gap-3 px-6">
                          <p className="w-full text-center text-xs uppercase tracking-normal leading-relaxed text-white/60">
                            Locked until release day
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </motion.main>
        <AnimatePresence>
          {aboutOpen && (
            <>
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-999 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setAboutOpen(false)}
              />

              <motion.div
                key="modal"
                className="fixed inset-x-0 top-1/2 z-1000 mx-auto w-[94vw] max-w-2xl -translate-y-1/2 rounded-2xl border border-white/20 bg-black/75 p-4 shadow-2xl sm:w-[90vw] sm:p-5"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
              >
                <p className="max-h-[72vh] overflow-y-auto pr-6 text-sm leading-relaxed text-white/85">
                  {description}
                </p>

                <button
                  onClick={() => setAboutOpen(false)}
                  className="absolute right-3 top-3 text-white/70 hover:text-white"
                >
                  <IoCloseCircle size={30} />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {trackingModalGame && (
          <GameTrackingModal
            open={trackingModalOpen}
            onClose={() => setTrackingModalOpen(false)}
            onSave={handleSaveTrackingModal}
            onRemove={handleRemoveTrackingEntry}
            saving={trackingSaving}
            game={trackingModalGame}
            initialNotes={trackingModalGame.notes ?? ""}
            initialRating={trackingModalGame.my_rating ?? null}
            initialCategoryRatings={trackingModalGame.categoryRatings}
            initialProgress={trackingModalGame.progress ?? 0}
            initialPlaytime={trackingModalGame.playtime ?? 0}
            initialPlayedSessions={trackingModalGame.playedSessions ?? []}
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
