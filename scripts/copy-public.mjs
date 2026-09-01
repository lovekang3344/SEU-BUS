/**
 * Cross-platform copy of `public/` → `out/` after a static export build.
 * Replaces the Unix-only `cp -r public out/`.
 *
 * Run automatically by `bun run build:desktop`. Pure Node, no deps.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log("→ copying public → out/public (for Electron static export)");
copyDir(path.join(root, "public"), path.join(root, "out"));
console.log("✓ done");
