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
      screenshots.url,
    summary,
    storyline,
      first_release_date,
      rating,
      total_rating_count;

    where 
      total_rating_count > 300;

    sort total_rating_count desc;
    limit 30;
  `;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("MOST PLAYED ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch most played games" },
      { status: 500 },
    );
  }
}
