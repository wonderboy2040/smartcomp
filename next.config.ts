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
  // Ensure the service worker is served with the correct MIME type
  // and is not cached aggressively (so updates reach clients quickly).
  async headers() {
    return [
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
