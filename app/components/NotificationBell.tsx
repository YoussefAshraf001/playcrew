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

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function NotificationBell({ games }: { games: Game[] }) {
  const { user } = useUser();
  const uid = user?.uid as string | undefined;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
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
            message: `${game.name} releases today.`,
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
          message: `${game.name} releases ${inDaysLabel}.`,
        });
      }
    }

    if (!writes.length) return;

    const batch = writeBatch(db);

    for (const entry of writes) {
      const notificationRef = doc(
        db,
        "users",
        uid,
        "notifications",
        entry.id,
      );

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
        className={`relative z-50 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600 rounded-full px-2 cursor-pointer transition-colors duration-300
        ${
          open &&
          "bg-linear-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,255,255,0.5)]"
        }`}
        onClick={() => setOpen((p) => !p)}
      >
        <button className="relative p-2 rounded-full">
          <BsBellFill size={14} />

          {unreadCount > 0 && (
            <>
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-zinc-900 animate-pulse" />
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 border border-red-300/40 rounded-full text-[10px] text-white leading-[16px] text-center font-semibold shadow-[0_0_10px_rgba(239,68,68,0.55)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
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
        absolute right-0 mt-3 w-[22rem] sm:w-[26rem] md:w-[30rem] max-w-[94vw]
        rounded-2xl overflow-hidden
        bg-zinc-900 backdrop-blur-xl
        border border-white/10
        shadow-[0_24px_70px_rgba(0,0,0,0.65)]
        z-50
      "
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    Notifications
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">
                    {currentItems.length} total
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllRead();
                  }}
                  className="text-xs sm:text-sm text-cyan-300 hover:text-cyan-200 transition whitespace-nowrap"
                >
                  Mark all read
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
                  <div className="space-y-1.5">
                    {currentItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.gameId ? `/game/${item.gameId}` : "#"}
                        className={`block p-3 rounded-xl border transition ${
                          item.read
                            ? "border-white/5 bg-transparent hover:bg-white/5"
                            : "border-cyan-400/20 bg-cyan-500/5 hover:bg-cyan-500/10"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={item.gameCover || "/placeholder-game.jpg"}
                            alt={item.gameName}
                            className="w-12 h-16 sm:w-14 sm:h-[4.5rem] object-cover rounded-lg shrink-0"
                          />

                          <div className="min-w-0">
                            <p
                              className={`text-sm sm:text-base leading-snug ${
                                item.read
                                  ? "text-white/80"
                                  : "text-white font-medium"
                              }`}
                            >
                              {item.message}
                            </p>
                            {item.releaseDate && (
                              <p className="text-xs sm:text-sm text-white/50 mt-1.5">
                                {item.releaseDate.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            )}
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
