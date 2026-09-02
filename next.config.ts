import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Desktop (Electron) production builds use static export so the main process
// can load index.html directly via loadFile (no Node server needed; the
// Electron main process provides keepAlive/schedule via IPC instead of HTTP).
// Web preview/dev keeps "standalone" with full API routes.
//
// Detection: we check BOTH the BUILD_DESKTOP env var AND a marker file
// (.desktop-build.flag) because Windows shell env propagation through
// execSync(shell:true) has been unreliable.
const flagPath = path.join(process.cwd(), ".desktop-build.flag");
const isDesktopBuild = process.env.BUILD_DESKTOP === "1" || fs.existsSync(flagPath);

const nextConfig: NextConfig = {
  output: isDesktopBuild ? "export" : "standalone",
  // Static export can't optimize images server-side; use plain <img>.
  images: isDesktopBuild ? { unoptimized: true } : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;