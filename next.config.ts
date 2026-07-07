import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standard next build/start (most reliable on Render)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow larger request bodies for PDF generation
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // CRITICAL: clean up stale build artifacts so old chunks don't linger
  // and cause "This page couldn't load" after deploys
  cleanDistDir: true,
  // Ensure the service worker is served with the correct MIME type
  // and is not cached aggressively (so updates reach clients quickly).
  async headers() {
    return [
      {
        // HTML pages must NEVER be cached aggressively — always revalidate
        // so a new deploy is picked up on next navigation.
        source: "/((?!_next/static|_next/image|favicon.ico|icon-|apple-|sw.js|sw-register.js|manifest.json|offline.html|logo.svg).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/sw-register.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
