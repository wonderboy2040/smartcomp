import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: '.next',
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  cleanDistDir: true,
  generateEtags: true,
  crossOrigin: 'anonymous',
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline',
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    optimizePackageImports: ['lucide-react', 'recharts', 'zod', 'class-variance-authority'],
    optimizeCss: true,
    // REMOVED: ppr (requires canary)
    // REMOVED: turbo (deprecated, moved to root turbopack)
  },
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  serverExternalPackages: ['@whiskeysockets/baileys'],
  outputFileTracingIncludes: { '/api/apps-script-code': ['./apps-script/code.gs'] },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    const sec = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
    ];
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|icon-|apple-|sw.js|sw-register.js|manifest.json|offline.html|logo.svg|robots.txt|clear-cache.html).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Pragma', value: 'no-cache' }, { key: 'Expires', value: '0' }, ...sec],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }, ...sec],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }, ...sec],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }, { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }, ...sec],
      },
      {
        source: '/track/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=600' }, ...sec],
      },
    ];
  },
  async redirects() {
    return [{ source: '/admin', destination: '/', permanent: true }];
  },
};

export default nextConfig;
