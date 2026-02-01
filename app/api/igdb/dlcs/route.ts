import { getIGDBToken } from "@/app/lib/igdb";

export async function POST(req: Request) {
  const { ids } = await req.json();

  const token = await getIGDBToken();

  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `
      fields name, cover.url, first_release_date;
      where id = (${ids.join(",")});
      limit 50;
    `,
  });

  const data = await res.json();
  return Response.json(data);
}
