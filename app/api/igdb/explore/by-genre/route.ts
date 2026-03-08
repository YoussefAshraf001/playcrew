import { getIGDBToken, igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const genreIdCache = new Map<string, number[]>();

const escapeIgdbString = (value: string) => value.replace(/"/g, '\\"').trim();

async function resolveGenreIds(genre: string) {
  const key = genre.toLowerCase().trim();
  if (!key) return [];
  if (genreIdCache.has(key)) return genreIdCache.get(key)!;

  const token = await getIGDBToken();
  const safeGenre = escapeIgdbString(genre);

  const res = await fetch("https://api.igdb.com/v4/genres", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `
      fields id,name,slug;
      where name ~ *"${safeGenre}"* | slug ~ *"${safeGenre.toLowerCase()}"*;
      limit 20;
    `,
  });

  if (!res.ok) {
    genreIdCache.set(key, []);
    return [];
  }

  const data = (await res.json()) as Array<{ id?: number }>;
  const ids = data
    .map((item) => item?.id)
    .filter((id): id is number => typeof id === "number");

  genreIdCache.set(key, ids);
  return ids;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genre = String(searchParams.get("genre") || "").trim();
  const offset = Math.max(0, Number(searchParams.get("offset") || "0"));
  const limit = Math.min(
    120,
    Math.max(1, Number(searchParams.get("limit") || "60")),
  );

  if (!genre) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const ids = await resolveGenreIds(genre);
    if (ids.length === 0) return NextResponse.json([], { status: 200 });

    const query = `
      fields
      name,
      cover.url,
      artworks.url,
      videos.video_id,
      videos.name,
      genres.name,
      summary,
        storyline,
        first_release_date,
        rating,
        total_rating_count;

      where
        cover != null &
        first_release_date != null &
        rating > 65 &
        total_rating_count > 40 &
        genres = (${ids.join(",")});

      sort total_rating_count desc;
      limit ${limit};
      offset ${offset};
    `;

    const data = await igdbGamesQuery(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("BY GENRE ERROR:", err);
    return NextResponse.json(
      { error: "Failed to fetch genre recommendations" },
      { status: 500 },
    );
  }
}
