export const runtime = "nodejs";

import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();

    if (!fileName) {
      return Response.json({ error: "Missing fileName" }, { status: 400 });
    }

    await b2.authorize();

    // You NEED fileId to delete
    const list = await b2.listFileNames({
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
      prefix: fileName,
      maxFileCount: 1,
    });

    const file = list.data.files[0];

    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    await b2.deleteFileVersion({
      fileId: file.fileId,
      fileName: file.fileName,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
