import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([], process.env.VERCEL_ENV);
  },
  // Hard rule §13: no personal data in Vercel. API routes here may NOT
  // touch Supabase directly — proxy to the EU backend API instead.
  // Router cache (2026-09-17): a page visited in the last half minute comes
  // back instantly on Back or a repeat click instead of re-rendering on the
  // server. Saves still refresh explicitly (router.refresh after a dialog),
  // so a stale list after a change is not a risk this introduces.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
};
export default nextConfig;
