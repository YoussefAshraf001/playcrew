import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

export async function refreshGameData(
  userId: string,
  game: any,
  fields: Record<string, boolean>,
  firestoreDocId: string,
) {
  const res = await fetch(`/api/igdb/${game.igdb.id}`);
  if (!res.ok) throw new Error("IGDB fetch failed");

  const igdb = await res.json();

  const update: Record<string, any> = {};
  const diff: Record<string, { old: any; new: any }> = {};

  const maybeUpdate = (key: string, newVal: any, oldVal: any) => {
    if (newVal !== undefined && newVal !== oldVal) {
      update[key] = newVal;
      diff[key] = { old: oldVal, new: newVal };
    }
  };

  if (fields.name) {
    maybeUpdate("igdb.name", igdb.name, game.igdb.name);
    maybeUpdate("name", igdb.name, game.name);
  }

  if (fields.cover) {
    maybeUpdate("igdb.cover", igdb.cover, game.igdb.cover);
  }

  if (fields.genres) {
    maybeUpdate("igdb.genres", igdb.genres, game.igdb.genres);
  }

  if (fields.rating) {
    maybeUpdate("igdb.aggregated_rating", igdb.rating, game.igdb.rating);
  }

  if (fields.platforms) {
    maybeUpdate("igdb.platforms", igdb.platforms, game.igdb.platforms);
  }  if (fields.released) {
    const nextReleaseDate =
      typeof igdb.releaseDate === "number"
        ? new Date(igdb.releaseDate * 1000)
        : null;

    maybeUpdate("igdb.releaseDate", nextReleaseDate, game.igdb.releaseDate ?? null);
  }

  update.lastUpdated = serverTimestamp();

  await updateDoc(
    doc(db, "users", userId, "games_igdb", firestoreDocId),
    update,
  );

  return { update, diff };
}

// import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";

// export async function refreshGameData(
//   userId: string,
//   game: any,
//   fields: Record<string, boolean>,
//   firestoreDocId: string,
// ) {
//   const res = await fetch(`/api/igdb/${game.igdb.id}`);
//   if (!res.ok) throw new Error("IGDB fetch failed");

//   const igdb = await res.json();

//   const update: Record<string, any> = {};
//   const diff: Record<string, { old: any; new: any }> = {};

//   const maybeUpdate = (key: string, newVal: any, oldVal: any) => {
//     if (newVal !== undefined && newVal !== oldVal) {
//       update[key] = newVal;
//       diff[key] = { old: oldVal, new: newVal };
//     }
//   };

//   if (fields.name) {
//     maybeUpdate("igdb.name", igdb.name, game.igdb.name);
//     maybeUpdate("name", igdb.name, game.name);
//   }

//   if (fields.cover) {
//     maybeUpdate("igdb.cover", igdb.cover, game.igdb.cover);
//   }

//   if (fields.genres) {
//     maybeUpdate("igdb.genres", igdb.genres, game.igdb.genres);
//   }

//   if (fields.platforms) {
//     maybeUpdate("igdb.platforms", igdb.platforms, game.igdb.platforms);
//   }

//   if (fields.released) {
//     maybeUpdate("igdb.releaseDate", igdb.releaseDate, game.igdb.releaseDate);
//   }

//   update.lastUpdated = serverTimestamp();

//   await updateDoc(
//     doc(db, "users", userId, "games_igdb", firestoreDocId),
//     update,
//   );

//   return { update, diff };
// }





