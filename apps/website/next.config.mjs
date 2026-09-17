import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
// The Thread door comes from the shared registry (env override first, then
// production) — the same source every page uses. Needs packages/shared/dist
// built, which the website already requires for its pages.
import { appUrl } from '@thefibre/shared';

const THREAD_APP_URL = appUrl('the-thread', process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([]);
  },
  // Pure marketing surface: no personal data, no Supabase, no sessions.
  // The only fetch is the public plan catalogue (no PII) — hard rule §13
  // holds trivially here.
  // Router cache (2026-09-17): a page visited in the last half minute comes
  // back instantly on Back or a repeat click instead of re-rendering on the
  // server. Saves still refresh explicitly (router.refresh after a dialog),
  // so a stale list after a change is not a risk this introduces.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  async redirects() {
    return [
      // The old V3 app lived on this apex; sign-in links in the wild must
      // keep working after the cut (V3's next.config carried these — the
      // new site inherits the obligation).
      { source: '/login', destination: THREAD_APP_URL, permanent: false },
      { source: '/signup', destination: THREAD_APP_URL, permanent: false },
      // V3's features page becomes the workshop.
      { source: '/features', destination: '/workshop', permanent: true },
    ];
  },
};
export default nextConfig;
