"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import { getUserByUsername } from "@/app/lib/social";
import ProfileCard from "@/app/components/ProfileCard";
import GameCard from "@/app/components/GameCard";
import GameSticker from "@/app/components/GameSticker";

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
  wallpaper?: { data?: string; url?: string } | string | null;
  avatar?: { data?: string } | null;
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
  review?: { text?: string; sticker?: string | null };
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
  thumbPath?: string;
  storagePath?: string;
  coverUrl?: string;
  url?: string;
  image?: string;
};

const TAB_ORDER = [
  { id: "profile", label: "Overview" },
  { id: "games", label: "Library" },
  { id: "reviews", label: "Reviews" },
  { id: "screenshots", label: "Shots" },
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => tabParam);
  const [gamesVisible, setGamesVisible] = useState(12);
  const [reviewsVisible, setReviewsVisible] = useState(3);
  const [screensVisible, setScreensVisible] = useState(8);
  const [gameQuery, setGameQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const u = await getUserByUsername(username);
      if (!mounted) return;
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({ uid: u.id, ...u });

      const libSnap = await getDocs(
        collection(db, "users", u.id, "games_igdb"),
      );
      const games = libSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as LibraryGame[];
      setLibrary(games);

      const revs = games
        .filter((g) => g.review?.text && g.review.text.trim())
        .map((g) => ({
          id: g.id,
          gameId: g.igdb?.id || g.id,
          gameName: g.igdb?.name || g.name,
          text: g.review?.text?.trim() ?? "",
          sticker: g.review?.sticker ?? g.sticker ?? null,
          createdAt: g.lastUpdated || new Date(),
        }));
      setReviews(revs);

      const shotSnap = await getDocs(
        collection(db, "users", u.id, "screenshots"),
      );
      setScreenshots(
        shotSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        })) as ScreenshotItem[],
      );

      setLoading(false);
    })().catch((err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [username]);

  const favoriteGames = useMemo(
    () => library.filter((g) => g.favorite).slice(0, 4),
    [library],
  );

  const recentlyPlayed = useMemo(
    () =>
      [...library]
        .sort((a, b) => {
          const aSession = Array.isArray(a.playedSessions)
            ? a.playedSessions.reduce(
                (latest, session) =>
                  Math.max(latest, toTime(session?.playedAt)),
                0,
              )
            : 0;
          const bSession = Array.isArray(b.playedSessions)
            ? b.playedSessions.reduce(
                (latest, session) =>
                  Math.max(latest, toTime(session?.playedAt)),
                0,
              )
            : 0;
          return (
            Math.max(toTime(b.lastUpdated), bSession) -
            Math.max(toTime(a.lastUpdated), aSession)
          );
        })
        .slice(0, 5),
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

  const visibleLibrary = filteredLibrary.slice(0, gamesVisible);
  const visibleReviews = reviews.slice(0, reviewsVisible);
  const visibleScreenshots = screenshots.slice(0, screensVisible);

  const currentYear = new Date().getFullYear();
  const gamesPlayed = library.length;
  const completedCount = library.filter((g) => g.status === "Completed").length;
  const playingCount = library.filter((g) => g.status === "Playing").length;
  const favoriteCount = library.filter((g) => g.favorite).length;
  // const activeThisYear = library.filter((g) => {
  //   const playedSessions = g.playedSessions ?? g.playSessions;
  //   const hasSessionsInYear = Array.isArray(playedSessions)
  //     ? playedSessions.some((session) => {
  //         const sessionDate = hasToDate(session?.playedAt)
  //           ? session.playedAt.toDate()
  //           : session?.playedAt;
  //         return sessionDate
  //           ? new Date(sessionDate).getFullYear() === currentYear
  //           : false;
  //       })
  //     : false;
  //   const activeStatus = ["Playing", "Completed", "On Hold"];
  //   const statusMatch =
  //     activeStatus.includes(g.status ?? "") &&
  //     (hasToDate(g.lastUpdated)
  //       ? g.lastUpdated.toDate().getFullYear()
  //       : new Date(g.lastUpdated ?? 0).getFullYear()) === currentYear;
  //   return hasSessionsInYear || statusMatch;
  // }).length;
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
  const currentPlaying = useMemo(
    () =>
      [...library]
        .filter((g) => g.status === "Playing")
        .sort((a, b) => toTime(b.lastUpdated) - toTime(a.lastUpdated))[0],
    [library],
  );

  const currentPlayingGames = useMemo(
    () =>
      [...library]
        .filter((g) => g.status === "Playing")
        .sort((a, b) => toTime(b.lastUpdated) - toTime(a.lastUpdated)),
    [library],
  );

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <span className="loading loading-dots loading-lg text-cyan-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center theme-text">
        User not found
      </div>
    );
  }

  const wallpaper =
    typeof profile?.wallpaper === "string"
      ? profile.wallpaper
      : (profile?.wallpaper?.data ?? profile?.wallpaper?.url ?? null);

  return (
    <main className="relative min-h-screen overflow-hidden theme-bg">
      {wallpaper ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--theme-accent-rgb),0.12),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.82))]" />
      )}
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[1px]" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="rounded-[32px] border border-white/10 bg-black/45 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="m-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2">
                <span>🚧</span>
                <span className="font-semibold text-amber-300">
                  Community Feature is Currently in Beta
                </span>
              </div>

              <p className="mt-2 text-sm text-white/70">
                You're seeing the first iteration of PlayCrew Social Feature.
                This feature will evolve significantly with future updates as
                the community grows.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                <ProfileCard profile={profile} />

                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Library", value: gamesPlayed },
                    { label: "Completion", value: `${completionRate}%` },
                    { label: "Favorites", value: favoriteCount },
                    { label: "Active", value: activeThisYear },
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
                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <h2 className="text-lg font-bold">Currently Playing</h2>
                  </div>
                  {currentPlaying ? (
                    <div className="flex gap-4">
                      <img
                        src={
                          currentPlaying.igdb?.cover || "/placeholder-game.jpg"
                        }
                        alt=""
                        aria-hidden="true"
                        className="h-24 w-16 rounded-2xl object-cover shadow-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">
                          {currentPlaying.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {currentPlaying.progress ?? 0}% complete
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-white"
                            style={{
                              width: `${currentPlaying.progress ?? 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                      Nothing currently in progress.
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Favorite Games</h2>
                    {favoriteGames.length >= 4 && (
                      <Link
                        href={`/users/${username}?tab=games`}
                        className="text-sm text-zinc-400 transition hover:text-white"
                      >
                        View All
                      </Link>
                    )}
                  </div>
                  {favoriteGames.length > 0 ? (
                    <div className="overflow-x-auto pb-2">
                      <div className="flex min-w-max gap-3">
                        {favoriteGames.map((g) => (
                          <div
                            key={g.id}
                            className="group w-[160px] shrink-0 overflow-hidden rounded-[24px] border border-white/8 bg-black/20 transition hover:-translate-y-1 hover:border-white/15"
                          >
                            <Link
                              href={`/game/${g.igdb?.id ?? g.id}`}
                              className="block"
                            >
                              <div className="relative aspect-[3/4] overflow-hidden">
                                <img
                                  src={g.igdb?.cover || "/placeholder-game.jpg"}
                                  alt=""
                                  aria-hidden="true"
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/20 to-transparent p-3">
                                  <p className="line-clamp-2 text-sm font-semibold text-white">
                                    {g.name}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 px-3 py-2">
                                <span className="truncate text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                  Favorite
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {g.status || "Tracked"}
                                </span>
                              </div>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                      No favorite games yet.
                    </div>
                  )}
                </section>

                {/* <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Activity</h2>
                    <span className="text-sm text-zinc-400">{activeThisYear} this year</span>
                  </div>
                  <div className="space-y-3">
                    {recentlyPlayed.slice(0, 3).map((game) => (
                      <div key={game.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/15 p-3">
                        <img
                          src={game.igdb?.cover || "/placeholder-game.jpg"}
                          alt=""
                          aria-hidden="true"
                          className="h-12 w-9 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{game.name}</div>
                          <div className="text-xs text-zinc-500">Updated {formatDate(game.lastUpdated)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section> */}
              </aside>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/35">
              <div className="border-b border-white/10 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                  {TAB_ORDER.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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
                {activeTab === "profile" && (
                  <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                    <div className="space-y-6">
                      {recentlyPlayed.length > 0 && (
                        <section>
                          <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                              Recently Played
                            </h2>
                            {recentlyPlayed.length >= 5 && (
                              <Link
                                href={`/users/${username}?tab=games`}
                                className="text-sm text-zinc-400 transition hover:text-white"
                              >
                                View All
                              </Link>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                            {recentlyPlayed.map((g) => (
                              <div
                                key={g.id}
                                className="overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.03]"
                              >
                                <GameCard game={g} showActions={false} />
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {reviews.length > 0 && (
                        <section>
                          <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                              Recent Reviews
                            </h2>
                            {reviews.length > 3 && (
                              <Link
                                href={`/users/${username}?tab=reviews`}
                                className="text-sm text-zinc-400 transition hover:text-white"
                              >
                                View All
                              </Link>
                            )}
                          </div>

                          <div className="space-y-3">
                            {visibleReviews.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                              >
                                <div className="flex items-start gap-4">
                                  {r.sticker && (
                                    <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                      {r.sticker.startsWith("http") ||
                                      r.sticker.startsWith("/") ? (
                                        <img
                                          src={r.sticker}
                                          alt=""
                                          aria-hidden="true"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <GameSticker stickerId={r.sticker} />
                                      )}
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

                          {reviewsVisible < reviews.length && (
                            <div className="mt-4 flex justify-center">
                              <button
                                type="button"
                                onClick={() => setReviewsVisible((v) => v + 3)}
                                className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                              >
                                Load More Reviews
                              </button>
                            </div>
                          )}
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
                        <h2 className="text-lg font-bold">Library Activity</h2>
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
                            <span>Active This Year</span>
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
                        <h2 className="text-2xl font-bold">Game Library</h2>
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
                            setGamesVisible(12);
                          }}
                          placeholder="Search games..."
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                        />
                      </div>
                    </div>

                    {filteredLibrary.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {visibleLibrary.map((g) => (
                            <GameCard key={g.id} game={g} showActions={false} />
                          ))}
                        </div>
                        {gamesVisible < filteredLibrary.length && (
                          <div className="mt-6 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setGamesVisible((v) => v + 12)}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                            >
                              Load More Games
                            </button>
                          </div>
                        )}
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
                    <h2 className="text-2xl font-bold">All Reviews</h2>
                    <div className="mt-5 space-y-3">
                      {reviews.length > 0 ? (
                        reviews.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex items-start gap-4">
                              {r.sticker && (
                                <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                  {r.sticker.startsWith("http") ||
                                  r.sticker.startsWith("/") ? (
                                    <img
                                      src={r.sticker}
                                      alt=""
                                      aria-hidden="true"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <GameSticker stickerId={r.sticker} />
                                  )}
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
                          No reviews yet
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "screenshots" && (
                  <section>
                    <h2 className="text-2xl font-bold">Screenshots</h2>
                    {screenshots.length > 0 ? (
                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {visibleScreenshots.map((s) => (
                          <Link
                            key={s.id}
                            href={`/screenshots/${s.id}`}
                            className="group relative aspect-video overflow-hidden rounded-2xl border border-white/8 bg-black/20"
                          >
                            <img
                              src={
                                s.thumbPath ??
                                s.storagePath ??
                                s.coverUrl ??
                                s.url ??
                                s.image ??
                                "/placeholder-game.jpg"
                              }
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                        No screenshots yet
                      </div>
                    )}

                    {screensVisible < screenshots.length && (
                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setScreensVisible((v) => v + 8)}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                        >
                          Load More Screenshots
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
