import { NextResponse } from "next/server";

const GIPHY_BASE_URL = "https://api.giphy.com/v1/stickers";

type GiphyResult = {
  id: string;
  title: string;
  images?: {
    fixed_width?: { url?: string };
    fixed_width_still?: { url?: string };
    original?: { url?: string };
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
  const query = searchParams.get("q")?.trim().slice(0, 50) ?? "";
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const endpoint = query ? "search" : "trending";
  const limit = 12;
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(limit),
    offset: String(offset),
    rating: "pg",
  });
  if (query) params.set("q", query);

  const response = await fetch(`${GIPHY_BASE_URL}/${endpoint}?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to load GIPHY stickers." },
      { status: response.status },
    );
  }

  const payload = (await response.json()) as { data?: GiphyResult[] };
  const stickers = (payload.data ?? []).flatMap((item) => {
    const previewUrl =
      item.images?.fixed_width_still?.url ??
      item.images?.fixed_width?.url ??
      item.images?.original?.url;
    const imageUrl = item.images?.original?.url ?? previewUrl;
    return previewUrl && imageUrl
      ? [{ id: item.id, title: item.title || "GIPHY sticker", previewUrl, imageUrl }]
      : [];
  });

  return NextResponse.json({ stickers, hasMore: (payload.data?.length ?? 0) === limit });
}
