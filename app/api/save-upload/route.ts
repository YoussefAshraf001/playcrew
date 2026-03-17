export const runtime = "nodejs";

import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;
    const gameId = formData.get("gameId");
    const userId = formData.get("userId") as string;

    if (!file || !gameId || !userId) {
      return Response.json(
        { error: "Missing file, gameId or userId" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await b2.authorize();

    const uploadUrl = await b2.getUploadUrl({
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
    });

    const storageKey = `saves/${userId}/${gameId}/save.zip`;

    const result = await b2.uploadFile({
      uploadUrl: uploadUrl.data.uploadUrl,
      uploadAuthToken: uploadUrl.data.authorizationToken,
      fileName: storageKey,
      data: buffer,
    });

    // ✅ RETURN SUCCESS (NO FIREBASE YET)
    return Response.json({
      success: true,
      storageKey,
      fileId: result.data.fileId,
      fileName: file.name,
      sizeBytes: file.size,
    });
  } catch (err: any) {
    console.error("🔥 SERVER ERROR:", err);

    return Response.json(
      {
        error: err?.message || String(err),
        stack: err?.stack || null,
      },
      { status: 500 },
    );
  }
}
