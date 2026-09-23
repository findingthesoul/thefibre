import { securityHeaderRoutes } from '@thefibre/shared/security-headers';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers, one list for every app (packages/shared).
  async headers() {
    return securityHeaderRoutes([], process.env.VERCEL_ENV);
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
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      // The old address, kept alive. The app was renamed Connections →
      // Connect on 2026-09-21 and its host moved with it; this carries every
      // bookmark, every link in a sent email, and — the one that would
      // actually hurt — an installed home-screen app, whose start_url is
      // whatever host it was installed from.
      //
      // Both stacks, matched on host rather than written out twice, and the
      // path and query are carried across so a link to one person still
      // lands on that person.
      //
      // NOT `permanent`. A 308 is cached by browsers effectively for ever,
      // which is the right answer only once nobody can imagine wanting the
      // old name back. Upgrade it in a month; the cost of being wrong the
      // other way is a redirect nobody can clear from a phone.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'connections.thethread.app' }],
        destination: 'https://connect.thethread.app/:path*',
        permanent: false,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'connections.thefibre.tech' }],
        destination: 'https://connect.thefibre.tech/:path*',
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
