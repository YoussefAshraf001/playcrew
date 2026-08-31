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
  unblockUser,
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
  const [friendshipExists, setFriendshipExists] = useState(false);
  const [sentRequestExists, setSentRequestExists] = useState(false);
  const [receivedRequestExists, setReceivedRequestExists] = useState(false);
  const [blockExists, setBlockExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const status = friendshipExists
    ? "friends"
    : receivedRequestExists
      ? "pending_received"
      : sentRequestExists
        ? "pending_sent"
        : "none";

  useEffect(() => {
    if (!myUid || !targetUid) return;

    const friendshipRef = doc(db, "users", myUid, "friends", targetUid);
    const sentRef = doc(db, "friend_requests", friendRequestDocId(myUid, targetUid));
    const receivedRef = doc(db, "friend_requests", friendRequestDocId(targetUid, myUid));
    const blockRef = doc(db, "users", myUid, "blocks", targetUid);

    const unsubFriendship = onSnapshot(friendshipRef, (snap) => {
      setFriendshipExists(snap.exists());
    });
    const unsubSent = onSnapshot(sentRef, (snap) => {
      setSentRequestExists(snap.exists());
    });

    const unsubReceived = onSnapshot(receivedRef, (snap) => {
      setReceivedRequestExists(snap.exists());
    });
    const unsubBlock = onSnapshot(blockRef, (snap) => {
      setBlockExists(snap.exists());
    });

    return () => {
      unsubFriendship();
      unsubSent();
      unsubReceived();
      unsubBlock();
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
      toast.success(
        `Friend request to ${targetUsername ?? "this user"} canceled.`,
      );
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
      toast.success(`${targetUsername ?? "User"} removed from your friends.`);
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
      toast.success(`${targetUsername ?? "User"} is now your friend.`);
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
      toast.success(
        `Declined ${targetUsername ?? "this user"}'s friend request.`,
      );
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
      toast.success(`User ${targetUsername ?? "blocked"} has been blocked.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to block user.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!myUid || !targetUid) {
      toast.error("Unable to unblock user.");
      return;
    }
    setLoading(true);
    try {
      await unblockUser(myUid, targetUid);
      toast.success(`${targetUsername ?? "User"} has been unblocked.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to unblock user.");
    } finally {
      setLoading(false);
    }
  };

  if (!targetUid) return null;

  return (
    <div className="flex items-center gap-2">
      {blockExists ? (
        <button
          onClick={handleUnblock}
          disabled={loading}
          className="theme-surface theme-hover-surface theme-text rounded-xl border px-3 py-1 text-sm transition duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unblock
        </button>
      ) : status === "friends" ? (
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

      {!blockExists && (
        <button
          onClick={handleBlock}
          disabled={loading}
          className="rounded-xl border border-red-500 bg-red-950 px-3 py-1 text-sm text-red-200 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Block
        </button>
      )}
    </div>
  );
}
