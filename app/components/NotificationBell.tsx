"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BsBellFill } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  doc,
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

export default function NotificationBell({ games }: { games: Game[] }) {
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

      // Upcoming notification window: 1 to 3 days before release.
      if (releaseKey === tomorrowKey || (diffDays >= 1 && diffDays <= 3)) {
        const soonId = `release-soon-${game.id}-${releaseKey}`;
        if (knownByUser.ids.has(soonId)) continue;

        const safeDiff = Math.max(diffDays, 1);
        const inDaysLabel =
          releaseKey === tomorrowKey || safeDiff === 1
            ? "tomorrow"
            : `in ${safeDiff} days`;
        writes.push({
          id: soonId,
          gameId: String(game.id),
          gameName: game.name,
          gameCover: game.igdb?.cover,
          releaseDate: release,
          message: `Releases ${inDaysLabel}.`,
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

  return (
    <>
      {/* BELL */}
      <div
        ref={ref}
        className={`relative z-50 rounded-full px-1.5 cursor-pointer transition-all duration-300 border
        bg-zinc-900/70 text-zinc-200 border-white/15 backdrop-blur-xl hover:bg-zinc-800/85
        ${
          open &&
          "bg-white/10 text-white border-cyan-300/60 shadow-[0_0_18px_rgba(125,211,252,0.35)]"
        }`}
        onClick={() =>
          setOpen((p) => {
            const next = !p;
            if (next) closePlayer();
            return next;
          })
        }
      >
        <button className="relative p-2 rounded-full">
          <BsBellFill size={14} />

          {unreadCount > 0 && (
            <span
              className="
                absolute -top-2 -right-2
                min-w-[20px] h-5 px-1.5
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
        absolute right-0 mt-3 w-[22rem] sm:w-[25rem] max-w-[94vw]
        rounded-2xl overflow-hidden
        bg-zinc-900/92 backdrop-blur-xl
        border border-cyan-300/25
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      "
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllRead();
                  }}
                  className="text-xs px-2.5 py-[5px] rounded-full border border-cyan-300/35 text-cyan-200 hover:bg-cyan-400/10 transition whitespace-nowrap"
                >
                  <IoMailOpen />
                </button>
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
                      <Link
                        key={item.id}
                        href={item.gameId ? `/game/${item.gameId}` : "#"}
                        className={`relative block p-3.5 rounded-[1.6rem] transition ${
                          item.read
                            ? "bg-[#121a24]/65 hover:bg-[#172130]/75 opacity-80"
                            : "bg-[#141f2b]/95 hover:bg-[#1a2735]/95 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.gameCover || "/placeholder-game.jpg"}
                            alt={item.gameName}
                            className={`w-10 h-10 object-cover rounded-lg shrink-0 ${
                              item.read ? "opacity-80" : ""
                            }`}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-[13px] leading-none ${
                                  item.read
                                    ? "text-white/70"
                                    : "text-white font-semibold max-w-[190px] truncate"
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

                                <span className="text-white/50 shrink-0">
                                  {formatTimeAgo(item.createdAt, nowMs)} ago
                                </span>
                              </div>
                            </div>
                            <p
                              className={`text-[11px] leading-snug mt-1 ${
                                item.read ? "text-white/55" : "text-white"
                              }`}
                            >
                              {item.message}
                            </p>
                          </div>
                        </div>
                      </Link>
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
