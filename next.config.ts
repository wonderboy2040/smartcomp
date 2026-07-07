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
  cleanDistDir: true,
  // Headers — ensure HTML is never cached aggressively (so new deploys
  // are picked up immediately), but immutable hashed assets are cached forever.
  async headers() {
    return [
      {
        // All HTML/JSON pages: never cache, always revalidate
        source: "/((?!_next/static|_next/image|favicon.ico|icon-|apple-|sw.js|sw-register.js|manifest.json|offline.html|logo.svg|robots.txt).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        // _next/static/* chunks are content-hashed → safe to cache forever
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
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
        source: "/clear-cache.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
