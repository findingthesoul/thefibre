import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([]);
  },
  // Hard rule §13 (inherited from The Fibre): no personal data in Vercel.
  // Flow's frontend never touches Supabase directly — all PII goes through
  // the Fibre API on Fly.io.
  // Router cache (2026-09-17): a page visited in the last half minute comes
  // back instantly on Back or a repeat click instead of re-rendering on the
  // server. Saves still refresh explicitly (router.refresh after a dialog),
  // so a stale list after a change is not a risk this introduces.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  // Connections has no /dashboard — its home is the root, which sends a
  // signed-in person on to the landscape. The shared SSO hop and a few
  // platform links still default to /dashboard (every other app has one), so
  // that address is caught here rather than answering 404. Sjoerd, 2026-09-14.
  async redirects() {
    return [{ source: '/dashboard', destination: '/', permanent: false }];
  },
};
export default nextConfig;
