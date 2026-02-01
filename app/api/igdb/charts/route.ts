import { getIGDBToken } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = await getIGDBToken();

    const query = `
      fields id, name, aggregated_rating, cover.url, first_release_date;
      where aggregated_rating != null
        & version_parent = null
        & category = 0;
      sort aggregated_rating desc;
      limit 100;
    `;

    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: query,
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const games = await res.json();
    return NextResponse.json(Array.isArray(games) ? games : []);
  } catch (err) {
    console.error("IGDB Charts Error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
