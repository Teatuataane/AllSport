import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

// The icon cache-buster (ICON_VERSION in components/EventIcon.tsx): a short
// hash of every event and domain icon, names and bytes. ASSET_CACHE below also
// applies to a 404, so a phone that probed an icon before it shipped keeps the
// 404 for a week; a new query string skips that cache entry. Derived here so it
// changes exactly when the icons do, instead of relying on a hand-bumped
// constant that the next icon batch might forget.
function iconVersion(): string {
  const hash = createHash("sha256")
  for (const dir of ["event-icons", "domain-icons"]) {
    const full = join(process.cwd(), "public", dir)
    for (const name of readdirSync(full).filter(f => f.endsWith(".png")).sort()) {
      hash.update(`${dir}/${name}\0`)
      hash.update(readFileSync(join(full, name)))
    }
  }
  return hash.digest("hex").slice(0, 10)
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: { NEXT_PUBLIC_ICON_VERSION: iconVersion() },
  // www.allsport.nz served the site as well, so Google indexed it as a second
  // site and kept its old favicon (the create-next-app Vercel triangle) in the
  // results. One permanent redirect folds it into allsport.nz.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.allsport.nz' }],
        destination: 'https://allsport.nz/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    // Both rule sets apply: Next runs every matching rule, and the security
    // headers and Cache-Control share no key, so the asset rules below add to
    // the site-wide security headers rather than replacing them.
    return [
      { source: '/:path*', headers: buildSecurityHeaders(supabaseUrl) },
      {
        source: '/:file(logo-hero-440.webp|logo-hero-880.webp|logo-mark.webp|favicon-32.png|icon-192.png|apple-touch-icon.png)',
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
