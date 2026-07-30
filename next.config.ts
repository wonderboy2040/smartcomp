import type { NextConfig } from "next";

/**
 * SmartComp v10.0 - Ultra Performance Configuration
 * Optimized for Next.js 15.5.x stable
 */

const nextConfig: NextConfig = {
  output: 'standalone',
  
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  cleanDistDir: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [],
    dangerouslyAllowSVG: true,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'zod',
    ],
  },

  // Server-side bundle optimization
  serverExternalPackages: ['@whiskeysockets/baileys'],

  outputFileTracingIncludes: {
    '/api/apps-script-code': ['./apps-script/code.gs'],
  },

  // Remove console.log in production (keep error/warn)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  async headers() {
    const securityHeaders = [
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
        source: '/((?!_next/static|_next/image|favicon.ico|icon-|apple-|sw.js|sw-register.js|manifest.json|offline.html|logo.svg|robots.txt).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          ...securityHeaders,
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ...securityHeaders,
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          ...securityHeaders,
        ],
      },
      {
        source: '/sw-register.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          ...securityHeaders,
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          ...securityHeaders,
        ],
      },
      {
        source: '/clear-cache.html',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          ...securityHeaders,
        ],
      },
      {
        source: '/:path*(logo|icon|apple-touch-icon|favicon).svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
          ...securityHeaders,
        ],
      },
      {
        source: '/track/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=600' },
          ...securityHeaders,
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
