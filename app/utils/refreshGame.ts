import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

/** Refresh game data from RAWG selectively */
export async function refreshGameData(
  userId: string,
  game: any,
  fieldsToRefresh: Record<string, boolean>
) {
  // 1️⃣ RAWG SEARCH
  const searchRes = await fetch(
    `https://api.rawg.io/api/games?search=${encodeURIComponent(
      game.name
    )}&key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
  );
  if (!searchRes.ok) throw new Error("RAWG search failed");

  const searchData = await searchRes.json();
  const first = searchData.results?.[0];
  if (!first) throw new Error("Game not found on RAWG");

  // 2️⃣ RAWG FULL GAME DATA
  const rawgRes = await fetch(
    `https://api.rawg.io/api/games/${first.slug}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
  );
  if (!rawgRes.ok) throw new Error("RAWG fetch failed");

  const rawg = await rawgRes.json();

  // 3️⃣ Prepare only the fields that should be refreshed
  const updatedFields: Partial<typeof game> = {};

  if (fieldsToRefresh.name) updatedFields.name = rawg.name;
  if (fieldsToRefresh.slug) updatedFields.slug = rawg.slug;
  if (fieldsToRefresh.released)
    updatedFields.released =
      rawg.released ?? rawg.platforms?.[0]?.released_at ?? "TBA";
  if (fieldsToRefresh.background_image)
    updatedFields.background_image = rawg.background_image;
  if (fieldsToRefresh.background_image_additional)
    updatedFields.background_image_additional =
      rawg.background_image_additional;
  if (fieldsToRefresh.metacritic) updatedFields.metacritic = rawg.metacritic;
  if (fieldsToRefresh.genres) updatedFields.genres = rawg.genres;
  if (fieldsToRefresh.platforms) updatedFields.platforms = rawg.platforms;
  if (fieldsToRefresh.publishers) updatedFields.publishers = rawg.publishers;

  // 4️⃣ Update only the selected fields in Firestore
  const gameRef = doc(db, "users", userId, "games", game.id.toString());
  await updateDoc(gameRef, updatedFields);

  return { ...game, ...updatedFields };
}

// import { doc, getDoc, updateDoc } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";

// /** Helper to detect custom images */
// function isCustomImage(url?: string | null) {
//   if (!url) return false;
//   return !url.includes("media.rawg.io");
// }

// /** Refresh game data from RAWG */
// export async function refreshGameData(
//   userId: string,
//   game: any,
//   refreshImages: boolean
// ) {
//   // 1️⃣ RAWG SEARCH
//   const searchRes = await fetch(
//     `https://api.rawg.io/api/games?search=${encodeURIComponent(
//       game.name
//     )}&key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//   );
//   if (!searchRes.ok) throw new Error("RAWG search failed");

//   const searchData = await searchRes.json();
//   const first = searchData.results?.[0];
//   if (!first) throw new Error("Game not found on RAWG");

//   // 2️⃣ RAWG FULL GAME DATA
//   const rawgRes = await fetch(
//     `https://api.rawg.io/api/games/${first.slug}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//   );
//   if (!rawgRes.ok) throw new Error("RAWG fetch failed");

//   const rawg = await rawgRes.json();

//   // 3️⃣ Load current user game fields
//   const ref = doc(db, "users", userId);
//   const snap = await getDoc(ref);
//   const currentGames = snap.exists() ? snap.data().trackedGames || {} : {};
//   const existing = currentGames[String(game.id)] || {};

//   const preservedUserFields = {
//     playtime: existing.playtime || 0,
//     progress: existing.progress || 0,
//     my_rating: existing.my_rating || 0,
//     favorite: existing.favorite || false,
//     status: existing.status || "",
//     notes: existing.notes || "",
//     categoryRatings: existing.categoryRatings || {
//       graphics: 0,
//       gameplay: 0,
//       story: 0,
//       ost: 0,
//       cinematics: 0,
//       voiceActing: 0,
//     },
//   };

//   // 4️⃣ RAWG fields — images respect refreshImages
//   const rawgFields = {
//     name: rawg.name,
//     slug: rawg.slug,
//     released: rawg.released ?? rawg.platforms?.[0]?.released_at ?? "TBA",
//     background_image:
//       refreshImages || !existing.background_image
//         ? rawg.background_image || "/placeholder-game.jpg"
//         : existing.background_image,
//     background_image_additional: rawg.background_image_additional || null,
//     metacritic: rawg.metacritic,
//     genres: rawg.genres,
//     platforms: rawg.platforms,
//     publishers: rawg.publishers,
//   };

//   const updated = {
//     ...existing,
//     ...rawgFields,
//     ...preservedUserFields,
//     id: game.id,
//   };

//   await updateDoc(ref, {
//     trackedGames: {
//       ...currentGames,
//       [String(game.id)]: updated,
//     },
//   });

//   return updated;
// }
