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

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: '/:path*', headers: buildSecurityHeaders(supabaseUrl) }]
  },
};

export default nextConfig;
