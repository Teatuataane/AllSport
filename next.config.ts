import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/securityHeaders";

/**
 * The CSP's connect-src is derived from the env var rather than hardcoded, so
 * it can never go stale if the Supabase project ref changes. Next loads .env*
 * before evaluating this file, so it is available locally too.
 *
 * Failing loudly here is deliberate: without the URL the CSP would silently
 * omit Supabase from connect-src and the browser would block every API call at
 * runtime. The app is already non-functional without this var (every client
 * asserts it non-null), so an early build error is the kinder failure.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL is not set. It is required to build the ' +
      'Content-Security-Policy connect-src.'
  )
}

// Static assets under /public were being served with `max-age=0, must-revalidate`
// (the platform default), so every image revalidated on every visit — the logo
// plus ~10 event icons on the live-session screen, each costing a round trip on
// mobile latency. Hashed /_next/static assets already get `immutable` and are
// untouched here.
//
// Deliberately NOT `immutable`: these files are named by slug (deadlift.png), so
// a re-exported icon reuses its filename. A week of freshness plus a month of
// stale-while-revalidate gives repeat visitors zero-network loads while still
// letting a replaced icon roll out on its own. If an icon ever needs to land
// immediately, ship it under a new filename.
const ASSET_CACHE = 'public, max-age=604800, stale-while-revalidate=2592000'

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    // Both rule sets apply: Next runs every matching rule, and the security
    // headers and Cache-Control share no key, so the asset rules below add to
    // the site-wide security headers rather than replacing them.
    return [
      { source: '/:path*', headers: buildSecurityHeaders(supabaseUrl) },
      {
        source: '/:file(logo-hero-440.webp|logo-hero-880.webp|logo-mark.webp|favicon-32.png|apple-touch-icon.png)',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
      {
        source: '/event-icons/:path*',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
      {
        source: '/domain-icons/:path*',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
      {
        source: '/colour-emblems/:path*',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
    ]
  },
};

export default nextConfig;
