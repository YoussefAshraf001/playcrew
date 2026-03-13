import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const games = await igdbGamesQuery(`
      search "${query}";
      fields 
        id,
        name,
        cover.url,
        first_release_date,
        version_parent;
      limit 200;
    `);

    return NextResponse.json(Array.isArray(games) ? games : []);
  } catch (err) {
    console.error("IGDB SEARCH ERROR:", err);
    return NextResponse.json([]);
  }
}
