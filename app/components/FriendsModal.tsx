"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiSearch, FiSlash, FiUserPlus, FiUsers, FiX } from "react-icons/fi";

import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import {
  acceptFriendRequest,
  declineFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
} from "@/app/lib/social";

type Person = {
  uid: string;
  username: string;
  avatar?: string | { data?: string } | null;
};

type IncomingRequest = {
  id: string;
  fromUid: string;
  person: Person;
};

const avatarSource = (avatar: Person["avatar"]) =>
  typeof avatar === "string" ? avatar : (avatar?.data ?? "");

export default function FriendsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, profile } = useUser();
  const uid = user?.uid;
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Person[]>([]);
  const [activeTab, setActiveTab] = useState<
    "friends" | "requests" | "blocked"
  >("friends");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const friendsSnapshotVersionRef = useRef(0);
  const requestsSnapshotVersionRef = useRef(0);
  const blockedSnapshotVersionRef = useRef(0);

  useEffect(() => {
    if (open) return;
    setSearchOpen(false);
    setSearch("");
    setResults([]);
    setActiveTab("friends");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !uid) return;
    setLoadingFriends(true);
    let cancelled = false;

    const unsubscribe = onSnapshot(
      collection(db, "users", uid, "friends"),
      async (snapshot) => {
        const snapshotVersion = ++friendsSnapshotVersionRef.current;
        const people = await Promise.all(
          snapshot.docs.map(async (friendDoc) => {
            const friendUid = String(friendDoc.data().uid ?? friendDoc.id);
            const profileSnap = await getDoc(doc(db, "users", friendUid));
            const data = profileSnap.data() as Partial<Person> | undefined;
            return {
              uid: friendUid,
              username: data?.username ?? "PlayCrew User",
              avatar: data?.avatar ?? null,
            } satisfies Person;
          }),
        );
        if (
          !cancelled &&
          snapshotVersion === friendsSnapshotVersionRef.current
        ) {
          setFriends(
            people.sort((a, b) => a.username.localeCompare(b.username)),
          );
          setLoadingFriends(false);
        }
      },
      () => setLoadingFriends(false),
    );

    return () => {
      cancelled = true;
      friendsSnapshotVersionRef.current += 1;
      unsubscribe();
    };
  }, [open, uid]);

  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;

    const unsubscribe = onSnapshot(
      collection(db, "users", uid, "blocks"),
      async (snapshot) => {
        const snapshotVersion = ++blockedSnapshotVersionRef.current;
        const people = await Promise.all(
          snapshot.docs.map(async (blockedDoc) => {
            const blockedUid = String(
              blockedDoc.data().blockedUid ?? blockedDoc.id,
            );
            const profileSnap = await getDoc(doc(db, "users", blockedUid));
            const data = profileSnap.data() as Partial<Person> | undefined;
            return {
              uid: blockedUid,
              username: data?.username ?? "PlayCrew User",
              avatar: data?.avatar ?? null,
            } satisfies Person;
          }),
        );

        if (
          !cancelled &&
          snapshotVersion === blockedSnapshotVersionRef.current
        ) {
          setBlockedUsers(
            people.sort((a, b) => a.username.localeCompare(b.username)),
          );
        }
      },
    );

    return () => {
      cancelled = true;
      blockedSnapshotVersionRef.current += 1;
      unsubscribe();
    };
  }, [open, uid]);

  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    const requestsQuery = query(
      collection(db, "friend_requests"),
      where("toUid", "==", uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
      const snapshotVersion = ++requestsSnapshotVersionRef.current;
      const incoming = await Promise.all(
        snapshot.docs.map(async (requestDoc) => {
          const fromUid = String(requestDoc.data().fromUid);
          const senderSnap = await getDoc(doc(db, "users", fromUid));
          const sender = senderSnap.data() as Partial<Person> | undefined;
          return {
            id: requestDoc.id,
            fromUid,
            person: {
              uid: fromUid,
              username: sender?.username ?? "PlayCrew User",
              avatar: sender?.avatar ?? null,
            },
          } satisfies IncomingRequest;
        }),
      );
      if (
        !cancelled &&
        snapshotVersion === requestsSnapshotVersionRef.current
      ) {
        setRequests(incoming);
      }
    });

    return () => {
      cancelled = true;
      requestsSnapshotVersionRef.current += 1;
      unsubscribe();
    };
  }, [open, uid]);

  useEffect(() => {
    if (!searchOpen || search.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const users = await searchUsersByUsername(
          search.trim().toLowerCase(),
          12,
          profile?.username,
        );
        if (!cancelled) {
          setResults(
            users.map((person) => ({
              uid: person.id,
              username: String(person.username ?? "PlayCrew User"),
              avatar: (person.avatar as Person["avatar"]) ?? null,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to search users", error);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [profile?.username, search, searchOpen]);

  const friendIds = useMemo(
    () => new Set(friends.map((item) => item.uid)),
    [friends],
  );
  const blockedIds = useMemo(
    () => new Set(blockedUsers.map((item) => item.uid)),
    [blockedUsers],
  );
  const visibleSearchResults = useMemo(
    () => results.filter((person) => !blockedIds.has(person.uid)),
    [blockedIds, results],
  );

  const actOnRequest = async (
    request: IncomingRequest,
    action: "accept" | "decline",
  ) => {
    if (!uid || busyId) return;
    setBusyId(request.id);
    const previousRequests = requests;
    const previousFriends = friends;
    setRequests((current) => current.filter((item) => item.id !== request.id));
    if (action === "accept") {
      setFriends((current) =>
        current.some((person) => person.uid === request.fromUid)
          ? current
          : [...current, request.person].sort((a, b) =>
              a.username.localeCompare(b.username),
            ),
      );
      setActiveTab("friends");
    }
    try {
      if (action === "accept") await acceptFriendRequest(request.fromUid, uid);
      else await declineFriendRequest(request.fromUid, uid);
      toast.success(
        action === "accept"
          ? `${request.person.username} is now your friend.`
          : `Declined ${request.person.username}'s friend request.`,
      );
    } catch (error) {
      setRequests(previousRequests);
      if (action === "accept") setFriends(previousFriends);
      console.error(`Failed to ${action} friend request`, error);
      toast.error(`Could not ${action} this request.`);
    } finally {
      setBusyId(null);
    }
  };

  const addFriend = async (person: Person) => {
    if (!uid || busyId || blockedIds.has(person.uid)) return;
    setBusyId(person.uid);
    try {
      await sendFriendRequest(uid, person.uid);
      toast.success(`Friend request sent to ${person.username}.`);
    } catch (error) {
      console.error("Failed to send friend request", error);
      toast.error("Could not send the friend request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) =>
            event.target === event.currentTarget && onClose()
          }
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            className="theme-panel-strong flex h-[min(640px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
              <div>
                <h2 className="theme-text flex items-center gap-2 text-xl font-black">
                  <FiUsers /> Socials
                  <span className="theme-accent-soft-bg rounded-full border border-[var(--theme-accent)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--theme-accent)]">
                    Beta
                  </span>
                </h2>
                <p className="theme-text-muted mt-1 text-xs">
                  Your PlayCrew community
                </p>
              </div>
              <button
                onClick={onClose}
                className="theme-hover-surface rounded-xl p-2"
              >
                <FiX size={20} />
              </button>
            </header>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
              <button
                type="button"
                onClick={() => setSearchOpen((current) => !current)}
                className="theme-accent-soft-bg flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition hover:brightness-110"
              >
                <FiUserPlus /> Find Friends
              </button>

              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative mt-3">
                      <FiSearch className="theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by username"
                        className="theme-surface theme-text h-11 w-full rounded-xl border pl-10 pr-3 outline-none focus:border-[var(--theme-accent)]"
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      {visibleSearchResults.map((person) => (
                        <PersonRow
                          key={person.uid}
                          person={person}
                          onProfile={onClose}
                          action={
                            friendIds.has(person.uid) ? (
                              <span className="theme-text-muted text-xs">
                                Friends
                              </span>
                            ) : (
                              <button
                                disabled={busyId === person.uid}
                                onClick={() => void addFriend(person)}
                                className="theme-accent-soft-bg rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                              >
                                Add
                              </button>
                            )
                          }
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="theme-surface mt-6 grid grid-cols-3 rounded-xl border p-1">
                {(
                  [
                    ["friends", "Friends", friends.length],
                    ["requests", "Requests", requests.length],
                    ["blocked", "Blocked", blockedUsers.length],
                  ] as const
                ).map(([tab, label, count]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition ${
                      activeTab === tab
                        ? "theme-accent-soft-bg border border-[var(--theme-accent)]"
                        : "theme-text-muted border border-transparent hover:theme-text"
                    }`}
                  >
                    {label} <span className="ml-1 opacity-70">{count}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="mt-4"
                >
                  {activeTab === "friends" ? (
                    loadingFriends ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((item) => (
                          <div
                            key={item}
                            className="h-16 animate-pulse rounded-xl bg-white/[0.06]"
                          />
                        ))}
                      </div>
                    ) : friends.length ? (
                      <div className="space-y-2">
                        {friends.map((person) => (
                          <PersonRow
                            key={person.uid}
                            person={person}
                            onProfile={onClose}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyPeople
                        icon={<FiUsers />}
                        message="No friends added yet."
                      />
                    )
                  ) : activeTab === "requests" ? (
                    requests.length ? (
                      <div className="space-y-2">
                        {requests.map((request) => (
                          <PersonRow
                            key={request.id}
                            person={request.person}
                            onProfile={onClose}
                            action={
                              <div className="flex gap-1.5">
                                <button
                                  disabled={busyId === request.id}
                                  onClick={() =>
                                    void actOnRequest(request, "accept")
                                  }
                                  className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-200 disabled:opacity-40"
                                >
                                  Accept
                                </button>
                                <button
                                  disabled={busyId === request.id}
                                  onClick={() =>
                                    void actOnRequest(request, "decline")
                                  }
                                  className="theme-surface rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40"
                                >
                                  Decline
                                </button>
                              </div>
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyPeople
                        icon={<FiUserPlus />}
                        message="No pending requests."
                      />
                    )
                  ) : blockedUsers.length ? (
                    <div className="space-y-2">
                      {blockedUsers.map((person) => (
                        <PersonRow
                          key={person.uid}
                          person={person}
                          onProfile={onClose}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyPeople
                      icon={<FiSlash />}
                      message="No blocked users."
                    />
                  )}
                </motion.section>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyPeople({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="theme-surface rounded-xl border p-8 text-center">
      <div className="theme-text-muted mx-auto flex justify-center text-3xl">
        {icon}
      </div>
      <p className="theme-text-muted mt-3 text-sm">{message}</p>
    </div>
  );
}

function PersonRow({
  person,
  action,
  onProfile,
}: {
  person: Person;
  action?: React.ReactNode;
  onProfile: () => void;
}) {
  const avatar = avatarSource(person.avatar);
  return (
    <div className="theme-surface theme-hover-surface flex items-center gap-3 rounded-xl border p-2.5 transition">
      <a
        href={`/users/${encodeURIComponent(person.username)}`}
        onClick={onProfile}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {avatar ? (
          <img
            src={avatar}
            alt={person.username}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="theme-accent-soft-bg flex h-11 w-11 items-center justify-center rounded-full border font-black">
            {person.username.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="theme-text truncate text-sm font-bold">
          {person.username}
        </span>
      </a>
      {action}
    </div>
  );
}
