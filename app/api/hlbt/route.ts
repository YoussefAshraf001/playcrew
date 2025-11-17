import axios from "axios";
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");

  if (!game)
    return NextResponse.json({ error: "Missing game query" }, { status: 400 });

  try {
    const res = await axios.get(
      `https://howlongtobeat.com/?q=${encodeURIComponent(game)}`
    );

    const $ = cheerio.load(res.data);

    const results: any[] = [];
    $(".back_dark").each((i, el) => {
      const name = $(el).find("a").text().trim();
      const url = $(el).find("a").attr("href");
      // parse gameplay times if available, or skip
      results.push({ name, url });
    });

    return NextResponse.json(results.slice(0, 10));
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 200 });
  }
}
