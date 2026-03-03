"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BsBellFill } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { useMusic } from "../context/MusicContext";
import { IoMailOpen } from "react-icons/io5";
import { MdDelete } from "react-icons/md";

type Game = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
  };
};

type Notification = {
  id: string;
  type: "game_release";
  gameId: string;
  gameName: string;
  gameCover?: string;
  message: string;
  releaseDate: Date | null;
  read: boolean;
  createdAt: Date | null;
};

type FireNotificationDoc = {
  gameId?: string;
  gameName?: string;
  gameCover?: string;
  message?: string;
  read?: boolean;
  createdAt?: unknown;
  releaseDate?: unknown;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    // Support both unix seconds and milliseconds.
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatTimeAgo = (value: Date | null, nowMs: number) => {
  if (!value) return "";

  const diffMs = nowMs - value.getTime();
  if (diffMs < 0) return "now";

  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d`;

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export default function NotificationBell({
  games,
  fullWidthTrigger = false,
}: {
  games: Game[];
  fullWidthTrigger?: boolean;
}) {
  const { user } = useUser();
  const { closePlayer } = useMusic();
  const uid = user?.uid as string | undefined;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [knownByUser, setKnownByUser] = useState<{
    uid: string;
    ids: Set<string>;
  } | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const currentItems = useMemo(() => (user ? items : []), [items, user]);

  const unreadCount = useMemo(
    () => currentItems.filter((item) => !item.read).length,
    [currentItems],
  );

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setKnownByUser(null);
      return;
    }

    const ref = collection(db, "users", uid, "notifications");
    const q = query(ref, orderBy("createdAt", "desc"), limit(25));

    const unsub = onSnapshot(q, (snap) => {
      const next: Notification[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as FireNotificationDoc;
        const createdAt = toDate(data.createdAt);
        const releaseDate = toDate(data.releaseDate);

        return {
          id: docSnap.id,
          type: "game_release",
          gameId: String(data.gameId ?? ""),
          gameName: data.gameName ?? "Unknown game",
          gameCover: data.gameCover,
          message: data.message ?? "A game in your list just released.",
          releaseDate,
          createdAt,
          read: !!data.read,
        };
      });

      setItems(next);
      setKnownByUser({
        uid,
        ids: new Set(snap.docs.map((d) => d.id)),
      });
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !knownByUser) return;
    if (knownByUser.uid !== uid) return;
    if (!games.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayKey = dateKey(today);
    const tomorrowKey = dateKey(tomorrow);
    const DAY_MS = 24 * 60 * 60 * 1000;
    const writes: Array<{
      id: string;
      gameId: string;
      gameName: string;
      gameCover?: string;
      releaseDate: Date;
      message: string;
    }> = [];

    for (const game of games) {
      const release = toDate(game.igdb?.releaseDate);
      if (!release) continue;

      release.setHours(0, 0, 0, 0);
      const releaseKey = dateKey(release);
      const diffDays = Math.floor(
        (release.getTime() - today.getTime()) / DAY_MS,
      );

      // Release day notification.
      if (releaseKey === todayKey || diffDays === 0) {
        const notificationId = `release-${game.id}-${todayKey}`;
        if (!knownByUser.ids.has(notificationId)) {
          writes.push({
            id: notificationId,
            gameId: String(game.id),
            gameName: game.name,
            gameCover: game.igdb?.cover,
            releaseDate: release,
            message: `Releases today.`,
          });
        }
        continue;
      }

      // Upcoming notification window: tomorrow only.
      if (releaseKey === tomorrowKey || diffDays === 1) {
        const soonId = `release-soon-${game.id}-${releaseKey}`;
        if (knownByUser.ids.has(soonId)) continue;

        writes.push({
          id: soonId,
          gameId: String(game.id),
          gameName: game.name,
          gameCover: game.igdb?.cover,
          releaseDate: release,
          message: "Releases tomorrow.",
        });
      }
    }

    if (!writes.length) return;

    const batch = writeBatch(db);

    for (const entry of writes) {
      const notificationRef = doc(db, "users", uid, "notifications", entry.id);

      batch.set(notificationRef, {
        type: "game_release",
        gameId: entry.gameId,
        gameName: entry.gameName,
        gameCover: entry.gameCover ?? null,
        message: entry.message,
        releaseDate: Timestamp.fromDate(entry.releaseDate),
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    batch.commit().catch((err) => {
      console.error("Failed to create release notifications", err);
    });
  }, [games, knownByUser, uid]);

  useEffect(() => {
    if (!uid || !currentItems.length) return;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trackedGameIds = new Set(games.map((g) => String(g.id)));

    // Reconcile stale or duplicate release notifications.
    const toDelete = new Set<string>();
    const byGameRelease = new Map<string, Notification[]>();

    for (const item of currentItems) {
      const isReleaseNotif =
        item.type === "game_release" &&
        (item.id.startsWith("release-") || item.id.startsWith("release-soon-"));

      if (!isReleaseNotif) continue;

      // If game is no longer tracked, remove stale release notifications.
      if (!trackedGameIds.has(String(item.gameId))) {
        toDelete.add(item.id);
        continue;
      }

      const release = item.releaseDate ? new Date(item.releaseDate) : null;
      if (!release || Number.isNaN(release.getTime())) continue;
      release.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (release.getTime() - today.getTime()) / DAY_MS,
      );

      // "release-soon" is valid only for tomorrow.
      if (item.id.startsWith("release-soon-") && diffDays !== 1) {
        toDelete.add(item.id);
        continue;
      }

      const key = `${item.gameId}-${dateKey(release)}`;
      const bucket = byGameRelease.get(key) ?? [];
      bucket.push(item);
      byGameRelease.set(key, bucket);
    }

    // Keep one notification per game+release date.
    for (const bucket of byGameRelease.values()) {
      if (bucket.length <= 1) continue;

      bucket.sort((a, b) => {
        const aPriority = a.id.startsWith("release-soon-") ? 0 : 1;
        const bPriority = b.id.startsWith("release-soon-") ? 0 : 1;
        if (aPriority !== bPriority) return bPriority - aPriority;

        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });

      const [, ...rest] = bucket;
      for (const item of rest) toDelete.add(item.id);
    }

    if (!toDelete.size) return;

    const batch = writeBatch(db);
    for (const notificationId of toDelete) {
      const notificationRef = doc(
        db,
        "users",
        uid,
        "notifications",
        notificationId,
      );
      batch.delete(notificationRef);
    }
    batch.commit().catch((err) => {
      console.error("Failed to cleanup stale notifications", err);
    });
  }, [currentItems, games, uid]);

  const markAllRead = async () => {
    if (!uid) return;

    const unread = currentItems.filter((item) => !item.read);
    if (!unread.length) return;

    const batch = writeBatch(db);
    unread.forEach((item) => {
      const ref = doc(db, "users", uid, "notifications", item.id);
      batch.update(ref, {
        read: true,
      });
    });

    await batch.commit();
  };

  const clearAllNotifications = async () => {
    if (!uid) return;

    const notificationsRef = collection(db, "users", uid, "notifications");
    const snap = await getDocs(notificationsRef);
    if (snap.empty) return;

    const docs = snap.docs;
    const CHUNK_SIZE = 400;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!uid) return;
    const notificationRef = doc(
      db,
      "users",
      uid,
      "notifications",
      notificationId,
    );
    await deleteDoc(notificationRef);
  };

  return (
    <>
      {/* BELL */}
      <div
        ref={ref}
        className={
          fullWidthTrigger
            ? "relative z-50 w-full"
            : `relative z-50 rounded-full px-1.5 cursor-pointer transition-all duration-300 border
        bg-zinc-900/70 text-zinc-200 border-white/15 backdrop-blur-xl hover:bg-zinc-800/85
        ${
          open &&
          "bg-white/10 text-white border-cyan-300/60 shadow-[0_0_18px_rgba(125,211,252,0.35)]"
        }`
        }
      >
        <button
          type="button"
          className={
            fullWidthTrigger
              ? `relative inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all duration-300 ${
                  open
                    ? "border-cyan-300/60 bg-white/10 text-white shadow-[0_0_18px_rgba(125,211,252,0.35)]"
                    : "border-white/15 bg-zinc-900/70 text-zinc-200 backdrop-blur-xl hover:bg-zinc-800/85"
                }`
              : "relative rounded-full p-2"
          }
          onClick={(e) => {
            e.stopPropagation();
            setOpen((p) => {
              const next = !p;
              if (next) closePlayer();
              return next;
            });
          }}
        >
          <BsBellFill size={14} />
          {fullWidthTrigger && <span>Notifications</span>}

          {unreadCount > 0 && (
            <span
              className="
                absolute -top-2 -right-2
                min-w-5 h-5 px-1.5
                rounded-full
                bg-cyan-500
                border border-cyan-200/70
                text-[11px] text-white font-bold leading-[18px] text-center
                shadow-[0_0_14px_rgba(34,211,238,0.65)]
                ring-1 ring-white
              "
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* DROPDOWN */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
              className="
        absolute right-0 mt-3 w-100 max-w-[calc(100vw-1rem)] max-[639px]:left-0 max-[639px]:right-auto
        rounded-2xl overflow-hidden
        bg-zinc-950
        border border-cyan-300/25
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      "
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    Notifications
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">
                    {unreadCount} Unread Messages
                  </p>
                  {/* <p className="text-xs text-white/60 mt-0.5">
                    {currentItems.length} total
                  </p> */}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllRead();
                    }}
                    className="text-xs px-2.5 py-[5px] rounded-full border border-cyan-300/35 text-cyan-200 hover:bg-cyan-400/10 transition whitespace-nowrap"
                    title="Mark all as read"
                    aria-label="Mark all as read"
                  >
                    <IoMailOpen />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllNotifications();
                    }}
                    className="rounded-full border border-red-300/35 px-2.5 py-[5px] text-[11px] text-red-200 transition hover:bg-red-500/15"
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-2">
                {currentItems.length === 0 ? (
                  <div className="px-4 py-14 text-center">
                    <p className="text-base text-white/75">
                      No notifications yet.
                    </p>
                    <p className="text-sm text-white/45 mt-1">
                      Release alerts will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentItems.map((item) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-[1.6rem]"
                      >
                        <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600/85 md:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(item.id);
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200/40 bg-black/30 text-red-100 transition hover:bg-black/45"
                            aria-label={`Delete notification for ${item.gameName}`}
                            title="Delete notification"
                          >
                            <MdDelete size={18} />
                          </button>
                        </div>

                        <motion.div
                          drag="x"
                          dragDirectionLock
                          dragConstraints={{ left: -80, right: 0 }}
                          dragElastic={0.06}
                          dragMomentum={false}
                          animate={{ x: swipedId === item.id ? -80 : 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 36,
                          }}
                          onDragStart={() => {
                            if (swipedId && swipedId !== item.id)
                              setSwipedId(null);
                          }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x <= -50) {
                              setSwipedId(item.id);
                            } else if (swipedId === item.id) {
                              setSwipedId(null);
                            }
                          }}
                          className={`relative w-full ${
                            item.read
                              ? "bg-[#10161f] hover:bg-[#141d2a] opacity-85"
                              : "bg-[#162434] hover:bg-[#1b2b3c] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]"
                          }`}
                        >
                          <Link
                            href={item.gameId ? `/game/${item.gameId}` : "#"}
                            onClick={(e) => {
                              if (swipedId === item.id) {
                                e.preventDefault();
                                setSwipedId(null);
                              }
                            }}
                            className="block p-3.5 md:pr-12"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={item.gameCover || "/placeholder-game.jpg"}
                                alt={item.gameName}
                                className={`h-10 w-10 shrink-0 rounded-lg object-cover ${
                                  item.read ? "opacity-80" : ""
                                }`}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={`text-[13px] leading-none ${
                                      item.read
                                        ? "text-white/70"
                                        : "max-w-[190px] truncate font-semibold text-white"
                                    }`}
                                  >
                                    {item.gameName}
                                  </p>
                                  <div className=" flex items-center gap-2 text-[11px] text-white/45">
                                    {item.releaseDate && (
                                      <>
                                        <span className="uppercase tracking-wide text-white/40">
                                          {item.releaseDate.toLocaleDateString(
                                            undefined,
                                            {
                                              month: "short",
                                              day: "numeric",
                                            },
                                          )}
                                        </span>
                                        <span className="text-white/25">•</span>
                                      </>
                                    )}

                                    <span className="shrink-0 text-white/50">
                                      {formatTimeAgo(item.createdAt, nowMs)} ago
                                    </span>
                                  </div>
                                </div>
                                <p
                                  className={`mt-1 text-[11px] leading-snug ${
                                    item.read ? "text-white/55" : "text-white"
                                  }`}
                                >
                                  {item.message}
                                </p>
                              </div>
                            </div>
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(item.id);
                            }}
                            className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/35 text-zinc-300 opacity-0 transition hover:border-red-300/35 hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100 md:inline-flex"
                            aria-label={`Delete notification for ${item.gameName}`}
                            title="Delete notification"
                          >
                            <MdDelete size={14} />
                          </button>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
