import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number(searchParams.get("offset") || "0"));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || "30")),
  );
  const now = Math.floor(Date.now() / 1000);

  const query = `
  fields 
    name,
    cover.url,
    artworks.url,
    videos.video_id,
    genres.name,
    first_release_date,
    rating,
    summary,
    storyline,
    total_rating_count;


  where 
    first_release_date > ${now - 60 * 60 * 24 * 180} &
    total_rating_count > 20;

  sort total_rating_count desc;
  limit ${limit};
  offset ${offset};
`;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("TRENDING ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch trending games" },
      { status: 500 },
    );
  }
}
