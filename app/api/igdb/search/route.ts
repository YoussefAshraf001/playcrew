import { igdbGamesQuery } from "@/app/lib/igdb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const games = await igdbGamesQuery(`
      search "${query}";
      fields 
        id,
        name,
        cover.url,
        first_release_date,
        version_parent;
      limit 200;
    `);

    return NextResponse.json(Array.isArray(games) ? games : []);
  } catch (err) {
    console.error("IGDB SEARCH ERROR:", err);
    return NextResponse.json([]);
  }
}

// const games = await igdbGamesQuery(`
//   search "${query}";
//   fields id, name, cover.url, first_release_date;
//   where version_parent = null;
//   where name ~ *"${query}"*;
//   limit 20;
// `);

// import { igdbGamesQuery } from "@/app/lib/igdb";
// import { NextResponse } from "next/server";

// export async function POST(req: Request) {
//   try {
//     const { query, category } = await req.json();

//     if (!query || query.length < 2) {
//       return NextResponse.json([]);
//     }

//     // Map UI tab → IGDB category
//     const categoryFilter = (() => {
//       switch (category) {
//         case "main":
//           return "category = 0";
//         case "remake":
//           return "category = 8";
//         case "remaster":
//           return "category = 9";
//         case "bundle":
//           return "category = 3";
//         case "dlc":
//           return "category = 1 && category = 2";
//         default:
//           return "category = 0";
//       }
//     })();

//     const games = await igdbGamesQuery(`
//   fields id, name, cover.url, first_release_date, category;
//   where name ~ *"${query}"* & ${categoryFilter};
//   limit 20;
// `);

//     return NextResponse.json(Array.isArray(games) ? games : []);
//   } catch (err) {
//     console.error("IGDB SEARCH ERROR:", err);
//     return NextResponse.json([], { status: 200 });
//   }
// }
