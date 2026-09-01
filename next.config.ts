import type { NextConfig } from "next";

// Desktop (Electron) production builds use "standalone" mode so API routes
// work within the Electron app (the main process starts the bundled Next.js
// server and loads the app via http://localhost).
// Web deployments also use "standalone" (suitable for Vercel, Docker, etc.).
const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
