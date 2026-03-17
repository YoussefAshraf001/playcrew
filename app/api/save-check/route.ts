export const runtime = "nodejs";

import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const gameId = searchParams.get("gameId");
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!gameId) {
      return Response.json({ error: "Missing gameId" }, { status: 400 });
    }

    await b2.authorize();

    const prefix = `saves/${userId}/${gameId}/`;

    const list = await b2.listFileNames({
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
      prefix,
      maxFileCount: 1,
    });

    const file = list.data.files[0];

    if (!file) {
      return Response.json({ save: null });
    }

    return Response.json({
      save: {
        fileName: file.fileName.split("/").pop(),
        sizeBytes: file.contentLength,
        storageKey: file.fileName,
      },
    });
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
