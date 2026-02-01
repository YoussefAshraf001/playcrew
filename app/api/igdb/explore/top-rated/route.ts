import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const query = `
    fields 
      name,
      cover.url,
      artworks.url,
      videos.video_id,
      genres.name,
    summary,
    storyline,
      first_release_date,
      rating,
      total_rating_count;

    where 
      rating > 85 &
      total_rating_count > 200;

    sort rating desc;
    limit 30;
  `;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("TOP RATED ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch top rated games" },
      { status: 500 },
    );
  }
}
