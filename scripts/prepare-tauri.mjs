import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const staticDir = path.join(rootDir, ".next", "static");
const publicDir = path.join(rootDir, "public");
const targetDir = path.join(rootDir, "src-tauri", "next-server");
const nodeRuntimeSource = path.dirname(process.execPath);
const nodeRuntimeTarget = path.join(rootDir, "src-tauri", "node-runtime");

if (!fs.existsSync(standaloneDir)) {
  throw new Error(`Missing Next standalone output: ${standaloneDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(standaloneDir, targetDir, { recursive: true, force: true });

const nextStaticTarget = path.join(targetDir, ".next", "static");
fs.mkdirSync(path.dirname(nextStaticTarget), { recursive: true });
fs.cpSync(staticDir, nextStaticTarget, { recursive: true, force: true });

const publicTarget = path.join(targetDir, "public");
fs.cpSync(publicDir, publicTarget, { recursive: true, force: true });

fs.rmSync(nodeRuntimeTarget, { recursive: true, force: true });
fs.mkdirSync(nodeRuntimeTarget, { recursive: true });
fs.cpSync(nodeRuntimeSource, nodeRuntimeTarget, { recursive: true, force: true });
