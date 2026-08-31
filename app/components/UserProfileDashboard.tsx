"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiActivity,
  FiBookOpen,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiHeart,
  FiImage,
  FiInfo,
  FiMessageSquare,
  FiSearch,
  FiSlash,
  FiUser,
  FiX,
} from "react-icons/fi";

import { db } from "@/app/lib/firebase";
import { getUserByUsername } from "@/app/lib/social";
import GameCard from "@/app/components/GameCard";
import BadgeCabinet from "@/app/components/BadgeCabinet";
import FriendButton from "@/app/components/social/FriendButton";
import { GAME_STICKERS } from "@/app/lib/gameStickers";
import { THEME_PRESETS } from "@/app/lib/themes";

const getAnimationDuration = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const signature = String.fromCharCode(...bytes.slice(0, 12));

  if (signature.startsWith("RIFF") && signature.includes("WEBP")) {
    let offset = 12;
    let duration = 0;
    while (offset + 8 <= bytes.length) {
      const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const size =
        bytes[offset + 4] |
        (bytes[offset + 5] << 8) |
        (bytes[offset + 6] << 16) |
        (bytes[offset + 7] << 24);
      const dataOffset = offset + 8;
      if (type === "ANMF" && size >= 16) {
        duration +=
          bytes[dataOffset + 12] |
          (bytes[dataOffset + 13] << 8) |
          (bytes[dataOffset + 14] << 16);
      }
      offset = dataOffset + size + (size % 2);
    }
    return duration;
  }

  if (signature.startsWith("GIF8")) {
    let duration = 0;
    for (let index = 0; index + 5 < bytes.length; index += 1) {
      if (
        bytes[index] === 0x21 &&
        bytes[index + 1] === 0xf9 &&
        bytes[index + 2] === 0x04
      ) {
        duration += (bytes[index + 4] | (bytes[index + 5] << 8)) * 10;
      }
    }
    return duration;
  }

  return 0;
};

function LoopingReviewSticker({ sticker }: { sticker: string }) {
  const [playback, setPlayback] = useState(0);
  const [stickerReady, setStickerReady] = useState(false);
  const localSticker = GAME_STICKERS.find((item) => item.id === sticker);
  const source = localSticker?.image ?? sticker;
  const isGiphy = /^https?:\/\/[^/]*giphy\.com\//i.test(source);
  const displaySource = isGiphy
    ? `${source}${source.includes("?") ? "&" : "?"}playcrewLoop=${playback}`
    : source;

  useEffect(() => {
    setStickerReady(false);
    let cancelled = false;
    let restart: number | undefined;

    const scheduleLoop = async () => {
      let duration = 4000;
      try {
        const response = await fetch(source);
        if (response.ok) {
          duration =
            getAnimationDuration(await response.arrayBuffer()) || duration;
        }
      } catch {
        // Cross-origin sticker hosts may block inspection; use the safe fallback.
      }

      if (!cancelled) {
        restart = window.setInterval(
          () => {
            setStickerReady(false);
            setPlayback((value) => value + 1);
          },
          Math.max(250, duration + 40),
        );
      }
    };

    void scheduleLoop();

    return () => {
      cancelled = true;
      if (restart !== undefined) window.clearInterval(restart);
    };
  }, [source]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!stickerReady && (
        <div className="absolute inset-0 animate-pulse bg-white/[0.08]" />
      )}
      <img
        key={playback}
        src={displaySource}
        alt={localSticker?.label ?? "Review sticker"}
        decoding="async"
        onLoad={() => setStickerReady(true)}
        onError={() => setStickerReady(true)}
        className={`h-full w-full object-contain transition-opacity duration-500 ${
          stickerReady ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

type FirestoreTimestampLike = { toDate?: () => Date };

const hasToDate = (value: unknown): value is { toDate: () => Date } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
};

type UserProfile = {
  uid: string;
  username?: string;
  displayName?: string;
  bio?: string;
  createdAt?: FirestoreTimestampLike | string | Date | null;
  wallpaper?:
    | {
        data?: string;
        url?: string;
        type?: "image" | "gif";
        crop?: { x: number; y: number; zoom: number };
      }
    | string
    | null;
  avatar?: string | { data?: string } | null;
  unlockedBadgeIds?: string[];
  themePreset?: string;
};

type LibraryGame = {
  id: string;
  name?: string;
  status?: string;
  favorite?: boolean;
  backlog?: boolean;
  playedSessions?: Array<{
    playedAt?: FirestoreTimestampLike | string | Date | null;
  }>;
  playSessions?: unknown;
  lastUpdated?: FirestoreTimestampLike | string | Date | null;
  progress?: number;
  playtime?: number | null;
  notInterested?: boolean;
  review?: {
    text?: string;
    sticker?: string | null;
    createdAt?: FirestoreTimestampLike | string | Date | null;
    updatedAt?: FirestoreTimestampLike | string | Date | null;
  };
  sticker?: string | null;
  igdb?: { id?: number; name?: string; cover?: string };
  [key: string]: unknown;
};

type ReviewItem = {
  id: string;
  gameId: string | number;
  gameName?: string;
  text: string;
  sticker?: string | null;
  createdAt?: FirestoreTimestampLike | string | Date | null;
};

type ScreenshotItem = {
  id: string;
  name?: string;
  igdbId?: number | null;
  thumbPath?: string;
  storagePath?: string;
  coverUrl?: string;
  url?: string;
  image?: string;
  customCoverUrl?: string | null;
  igdbCoverUrl?: string | null;
};

const isDisplayableImageSource = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  /^(https?:|data:|blob:|\/\/|\/)/i.test(value.trim());

function ProfileScreenshotCover({
  screenshot,
  libraryCover,
}: {
  screenshot: ScreenshotItem;
  libraryCover?: string | null;
}) {
  const sources = [
    screenshot.customCoverUrl,
    libraryCover,
    screenshot.coverUrl,
    screenshot.igdbCoverUrl,
    screenshot.thumbPath,
    screenshot.url,
    screenshot.image,
    screenshot.storagePath,
    "/placeholder-game.jpg",
  ].filter(isDisplayableImageSource);
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[Math.min(sourceIndex, sources.length - 1)];

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() =>
        setSourceIndex((current) =>
          Math.min(current + 1, Math.max(0, sources.length - 1)),
        )
      }
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}

function ProfileGameCarousel({
  title,
  games,
  emptyMessage,
  showProgress = false,
}: {
  title: string;
  games: LibraryGame[];
  emptyMessage: string;
  showProgress?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [coverReady, setCoverReady] = useState(false);
  const game = games[index];

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, games.length - 1)));
  }, [games.length]);

  useEffect(() => {
    setCoverReady(false);
  }, [game?.id]);

  const move = (direction: -1 | 1) => {
    if (games.length < 2) return;
    setCoverReady(false);
    setIndex((current) => (current + direction + games.length) % games.length);
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {showProgress && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
          )}
          <h2 className="truncate text-lg font-bold">{title}</h2>
          {games.length > 1 && (
            <span className="text-xs text-zinc-500">
              {index + 1}/{games.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => move(direction)}
              disabled={games.length < 2}
              aria-label={direction < 0 ? `Previous ${title}` : `Next ${title}`}
              className="theme-hover-accent theme-text rounded-full border border-white/10 p-1.5 transition disabled:cursor-default disabled:opacity-20"
            >
              {direction < 0 ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
          ))}
        </div>
      </div>

      {game ? (
        <Link
          href={`/game/${game.igdb?.id ?? game.id}`}
          className="group block"
        >
          <div className="flex min-h-24 gap-4">
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/[0.06] shadow-lg">
              {!coverReady && (
                <div className="absolute inset-0 animate-pulse bg-white/10" />
              )}
              <img
                key={game.id}
                src={game.igdb?.cover || "/placeholder-game.jpg"}
                alt={`${game.name ?? "Game"} cover`}
                loading="lazy"
                decoding="async"
                onLoad={() => setCoverReady(true)}
                onError={() => setCoverReady(true)}
                className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${coverReady ? "opacity-100" : "opacity-0"}`}
              />
            </div>
            <div className="min-w-0 flex-1 py-1">
              {!coverReady ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 w-4/5 rounded-full bg-white/10" />
                  <div className="h-3 w-2/5 rounded-full bg-white/[0.07]" />
                  <div className="h-2 w-full rounded-full bg-white/[0.07]" />
                </div>
              ) : (
                <div className="animate-[fadeIn_0.4s_ease-out]">
                  <p className="truncate text-base font-semibold">
                    {game.name ?? game.igdb?.name ?? "Game"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {showProgress
                      ? `${game.progress ?? 0}% complete`
                      : game.status || "Favorite"}
                  </p>
                  {showProgress && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="theme-accent-bg h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, game.progress ?? 0))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

const TAB_ORDER = [
  { id: "profile", label: "Overview" },
  { id: "games", label: "Library" },
  { id: "reviews", label: "Reviews" },
  { id: "screenshots", label: "Screenshots" },
] as const;

const toTime = (
  value: FirestoreTimestampLike | string | Date | null | undefined,
) => {
  const date = hasToDate(value)
    ? value.toDate()
    : typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : null;

  return date?.getTime() ?? 0;
};

const formatDate = (
  value: FirestoreTimestampLike | string | Date | null | undefined,
) => {
  const date = hasToDate(value)
    ? value.toDate()
    : typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : null;
  return date ? date.toLocaleDateString() : "Unknown";
};

function PageControls({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      className="mt-6 flex items-center justify-center gap-3"
      aria-label="Pages"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="theme-surface theme-hover-surface rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-default disabled:opacity-25"
      >
        Previous
      </button>
      <span className="theme-text-muted min-w-24 text-center text-sm">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className="theme-surface theme-hover-surface rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-default disabled:opacity-25"
      >
        Next
      </button>
    </nav>
  );
}

export default function UserProfileDashboard({
  username,
}: {
  username: string;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "profile";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [screenshotsUnavailable, setScreenshotsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState(() => tabParam);
  const [gamePage, setGamePage] = useState(1);
  const [reviewsVisible, setReviewsVisible] = useState(6);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewPage, setReviewPage] = useState(1);
  const [screenshotPage, setScreenshotPage] = useState(1);
  const [gameQuery, setGameQuery] = useState("");

  useEffect(() => {
    const nextTab = TAB_ORDER.some((tab) => tab.id === tabParam)
      ? tabParam
      : "profile";
    setActiveTab(nextTab);
  }, [tabParam]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setLoadError(false);
      setScreenshotsUnavailable(false);
      const u = await getUserByUsername(username);
      if (!mounted) return;
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({ uid: u.id, ...u });

      const [libraryResult, foldersResult, legacyScreenshotsResult] =
        await Promise.allSettled([
          getDocs(collection(db, "users", u.id, "games_igdb")),
          getDocs(collection(db, "users", u.id, "screenshotFolders")),
          getDocs(collection(db, "users", u.id, "screenshots")),
        ]);

      const games =
        libraryResult.status === "fulfilled"
          ? (libraryResult.value.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Record<string, unknown>),
            })) as LibraryGame[])
          : [];

      if (libraryResult.status === "rejected") {
        console.error(
          "Failed to load public game library",
          libraryResult.reason,
        );
      }
      setLibrary(games);

      const revs = games
        .filter((g) => g.review?.text && g.review.text.trim())
        .map((g) => ({
          id: g.id,
          gameId: g.igdb?.id || g.id,
          gameName: g.igdb?.name || g.name,
          text: g.review?.text?.trim() ?? "",
          sticker: g.review?.sticker ?? g.sticker ?? null,
          createdAt: g.review?.createdAt ?? g.lastUpdated ?? null,
        }))
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
      setReviews(revs);

      const screenshotDocs =
        foldersResult.status === "fulfilled" && !foldersResult.value.empty
          ? foldersResult.value.docs
          : legacyScreenshotsResult.status === "fulfilled"
            ? legacyScreenshotsResult.value.docs
            : [];

      if (screenshotDocs.length > 0) {
        setScreenshots(
          screenshotDocs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          })) as ScreenshotItem[],
        );
      } else {
        const bothFailed =
          foldersResult.status === "rejected" &&
          legacyScreenshotsResult.status === "rejected";
        setScreenshotsUnavailable(bothFailed);
        if (bothFailed) {
          console.error("Public screenshots are unavailable", {
            folders: foldersResult.reason,
            legacy: legacyScreenshotsResult.reason,
          });
        }
        setScreenshots([]);
      }

      setLoading(false);
    })().catch((err) => {
      console.error(err);
      setLoadError(true);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [username]);

  const favoriteGames = useMemo(
    () => library.filter((g) => g.favorite),
    [library],
  );

  const filteredLibrary = useMemo(() => {
    const q = gameQuery.trim().toLowerCase();
    if (!q) return library;
    return library.filter((g) => {
      const name = String(g.name ?? g.igdb?.name ?? "").toLowerCase();
      const status = String(g.status ?? "").toLowerCase();
      return name.includes(q) || status.includes(q);
    });
  }, [gameQuery, library]);

  const gamesPerPage = 12;
  const gamePageCount = Math.max(
    1,
    Math.ceil(filteredLibrary.length / gamesPerPage),
  );
  const pagedLibrary = filteredLibrary.slice(
    (gamePage - 1) * gamesPerPage,
    gamePage * gamesPerPage,
  );
  const visibleReviews = reviews.slice(0, reviewsVisible);
  const reviewsPerPage = 6;
  const filteredReviews = useMemo(() => {
    const query = reviewQuery.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) =>
      String(review.gameName ?? "")
        .toLowerCase()
        .includes(query),
    );
  }, [reviewQuery, reviews]);
  const reviewPageCount = Math.max(
    1,
    Math.ceil(filteredReviews.length / reviewsPerPage),
  );
  const pagedReviews = filteredReviews.slice(
    (reviewPage - 1) * reviewsPerPage,
    reviewPage * reviewsPerPage,
  );
  const screenshotsPerPage = 12;
  const screenshotPageCount = Math.max(
    1,
    Math.ceil(screenshots.length / screenshotsPerPage),
  );
  const pagedScreenshots = screenshots.slice(
    (screenshotPage - 1) * screenshotsPerPage,
    screenshotPage * screenshotsPerPage,
  );

  useEffect(() => {
    setGamePage(1);
  }, [gameQuery]);

  useEffect(() => {
    setGamePage((page) => Math.min(page, gamePageCount));
  }, [gamePageCount]);

  useEffect(() => {
    setScreenshotPage((page) => Math.min(page, screenshotPageCount));
  }, [screenshotPageCount]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewQuery]);

  useEffect(() => {
    setReviewPage((page) => Math.min(page, reviewPageCount));
  }, [reviewPageCount]);

  const currentYear = new Date().getFullYear();
  const gamesPlayed = library.length;
  const completedCount = library.filter((g) => g.status === "Completed").length;
  const playingCount = library.filter((g) => g.status === "Playing").length;
  const favoriteCount = library.filter((g) => g.favorite).length;
  const activeThisYear = library.filter((g) => {
    const playedSessions = g.playedSessions ?? g.playSessions;

    const hasSessionsInYear = Array.isArray(playedSessions)
      ? playedSessions.some((session) => {
          const playedAt =
            session && typeof session === "object" && "playedAt" in session
              ? (
                  session as {
                    playedAt?: FirestoreTimestampLike | string | Date | null;
                  }
                ).playedAt
              : null;

          return new Date(toTime(playedAt)).getFullYear() === currentYear;
        })
      : false;

    const activeStatus = ["Playing", "Completed", "On Hold"];

    const statusMatch =
      activeStatus.includes(g.status ?? "") &&
      new Date(toTime(g.lastUpdated)).getFullYear() === currentYear;

    return hasSessionsInYear || statusMatch;
  }).length;
  const completionRate = gamesPlayed
    ? Math.round((completedCount / gamesPlayed) * 100)
    : 0;
  const currentPlayingGames = useMemo(
    () =>
      [...library]
        .filter((g) => g.status === "Playing")
        .sort((a, b) => toTime(b.lastUpdated) - toTime(a.lastUpdated)),
    [library],
  );

  const selectTab = (tab: (typeof TAB_ORDER)[number]["id"]) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  };

  useEffect(() => {
    if (!reviewsModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [reviewsModalOpen]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <span className="loading loading-dots loading-lg text-cyan-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="theme-bg flex min-h-[70vh] items-center justify-center px-4">
        <div className="theme-panel-strong max-w-md rounded-3xl border p-8 text-center">
          <FiUser className="theme-accent-text mx-auto h-10 w-10" />
          <h1 className="theme-text mt-4 text-xl font-bold">
            {loadError ? "Profile unavailable" : "User not found"}
          </h1>
          <p className="theme-text-muted mt-2 text-sm">
            {loadError
              ? "PlayCrew could not load this profile. Try again shortly."
              : `There is no PlayCrew member named @${username}.`}
          </p>
        </div>
      </div>
    );
  }

  const wallpaper =
    typeof profile?.wallpaper === "string"
      ? profile.wallpaper
      : (profile?.wallpaper?.data ?? profile?.wallpaper?.url ?? null);
  const wallpaperCropStyle =
    typeof profile?.wallpaper === "object" &&
    profile.wallpaper?.type === "gif" &&
    profile.wallpaper.crop
      ? {
          transform: `translate(${profile.wallpaper.crop.x}px, ${profile.wallpaper.crop.y}px) scale(${profile.wallpaper.crop.zoom})`,
        }
      : undefined;
  const avatar =
    typeof profile.avatar === "string"
      ? profile.avatar
      : (profile.avatar?.data ?? null);
  const displayUsername = profile.displayName || profile.username || username;
  const profileThemeAccent =
    THEME_PRESETS.find((theme) => theme.id === profile.themePreset)
      ?.swatches[2] ?? "var(--theme-accent)";

  return (
    <>
      <main className="page-top-offset relative min-h-screen overflow-hidden theme-bg pt-10">
        {wallpaper ? (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={wallpaper}
              alt=""
              className="h-full w-full object-cover"
              style={wallpaperCropStyle}
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--theme-accent-rgb),0.12),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.82))]" />
        )}
        <div className="absolute inset-0 bg-[color:rgba(var(--theme-bg-rgb),0.88)] backdrop-blur-[2px]" />

        <div
          role="status"
          className="theme-panel-strong absolute right-4 top-16 z-20 flex max-w-[calc(100%-2rem)] items-start gap-3 rounded-2xl border border-amber-300/25 px-4 py-3 shadow-2xl backdrop-blur-xl sm:right-6 sm:max-w-[300px]"
        >
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-300/10 text-amber-200">
            <FiInfo aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em]">
              Public profiles are in
              <span className="text-yellow-600 font-black"> Beta</span>
            </p>
            <p className="theme-text-muted mt-1 text-[11px] leading-4">
              Some profile features and layouts are still being refined and
              might not work correctly.
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div
            className="theme-panel-strong overflow-hidden rounded-[32px] border shadow-[0_24px_90px_rgba(0,0,0,0.35)]"
            // style={{
            //   borderColor: profileThemeAccent,
            //   boxShadow: `0 0 24px color-mix(in srgb, ${profileThemeAccent} 22%, transparent), 0 24px 90px rgba(0,0,0,0.35)`,
            // }}
          >
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                <div className="space-y-5">
                  <section className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
                    <div className="relative h-40 sm:h-52">
                      {wallpaper ? (
                        <img
                          src={wallpaper}
                          alt=""
                          className="h-full w-full object-cover"
                          style={wallpaperCropStyle}
                        />
                      ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(var(--theme-accent-rgb),0.42),transparent_45%),linear-gradient(135deg,rgba(var(--theme-bg-rgb),0.85),rgba(var(--theme-accent-rgb),0.12))]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 sm:px-7 sm:pb-7">
                      <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex min-w-0 items-end gap-4">
                          <div
                            className="h-24 w-24 shrink-0 overflow-hidden rounded-[26px] sm:h-28 sm:w-28 border"
                            style={{
                              borderColor: profileThemeAccent,
                              boxShadow: `0 0 24px color-mix(in srgb, ${profileThemeAccent} 22%, transparent), 0 24px 90px rgba(0,0,0,0.35)`,
                            }}
                          >
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={`${displayUsername}'s avatar`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="theme-accent-bg flex h-full w-full items-center justify-center">
                                <FiUser className="h-10 w-10 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 pb-1">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                              Player profile
                            </p>
                            <h1 className="truncate text-2xl font-black text-white sm:text-3xl">
                              {displayUsername}
                            </h1>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <FriendButton targetUid={profile.uid} />
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { label: "Library", value: gamesPlayed },
                      { label: "Completion", value: `${completionRate}%` },
                      { label: "Favorites", value: favoriteCount },
                      {
                        label: `Tracked in ${currentYear}`,
                        value: activeThisYear,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                          {item.label}
                        </div>
                        <div className="mt-2 text-3xl font-black tracking-tight">
                          {typeof item.value === "number"
                            ? String(item.value).padStart(2, "0")
                            : item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="space-y-4">
                  <ProfileGameCarousel
                    title="Currently Playing"
                    games={currentPlayingGames}
                    emptyMessage="Nothing currently in progress."
                    showProgress
                  />
                  <ProfileGameCarousel
                    title="Favorite Games"
                    games={favoriteGames}
                    emptyMessage="No favorite games yet."
                  />
                </aside>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-black/35">
                <div className="border-b border-white/10 px-4 py-4 sm:px-6">
                  <div className="grid w-full grid-cols-4 gap-2 overflow-x-auto">
                    {TAB_ORDER.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => selectTab(tab.id)}
                        className={`flex h-10 min-w-28 items-center justify-center rounded-full px-3 text-center text-sm font-semibold transition ${
                          activeTab === tab.id
                            ? "bg-white text-black"
                            : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === "profile" && (
                        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                          <div className="min-w-0 space-y-6">
                            <BadgeCabinet
                              games={library}
                              unlockedBadgeIds={profile.unlockedBadgeIds}
                            />

                            {reviews.length > 0 && (
                              <section>
                                <div className="mb-4 flex items-center justify-between">
                                  <h2 className="text-lg font-bold">
                                    Recent Reviews
                                  </h2>
                                </div>

                                <div className="space-y-3">
                                  {reviews.slice(0, 3).map((r) => (
                                    <div
                                      key={r.id}
                                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                                    >
                                      <div className="flex items-start gap-4">
                                        {r.sticker ? (
                                          <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                            <LoopingReviewSticker
                                              sticker={r.sticker}
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/70 text-zinc-500">
                                            <FiSlash className="h-5 w-5" />
                                            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em]">
                                              No sticker
                                            </span>
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-3">
                                            <Link
                                              href={`/game/${r.gameId}`}
                                              className="truncate text-sm font-semibold text-white hover:underline"
                                            >
                                              {r.gameName || "Game"}
                                            </Link>
                                            <span className="text-xs text-zinc-500">
                                              {formatDate(r.createdAt)}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                                            {r.text}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}
                          </div>

                          <aside className="space-y-6">
                            <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                              <h2 className="text-lg font-bold">About</h2>
                              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                {profile?.bio || "No bio yet."}
                              </p>
                            </section>

                            <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                              <h2 className="text-lg font-bold">
                                Library Activity
                              </h2>
                              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                                <div className="flex items-center justify-between">
                                  <span>Completed</span>
                                  <span>{completedCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Playing</span>
                                  <span>{playingCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Completion Rate</span>
                                  <span>{completionRate}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Tracked in {currentYear}</span>
                                  <span>{activeThisYear}</span>
                                </div>
                              </div>
                            </section>
                          </aside>
                        </div>
                      )}

                      {activeTab === "games" && (
                        <section>
                          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                              <h2 className="text-2xl font-bold">
                                Game Library
                              </h2>
                              <p className="mt-2 text-sm text-zinc-400">
                                Search by name or status, then browse the full
                                collection.
                              </p>
                            </div>
                            <div className="w-full lg:max-w-sm">
                              <input
                                value={gameQuery}
                                onChange={(e) => {
                                  setGameQuery(e.target.value);
                                  setGamePage(1);
                                }}
                                placeholder="Search games..."
                                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                              />
                            </div>
                          </div>

                          {filteredLibrary.length > 0 ? (
                            <>
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                  key={`games-page-${gamePage}-${gameQuery}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.2 }}
                                  className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                                >
                                  {pagedLibrary.map((g) => (
                                    <GameCard
                                      key={g.id}
                                      game={g}
                                      showActions={false}
                                      posterLayout
                                    />
                                  ))}
                                </motion.div>
                              </AnimatePresence>
                              <PageControls
                                page={gamePage}
                                pageCount={gamePageCount}
                                onPage={setGamePage}
                              />
                            </>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                              No games tracked yet
                            </div>
                          )}
                        </section>
                      )}

                      {activeTab === "reviews" && (
                        <section>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <h2 className="text-2xl font-bold">
                                All Reviews
                              </h2>
                              <p className="mt-1 text-sm text-zinc-400">
                                {filteredReviews.length}{" "}
                                {filteredReviews.length === 1
                                  ? "review"
                                  : "reviews"}
                              </p>
                            </div>
                            <label className="relative block w-full sm:max-w-xs">
                              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input
                                type="search"
                                value={reviewQuery}
                                onChange={(event) =>
                                  setReviewQuery(event.target.value)
                                }
                                placeholder="Search game title"
                                className="theme-surface theme-text h-10 w-full rounded-xl border py-2 pl-9 pr-10 text-sm outline-none transition focus:border-[rgba(var(--theme-accent-rgb),0.55)]"
                              />
                              {reviewQuery && (
                                <button
                                  type="button"
                                  onClick={() => setReviewQuery("")}
                                  aria-label="Clear review search"
                                  className="theme-text-muted theme-hover-surface absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5"
                                >
                                  <FiX size={14} />
                                </button>
                              )}
                            </label>
                          </div>
                          <div className="mt-5 space-y-3">
                            {pagedReviews.length > 0 ? (
                              pagedReviews.map((r) => (
                                <div
                                  key={r.id}
                                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                                >
                                  <div className="flex items-start gap-4">
                                    {r.sticker ? (
                                      <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                        <LoopingReviewSticker
                                          sticker={r.sticker}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/70 text-zinc-500">
                                        <FiSlash className="h-6 w-6" />
                                        <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em]">
                                          No sticker
                                        </span>
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <Link
                                          href={`/game/${r.gameId}`}
                                          className="truncate text-sm font-semibold text-white hover:underline"
                                        >
                                          {r.gameName || "Game"}
                                        </Link>
                                        <span className="text-xs text-zinc-500">
                                          {formatDate(r.createdAt)}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                                        {r.text}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                                {reviewQuery
                                  ? "No reviews match that game title."
                                  : "No reviews yet"}
                              </div>
                            )}
                          </div>

                          {filteredReviews.length > reviewsPerPage && (
                            <nav
                              className="mt-6 flex items-center justify-center gap-3"
                              aria-label="Review pages"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewPage((page) => Math.max(1, page - 1))
                                }
                                disabled={reviewPage === 1}
                                className="theme-surface theme-hover-surface theme-text rounded-full border p-2.5 transition disabled:cursor-default disabled:opacity-25"
                                aria-label="Previous review page"
                              >
                                <FiChevronLeft />
                              </button>
                              <span className="theme-text-muted min-w-24 text-center text-sm">
                                Page{" "}
                                <strong className="theme-text">
                                  {reviewPage}
                                </strong>{" "}
                                of {reviewPageCount}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewPage((page) =>
                                    Math.min(reviewPageCount, page + 1),
                                  )
                                }
                                disabled={reviewPage === reviewPageCount}
                                className="theme-surface theme-hover-surface theme-text rounded-full border p-2.5 transition disabled:cursor-default disabled:opacity-25"
                                aria-label="Next review page"
                              >
                                <FiChevronRight />
                              </button>
                            </nav>
                          )}
                        </section>
                      )}

                      {activeTab === "screenshots" && (
                        <section>
                          {screenshots.length > 0 ? (
                            <>
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                  key={`screenshots-page-${screenshotPage}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.2 }}
                                  className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                                >
                                  {pagedScreenshots.map((s) => (
                                    <Link
                                      key={s.id}
                                      href={`/screenshots/${s.id}`}
                                      className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-black/20"
                                    >
                                      <ProfileScreenshotCover
                                        screenshot={s}
                                        libraryCover={
                                          s.igdbId == null
                                            ? null
                                            : library.find(
                                                (game) =>
                                                  game.igdb?.id === s.igdbId,
                                              )?.igdb?.cover
                                        }
                                      />
                                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                                    </Link>
                                  ))}
                                </motion.div>
                              </AnimatePresence>
                              <PageControls
                                page={screenshotPage}
                                pageCount={screenshotPageCount}
                                onPage={setScreenshotPage}
                              />
                            </>
                          ) : screenshotsUnavailable ? (
                            <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                              This player&apos;s screenshots are not publicly
                              available.
                            </div>
                          ) : (
                            <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                              No screenshots yet
                            </div>
                          )}
                        </section>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {reviewsModalOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewsModalOpen(false)}
            >
              <motion.section
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                onClick={(event) => event.stopPropagation()}
                className="theme-panel-strong flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
              >
                <header className="flex items-center justify-between border-b theme-border px-5 py-4 sm:px-6">
                  <div>
                    <p className="theme-accent-text text-[10px] font-bold uppercase tracking-[0.22em]">
                      Player reviews
                    </p>
                    <h2 className="theme-text mt-1 text-xl font-black">
                      All Reviews
                    </h2>
                    <p className="theme-text-muted mt-1 text-xs">
                      {reviews.length} total
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewsModalOpen(false)}
                    aria-label="Close reviews"
                    className="theme-surface theme-hover-surface theme-text rounded-full border p-2.5"
                  >
                    <FiX size={20} />
                  </button>
                </header>

                <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="space-y-3">
                    {visibleReviews.map((review) => (
                      <article
                        key={review.id}
                        className="theme-surface rounded-2xl border p-4"
                      >
                        <div className="flex items-start gap-4">
                          {review.sticker ? (
                            <div className="theme-surface h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                              <LoopingReviewSticker sticker={review.sticker} />
                            </div>
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/70 text-zinc-500">
                              <FiSlash className="h-5 w-5" />
                              <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em]">
                                No sticker
                              </span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={`/game/${review.gameId}`}
                                onClick={() => setReviewsModalOpen(false)}
                                className="theme-text truncate text-sm font-bold hover:underline"
                              >
                                {review.gameName || "Game"}
                              </Link>
                              <time className="theme-text-muted shrink-0 text-xs">
                                {formatDate(review.createdAt)}
                              </time>
                            </div>
                            <p className="theme-text-muted mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                              {review.text}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {reviewsVisible < reviews.length && (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setReviewsVisible((value) => value + 6)}
                        className="theme-accent-bg rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </div>
              </motion.section>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
