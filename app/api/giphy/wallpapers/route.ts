import { NextResponse } from "next/server";

const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";
const RESULT_LIMIT = 18;

type GiphyGif = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: { url?: string };
    fixed_width_still?: { url?: string };
    original?: { url?: string; width?: string; height?: string; size?: string };
  };
};

export async function GET(request: Request) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GIPHY is not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const endpoint = query ? "search" : "trending";
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(RESULT_LIMIT),
    rating: "pg",
  });
  if (query) params.set("q", query);

  const response = await fetch(`${GIPHY_BASE_URL}/${endpoint}?${params}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: GiphyGif[];
    meta?: { msg?: string };
  } | null;

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.meta?.msg || "Unable to load GIPHY wallpapers." },
      { status: response.status },
    );
  }

  const wallpapers = (payload?.data ?? []).flatMap((item) => {
    const previewUrl =
      item.images?.fixed_width?.url ??
      item.images?.fixed_width_still?.url ??
      item.images?.original?.url;
    const imageUrl = item.images?.original?.url;
    if (!previewUrl || !imageUrl) return [];

    return [
      {
        id: item.id,
        title: item.title?.trim() || "GIPHY wallpaper",
        previewUrl,
        imageUrl,
        size: Number(item.images?.original?.size) || null,
      },
    ];
  });

  return NextResponse.json({ wallpapers });
}
