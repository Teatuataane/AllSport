import type { NextConfig } from "next";

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
    return [
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
