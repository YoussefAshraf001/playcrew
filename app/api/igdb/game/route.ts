import { getIGDBToken, igdbReleaseDateQuery } from "@/app/lib/igdb";
import { inferReleaseDatePrecision } from "@/app/lib/releaseDates";
import { NextResponse } from "next/server";

const SIMILAR_TARGET = 20;

const mapSimilarEntry = (entry: any) => ({
  id: entry.id,
  name: entry.name,
  cover: entry.cover?.url
    ? `https:${entry.cover.url.replace("t_thumb", "t_cover_big_2x")}`
    : "/placeholder-game.jpg",
  rating: entry.aggregated_rating ? Math.round(entry.aggregated_rating) : 0,
  released: entry.first_release_date ?? null,
});

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "No ID provided" }, { status: 400 });
  }

  try {
    const token = await getIGDBToken();

    // 1) Fetch game details
    const gameRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `
        fields id, name, slug, tags, genres, cover.url,
        aggregated_rating, total_rating, total_rating_count,
        first_release_date, summary, storyline, platforms.name,
        screenshots.url, videos.video_id, dlcs, similar_games,
        franchises,
        game_engines, game_status, websites;
        where id = ${id};
      `,
    });

    if (!gameRes.ok) {
      const errText = await gameRes.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const [game] = await gameRes.json();

    const similarResPromise = game.similar_games?.length
      ? fetch("https://api.igdb.com/v4/games", {
          method: "POST",
          headers: {
            "Client-ID": process.env.IGDB_CLIENT_ID!,
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
          },
          body: `
            fields id, name, cover.url, aggregated_rating, first_release_date;
            where id = (${game.similar_games.join(",")});
            limit ${SIMILAR_TARGET};
          `,
        })
      : Promise.resolve(null);

    // These requests do not depend on one another, so run them together.
    const [[releaseDateInfo], timeRes, similarRes] = await Promise.all([
      igdbReleaseDateQuery(`
        fields date, human, y, m;
        where game = ${id};
        sort date asc;
        limit 1;
      `),
      fetch("https://api.igdb.com/v4/game_time_to_beats", {
        method: "POST",
        headers: {
          "Client-ID": process.env.IGDB_CLIENT_ID!,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body: `
          fields completely, normally, hastily, count;
          where game_id = ${id};
        `,
      }),
      similarResPromise,
    ]);

    if (!timeRes.ok) {
      const errText = await timeRes.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const [timeToBeat] = await timeRes.json();

    // 3) Map similar games
    let similarGames: any[] = [];
    if (similarRes?.ok) {
      const similarData = await similarRes.json();
      const byId = new Map<number, any>(
        similarData.map((entry: any) => [entry.id, entry]),
      );

      similarGames = game.similar_games
        .map((similarId: number) => byId.get(similarId))
        .filter(Boolean)
        .map((entry: any) => mapSimilarEntry(entry));
    }

    // Backfill if similar_games returns fewer than requested.
    if (similarGames.length < SIMILAR_TARGET && game.genres?.length) {
      const excludedIds = new Set<number>([
        Number(id),
        ...similarGames.map((g: any) => g.id),
      ]);

      const extraRes = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": process.env.IGDB_CLIENT_ID!,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body: `
          fields id, name, cover.url, aggregated_rating, first_release_date;
          where id != ${id}
            & cover != null
            & genres = (${game.genres.join(",")});
          sort total_rating_count desc;
          limit 60;
        `,
      });

      if (extraRes.ok) {
        const extraData = await extraRes.json();
        const extras = extraData
          .filter((entry: any) => !excludedIds.has(entry.id))
          .map((entry: any) => mapSimilarEntry(entry));

        similarGames = [...similarGames, ...extras].slice(0, SIMILAR_TARGET);
      }
    }

    // These lookups are independent too, so fetch them concurrently.
    const [genreRes, tagRes] = await Promise.all([
      game.genres?.length
        ? fetch("https://api.igdb.com/v4/genres", {
            method: "POST",
            headers: {
              "Client-ID": process.env.IGDB_CLIENT_ID!,
              Authorization: `Bearer ${token}`,
              "Content-Type": "text/plain",
            },
            body: `
              fields id, name;
              where id = (${game.genres.join(",")});
            `,
          })
        : Promise.resolve(null),
      game.tags?.length
        ? fetch("https://api.igdb.com/v4/tags", {
            method: "POST",
            headers: {
              "Client-ID": process.env.IGDB_CLIENT_ID!,
              Authorization: `Bearer ${token}`,
              "Content-Type": "text/plain",
            },
            body: `
              fields id, name;
              where id = (${game.tags.join(",")});
            `,
          })
        : Promise.resolve(null),
    ]);

    // 4) Map genre names
    const genreMap: Record<number, string> = {};
    if (genreRes?.ok) {
      const genresData = await genreRes.json();
      genresData.forEach((g: any) => (genreMap[g.id] = g.name));
    }

    // 5) Map tag names
    const tagMap: Record<number, string> = {};
    if (tagRes?.ok) {
      const tagsData = await tagRes.json();
      tagsData.forEach((t: any) => (tagMap[t.id] = t.name));
    }

    // 6) Map game data
    const mappedGame = {
      id: game.id,
      name: game.name,
      description_raw: game.storyline || "No description available",
      summary: game.summary || "No description available",
      background_image: game.cover
        ? `https:${game.cover.url.replace("t_thumb", "t_cover_big_2x")}`
        : "/placeholder-game.jpg",
      short_screenshots:
        game.screenshots?.map(
          (s: any) => `https:${s.url.replace("t_thumb", "t_screenshot_big")}`,
        ) || [],
      platforms:
        game.platforms?.map((p: any) => ({ platform: { name: p.name } })) || [],
      released: game.first_release_date,
      releaseDatePrecision: inferReleaseDatePrecision(
        releaseDateInfo?.human ?? null,
      ),
      rating: game.aggregated_rating ? Math.round(game.aggregated_rating) : 0,
      total_rating: game.total_rating,
      total_rating_count: game.total_rating_count,
      videos: game.videos,
      dlcs: game.dlcs,
      similar_games: similarGames,
      franchises: game.franchises,
      game_engines: game.game_engines,
      game_status: game.game_status,
      websites: game.websites,
      genres:
        game.genres?.map(
          (genreId: number) => genreMap[genreId] ?? `Unknown (${genreId})`,
        ) || [],
      tags:
        game.tags?.map(
          (tagId: number) => tagMap[tagId] ?? `Unknown (${tagId})`,
        ) || [],
      time_to_beat: timeToBeat || null,
    };

    return NextResponse.json(mappedGame);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}





