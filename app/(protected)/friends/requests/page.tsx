"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/context/UserContext";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequestsFor,
} from "@/app/lib/social";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowRight, FiInbox, FiUserPlus } from "react-icons/fi";
import { MdCheck, MdClose } from "react-icons/md";

type FriendRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  senderId?: string;
  senderUsername?: string;
  senderAvatar?: string;
  message?: string;
  createdAt?: unknown;
};

const toTimeAgo = (value?: unknown) => {
  if (!value) return "just now";
  const date =
    value instanceof Date
      ? value
      : typeof value === "object" &&
          value !== null &&
          "toDate" in value &&
          typeof (value as { toDate?: unknown }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === "string"
          ? new Date(value)
          : typeof value === "number"
            ? new Date(value)
            : null;

  if (!date || Number.isNaN(date.getTime())) return "just now";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function FriendRequestsPage() {
  const { user } = useUser();
  const uid = user?.uid;
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!uid) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const reqs = (await getFriendRequestsFor(uid)) as FriendRequest[];
      if (!mounted) return;
      setRequests(reqs);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      recent: requests.filter((r) => toTimeAgo(r.createdAt) === "just now")
        .length,
    }),
    [requests],
  );

  const handleAccept = async (r: FriendRequest) => {
    if (!uid) return;
    setBusyId(r.id);
    try {
      await acceptFriendRequest(r.fromUid, uid);
      setRequests((s) => s.filter((x) => x.id !== r.id));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (r: FriendRequest) => {
    if (!uid) return;
    setBusyId(r.id);
    try {
      await declineFriendRequest(r.fromUid, uid);
      setRequests((s) => s.filter((x) => x.id !== r.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_28%),linear-gradient(180deg,#050816,#080d17_55%,#050816)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_25%,transparent_75%,rgba(255,255,255,0.04))]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <FiUserPlus className="text-cyan-200" />
                Inbox
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Friend Requests
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                Review who wants to connect, accept the ones you know, and keep
                the rest out of your circle.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  Total
                </p>
                <p className="mt-1 text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  Fresh
                </p>
                <p className="mt-1 text-2xl font-bold">{stats.recent}</p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]"
              />
            ))}
          </section>
        ) : requests.length === 0 ? (
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <FiInbox className="text-2xl text-cyan-200" />
            </div>
            <h2 className="text-2xl font-bold">No pending requests</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
              When someone sends you a request, it will show up here with a
              quick accept/decline action.
            </p>
            <Link
              href="/users/search"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Find people to follow
              <FiArrowRight />
            </Link>
          </section>
        ) : (
          <section className="grid gap-4">
            <AnimatePresence initial={false}>
              {requests.map((r, index) => (
                <motion.article
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22, delay: index * 0.02 }}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-5"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_35%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                        {r.senderAvatar ? (
                          <img
                            src={r.senderAvatar}
                            alt={r.senderUsername || "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-300">
                            {(r.senderUsername || "U")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 border border-white/10" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-lg font-bold">
                            {r.senderUsername || "Friend Request"}
                          </h3>
                          <span className="rounded-full border border-cyan-300/15 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                            New
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-zinc-300">
                          {r.message ||
                            `${r.senderUsername || "A user"} sent you a friend request.`}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Received {toTimeAgo(r.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleAccept(r)}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MdCheck className="text-lg" />
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleDecline(r)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MdClose className="text-lg" />
                        Decline
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </section>
        )}
      </div>
    </main>
  );
}
