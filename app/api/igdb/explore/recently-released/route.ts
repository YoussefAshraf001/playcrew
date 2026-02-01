import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const monthAgo = now - 60 * 60 * 24 * 30;

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
      first_release_date >= ${monthAgo} &
      first_release_date <= ${now} &
      cover != null;

    sort first_release_date desc;
    limit 30;
  `;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("RECENT ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch recent games" },
      { status: 500 },
    );
  }
}
