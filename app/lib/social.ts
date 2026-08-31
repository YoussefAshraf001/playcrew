"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
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

type UserData = {
  id: string;
  username?: string;
  avatar?: string;
  photoURL?: string;
} & FirestoreDocData;

export async function getUserByUsername(
  username: string,
): Promise<UserData | null> {
  const q = query(
    collection(db, "users"),
    where("username", "==", username),
    limit(1),
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return {
    id: docSnap.id,
    ...(docSnap.data() as FirestoreDocData),
  } as UserData;
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

}

export async function cancelFriendRequest(fromUid: string, toUid: string) {
  const id = friendRequestDocId(fromUid, toUid);
  const matchingRequestsQuery = query(
    collection(db, "friend_requests"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", toUid),
  );
  const matchingRequests = await getDocs(matchingRequestsQuery);
  const batch = writeBatch(db);

  batch.delete(doc(db, "friend_requests", id));
  matchingRequests.docs.forEach((requestDoc) => {
    if (requestDoc.id !== id) batch.delete(requestDoc.ref);
  });
  await batch.commit();
}

export async function declineFriendRequest(fromUid: string, toUid: string) {
  const id = friendRequestDocId(fromUid, toUid);
  const batch = writeBatch(db);
  batch.delete(doc(db, "friend_requests", id));
  batch.delete(
    doc(db, "users", toUid, "notifications", `friend-request-${fromUid}`),
  );
  await batch.commit();
}

export async function acceptFriendRequest(fromUid: string, toUid: string) {
  // create friendship docs under both users atomically
  const friendRefA = doc(db, "users", fromUid, "friends", toUid);
  const friendRefB = doc(db, "users", toUid, "friends", fromUid);
  const requestId = friendRequestDocId(fromUid, toUid);
  const requestRef = doc(db, "friend_requests", requestId);
  const requestNotificationRef = doc(
    db,
    "users",
    toUid,
    "notifications",
    `friend-request-${fromUid}`,
  );

  await runTransaction(db, async (tx) => {
    tx.set(friendRefA, { uid: toUid, createdAt: serverTimestamp() });
    tx.set(friendRefB, { uid: fromUid, createdAt: serverTimestamp() });
    tx.delete(requestRef);
    tx.delete(requestNotificationRef);
  });

  const accepterSnap = await getDoc(doc(db, "users", toUid));
  const accepter = accepterSnap.data() as UserDoc | undefined;
  const notifRef = doc(collection(db, "users", fromUid, "notifications"));
  await setDoc(notifRef, {
    type: "friend_accept",
    fromUid: toUid,
    toUid: fromUid,
    senderId: toUid,
    senderUsername: accepter?.username ?? "PlayCrew User",
    senderAvatar: accepter?.avatar ?? accepter?.photoURL ?? "",
    message: `${accepter?.username ?? "A PlayCrew user"} accepted your friend request.`,
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
  // Only include existing relationship records in the batch. Attempting to
  // delete absent request documents is rejected by participant-only rules
  // because an absent document has no fromUid/toUid fields to authorize.
  const blockRef = doc(db, "users", myUid, "blocks", blockedUid);
  const friendRefA = doc(db, "users", myUid, "friends", blockedUid);
  const friendRefB = doc(db, "users", blockedUid, "friends", myUid);

  const [friendship, sentRequests, receivedRequests] = await Promise.all([
    getDoc(friendRefA),
    getDocs(
      query(
        collection(db, "friend_requests"),
        where("fromUid", "==", myUid),
        where("toUid", "==", blockedUid),
      ),
    ),
    getDocs(
      query(
        collection(db, "friend_requests"),
        where("fromUid", "==", blockedUid),
        where("toUid", "==", myUid),
      ),
    ),
  ]);

  const batch = writeBatch(db);
  batch.set(blockRef, { blockedUid, createdAt: serverTimestamp() });
  if (friendship.exists()) {
    batch.delete(friendRefA);
    batch.delete(friendRefB);
  }
  sentRequests.docs.forEach((requestDoc) => batch.delete(requestDoc.ref));
  receivedRequests.docs.forEach((requestDoc) => batch.delete(requestDoc.ref));
  await batch.commit();
}

export async function unblockUser(myUid: string, blockedUid: string) {
  if (!myUid || !blockedUid) throw new Error("Missing uids");
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", myUid, "blocks", blockedUid));
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
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as FirestoreDocData),
  }));
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
    .map(
      (d) =>
        ({
          id: d.id,
          ...(d.data() as FirestoreDocData),
        }) as UserData,
    )
    .filter((user) =>
      excluded
        ? String(user.username ?? "")
            .trim()
            .toLowerCase() !== excluded
        : true,
    );
}
