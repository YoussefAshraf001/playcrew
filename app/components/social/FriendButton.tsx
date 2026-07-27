"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  isFriend,
  friendRequestDocId,
} from "@/app/lib/social";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function FriendButton({
  targetUid,
  targetUsername,
}: {
  targetUid: string;
  targetUsername?: string;
}) {
  const { user } = useUser();
  const myUid = user?.uid;
  const [status, setStatus] = useState<
    "none" | "pending_sent" | "pending_received" | "friends"
  >("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (!myUid || !targetUid) return setStatus("none");

      try {
        const friendship = await isFriend(myUid, targetUid);
        if (!mounted) return;
        if (friendship) return setStatus("friends");
        setStatus("none");
      } catch (err) {
        console.error(err);
      }
    }

    void check();

    return () => {
      mounted = false;
    };
  }, [myUid, targetUid]);

  useEffect(() => {
    if (!myUid || !targetUid) return;

    const sentRef = doc(db, "friend_requests", friendRequestDocId(myUid, targetUid));
    const receivedRef = doc(db, "friend_requests", friendRequestDocId(targetUid, myUid));

    const unsubSent = onSnapshot(sentRef, (snap) => {
      setStatus((current) => {
        if (current === "friends") return current;
        return snap.exists() ? "pending_sent" : current === "pending_sent" ? "none" : current;
      });
    });

    const unsubReceived = onSnapshot(receivedRef, (snap) => {
      setStatus((current) => {
        if (current === "friends") return current;
        return snap.exists() ? "pending_received" : current === "pending_received" ? "none" : current;
      });
    });

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [myUid, targetUid]);

  const handleSend = async () => {
    if (!myUid || !targetUid) {
      toast.error("Log in to add friends.");
      return;
    }
    setLoading(true);
    try {
      await sendFriendRequest(myUid, targetUid);
      setStatus("pending_sent");
      toast.success(`Friend request sent to ${targetUsername ?? "user"}.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send friend request.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to cancel request.");
      return;
    }
    setLoading(true);
    try {
      await cancelFriendRequest(myUid, targetUid);
      setStatus("none");
      toast.success("Friend request canceled.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel request.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to remove friend.");
      return;
    }
    setLoading(true);
    try {
      await removeFriend(myUid, targetUid);
      setStatus("none");
      toast.success("Friend removed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove friend.");
    } finally {
      setLoading(false);
    }
  };

  const handleIncomingAccept = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to accept request.");
      return;
    }
    setLoading(true);
    try {
      await acceptFriendRequest(targetUid, myUid);
      setStatus("friends");
      toast.success("Friend request accepted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to accept friend request.");
    } finally {
      setLoading(false);
    }
  };

  const handleIncomingDecline = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to decline request.");
      return;
    }
    setLoading(true);
    try {
      await declineFriendRequest(targetUid, myUid);
      setStatus("none");
      toast.success("Friend request declined.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to decline friend request.");
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to block user.");
      return;
    }
    setLoading(true);
    try {
      await blockUser(myUid, targetUid);
      setStatus("none");
      toast.success(`User ${targetUsername ?? "blocked"} has been blocked.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to block user.");
    } finally {
      setLoading(false);
    }
  };

  if (!targetUid) return null;

  return (
    <div className="flex items-center gap-2">
      {status === "friends" ? (
        <button
          onClick={handleRemove}
          disabled={loading}
          className="rounded-xl border border-zinc-500 bg-zinc-900 px-3 py-1 text-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove Friend
        </button>
      ) : status === "pending_sent" ? (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="rounded-xl border border-cyan-500 bg-cyan-950 px-3 py-1 text-sm text-cyan-200 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel Request
        </button>
      ) : status === "pending_received" ? (
        <>
          <button
            onClick={handleIncomingAccept}
            disabled={loading}
            className="rounded-xl border border-emerald-500 bg-emerald-950 px-3 py-1 text-sm text-emerald-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={handleIncomingDecline}
            disabled={loading}
            className="rounded-xl border border-zinc-500 bg-zinc-900 px-3 py-1 text-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Decline
          </button>
        </>
      ) : (
        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded-xl border border-cyan-500 bg-cyan-950 px-3 py-1 text-sm text-cyan-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add Friend
        </button>
      )}

      <button
        onClick={handleBlock}
        disabled={loading}
        className="rounded-xl border border-red-500 bg-red-950 px-3 py-1 text-sm text-red-200 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Block
      </button>
    </div>
  );
}
