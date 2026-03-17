import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();

    console.log("fileName:", fileName);

    if (!fileName) {
      throw new Error("Missing fileName");
    }

    // 🔹 Step 1: Authorize
    const authResponse = await b2.authorize();
    console.log("AUTH RESPONSE:", authResponse);

    if (!authResponse?.data) {
      throw new Error("B2 authorize failed");
    }

    const baseUrl = authResponse.data.downloadUrl;

    // 🔹 Step 2: Get download authorization
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
      fileNamePrefix: fileName,
      validDurationInSeconds: 60,
    });

    console.log("DOWNLOAD AUTH:", downloadAuth);

    if (!downloadAuth?.data?.authorizationToken) {
      throw new Error(
        "Download authorization failed: " + JSON.stringify(downloadAuth),
      );
    }

    const downloadUrl = `${baseUrl}/file/${process.env.BACKBLAZE_B2_BUCKET_NAME}/${fileName}?Authorization=${downloadAuth.data.authorizationToken}`;

    console.log("FINAL URL:", downloadUrl);

    return Response.json({ downloadUrl });
  } catch (err: any) {
    console.error("💥 FULL ERROR:", err);

    return Response.json({ error: err.message }, { status: 500 });
  }
}
