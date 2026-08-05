"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BsBellFill } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "../context/UserContext";
import { useMusic } from "../context/MusicContext";
import { usePathname } from "next/navigation";
import { useUI } from "../context/UIContext";
import { IoMailOpen } from "react-icons/io5";
import { MdDelete } from "react-icons/md";
import { ReleaseDatePrecision } from "../lib/releaseDates";
import { acceptFriendRequest, declineFriendRequest } from "../lib/social";

type Game = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
    releaseDatePrecision?: ReleaseDatePrecision;
  };
};

type Notification = {
  id: string;
  type:
    | "game_release"
    | "game_release_change"
    | "friend_request"
    | "friend_accept";

  // Game notifications
  gameId?: string;
  gameName?: string;
  gameCover?: string;
  releaseDate?: Date | null;

  // Friend requests
  senderId?: string;
  fromUid?: string;
  toUid?: string;
  senderUsername?: string;
  senderAvatar?: string;

  // Shared
  message: string;
  read: boolean;
  createdAt: Date | null;
  archived?: boolean;
};

type FireNotificationDoc = {
  type?:
    | "game_release"
    | "game_release_change"
    | "friend_request"
    | "friend_accept";
  gameId?: string;
  gameName?: string;
  gameCover?: string;

  senderId?: string;
  fromUid?: string;
  toUid?: string;
  senderUsername?: string;
  senderAvatar?: string;
  title?: string;
  image?: string;

  message?: string;
  read?: boolean;
  createdAt?: unknown;
  releaseDate?: unknown;
  archived?: boolean;
};

const inferNotificationType = (data: FireNotificationDoc) => {
  if (data.type) return data.type;
  if (
    data.senderId ||
    data.fromUid ||
    data.senderUsername ||
    data.senderAvatar ||
    data.message?.toLowerCase().includes("friend request")
  ) {
    return "friend_request";
  }
  return "game_release";
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
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  compactPanelAnchor = "bottom-end",
}: {
  games: Game[];
  fullWidthTrigger?: boolean;
  compactPanelAnchor?: "bottom-end" | "right-center";
}) {
  const { user } = useUser();
  const { closePlayer } = useMusic();
  const uid = user?.uid as string | undefined;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);
  const { navbarLayout } = useUI();
  const pathname = usePathname();
  const isDashboard = pathname.includes("/dashboard");
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
      const reset = window.setTimeout(() => {
        setItems([]);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const notificationsRef = collection(db, "users", uid, "notifications");
    const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(25));

    const unsub = onSnapshot(q, (snap) => {
      const next: Notification[] = snap.docs
        .filter((d) => !d.data().archived)
        .map((docSnap) => {
          const data = docSnap.data() as FireNotificationDoc;
          return {
            id: docSnap.id,
            type: inferNotificationType(data),

            gameId: data.gameId,
            gameName: data.gameName ?? data.title,
            gameCover: data.gameCover ?? data.image,
            releaseDate: toDate(data.releaseDate),

            senderId: data.senderId,
            fromUid: data.fromUid,
            toUid: data.toUid,
            senderUsername: data.senderUsername,
            senderAvatar: data.senderAvatar,

            message: data.message ?? "",
            read: !!data.read,
            createdAt: toDate(data.createdAt),
          };
        });

      void (async () => {
        const resolved = await Promise.all(
          next.map(async (item) => {
            if (item.type !== "friend_request") return item;

            const senderUid = item.senderId ?? item.fromUid;
            if (!senderUid) return item;

            if (item.senderUsername && item.senderAvatar) return item;

            try {
              const senderSnap = await getDoc(doc(db, "users", senderUid));
              if (!senderSnap.exists()) return item;

              const sender = senderSnap.data() as {
                username?: string;
                avatar?: string;
                photoURL?: string;
              };

              return {
                ...item,
                senderId: senderUid,
                senderUsername: item.senderUsername ?? sender.username,
                senderAvatar:
                  item.senderAvatar ?? sender.avatar ?? sender.photoURL ?? "",
              };
            } catch (err) {
              console.error("Failed to resolve friend request sender", err);
              return item;
            }
          }),
        );

        setItems(resolved);
      })();
    });

    return () => unsub();
  }, [uid]);

  const markNotificationRead = async (notificationId: string) => {
    if (!uid) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item,
      ),
    );

    try {
      const notificationRef = doc(
        db,
        "users",
        uid,
        "notifications",
        notificationId,
      );
      const batch = writeBatch(db);
      batch.update(notificationRef, { read: true });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllRead = async () => {
    if (!uid) return;

    const unread = currentItems.filter((item) => !item.read);
    if (!unread.length) return;

    setItems((prev) => prev.map((item) => ({ ...item, read: true })));

    try {
      const batch = writeBatch(db);
      unread.forEach((item) => {
        const ref = doc(db, "users", uid, "notifications", item.id);
        batch.update(ref, {
          read: true,
        });
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
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

  const handleFriendRequest = async (
    item: Notification,
    action: "accept" | "decline",
  ) => {
    if (!uid || !item.senderId) return;
    setBusyNotificationId(item.id);

    try {
      if (action === "accept") {
        await acceptFriendRequest(item.senderId, uid);
      } else {
        await declineFriendRequest(item.senderId, uid);
      }

      await deleteNotification(item.id);
      setItems((prev) => prev.filter((n) => n.id !== item.id));
    } catch (err) {
      console.error(`Failed to ${action} friend request`, err);
    } finally {
      setBusyNotificationId((current) =>
        current === item.id ? null : current,
      );
    }
  };

  return (
    <>
      <div
        ref={ref}
        className={
          fullWidthTrigger
            ? "relative z-50 w-full"
            : `theme-surface theme-hover-surface relative z-50 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-all duration-300
        ${
          open &&
          "bg-white/10 text-white border-[rgba(var(--theme-accent-rgb),0.5)] shadow-[0_0_18px_rgba(var(--theme-accent-rgb),0.35)]"
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
              : "relative inline-flex h-8 w-8 items-center justify-center rounded-full"
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
                bg-[rgb(var(--theme-accent-rgb))]
                border-[rgba(var(--theme-accent-rgb),0.7)]
                shadow-[0_0_14px_rgba(var(--theme-accent-rgb),0.65)]
                text-[11px] text-white font-bold leading-[18px] text-center
                ring-1 ring-white
              "
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              {...(navbarLayout === "sidebar"
                ? {
                    initial: { opacity: 0, x: -12 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: -12 },
                  }
                : {
                    initial: { opacity: 0, y: -8, scale: 0.985 },
                    animate: { opacity: 1, y: 320, scale: 1 },
                    exit: { opacity: 0, y: -360, scale: 0.985 },
                  })}
              transition={{
                type: "spring",
                stiffness: 140,
                damping: 26,
                mass: 1.05,
              }}
              className={
                navbarLayout === "sidebar"
                  ? `
        fixed left-20 ${isDashboard ? "top-6 md:top-6" : "top-18 md:top-8"} w-100 max-w-[calc(100vw-1rem)]
        rounded-2xl overflow-hidden
        theme-panel-strong border
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      `
                  : fullWidthTrigger
                    ? `
        absolute right-0 mt-3 w-100 max-w-[calc(100vw-1rem)] max-[639px]:left-0 max-[639px]:right-auto
        rounded-2xl overflow-hidden
        bg-zinc-950
        border border-cyan-300/25
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      `
                    : compactPanelAnchor === "right-center"
                      ? `
        absolute left-full top-1/2 ml-3 w-100 max-w-[calc(100vw-6rem)] -translate-y-1/2
        rounded-2xl overflow-hidden
        bg-zinc-950
        border border-cyan-300/25
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      `
                      : `
        absolute right-0 mt-3 w-100 max-w-[calc(100vw-1rem)]
        rounded-2xl overflow-hidden
        bg-zinc-950
        border border-cyan-300/25
        shadow-[0_18px_44px_rgba(0,0,0,0.55)]
        z-50
      `
              }
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
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllRead();
                    }}
                    className="text-xs px-2.5 py-[5px] rounded-full border
                    border-[rgba(var(--theme-accent-rgb),0.35)]
                    text-[rgb(var(--theme-accent-rgb))]
                    hover:bg-[rgba(var(--theme-accent-rgb),0.1)]
                    transition whitespace-nowrap"
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
                    className="
                      rounded-full
                      border
                      px-2.5 py-[5px]
                      text-[11px]
                      transition
                      border-[rgba(var(--theme-accent-rgb),0.35)]
                      text-[rgb(var(--theme-accent-rgb))]
                      hover:bg-[rgba(var(--theme-accent-rgb),0.12)]
                    "
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-2">
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
                    {currentItems.map((item) => {
                      const timeLabel = formatTimeAgo(item.createdAt, nowMs);
                      const showAgo = /[0-9](m|h|d)$/.test(timeLabel);
                      return (
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
                              if (swipedId && swipedId !== item.id) {
                                setSwipedId(null);
                              }
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
                                : "bg-[#162434] hover:bg-[#1b2b3c] shadow-[inset_0_0_0_1px_rgba(var(--theme-accent-rgb),0.35)]"
                            }`}
                          >
                            <div className="block p-3.5 md:pr-12">
                              <div className="flex items-center gap-3">
                                <Link
                                  href={
                                    item.type === "friend_request"
                                      ? item.senderUsername
                                        ? `/users/${item.senderUsername}`
                                        : "#"
                                      : item.gameId
                                        ? `/game/${item.gameId}`
                                        : "#"
                                  }
                                  onClick={(e) => {
                                    if (swipedId === item.id) {
                                      e.preventDefault();
                                      setSwipedId(null);
                                      return;
                                    }

                                    if (!item.read) {
                                      void markNotificationRead(item.id);
                                    }
                                  }}
                                  className="shrink-0"
                                >
                                  <img
                                    src={
                                      item.type === "friend_request"
                                        ? item.senderAvatar ||
                                          "/default-avatar.png"
                                        : item.gameCover ||
                                          "/placeholder-game.jpg"
                                    }
                                    alt={
                                      item.type === "friend_request"
                                        ? item.senderUsername || "User"
                                        : item.gameName || "Game"
                                    }
                                    className={`h-10 w-10 rounded-lg object-cover ${
                                      item.read ? "opacity-80" : ""
                                    }`}
                                  />
                                </Link>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <Link
                                      href={
                                        item.type === "friend_request"
                                          ? item.senderUsername
                                            ? `/users/${item.senderUsername}`
                                            : "#"
                                          : item.gameId
                                            ? `/game/${item.gameId}`
                                            : "#"
                                      }
                                      onClick={(e) => {
                                        if (swipedId === item.id) {
                                          e.preventDefault();
                                          setSwipedId(null);
                                          return;
                                        }

                                        if (!item.read) {
                                          void markNotificationRead(item.id);
                                        }
                                      }}
                                      className={`min-w-0 ${
                                        item.read ? "text-white/70" : ""
                                      }`}
                                    >
                                      <p
                                        className={`text-[13px] leading-none ${
                                          item.read
                                            ? ""
                                            : "max-w-[190px] truncate font-semibold text-white"
                                        }`}
                                      >
                                        {item.type === "friend_request"
                                          ? "Friend Request"
                                          : item.gameName || "Unknown game"}
                                      </p>
                                    </Link>
                                    <div className="flex items-center gap-2 text-[11px] text-white/45">
                                      <span className="shrink-0 text-white/50">
                                        {timeLabel}
                                        {showAgo ? " ago" : ""}
                                      </span>
                                    </div>
                                  </div>
                                  <p
                                    className={`mt-1 text-[11px] leading-snug ${
                                      item.read ? "text-white/55" : "text-white"
                                    }`}
                                  >
                                    {item.type === "friend_request"
                                      ? `${item.senderUsername || "A user"} sent you a friend request.`
                                      : item.message}
                                  </p>
                                  {item.type === "friend_request" && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          busyNotificationId === item.id
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleFriendRequest(
                                            item,
                                            "accept",
                                          );
                                        }}
                                        className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          busyNotificationId === item.id
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleFriendRequest(
                                            item,
                                            "decline",
                                          );
                                        }}
                                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(item.id);
                              }}
                              className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/35 text-zinc-300 opacity-0 transition hover:border-red-300/35 hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100 md:inline-flex pointer-events-none group-hover:pointer-events-auto"
                              aria-label={`Delete notification for ${item.gameName}`}
                            >
                              <MdDelete size={14} />
                            </button>
                          </motion.div>
                        </div>
                      );
                    })}
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
