import B2 from "backblaze-b2";

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID!,
  applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY!,
});

export async function POST(req: Request) {
  const { fileName } = await req.json();

  await b2.authorize();

  const download = await b2.getDownloadAuthorization({
    bucketId: process.env.BACKBLAZE_B2_BUCKET_ID!,
    fileNamePrefix: fileName,
    validDurationInSeconds: 60,
  });

  return Response.json({
    downloadUrl: `https://f000.backblazeb2.com/file/${process.env.BACKBLAZE_B2_BUCKET_NAME}/${fileName}?Authorization=${download.data.authorizationToken}`,
  });
}
