import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    fields name, 
    cover.url, 
    artworks.url, 
    videos.video_id, 
    genres.name, 
      summary,
      storyline,
      first_release_date,
      screenshots.url,
    platforms.name, 
    hypes;
    where first_release_date > ${now} & hypes > 50;
    sort hypes desc;
    limit 30;
  `;

  try {
    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("UPCOMING ERROR:", err);
    return NextResponse.json([], { status: 500 });
  }
}
