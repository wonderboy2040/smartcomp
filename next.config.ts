import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output for production deployment (Render, Vercel)
  output: "standalone",
  // Skip TypeScript errors during build (faster deploys)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  // Required for standalone output to work on Render
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
