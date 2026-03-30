export const runtime = "nodejs";

import B2 from "backblaze-b2";
import { adminDb } from "@/app/lib/firebase-admin";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function POST(req: Request) {
  try {
    const { fileName, gameId, userId } = await req.json();

    if (!fileName || !gameId || !userId) {
      return Response.json(
        { error: "Missing fileName, gameId or userId" },
        { status: 400 },
      );
    }

    await b2.authorize();

    // 🔍 Find file in B2
    const list = await b2.listFileNames({
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
      prefix: fileName,
      maxFileCount: 1000, // get all versions
    });

    const files = list.data.files;

    if (!files.length) {
      console.warn("File already deleted in B2:", fileName);
    } else {
      await Promise.all(
        files.map((file: any) =>
          b2.deleteFileVersion({
            fileId: file.fileId,
            fileName: file.fileName,
          }),
        ),
      );
    }

    // 🧠 Delete from Firebase
    const ref = adminDb
      .collection("users")
      .doc(userId)
      .collection("games_igdb")
      .doc(gameId.toString());

    try {
      await ref.set({ save: null }, { merge: true });
    } catch (err) {
      console.error("Firestore cleanup failed:", err);
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("🔥 DELETE ERROR:", err);

    return Response.json(
      {
        error: err?.message || "Delete failed",
      },
      { status: 500 },
    );
  }
}
