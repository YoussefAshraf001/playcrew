import { NextResponse } from "next/server";
import { getIGDBToken } from "@/app/lib/igdb";

const ASSETS = [
  ["library-capsule-2x", "Library Capsule 2x", "library_capsule_2x.jpg", "600 × 900"],
  ["library-capsule", "Library Capsule", "library_capsule.jpg", "300 × 450"],
  ["library-hero-2x", "Library Hero 2x", "library_hero_2x.jpg"],
  ["library-hero", "Library Hero", "library_hero.jpg"],
  ["library-logo-2x", "Library Logo 2x", "logo_2x.png"],
  ["library-logo", "Library Logo", "logo.png"],
  ["library-header-2x", "Library Header 2x", "library_header_2x.jpg"],
  ["library-header", "Library Header", "library_header.jpg"],
  ["main-capsule-2x", "Main Capsule 2x", "capsule_616x353_2x.jpg"],
  ["main-capsule", "Main Capsule", "capsule_616x353.jpg", "616 × 353"],
  ["header", "Store Header", "header.jpg", "460 × 215"],
  ["small-capsule-2x", "Small Capsule 2x", "capsule_231x87_2x.jpg"],
  ["small-capsule", "Small Capsule", "capsule_231x87.jpg", "231 × 87"],
  ["page-background", "Page Background", "page_bg_raw.jpg"],
] as const;

// Only the two portrait library capsules are needed by the cover picker.
const COVER_ASSETS = ASSETS.slice(0, 2);

const CDN_BASES = [
  "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps",
  "https://cdn.cloudflare.steamstatic.com/steam/apps",
];

type LocalizedAssetPaths = Record<string, string>;
type ResolvedSteamAsset = {
  key: string;
  label: string;
  filename: string;
  dimensions?: string;
  url: string;
};

const getLocalizedAssetPath = (paths?: LocalizedAssetPaths) =>
  paths?.english ?? Object.values(paths ?? {})[0] ?? null;

async function resolveHashedLibraryAssets(
  appId: string,
): Promise<ResolvedSteamAsset[]> {
  try {
    const response = await fetch(`https://api.steamcmd.net/v1/info/${appId}`, {
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      data?: Record<
        string,
        {
          common?: {
            library_assets_full?: {
              library_capsule?: {
                image?: LocalizedAssetPaths;
                image2x?: LocalizedAssetPaths;
              };
            };
          };
        }
      >;
    };
    const capsule =
      payload.data?.[appId]?.common?.library_assets_full?.library_capsule;
    const standardPath = getLocalizedAssetPath(capsule?.image);
    const doublePath = getLocalizedAssetPath(capsule?.image2x);
    const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}`;

    return [
      doublePath
        ? {
            key: "library-capsule-2x",
            label: "Library Capsule 2x",
            filename: doublePath.split("/").at(-1) ?? "library_capsule_2x.jpg",
            dimensions: "600 × 900",
            url: `${base}/${doublePath}`,
          }
        : null,
      standardPath
        ? {
            key: "library-capsule",
            label: "Library Capsule",
            filename: standardPath.split("/").at(-1) ?? "library_capsule.jpg",
            dimensions: "300 × 450",
            url: `${base}/${standardPath}`,
          }
        : null,
    ].filter((asset): asset is NonNullable<typeof asset> => asset !== null);
  } catch (error) {
    console.warn("Steam app-info lookup failed; trying direct CDN paths", error);
    return [];
  }
}

async function resolveAsset(appId: string, asset: (typeof ASSETS)[number]) {
  const filenames =
    asset[0] === "library-capsule-2x"
      ? ["library_capsule_2x.jpg", "library_600x900_2x.jpg"]
      : asset[0] === "library-capsule"
        ? ["library_capsule.jpg", "library_600x900.jpg"]
        : [asset[2]];

  for (const filename of filenames) {
    for (const base of CDN_BASES) {
      const url = `${base}/${appId}/${filename}`;
      try {
        const response = await fetch(url, {
          method: "HEAD",
          next: { revalidate: 86_400 },
        });
        if (
          response.ok &&
          response.headers.get("content-type")?.startsWith("image/")
        ) {
          return {
            key: asset[0],
            label: asset[1],
            filename,
            dimensions: asset[3],
            url,
          };
        }
      } catch {
        // Try the fallback filename or Steam CDN.
      }
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const igdbId = Number(id);
    if (!Number.isInteger(igdbId) || igdbId <= 0) {
      return NextResponse.json({ error: "Invalid IGDB ID." }, { status: 400 });
    }

    const token = await getIGDBToken();
    const response = await fetch("https://api.igdb.com/v4/external_games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `fields uid,name,url,external_game_source; where game = ${igdbId} & external_game_source = 13; limit 10;`,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());

    const matches = (await response.json()) as Array<{ uid?: string }>;
    let appId = matches.find((match) => /^\d+$/.test(match.uid ?? ""))?.uid;

    // Some IGDB records have a Steam website but no external_games mapping.
    if (!appId) {
      const websitesResponse = await fetch("https://api.igdb.com/v4/websites", {
        method: "POST",
        headers: {
          "Client-ID": process.env.IGDB_CLIENT_ID!,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body: `fields url,type; where game = ${igdbId} & type = 13; limit 10;`,
        cache: "no-store",
      });

      if (websitesResponse.ok) {
        const websites = (await websitesResponse.json()) as Array<{
          url?: string;
        }>;
        for (const website of websites) {
          const match = website.url?.match(/store\.steampowered\.com\/app\/(\d+)/i);
          if (match?.[1]) {
            appId = match[1];
            break;
          }
        }
      }
    }

    if (!appId) {
      return NextResponse.json(
        { error: "IGDB does not have a Steam App ID for this game." },
        { status: 404 },
      );
    }

    let assets = await resolveHashedLibraryAssets(appId);
    if (!assets.length) {
      assets = (
        await Promise.all(COVER_ASSETS.map((asset) => resolveAsset(appId, asset)))
      ).filter((asset): asset is NonNullable<typeof asset> => asset !== null);
    }
    return NextResponse.json(
      {
        appId,
        steamUrl: `https://store.steampowered.com/app/${appId}`,
        assets,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load Steam assets", error);
    return NextResponse.json({ error: "Could not load Steam assets right now." }, { status: 500 });
  }
}
