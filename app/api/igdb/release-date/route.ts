import { igdbReleaseDateQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { igdbId } = await req.json();

    if (!igdbId) {
      return NextResponse.json({ error: "Missing igdbId" }, { status: 400 });
    }

    const data = await igdbReleaseDateQuery(`
      fields date;
      where game = ${igdbId};
      sort date asc;
      limit 1;
    `);

    if (!Array.isArray(data) || !data[0]?.date) {
      return NextResponse.json({ igdbDate: null });
    }

    return NextResponse.json({
      igdbDate: data[0].date,
    });
  } catch (err: any) {
    console.error("IGDB ERROR:", err.message);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
