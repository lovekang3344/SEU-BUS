/**
 * Cross-platform post-build copy for `next build` (standalone output).
 * Replaces the Unix-only `cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`.
 *
 * Run automatically by `bun run build`. Pure Node, no deps.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("⚠ source missing:", src);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log("→ copying .next/static → .next/standalone/.next/static");
copyDir(
  path.join(root, ".next", "static"),
  path.join(root, ".next", "standalone", ".next", "static")
);

console.log("→ copying public → .next/standalone/public");
copyDir(
  path.join(root, "public"),
  path.join(root, ".next", "standalone", "public")
);

console.log("✓ standalone build ready");
