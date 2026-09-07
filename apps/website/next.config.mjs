/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pure marketing surface: no personal data, no Supabase, no sessions.
  // The only fetch is the public plan catalogue (no PII) — hard rule §13
  // holds trivially here.
  experimental: {},
  async redirects() {
    return [
      // The old V3 app lived on this apex; sign-in links in the wild must
      // keep working after the cut (V3's next.config carried these — the
      // new site inherits the obligation).
      { source: '/login', destination: 'https://app.thethread.app', permanent: false },
      { source: '/signup', destination: 'https://app.thethread.app', permanent: false },
      // V3's features page becomes the workshop.
      { source: '/features', destination: '/workshop', permanent: true },
    ];
  },
};
export default nextConfig;
