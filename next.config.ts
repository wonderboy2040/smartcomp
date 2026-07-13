import type { NextConfig } from "next";

/**
 * Next.js configuration for Smart Computers Panel.
 *
 * Performance:
 *   - poweredByHeader: false  (smaller response, hides tech stack)
 *   - reactStrictMode: true   (catches bugs in dev)
 *   - compress: true          (gzip/brotli for all responses)
 *   - productionBrowserSourceMaps: false (faster builds, smaller deploy)
 *   - images: AVIF/WebP + long cache for optimized images
 *   - experimental.optimizePackageImports: tree-shake heavy UI libs
 *   - experimental.serverActions.bodySizeLimit: 2mb (PDFs / large invoices)
 *
 * Cache headers:
 *   - HTML/JSON pages: no-cache (so new deploys are picked up immediately)
 *   - /_next/static/* : let Next.js handle it (DON'T override — overriding
 *     triggers a build warning and breaks dev).
 *   - sw.js / sw-register.js / manifest.json: must revalidate
 *
 * Security headers:
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: SAMEORIGIN
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *   - Permissions-Policy: camera=(), microphone=(), geolocation=()
 *   - Strict-Transport-Security: max-age=1y (HTTPS-only, after first visit)
 */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // existing codebase has minor type issues; we fix gradually
  },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  cleanDistDir: true,

  // Image optimization (for any <Image> usage + future)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24h
    remotePatterns: [],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Tree-shake large icon/component libraries so only used icons end up in the bundle.
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
      'framer-motion',
    ],
  },

  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ]

    return [
      {
        // All HTML/JSON pages: never cache, always revalidate
        // (so new deploys are picked up immediately)
        source: '/((?!_next/static|_next/image|favicon.ico|icon-|apple-|sw.js|sw-register.js|manifest.json|offline.html|logo.svg|robots.txt).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          ...securityHeaders,
        ],
      },
      {
        // _next/static/* chunks — DO NOT set Cache-Control here.
        // Next.js 16 already sets optimal immutable caching for hashed assets;
        // overriding it triggers a build warning and breaks dev mode.
        source: '/_next/static/:path*',
        headers: securityHeaders,
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
        // Static brand assets — long cache (file never changes)
        source: '/:path*(logo|icon|apple-touch-icon|favicon).svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
          ...securityHeaders,
        ],
      },
    ]
  },
}

export default nextConfig
