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
};

export default nextConfig;
