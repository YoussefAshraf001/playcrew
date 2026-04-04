import { NextResponse } from "next/server";
import { getIGDBToken, igdbReleaseDateQuery } from "@/app/lib/igdb";
import { inferReleaseDatePrecision } from "@/app/lib/releaseDates";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();

    if (!id) {
      return NextResponse.json({ error: "Missing IGDB ID" }, { status: 400 });
    }

    const token = await getIGDBToken();

    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `
  fields
    name,
    cover.image_id,
    genres.name,
    rating,
    platforms.name,
    first_release_date;
  where id = ${id};
`,
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("IGDB ERROR:", text);
      return NextResponse.json(
        { error: "IGDB fetch failed", details: text },
        { status: 500 },
      );
    }

    let game;
    try {
      const parsed = JSON.parse(text);

      if (!parsed || parsed.length === 0) {
        console.error("IGDB EMPTY RESPONSE - No games found for ID:", id);
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
      }

      [game] = parsed;
    } catch (parseErr) {
      console.error("JSON PARSE ERROR:", parseErr, "Text was:", text);
      throw parseErr;
    }

    const [releaseDateInfo] = await igdbReleaseDateQuery(`
      fields date, human, y, m;
      where game = ${id};
      sort date asc;
      limit 1;
    `);

    return NextResponse.json({
      id: game.id,
      name: game.name,
      cover: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`
        : null,
      genres: game.genres?.map((g: any) => g.name) ?? [],
      rating: game.rating ?? null,
      platforms: game.platforms?.map((p: any) => p.name) ?? [],
      releaseDate: game.first_release_date ?? null,
      releaseDatePrecision: inferReleaseDatePrecision(
        releaseDateInfo?.human ?? null,
      ),
    });
  } catch (err) {
    console.error("IGDB ROUTE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
