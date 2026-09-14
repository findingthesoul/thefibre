/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hard rule §13 (inherited from The Fibre): no personal data in Vercel.
  // Flow's frontend never touches Supabase directly — all PII goes through
  // the Fibre API on Fly.io.
  experimental: {},
  // Connections has no /dashboard — its home is the root, which sends a
  // signed-in person on to the landscape. The shared SSO hop and a few
  // platform links still default to /dashboard (every other app has one), so
  // that address is caught here rather than answering 404. Sjoerd, 2026-09-14.
  async redirects() {
    return [{ source: '/dashboard', destination: '/', permanent: false }];
  },
};
export default nextConfig;
