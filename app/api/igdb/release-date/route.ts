import { igdbReleaseDateQuery } from "@/app/lib/igdb";
import { inferReleaseDatePrecision } from "@/app/lib/releaseDates";
import { resolveIgdbReleasePhases } from "@/app/lib/igdbReleasePhases";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { igdbId } = await req.json();

    if (!igdbId) {
      return NextResponse.json({ error: "Missing igdbId" }, { status: 400 });
    }

    const data = await igdbReleaseDateQuery(`
      fields date, human, y, m, status.name, platform.name, release_region.region;
      where game = ${igdbId};
      sort date asc;
      limit 100;
    `);

    if (!Array.isArray(data)) {
      return NextResponse.json({
        igdbDate: null,
        earlyAccessDate: null,
        earlyAccessDatePrecision: null,
        fullReleaseDate: null,
        fullReleaseDatePrecision: null,
        releaseDateKind: null,
        precision: null,
        human: null,
      });
    }

    const phases = resolveIgdbReleasePhases(data);

    return NextResponse.json({
      igdbDate: phases.releaseDate,
      earlyAccessDate: phases.earlyAccessDate,
      earlyAccessDatePrecision: phases.earlyAccessDatePrecision,
      fullReleaseDate: phases.fullReleaseDate,
      fullReleaseDatePrecision: phases.fullReleaseDatePrecision,
      releaseDateKind: phases.releaseDateKind,
      precision: inferReleaseDatePrecision(phases.releaseDateHuman),
      human: phases.releaseDateHuman,
    });
  } catch (err: any) {
    console.error("IGDB ERROR:", err.message);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
