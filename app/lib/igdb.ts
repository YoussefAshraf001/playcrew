let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getIGDBToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(
    "https://id.twitch.tv/oauth2/token" +
      `?client_id=${process.env.IGDB_CLIENT_ID}` +
      `&client_secret=${process.env.IGDB_CLIENT_SECRET}` +
      "&grant_type=client_credentials",
    { method: "POST" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch Twitch token");
  }

  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;

  return cachedToken;
}

export async function igdbGamesQuery(query: string) {
  const token = await getIGDBToken();

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

  return res.json();
}

export async function igdbReleaseDateQuery(query: string) {
  const token = await getIGDBToken();

  const res = await fetch("https://api.igdb.com/v4/release_dates", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB release_dates error: ${text}`);
  }

  return res.json();
}
