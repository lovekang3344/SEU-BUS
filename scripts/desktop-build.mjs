/**
 * Pre-build hook for desktop static export.
 *
 * Next.js `output: export` doesn't support API routes (they're dynamic).
 * Since the desktop app uses Electron IPC instead of HTTP for keepalive/
 * schedule, we temporarily hide the api/ folder during the static build,
 * then restore it afterwards.
 *
 * This script is invoked by `build:desktop`:
 *   node scripts/desktop-build.mjs   # hides api/, runs next build, restores api/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const apiBackup = path.join(root, ".api-backup-desktop-build");

function exists(p) { try { fs.existsSync(p); return true; } catch { return false; } }

let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  // Remove the desktop-build marker file (in case next build didn't clean it).
  try { fs.unlinkSync(path.join(root, ".desktop-build.flag")); } catch { /* ignore */ }
  if (fs.existsSync(apiBackup)) {
    if (fs.existsSync(apiDir)) {
      // api/ was recreated somehow; remove it first
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(apiBackup, apiDir);
    console.log("✓ restored src/app/api/");
  }
}

// Make sure we restore on any exit (success, error, signal).
process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(130); });
process.on("SIGTERM", () => { restore(); process.exit(143); });
process.on("uncaughtException", (e) => { console.error(e); restore(); process.exit(1); });

try {
  // 1. Move api/ aside.
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(apiBackup)) fs.rmSync(apiBackup, { recursive: true, force: true });
    fs.renameSync(apiDir, apiBackup);
    console.log("✓ temporarily moved src/app/api/ aside for static export");
  }

  // 2. Run next build with BUILD_DESKTOP=1.
  //    Create a marker file (.desktop-build.flag) because Windows env var
  //    propagation through execSync(shell:true) has been unreliable. The
  //    next.config.ts checks both the env var AND the marker file.
  const flagFile = path.join(root, ".desktop-build.flag");
  fs.writeFileSync(flagFile, "1", "utf8");
  console.log("→ created .desktop-build.flag marker");
  console.log("→ running: next build (BUILD_DESKTOP=1)");
  const buildEnv = { ...process.env, BUILD_DESKTOP: "1" };
  try {
    execSync("next build", {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: buildEnv,
    });
  } catch (e) {
    // Fallback: npx next build (in case `next` isn't on PATH directly).
    console.log("→ fallback: npx next build");
    execSync("npx next build", {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: buildEnv,
    });
  } finally {
    // Always remove the marker file (even if build failed).
    try { fs.unlinkSync(flagFile); } catch { /* ignore */ }
  }

  // 3. Copy public/ → out/ (for pet sprites etc.).
  console.log("→ copying public → out");
  import("./copy-public.mjs").catch(() => {
    // fallback inline copy if dynamic import fails
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
    copyDir(path.join(root, "public"), path.join(root, "out"));
  });

  console.log("✓ desktop build complete");
} catch (e) {
  console.error("✗ desktop build failed:", e.message);
  process.exit(1);
} finally {
  restore();
}