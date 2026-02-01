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
      rating >= 88 &
      total_rating_count >= 150;

    sort rating desc;
    limit 30;
  `;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("CRITICALLY ACCLAIMED ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch critically acclaimed games" },
      { status: 500 },
    );
  }
}
