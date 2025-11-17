import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const musicDir = path.join(process.cwd(), "public/music");

  try {
    const files = fs.readdirSync(musicDir).filter((f) => f.endsWith(".mp3"));

    const tracks = files.map((file) => {
      const name = file.replace(".mp3", "");
      // Check if cover exists
      const coverPathJpg = path.join(musicDir, `${name}.jpg`);
      const coverPathPng = path.join(musicDir, `${name}.png`);
      const cover = fs.existsSync(coverPathJpg)
        ? `/music/${name}.jpg`
        : fs.existsSync(coverPathPng)
        ? `/music/${name}.png`
        : undefined;

      return { src: `/music/${file}`, title: name, cover };
    });

    return NextResponse.json(tracks);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to read music folder" },
      { status: 500 }
    );
  }
}
