import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

export async function refreshGameData(userId: string, game: any) {
  // 1. RAWG SEARCH
  const searchRes = await fetch(
    `https://api.rawg.io/api/games?search=${encodeURIComponent(
      game.name
    )}&key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
  );
  if (!searchRes.ok) throw new Error("RAWG search failed");

  const searchData = await searchRes.json();
  const first = searchData.results?.[0];
  if (!first) throw new Error("Game not found on RAWG");

  // 2. RAWG FULL GAME DATA
  const rawgRes = await fetch(
    `https://api.rawg.io/api/games/${first.slug}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
  );
  if (!rawgRes.ok) throw new Error("RAWG fetch failed");

  const rawg = await rawgRes.json();

  // 3. Load current user game fields
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  const currentGames = snap.exists() ? snap.data().trackedGames || {} : {};
  const existing = currentGames[String(game.id)] || {};

  const preservedUserFields = {
    playtime: existing.playtime || 0,
    progress: existing.progress || 0,
    my_rating: existing.my_rating || 0,
    favorite: existing.favorite || false,
    status: existing.status || "",
    notes: existing.notes || "",
    categoryRatings: existing.categoryRatings || {
      graphics: 0,
      gameplay: 0,
      story: 0,
      fun: 0,
    },
  };

  const rawgFields = {
    name: rawg.name,
    slug: rawg.slug,
    released: rawg.released ?? rawg.platforms?.[0]?.released_at ?? "TBA",

    background_image: rawg.background_image || "/placeholder-game.jpg",
    background_image_additional: rawg.background_image_additional || null,
    metacritic: rawg.metacritic,
    genres: rawg.genres,
    platforms: rawg.platforms,
    publishers: rawg.publishers,
  };

  const updated = {
    ...existing,
    ...rawgFields,
    ...preservedUserFields,
    id: game.id,
  };

  await updateDoc(ref, {
    trackedGames: {
      ...currentGames,
      [String(game.id)]: updated,
    },
  });

  return updated;
}
