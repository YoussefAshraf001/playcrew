"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  where,
  orderBy,
  limit,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

type UserDoc = {
  username?: string;
  avatar?: string;
  photoURL?: string;
};

type FirestoreDocData = Record<string, unknown>;

export async function getUserByUsername(username: string) {
  const q = query(
    collection(db, "users"),
    where("username", "==", username),
    limit(1),
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as FirestoreDocData) };
}

export function friendRequestDocId(fromUid: string, toUid: string) {
  return `${fromUid}_${toUid}`;
}

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  message?: string,
) {
  if (!fromUid || !toUid) throw new Error("Missing uids");

  const id = friendRequestDocId(fromUid, toUid);
  const ref = doc(db, "friend_requests", id);

  await setDoc(ref, {
    fromUid,
    toUid,
    message: message ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });

  // create notification
  const notifRef = doc(collection(db, "users", toUid, "notifications"));
  const senderSnap = await getDoc(doc(db, "users", fromUid));

  if (!senderSnap.exists()) throw new Error("Sender not found");

  const sender = senderSnap.data() as UserDoc;

  await setDoc(notifRef, {
    type: "friend_request",

    fromUid,
    toUid,

    senderId: fromUid,
    senderUsername: sender.username,
    senderAvatar: sender.avatar ?? sender.photoURL ?? "",

    message: message || `${sender.username} sent you a friend request.`,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function cancelFriendRequest(fromUid: string, toUid: string) {
  const id = friendRequestDocId(fromUid, toUid);
  const ref = doc(db, "friend_requests", id);
  await deleteDoc(ref);
}

export async function declineFriendRequest(fromUid: string, toUid: string) {
  // mark request as declined or delete
  const id = friendRequestDocId(fromUid, toUid);
  const ref = doc(db, "friend_requests", id);
  await deleteDoc(ref);
}

export async function acceptFriendRequest(fromUid: string, toUid: string) {
  // create friendship docs under both users atomically
  const friendRefA = doc(db, "users", fromUid, "friends", toUid);
  const friendRefB = doc(db, "users", toUid, "friends", fromUid);
  const requestId = friendRequestDocId(fromUid, toUid);
  const requestRef = doc(db, "friend_requests", requestId);

  await runTransaction(db, async (tx) => {
    tx.set(friendRefA, { uid: toUid, createdAt: serverTimestamp() });
    tx.set(friendRefB, { uid: fromUid, createdAt: serverTimestamp() });
    tx.delete(requestRef);
  });

  // notify origin
  const notifRef = doc(collection(db, "users", fromUid, "notifications"));
  await setDoc(notifRef, {
    type: "friend_accept",
    fromUid: toUid,
    toUid: fromUid,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function removeFriend(myUid: string, otherUid: string) {
  const refA = doc(db, "users", myUid, "friends", otherUid);
  const refB = doc(db, "users", otherUid, "friends", myUid);
  const batch = writeBatch(db);
  batch.delete(refA);
  batch.delete(refB);
  await batch.commit();
}

export async function blockUser(myUid: string, blockedUid: string) {
  // block and remove friendship + delete pending requests
  const blockRef = doc(db, "users", myUid, "blocks", blockedUid);
  const friendRefA = doc(db, "users", myUid, "friends", blockedUid);
  const friendRefB = doc(db, "users", blockedUid, "friends", myUid);
  const req1 = doc(
    db,
    "friend_requests",
    friendRequestDocId(myUid, blockedUid),
  );
  const req2 = doc(
    db,
    "friend_requests",
    friendRequestDocId(blockedUid, myUid),
  );

  const batch = writeBatch(db);
  batch.set(blockRef, { blockedUid, createdAt: serverTimestamp() });
  batch.delete(friendRefA);
  batch.delete(friendRefB);
  batch.delete(req1);
  batch.delete(req2);
  await batch.commit();
}

export async function isFriend(myUid: string | undefined, otherUid: string) {
  if (!myUid) return false;
  const ref = doc(db, "users", myUid, "friends", otherUid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function getFriendRequestsFor(uid: string) {
  const q = query(
    collection(db, "friend_requests"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreDocData) }));
}

export async function searchUsersByUsername(
  prefix: string,
  limitNum = 20,
  excludeUsername?: string,
) {
  const start = prefix;
  const end = prefix + "\uf8ff";
  const q = query(
    collection(db, "users"),
    orderBy("username"),
    where("username", ">=", start),
    where("username", "<=", end),
    limit(limitNum),
  );
  const snap = await getDocs(q);
  const excluded = excludeUsername?.trim().toLowerCase() ?? null;
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as FirestoreDocData) }))
    .filter((user) =>
      excluded ? String(user.username ?? "").trim().toLowerCase() !== excluded : true,
    );
}
