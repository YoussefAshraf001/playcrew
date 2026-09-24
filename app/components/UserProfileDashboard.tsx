"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiActivity,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiCompass,
  FiDownload,
  FiHeart,
  FiMonitor,
  FiPauseCircle,
  FiImage,
  FiInfo,
  FiMessageSquare,
  FiSearch,
  FiSettings,
  FiStar,
  FiSlash,
  FiUser,
  FiX,
} from "react-icons/fi";

import { db } from "@/app/lib/firebase";
import { getUserByUsername } from "@/app/lib/social";
import GameCard from "@/app/components/GameCard";
import BadgeCabinet from "@/app/components/BadgeCabinet";
import CollectionGenreChart from "@/app/components/CollectionGenreChart";
import FriendButton from "@/app/components/social/FriendButton";
import { GAME_STICKERS } from "@/app/lib/gameStickers";
import { THEME_PRESETS } from "@/app/lib/themes";
import { useUser } from "@/app/context/UserContext";

function LoopingReviewSticker({
  sticker,
  active,
}: {
  sticker: string;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localSticker = GAME_STICKERS.find((item) => item.id === sticker);
  const source = localSticker?.image ?? sticker;

  useEffect(() => {
    if (active || !canvasRef.current) return;
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight,
      );
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    };
    image.src = source;
  }, [active, source]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {active ? (
        <img
          key={source}
          src={source}
          alt={localSticker?.label ?? "Review sticker"}
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          role="img"
          aria-label={localSticker?.label ?? "Review sticker"}
          className="h-full w-full object-contain"
        />
      )}
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
        localData?: string;
        url?: string;
        type?: "image" | "gif";
        crop?: {
          x: number;
          y: number;
          zoom: number;
          area?: { x: number; y: number; width: number; height: number };
        };
      }
    | string
    | null;
  avatar?:
    | string
    | {
        data?: string;
        localData?: string;
        type?: "image" | "gif";
        crop?: {
          x: number;
          y: number;
          zoom: number;
          area?: { x: number; y: number; width: number; height: number };
        };
      }
    | null;
  unlockedBadgeIds?: string[];
  badgeUnlockedAt?: Record<string, unknown>;
  themePreset?: string;
};

type LibraryGame = {
  id: string;
  name?: string;
  status?: string;
  favorite?: boolean;
  favoriteOrder?: number | null;
  backlog?: boolean;
  playedSessions?: Array<{
    playedAt?: FirestoreTimestampLike | string | Date | null;
  }>;
  playSessions?: unknown;
  lastUpdated?: FirestoreTimestampLike | string | Date | null;
  progress?: number;
  playtime?: number | null;
  my_rating?: number | null;
  notInterested?: boolean;
  review?: {
    text?: string;
    sticker?: string | null;
    createdAt?: FirestoreTimestampLike | string | Date | null;
    updatedAt?: FirestoreTimestampLike | string | Date | null;
  };
  sticker?: string | null;
  playedOn?: string | string[] | null;
  igdb?: {
    id?: number;
    name?: string;
    cover?: string;
    genres?: string[];
    platforms?: string[];
    releaseDate?: FirestoreTimestampLike | string | Date | null;
  };
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
                      ? `${game.progress ?? 0}% completion`
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
  return (
    <nav
      className="z-20 flex h-16 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[rgba(var(--theme-bg-rgb),0.88)] px-3 shadow-[0_-14px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl"
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
  const { user } = useUser();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "profile";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [hoveredReviewId, setHoveredReviewId] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [screenshotQuery, setScreenshotQuery] = useState("");
  const [screenshotsUnavailable, setScreenshotsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState(() => tabParam);
  const [gamePage, setGamePage] = useState(1);
  const [reviewsVisible, setReviewsVisible] = useState(6);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewQuery, setReviewQuery] = useState("");
  const [insightSettingsOpen, setInsightSettingsOpen] = useState(false);
  const [excludeOnlineFromInsights, setExcludeOnlineFromInsights] =
    useState(false);
  const [hiddenInsightGameIds, setHiddenInsightGameIds] = useState<Set<string>>(
    new Set(),
  );
  const [insightGameQuery, setInsightGameQuery] = useState("");
  const [hiddenGamesDrawerOpen, setHiddenGamesDrawerOpen] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);

  useEffect(() => {
    setExcludeOnlineFromInsights(
      window.localStorage.getItem(
        `profile.insights.excludeOnline.${username}`,
      ) === "true",
    );
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(
          `profile.insights.hiddenGames.${username}`,
        ) ?? "[]",
      ) as unknown;
      setHiddenInsightGameIds(
        new Set(
          Array.isArray(stored)
            ? stored.filter((id): id is string => typeof id === "string")
            : [],
        ),
      );
    } catch {
      setHiddenInsightGameIds(new Set());
    }
  }, [username]);
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
    () =>
      library
        .filter((g) => g.favorite)
        .sort(
          (a, b) =>
            (a.favoriteOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.favoriteOrder ?? Number.MAX_SAFE_INTEGER),
        ),
    [library],
  );

  const insightLibrary = useMemo(
    () =>
      library.filter(
        (game) =>
          (!excludeOnlineFromInsights || game.status !== "Online") &&
          !hiddenInsightGameIds.has(String(game.id)),
      ),
    [excludeOnlineFromInsights, hiddenInsightGameIds, library],
  );
  const hiddenInsightGames = useMemo(
    () => library.filter((game) => hiddenInsightGameIds.has(String(game.id))),
    [hiddenInsightGameIds, library],
  );
  const insightGameSearchResults = useMemo(() => {
    const query = insightGameQuery.trim().toLowerCase();
    if (!query) return [];
    return library
      .filter(
        (game) =>
          !hiddenInsightGameIds.has(String(game.id)) &&
          (game.name ?? game.igdb?.name ?? "").toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [hiddenInsightGameIds, insightGameQuery, library]);

  const saveHiddenInsightGames = (ids: Set<string>) => {
    setHiddenInsightGameIds(ids);
    window.localStorage.setItem(
      `profile.insights.hiddenGames.${username}`,
      JSON.stringify([...ids]),
    );
  };

  const filteredLibrary = useMemo(() => {
    const q = gameQuery.trim().toLowerCase();
    return library
      .filter((g) => {
        if (!q) return true;
        const name = String(g.name ?? g.igdb?.name ?? "").toLowerCase();
        const status = String(g.status ?? "").toLowerCase();
        return name.includes(q) || status.includes(q);
      })
      .sort((a, b) => {
        const dateDifference =
          toTime(b.igdb?.releaseDate) - toTime(a.igdb?.releaseDate);
        if (dateDifference !== 0) return dateDifference;
        return String(a.name ?? a.igdb?.name ?? "").localeCompare(
          String(b.name ?? b.igdb?.name ?? ""),
        );
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
  const reviewsPerPage = 3;
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
  const filteredScreenshots = useMemo(() => {
    const query = screenshotQuery.trim().toLowerCase();
    if (!query) return screenshots;
    return screenshots.filter((screenshot) => {
      const linkedGame =
        screenshot.igdbId == null
          ? null
          : library.find((game) => game.igdb?.id === screenshot.igdbId);
      return [screenshot.name, linkedGame?.name, linkedGame?.igdb?.name].some(
        (value) => value?.toLowerCase().includes(query),
      );
    });
  }, [library, screenshotQuery, screenshots]);
  const screenshotPageCount = Math.max(
    1,
    Math.ceil(filteredScreenshots.length / screenshotsPerPage),
  );
  const pagedScreenshots = filteredScreenshots.slice(
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
    setScreenshotPage(1);
  }, [screenshotQuery]);

  useEffect(() => {
    setScreenshotPage((page) => Math.min(page, screenshotPageCount));
  }, [screenshotPageCount]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewQuery]);

  useEffect(() => {
    setReviewPage((page) => Math.min(page, reviewPageCount));
  }, [reviewPageCount]);

  const gamesPlayed = insightLibrary.length;
  const completedCount = insightLibrary.filter(
    (g) => g.status === "Completed",
  ).length;
  const playingCount = insightLibrary.filter(
    (g) => g.status === "Playing",
  ).length;
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
  const collectionInsights = useMemo(() => {
    const totalHours = insightLibrary.reduce(
      (sum, game) =>
        sum + (typeof game.playtime === "number" ? game.playtime : 0),
      0,
    );
    const ratings = insightLibrary
      .map((game) => game.my_rating)
      .filter(
        (rating): rating is number =>
          typeof rating === "number" && Number.isFinite(rating),
      );
    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null;
    const countValues = (values: string[]) => {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        const clean = value.trim();
        if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
      });
      return (
        [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "Not enough data"
      );
    };
    const topGenre = countValues(
      insightLibrary.flatMap((game) => game.igdb?.genres ?? []),
    );
    const topPlatform = countValues(
      insightLibrary.flatMap((game) => {
        const playedOn = Array.isArray(game.playedOn)
          ? game.playedOn
          : game.playedOn
            ? [game.playedOn]
            : [];
        return playedOn.length ? playedOn : (game.igdb?.platforms ?? []);
      }),
    );
    const mostPlayed =
      [...insightLibrary]
        .filter((game) => (game.playtime ?? 0) > 0)
        .sort((a, b) => (b.playtime ?? 0) - (a.playtime ?? 0))[0] ?? null;
    const highestRated =
      [...insightLibrary]
        .filter(
          (game) =>
            typeof game.my_rating === "number" &&
            Number.isFinite(game.my_rating),
        )
        .sort((a, b) => (b.my_rating ?? 0) - (a.my_rating ?? 0))[0] ?? null;
    const latestCompletion =
      [...insightLibrary]
        .filter((game) => game.status === "Completed")
        .sort((a, b) => toTime(b.lastUpdated) - toTime(a.lastUpdated))[0] ??
      null;
    const statusCounts = new Map<string, number>();
    insightLibrary.forEach((game) => {
      const status = game.status?.trim() || "No status";
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    });
    const completed = insightLibrary.filter(
      (game) => game.status === "Completed",
    ).length;

    const dropped = insightLibrary.filter(
      (game) => game.status === "Dropped",
    ).length;

    const startedGames = insightLibrary.filter((game) =>
      ["Completed", "Playing", "On Hold", "Dropped"].includes(
        game.status ?? "",
      ),
    );

    const gamesWithPlaytime = insightLibrary.filter(
      (game) =>
        typeof game.playtime === "number" &&
        Number.isFinite(game.playtime) &&
        game.playtime > 0,
    );

    const averagePlaytime = gamesWithPlaytime.length
      ? gamesWithPlaytime.reduce((sum, game) => sum + (game.playtime ?? 0), 0) /
        gamesWithPlaytime.length
      : 0;

    const finishRate = startedGames.length
      ? (completed / startedGames.length) * 100
      : 0;

    const dropRate = startedGames.length
      ? (dropped / startedGames.length) * 100
      : 0;

    const reviewedGames = insightLibrary.filter((game) =>
      game.review?.text?.trim(),
    ).length;

    const reviewRate = startedGames.length
      ? (reviewedGames / startedGames.length) * 100
      : 0;

    const genreCounts = new Map<string, number>();

    insightLibrary.forEach((game) => {
      game.igdb?.genres?.forEach((genre) => {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      });
    });

    const dominantGenre =
      [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const dominantGenreName = dominantGenre?.[0] ?? null;
    const dominantGenreCount = dominantGenre?.[1] ?? 0;

    const totalGenreOccurrences = [...genreCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    );

    const dominantGenreShare = totalGenreOccurrences
      ? (dominantGenreCount / totalGenreOccurrences) * 100
      : 0;
    let playstyle = {
      label: "Balanced",
      detail: "A bit of everything",
    };

    if (startedGames.length >= 5) {
      if (finishRate >= 80) {
        playstyle = {
          label: "Completionist",
          detail: `${Math.round(finishRate)}% finish rate`,
        };
      } else if (averagePlaytime >= 50) {
        playstyle = {
          label: "Marathoner",
          detail: `${Math.round(averagePlaytime)}h avg. per game`,
        };
      } else if (reviewRate >= 60 && reviewedGames >= 5) {
        playstyle = {
          label: "Critic",
          detail: `${reviewedGames} games reviewed`,
        };
      } else if (
        dominantGenreShare >= 35 &&
        dominantGenreCount >= 5 &&
        dominantGenreName
      ) {
        playstyle = {
          label: "Specialist",
          detail: `${Math.round(dominantGenreShare)}% ${dominantGenreName}`,
        };
      } else if (dropRate >= 40) {
        playstyle = {
          label: "Picky",
          detail: `${Math.round(dropRate)}% drop rate`,
        };
      } else if (averagePlaytime <= 10 && gamesWithPlaytime.length >= 5) {
        playstyle = {
          label: "Sampler",
          detail: `${Math.round(averagePlaytime)}h avg. per game`,
        };
      } else if (startedGames.length >= 20 && finishRate < 50) {
        playstyle = {
          label: "Explorer",
          detail: `${startedGames.length} games explored`,
        };
      } else if (averagePlaytime >= 25) {
        playstyle = {
          label: "Dedicated",
          detail: `${Math.round(averagePlaytime)}h avg. per game`,
        };
      }
    }
    const statusColors: Record<string, string> = {
      Completed: "#22c55e",
      Playing: "#22d3ee",
      "Want To Play": "#a78bfa",
      Dropped: "#fb7185",
      "On Hold": "#f59e0b",
      Online: "#3b82f6",
    };
    const fallbackStatusColors = [
      "#f97316",
      "#ec4899",
      "#14b8a6",
      "#84cc16",
      "#8b5cf6",
    ];
    const statusOrder = [
      "Completed",
      "Playing",
      "Want To Play",
      "On Hold",
      "Dropped",
      "Online",
    ];
    const statuses = [...statusCounts.entries()]
      .sort(
        ([a], [b]) =>
          (statusOrder.indexOf(a) < 0
            ? statusOrder.length
            : statusOrder.indexOf(a)) -
            (statusOrder.indexOf(b) < 0
              ? statusOrder.length
              : statusOrder.indexOf(b)) || a.localeCompare(b),
      )
      .map(([status, count], index) => ({
        label: status === "Want To Play" ? "Backlog" : status,
        count,
        color:
          statusColors[status] ??
          fallbackStatusColors[index % fallbackStatusColors.length],
      }));

    return {
      totalHours,
      averageRating,
      topGenre,
      topPlatform,
      mostPlayed,
      highestRated,
      latestCompletion,
      playstyle,
      statuses,
    };
  }, [insightLibrary, completedCount, playingCount]);
  const otherStatusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    insightLibrary.forEach((game) => {
      const status = game.status?.trim() || "No status";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [insightLibrary]);

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
      : typeof window !== "undefined" &&
          window.playcrewDesktop &&
          profile?.wallpaper?.localData
        ? profile.wallpaper.localData
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
      : typeof window !== "undefined" &&
          window.playcrewDesktop &&
          profile.avatar?.localData
        ? profile.avatar.localData
        : (profile.avatar?.data ?? null);
  const avatarCrop =
    typeof profile.avatar === "object" && profile.avatar?.type === "gif"
      ? profile.avatar.crop
      : undefined;
  const avatarCropArea = avatarCrop?.area;
  const avatarCropStyle = avatarCropArea
    ? {
        position: "absolute" as const,
        left: `${(-avatarCropArea.x / avatarCropArea.width) * 100}%`,
        top: `${(-avatarCropArea.y / avatarCropArea.height) * 100}%`,
        width: `${10000 / avatarCropArea.width}%`,
        height: `${10000 / avatarCropArea.height}%`,
        maxWidth: "none",
      }
    : avatarCrop
      ? {
          transform: `translate(${avatarCrop.x / 4.4}%, ${avatarCrop.y / 4.4}%) scale(${avatarCrop.zoom})`,
        }
      : undefined;
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

        {/* <div
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
        </div> */}

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
                                style={avatarCropStyle}
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
                            {profile.bio?.trim() && (
                              <p
                                className="mt-1.5 line-clamp-2 max-w-xl text-xs leading-relaxed text-white/65 sm:text-sm"
                                title={profile.bio}
                              >
                                {profile.bio}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {user?.uid === profile.uid ? (
                            <Link
                              href={`/profile/${encodeURIComponent(profile.username ?? username)}/edit`}
                              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                            >
                              Edit profile
                            </Link>
                          ) : (
                            <FriendButton targetUid={profile.uid} />
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                          Player insights
                        </p>
                        <h2 className="mt-1 text-lg font-bold">
                          Collection at a glance
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInsightSettingsOpen(true)}
                        aria-label="Open player insight settings"
                        title="Insight settings"
                        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300/75 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-200"
                      >
                        <FiSettings className="h-4.5 w-4.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 border-b border-white/8 sm:grid-cols-4">
                      {[
                        {
                          label: "Games",
                          value: gamesPlayed,
                          icon: FiBookOpen,
                        },
                        {
                          label: "Completed",
                          value: completedCount,
                          icon: FiCheckCircle,
                        },
                        {
                          label: "Hours played",
                          value: Math.round(
                            collectionInsights.totalHours,
                          ).toLocaleString(),
                          icon: FiClock,
                        },
                        {
                          label: "Average rating",
                          value:
                            collectionInsights.averageRating === null
                              ? "—"
                              : collectionInsights.averageRating.toFixed(1),
                          icon: FiStar,
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className="border-white/8 p-4 even:border-l sm:border-l sm:first:border-l-0"
                          >
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Icon className="h-3.5 w-3.5 text-cyan-300/70" />
                              <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
                                {item.label}
                              </span>
                            </div>
                            <p className="mt-2 text-2xl font-black tracking-tight text-white">
                              {item.value}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-6 p-5">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-zinc-300">
                            Collection breakdown
                          </p>
                          <span className="text-xs font-bold text-cyan-300">
                            {completionRate}% Completion rate
                          </span>
                        </div>
                        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/5">
                          {collectionInsights.statuses.map((item) => (
                            <div
                              key={item.label}
                              title={`${item.label}: ${item.count}`}
                              style={{
                                width: `${gamesPlayed ? (item.count / gamesPlayed) * 100 : 0}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                          {collectionInsights.statuses.map((item) => (
                            <span
                              key={item.label}
                              className="flex items-center gap-1.5 text-[11px] text-zinc-400"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.label}{" "}
                              <strong className="font-semibold text-zinc-200">
                                {item.count}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-xs font-semibold text-zinc-300">
                          Collection identity
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            {
                              label: "Favorite genre",
                              value: collectionInsights.topGenre,
                              detail: "Most represented",
                              icon: FiCompass,
                            },
                            {
                              label: "Top platform",
                              value: collectionInsights.topPlatform,
                              detail: "Most used",
                              icon:
                                collectionInsights.topPlatform.toLowerCase() ===
                                "pirated"
                                  ? FiDownload
                                  : FiMonitor,
                            },
                            {
                              label: "Playstyle",
                              value: collectionInsights.playstyle.label,
                              detail: collectionInsights.playstyle.detail,
                              icon: FiActivity,
                            },
                            {
                              label: "Most played",
                              value:
                                collectionInsights.mostPlayed?.name ??
                                "No playtime logged",
                              detail: collectionInsights.mostPlayed
                                ? `${Math.round(collectionInsights.mostPlayed.playtime ?? 0)}h`
                                : "",
                              background:
                                collectionInsights.mostPlayed?.igdb?.cover,
                            },
                            {
                              label: "Highest rated",
                              value:
                                collectionInsights.highestRated?.name ??
                                "No ratings yet",
                              detail: collectionInsights.highestRated
                                ? `${collectionInsights.highestRated.my_rating}/10`
                                : "",
                              background:
                                collectionInsights.highestRated?.igdb?.cover,
                            },
                            {
                              label: "Latest completion",
                              value:
                                collectionInsights.latestCompletion?.name ??
                                "Nothing completed",
                              detail: collectionInsights.latestCompletion
                                ? formatDate(
                                    collectionInsights.latestCompletion
                                      .lastUpdated,
                                  )
                                : "",
                              background:
                                collectionInsights.latestCompletion?.igdb
                                  ?.cover,
                            },
                          ].map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <div
                                key={item.label}
                                className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20 p-3"
                                style={
                                  item.background
                                    ? {
                                        backgroundImage: `linear-gradient(90deg, rgba(5,5,7,.96) 0%, rgba(5,5,7,.84) 58%, rgba(5,5,7,.4) 100%), url(${item.background})`,
                                        backgroundPosition: "center 28%",
                                        backgroundSize: "cover",
                                      }
                                    : undefined
                                }
                              >
                                <div className="relative z-10">
                                  <div className="flex items-center gap-1.5 text-zinc-500">
                                    {ItemIcon && (
                                      <ItemIcon className="h-3 w-3 text-cyan-300/70" />
                                    )}
                                    <p className="text-[9px] font-bold uppercase tracking-[0.16em]">
                                      {item.label}
                                    </p>
                                  </div>
                                  <p
                                    className="mt-1.5 line-clamp-2 min-h-8 text-sm font-semibold capitalize leading-4 text-white"
                                    title={item.value}
                                  >
                                    {item.value}
                                  </p>
                                  {item.detail && (
                                    <p className="mt-1.5 text-[10px] font-bold text-cyan-300">
                                      {item.detail}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
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
                  <CollectionGenreChart games={insightLibrary} />
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
                      className="flex h-[640px] flex-col overflow-hidden sm:h-[680px]"
                    >
                      <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2">
                        {activeTab === "profile" && (
                          <div>
                            <div className="min-w-0 space-y-5">
                              <BadgeCabinet
                                games={library}
                                unlockedBadgeIds={profile.unlockedBadgeIds}
                                badgeUnlockedAt={profile.badgeUnlockedAt}
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
                                        onMouseEnter={() =>
                                          setHoveredReviewId(r.id)
                                        }
                                        onMouseLeave={() =>
                                          setHoveredReviewId(null)
                                        }
                                        onFocusCapture={() =>
                                          setHoveredReviewId(r.id)
                                        }
                                        onBlurCapture={(event) => {
                                          if (
                                            !event.currentTarget.contains(
                                              event.relatedTarget,
                                            )
                                          )
                                            setHoveredReviewId(null);
                                        }}
                                        className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055] hover:shadow-[0_14px_35px_rgba(var(--theme-accent-rgb),0.12)] focus-within:border-cyan-300/30"
                                      >
                                        <div className="flex items-start gap-4">
                                          {r.sticker ? (
                                            <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/5 transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105">
                                              <LoopingReviewSticker
                                                sticker={r.sticker}
                                                active={
                                                  hoveredReviewId === r.id
                                                }
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
                                                className="truncate text-sm font-semibold text-white transition-colors group-hover:text-cyan-200 hover:underline"
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

                            <aside className="hidden">
                              <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                                <h2 className="text-lg font-bold">About</h2>
                                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                  {profile?.bio || "No bio yet."}
                                </p>
                              </section>

                              <section className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
                                <div className="border-b border-white/8 px-5 py-4">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
                                    Player highlights
                                  </p>
                                  <h2 className="mt-1 text-lg font-bold">
                                    Collection identity
                                  </h2>
                                </div>
                                <div className="divide-y divide-white/8">
                                  {[
                                    {
                                      label: "Most played game",
                                      value:
                                        collectionInsights.mostPlayed?.name ??
                                        "No playtime logged",
                                      detail: collectionInsights.mostPlayed
                                        ? `${Math.round(collectionInsights.mostPlayed.playtime ?? 0)} hours`
                                        : "",
                                    },
                                    {
                                      label: "Highest-rated game",
                                      value:
                                        collectionInsights.highestRated?.name ??
                                        "No ratings yet",
                                      detail: collectionInsights.highestRated
                                        ? `${collectionInsights.highestRated.my_rating}/10`
                                        : "",
                                    },
                                    {
                                      label: "Latest completion",
                                      value:
                                        collectionInsights.latestCompletion
                                          ?.name ?? "Nothing completed yet",
                                      detail:
                                        collectionInsights.latestCompletion
                                          ? formatDate(
                                              collectionInsights
                                                .latestCompletion.lastUpdated,
                                            )
                                          : "",
                                    },
                                    {
                                      label: "Favorite genre",
                                      value: collectionInsights.topGenre,
                                      detail: "Most represented",
                                    },
                                    {
                                      label: "Top platform",
                                      value: collectionInsights.topPlatform,
                                      detail: "Most used",
                                    },
                                    {
                                      label: "Playstyle",
                                      value: collectionInsights.playstyle.label,
                                      detail:
                                        collectionInsights.playstyle.detail,
                                    },
                                  ].map((item) => (
                                    <div
                                      key={item.label}
                                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                          {item.label}
                                        </p>
                                        <p
                                          className="mt-1 truncate text-sm font-semibold text-white capitalize"
                                          title={item.value}
                                        >
                                          {item.value}
                                        </p>
                                      </div>
                                      {item.detail && (
                                        <span className="shrink-0 text-xs font-semibold text-cyan-300">
                                          {item.detail}
                                        </span>
                                      )}
                                    </div>
                                  ))}
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
                                  {/* {filteredReviews.length}{" "}
                                {filteredReviews.length === 1
                                  ? "review"
                                  : "reviews"} */}
                                  Search by game title, then browse captured
                                  moments.
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
                          <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={`reviews-page-${reviewPage}-${reviewQuery}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="mt-5 space-y-3"
                          >
                              {pagedReviews.length > 0 ? (
                                pagedReviews.map((r) => (
                                  <div
                                    key={r.id}
                                    onMouseEnter={() =>
                                      setHoveredReviewId(r.id)
                                    }
                                    onMouseLeave={() =>
                                      setHoveredReviewId(null)
                                    }
                                    onFocusCapture={() =>
                                      setHoveredReviewId(r.id)
                                    }
                                    onBlurCapture={(event) => {
                                      if (
                                        !event.currentTarget.contains(
                                          event.relatedTarget,
                                        )
                                      )
                                        setHoveredReviewId(null);
                                    }}
                                    className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055] hover:shadow-[0_14px_35px_rgba(var(--theme-accent-rgb),0.12)] focus-within:border-cyan-300/30"
                                  >
                                    <div className="flex items-start gap-4">
                                      {r.sticker ? (
                                        <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/5 transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105">
                                          <LoopingReviewSticker
                                            sticker={r.sticker}
                                            active={hoveredReviewId === r.id}
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
                                            className="truncate text-sm font-semibold text-white transition-colors group-hover:text-cyan-200 hover:underline"
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
                            </motion.div>
                          </AnimatePresence>
                          </section>
                        )}

                        {activeTab === "screenshots" && (
                          <section>
                            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                              <div>
                                <h2 className="text-2xl font-bold">
                                  Screenshots
                                </h2>
                                <p className="mt-2 text-sm text-zinc-400">
                                  Search by game title, then browse captured
                                  moments.
                                </p>
                              </div>
                              <div className="w-full lg:max-w-sm">
                                <input
                                  value={screenshotQuery}
                                  onChange={(event) => {
                                    setScreenshotQuery(event.target.value);
                                    setScreenshotPage(1);
                                  }}
                                  placeholder="Search screenshots..."
                                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                                />
                              </div>
                            </div>

                            {filteredScreenshots.length > 0 ? (
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
                              </>
                            ) : screenshotsUnavailable ? (
                              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                                This player&apos;s screenshots are not publicly
                                available.
                              </div>
                            ) : (
                              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                                {screenshotQuery
                                  ? "No screenshots match that game title."
                                  : "No screenshots yet"}
                              </div>
                            )}
                          </section>
                        )}
                      </div>

                      {activeTab === "games" && (
                        <PageControls
                          page={gamePage}
                          pageCount={gamePageCount}
                          onPage={setGamePage}
                        />
                      )}
                      {activeTab === "reviews" && (
                        <PageControls
                          page={reviewPage}
                          pageCount={reviewPageCount}
                          onPage={setReviewPage}
                        />
                      )}
                      {activeTab === "screenshots" && (
                        <PageControls
                          page={screenshotPage}
                          pageCount={screenshotPageCount}
                          onPage={setScreenshotPage}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {insightSettingsOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInsightSettingsOpen(false)}
            >
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-labelledby="insight-settings-title"
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                onClick={(event) => event.stopPropagation()}
                className="theme-panel-strong relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border shadow-2xl"
              >
                <header className="flex items-center justify-between border-b theme-border px-6 py-5">
                  <div>
                    <p className="theme-accent-text text-[10px] font-bold uppercase tracking-[0.22em]">
                      Player insights
                    </p>
                    <h2
                      id="insight-settings-title"
                      className="theme-text mt-1 text-xl font-black"
                    >
                      Insight settings
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInsightSettingsOpen(false)}
                    aria-label="Close insight settings"
                    className="theme-surface theme-hover-surface theme-text rounded-full border p-2.5"
                  >
                    <FiX size={18} />
                  </button>
                </header>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={excludeOnlineFromInsights}
                    onClick={() => {
                      const next = !excludeOnlineFromInsights;
                      setExcludeOnlineFromInsights(next);
                      window.localStorage.setItem(
                        `profile.insights.excludeOnline.${username}`,
                        String(next),
                      );
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-300/25"
                  >
                    <span>
                      <span className="theme-text block text-sm font-bold">
                        Exclude Online games
                      </span>
                      <span className="theme-text-muted mt-1 block text-xs leading-relaxed">
                        Removes games with the Online status from totals,
                        ratings, playtime, genres, platforms, and highlights.
                      </span>
                    </span>
                    <span
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${excludeOnlineFromInsights ? "bg-[var(--theme-accent)]" : "bg-white/15"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${excludeOnlineFromInsights ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </span>
                  </button>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="theme-text text-sm font-bold">
                          Hide specific games
                        </h3>
                        <p className="theme-text-muted mt-1 text-xs">
                          Excluded games remain in the library but do not affect
                          insights.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHiddenGamesDrawerOpen(true)}
                        className="theme-surface theme-hover-surface shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold"
                      >
                        Hidden ({hiddenInsightGames.length})
                      </button>
                    </div>
                    <div className="relative mt-3">
                      <FiSearch className="theme-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={insightGameQuery}
                        onChange={(event) =>
                          setInsightGameQuery(event.target.value)
                        }
                        placeholder="Search library games..."
                        className="theme-surface theme-text w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-300/40"
                      />
                    </div>
                    {insightGameSearchResults.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                        {insightGameSearchResults.map((game) => (
                          <button
                            key={game.id}
                            type="button"
                            onClick={() => {
                              saveHiddenInsightGames(
                                new Set([
                                  ...hiddenInsightGameIds,
                                  String(game.id),
                                ]),
                              );
                              setInsightGameQuery("");
                            }}
                            className="theme-hover-surface flex w-full items-center gap-3 border-b border-white/8 px-3 py-2 text-left last:border-b-0"
                          >
                            <img
                              src={game.igdb?.cover || "/placeholder-game.jpg"}
                              alt=""
                              className="h-10 w-7 rounded object-cover"
                            />
                            <span className="theme-text min-w-0 flex-1 truncate text-sm font-semibold">
                              {game.name ?? game.igdb?.name}
                            </span>
                            <span className="theme-text-muted text-xs">
                              Hide
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="theme-text text-sm font-bold">
                        Full status breakdown
                      </h3>
                      <span className="theme-text-muted text-xs">
                        {otherStatusBreakdown.reduce(
                          (sum, [, count]) => sum + count,
                          0,
                        )}{" "}
                        games
                      </span>
                    </div>
                    <p className="theme-text-muted mt-1 text-xs">
                      Every library status and its exact game count.
                    </p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                      {otherStatusBreakdown.length ? (
                        otherStatusBreakdown.map(([status, count]) => (
                          <div
                            key={status}
                            className="flex items-center justify-between border-b border-white/8 px-4 py-3 text-sm last:border-b-0"
                          >
                            <span className="theme-text-muted">{status}</span>
                            <span className="theme-text font-bold">
                              {count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="theme-text-muted px-4 py-6 text-center text-sm">
                          No status data is available.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {hiddenGamesDrawerOpen && (
                    <>
                      <motion.button
                        type="button"
                        aria-label="Close hidden games drawer"
                        className="absolute inset-0 z-10 bg-black/55"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setHiddenGamesDrawerOpen(false)}
                      />
                      <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="theme-panel-strong absolute inset-y-0 right-0 z-20 flex w-[86%] max-w-sm flex-col border-l shadow-2xl"
                      >
                        <div className="flex items-center justify-between border-b theme-border px-4 py-4">
                          <div>
                            <p className="theme-accent-text text-[10px] font-bold uppercase tracking-wider">
                              Insight exclusions
                            </p>
                            <h3 className="theme-text mt-1 font-bold">
                              Hidden games
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHiddenGamesDrawerOpen(false)}
                            className="theme-surface rounded-full border p-2"
                            aria-label="Close drawer"
                          >
                            <FiX />
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          {hiddenInsightGames.length ? (
                            <div className="space-y-2">
                              {hiddenInsightGames.map((game) => (
                                <div
                                  key={game.id}
                                  className="theme-surface flex items-center gap-3 rounded-xl border p-2"
                                >
                                  <img
                                    src={
                                      game.igdb?.cover ||
                                      "/placeholder-game.jpg"
                                    }
                                    alt=""
                                    className="h-12 w-8 rounded object-cover"
                                  />
                                  <span className="theme-text min-w-0 flex-1 truncate text-sm font-semibold">
                                    {game.name ?? game.igdb?.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = new Set(
                                        hiddenInsightGameIds,
                                      );
                                      next.delete(String(game.id));
                                      saveHiddenInsightGames(next);
                                    }}
                                    className="rounded-lg border border-red-400/20 px-2 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/10"
                                  >
                                    Restore
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="theme-text-muted py-10 text-center text-sm">
                              No games are hidden from insights.
                            </p>
                          )}
                        </div>
                      </motion.aside>
                    </>
                  )}
                </AnimatePresence>
              </motion.section>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
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
                        onMouseEnter={() => setHoveredReviewId(review.id)}
                        onMouseLeave={() => setHoveredReviewId(null)}
                        onFocusCapture={() => setHoveredReviewId(review.id)}
                        onBlurCapture={(event) => {
                          if (
                            !event.currentTarget.contains(event.relatedTarget)
                          )
                            setHoveredReviewId(null);
                        }}
                        className="theme-surface group rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055] hover:shadow-[0_14px_35px_rgba(var(--theme-accent-rgb),0.12)] focus-within:border-cyan-300/30"
                      >
                        <div className="flex items-start gap-4">
                          {review.sticker ? (
                            <div className="theme-surface h-16 w-16 shrink-0 overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105">
                              <LoopingReviewSticker
                                sticker={review.sticker}
                                active={hoveredReviewId === review.id}
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
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={`/game/${review.gameId}`}
                                onClick={() => setReviewsModalOpen(false)}
                                className="theme-text truncate text-sm font-bold transition-colors group-hover:text-cyan-200 hover:underline"
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
