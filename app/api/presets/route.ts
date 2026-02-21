import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import type { Dirent } from "fs";
import path from "path";

type PresetKind = "avatar" | "wallpaper";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const toLabel = (name: string) =>
  name
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const sortAssets = (a: string, b: string) => {
  const aBase = path.basename(a, path.extname(a));
  const bBase = path.basename(b, path.extname(b));
  const aNum = Number(aBase);
  const bNum = Number(bBase);

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

const walkFiles = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) out.push(full);
    }
  }

  return out;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get("type");
    const type: PresetKind = rawType === "wallpaper" ? "wallpaper" : "avatar";

    const publicPresetsRoot = path.join(process.cwd(), "public", "presets");
    const categoryEntries = await fs.readdir(publicPresetsRoot, {
      withFileTypes: true,
    });

    const categories = [];

    for (const categoryEntry of categoryEntries) {
      if (!categoryEntry.isDirectory()) continue;

      const categoryDir = path.join(publicPresetsRoot, categoryEntry.name);
      const allFiles = await walkFiles(categoryDir);

      // Prefer files that live under /avatar or /wallpaper for the requested type.
      const typeMarker = `${path.sep}${type}${path.sep}`;
      const typeScoped = allFiles.filter((f) => f.includes(typeMarker));
      const sourceFiles = typeScoped.length ? typeScoped : allFiles;

      const webPaths = sourceFiles
        .map((full) => full.replace(publicPresetsRoot, "").replace(/\\/g, "/"))
        .map((rel) => `/presets${rel.startsWith("/") ? rel : `/${rel}`}`)
        .sort(sortAssets);

      const gifAssets = webPaths.filter((p) => p.toLowerCase().endsWith(".gif"));
      const staticAssets = webPaths.filter((p) => !p.toLowerCase().endsWith(".gif"));

      if (!staticAssets.length && !gifAssets.length) continue;

      categories.push({
        id: categoryEntry.name.toLowerCase(),
        label: toLabel(categoryEntry.name),
        static: staticAssets,
        gifs: gifAssets,
      });
    }

    categories.sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to list presets", error);
    return NextResponse.json([], { status: 200 });
  }
}
