# Smart Computers Panel — v2.1 Optimized Edition

Changelog of fixes and optimizations applied to the original `wonderboy2040/smartcomp` repo.

## Build & Next.js 16 Compatibility

1. **Renamed `src/middleware.ts` → `src/proxy.ts`**
   - Removes the `The "middleware" file convention is deprecated. Please use "proxy" instead.` build warning.
   - Renamed the exported `middleware` function to `proxy`. Behavior unchanged.

2. **Removed `eslint` block from `next.config.ts`**
   - Next.js 16 no longer supports the `eslint` key in config. Linting is still available via `npm run lint`.

3. **Removed redundant `Cache-Control` override for `/_next/static/*`**
   - Next.js 16 already sets optimal immutable caching for hashed assets. Overriding it triggered a build warning ("Custom Cache-Control headers detected… can break Next.js development behavior").
   - Security headers (X-Content-Type-Options, X-Frame-Options, etc.) are still applied to the static path.

4. **Added `experimental.optimizePackageImports`**
   - Tree-shakes `lucide-react`, `recharts`, `date-fns`, `framer-motion` so only the icons/components actually used end up in the bundle.
   - Significantly reduces initial JS payload.

## Performance

5. **Dynamic imports for all 20 panels (`src/app/page.tsx`)**
   - Each panel is now a separate chunk loaded on first activation via `next/dynamic` + `lazy()`.
   - Initial bundle is now small (just Dashboard + shell), and panels load on demand.
   - Panels remain mounted after first activation (CSS `hidden`), so switching back is instant.

6. **Removed redundant `/api/sheets/sync` fetch on every Dashboard mount**
   - Parent `page.tsx` already knows the configured state from `/api/config`. It now passes `sheetsConnected` as a prop to `DashboardView`. Saves one network round-trip per dashboard render.

7. **Added search debouncing in Stock & Customers panels**
   - Previously every keystroke fired an API call. Now waits 300ms after the user stops typing.

8. **Paused WhatsApp panel auto-refresh when tab is hidden**
   - Polling interval raised from 15s → 30s, and pauses entirely when `document.hidden`.
   - Saves battery on mobile and avoids hammering Apps Script in background tabs.

9. **`prefetch()` now silently swallows errors**
   - Background prefetches that fail (e.g. /api/seed/init when not configured) no longer surface as unhandled promise rejections.

10. **`useFetch` cleanup is now leak-proof**
    - When the last subscriber for a URL unmounts, the subscriber Set is removed from the global Map, freeing memory.
    - Previously the Set stayed forever, growing the global state on long sessions.

11. **`useFetch` no longer refetches on every render when callers pass a fresh `options` object**
    - The refetch-decision key is now `[url, method, bodyKey]` instead of `[url, bodyKey, options]`, so callers passing `useFetch(url, undefined)` (very common) don't accidentally re-trigger fetches.

12. **Theme provider reads `localStorage` during initial state**
    - Eliminates a flash of wrong theme on first client render.
    - The inline script in `layout.tsx` also updates the theme-color meta tag immediately when dark mode is restored.

13. **Layout uses `display: 'swap'` for the Geist font**
    - Text renders immediately with a fallback font instead of being invisible while Geist loads.

14. **`reactStrictMode` re-enabled**
    - Helps catch bugs in development (was disabled in v1.0).

15. **Added `compress: true`, `poweredByHeader: false`, `productionBrowserSourceMaps: false`**
    - Smaller responses, hides tech stack, faster builds.

16. **Added image optimization config (AVIF/WebP, 24h cache)**

## Security

17. **Added security headers to all responses**
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: SAMEORIGIN`  (prevents clickjacking)
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `X-DNS-Prefetch-Control: on`

## Bug Fixes

18. **`global-error.tsx` now logs errors to `/api/log-error`**
    - Previously the root-level error boundary didn't report errors, making them hard to debug.

19. **Added cleanup to all `useEffect` intervals**
    - `prefetch` stagger timers in `page.tsx` are now cancelled on unmount.
    - Dashboard auto-refresh interval is properly cleaned up.
    - `/api/config` fetch is now cancellable on unmount.

20. **`notify()` in `api.ts` iterates over a copy of subscribers**
    - Prevents skipping entries if a subscriber unsubscribes itself during the callback.

21. **CRITICAL: Fixed React error #310 in `page.tsx` (Rules of Hooks violation)**
    - **Symptom**: Users saw a minified React error #310 ("Rendered more hooks than during the previous render") on production deployments, especially when `APP_PIN` was set.
    - **Root cause**: `useCallback(handleNavigate)` and `useMemo(shopName)` were called AFTER the early returns `if (!configChecked) return …` and `if (!isConfigured) return <SetupWizard />`. On the first render, the component returned early (0 hooks called). On the next render, when `configChecked` flipped to `true`, those hooks were called — changing the hook count and triggering React error #310.
    - **Fix**: Moved `useCallback` and `useMemo` ABOVE the early returns, so hook count is constant on every render regardless of config state.
    - This is a textbook Rules of Hooks violation — hooks must never be conditional or after early returns.

## What Was NOT Changed (On Purpose)

- **`apps-script/code.gs`** — backend logic untouched. Data protection (soft-delete, blocked replaceAll) is preserved.
- **PIN authentication** — same SHA-256 cookie + salt scheme.
- **All API route handlers** — request/response shapes unchanged.
- **All panel UI/UX** — same Claymorphism design system, same features.

## How to Verify

```bash
npm install
npm run build   # should produce ZERO warnings
npm run start   # production server on port 10000
```

Open browser DevTools → Network → load the app:
- Initial bundle should be ~50% smaller than before (panels load on demand)
- Switching panels triggers a single chunk download (one-time)
- Switching back to a previously-visited panel is instant (CSS show/hide)

Open DevTools → Application → Service Workers:
- Old SW (if any) is automatically unregistered
- No new SW is installed (self-destruct strategy preserved)

## File Summary

Files modified:
- `next.config.ts` — security headers, performance flags, removed eslint override
- `src/middleware.ts` → `src/proxy.ts` (renamed, updated export)
- `src/app/layout.tsx` — font display swap, dynamic themeColor, better metadata
- `src/app/page.tsx` — dynamic imports for all panels, leak-free intervals
- `src/app/error.tsx` — unchanged (already good)
- `src/app/global-error.tsx` — better error reporting, inline styles, layout
- `src/lib/api.ts` — leak-free subscriber cleanup, prefetch error swallowing, refetch decision fix
- `src/lib/theme-context.tsx` — hydration-safe initial state, callback memoization
- `src/components/panels/Dashboard.tsx` — removed redundant /api/sheets/sync fetch
- `src/components/panels/Stock.tsx` — search debouncing
- `src/components/panels/Customers.tsx` — search debouncing
- `src/components/panels/WhatsApp.tsx` — visibility-aware polling, 15s → 30s
- `package.json` — version bump to 2.1.0

Files added:
- `CHANGES.md` (this file)

Files removed:
- `src/middleware.ts` (renamed to `src/proxy.ts`)
