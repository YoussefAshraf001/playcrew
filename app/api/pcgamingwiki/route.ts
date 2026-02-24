import { NextResponse } from "next/server";

const PCGW_API_URL = "https://www.pcgamingwiki.com/w/api.php";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to fetch PCGamingWiki API";
}

type CargoQueryResponse = {
  cargoquery?: Array<{ title: Record<string, string> }>;
  [key: string]: unknown;
};

function sanitizeForWhereClause(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function runCargoQuery(queryParams: URLSearchParams) {
  const requestUrl = `${PCGW_API_URL}?${queryParams.toString()}`;

  const response = await fetch(requestUrl, {
    headers: {
      "User-Agent": "PlayCrew/1.0 (PCGW test page)",
    },
    next: { revalidate: 0 },
    cache: "no-store",
  });

  const text = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    response,
    requestUrl,
    data,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim() || "Cyberpunk 2077";
  const safeTitle = sanitizeForWhereClause(title);

  const commonFields = [
    "Availability._pageName=Page",
    "Availability.Uses_DRM",
    "Availability.Retail_DRM",
    "Availability.Steam_DRM",
    "Availability.GOGcom_DRM",
    "Availability.Epic_Games_Store_DRM",
    "Availability.EA_app_DRM",
    "Availability.Ubisoft_Store_DRM",
    "Availability.Microsoft_Store_DRM",
    "Availability.Developer_website_DRM",
    "Availability.Publisher_website_DRM",
    "Availability.Official_website_DRM",
    "Availability.Available_from",
    "Multiplayer.Online",
    "Multiplayer.Local",
    "Multiplayer.Online_modes",
    "Multiplayer.Local_modes",
    "Infobox_game.Modes",
  ].join(",");

  try {
    const exactQuery = new URLSearchParams({
      action: "cargoquery",
      format: "json",
      tables: "Availability,Multiplayer,Infobox_game",
      join_on:
        "Availability._pageName=Multiplayer._pageName,Availability._pageName=Infobox_game._pageName",
      fields: commonFields,
      where: `Availability._pageName="${safeTitle}"`,
      limit: "20",
    });

    const exactResult = await runCargoQuery(exactQuery);

    const exactData = exactResult.data as CargoQueryResponse;
    const exactMatches = Array.isArray(exactData?.cargoquery)
      ? exactData.cargoquery
      : [];

    if (exactMatches.length > 0) {
      return NextResponse.json({
        ok: exactResult.response.ok,
        status: exactResult.response.status,
        title,
        mode: "exact",
        requestUrl: exactResult.requestUrl,
        data: exactResult.data,
      });
    }

    const likeQuery = new URLSearchParams({
      action: "cargoquery",
      format: "json",
      tables: "Availability,Multiplayer,Infobox_game",
      join_on:
        "Availability._pageName=Multiplayer._pageName,Availability._pageName=Infobox_game._pageName",
      fields: commonFields,
      where: `Availability._pageName LIKE "%${safeTitle}%"`,
      limit: "25",
    });

    const likeResult = await runCargoQuery(likeQuery);

    return NextResponse.json({
      ok: likeResult.response.ok,
      status: likeResult.response.status,
      title,
      mode: "like",
      requestUrl: likeResult.requestUrl,
      data: likeResult.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        title,
        requestUrl: null,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
