import { igdbReleaseDateQuery } from "@/app/lib/igdb";
import { inferReleaseDatePrecision } from "@/app/lib/releaseDates";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { igdbId } = await req.json();

    if (!igdbId) {
      return NextResponse.json({ error: "Missing igdbId" }, { status: 400 });
    }

    const data = await igdbReleaseDateQuery(`
      fields date, human, y, m;
      where game = ${igdbId};
      sort date asc;
      limit 1;
    `);

    if (!Array.isArray(data) || !data[0]?.date) {
      return NextResponse.json({ igdbDate: null, precision: null, human: null });
    }

    const entry = data[0];

    return NextResponse.json({
      igdbDate: entry.date,
      precision: inferReleaseDatePrecision(entry.human),
      human: entry.human ?? null,
    });
  } catch (err: any) {
    console.error("IGDB ERROR:", err.message);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
