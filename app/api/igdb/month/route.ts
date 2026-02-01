import { getIGDBToken } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { year, month } = await req.json();

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return NextResponse.json(
        { error: "Year and month are required" },
        { status: 400 },
      );
    }

    const start = Math.floor(new Date(year, month, 1).getTime() / 1000);
    const end = Math.floor(
      new Date(year, month + 1, 0, 23, 59, 59).getTime() / 1000,
    );

    const token = await getIGDBToken();

    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `
        fields name, first_release_date, cover.url, platforms.name;
        where first_release_date >= ${start}
          & first_release_date <= ${end}
          & version_parent = null;
        sort first_release_date asc;
        limit 500;
      `,
    });

    if (!igdbRes.ok) {
      throw new Error(await igdbRes.text());
    }

    return NextResponse.json(await igdbRes.json());
  } catch (err) {
    console.error("IGDB ERROR:", err);
    return NextResponse.json({ error: "IGDB internal error" }, { status: 500 });
  }
}
