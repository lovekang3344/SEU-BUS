import type { NextConfig } from "next";

// Desktop (Electron) production builds use static export so the main process
// can load index.html directly via loadFile (no Node server needed; the
// Electron main process provides keepAlive/schedule via IPC instead of HTTP).
// Web preview/dev keeps "standalone" with full API routes.
const isDesktopBuild = process.env.BUILD_DESKTOP === "1";

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
